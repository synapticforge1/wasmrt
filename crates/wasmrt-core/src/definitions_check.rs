//! Holds wasmrt's hand-kept instruction and feature tables to the workspace's shared definitions
//! (D1 / D2, generated into [`crate::definitions`] from binaryang by `scripts/definitions.ts`).
//!
//! Letters H8 (I5 opcode membership, I6 feature names) and H10 (the tables become generated copies;
//! a gate regenerates and diffs). wasmrt's instruction set is not one table — it is `define_ops!`,
//! the `0xFB`/`0xFC` dispatch in `opcode::decode_expr`, `decode_simd`'s ranges, `wat::lookup_simd`,
//! `wat::lookup_atomic`, and `features::op_feature` / `simd_sub_feature` — so this check reads all
//! of them through their real entry points rather than through any one list.
//!
//! For every D1 entry it builds a body from the entry's encoding, immediates synthesized from the
//! entry's immediate KINDS, and whatever structure the instruction needs around it, then asserts:
//!   1. **decode**: wasmrt decodes it as ONE instruction consuming EXACTLY those bytes — so wasmrt
//!      agrees on the count and width of every immediate (binaryang's own proof shape for D1);
//!   2. **name**: wasmrt's mnemonic for what it decoded is D1's;
//!   3. **feature**: wasmrt gates it with the feature D1 names (resolved through D2's CLI spelling,
//!      the same path `--features` takes).
//!
//! And in reverse, sweeping the whole encoding space:
//!   4. **membership**: nothing wasmrt accepts is absent from D1.
//!
//! D2 is checked both ways too: every D2 spelling wasmrt cannot resolve, and every wasmrt feature D2
//! does not list.
//!
//! A difference is a FINDING, not a test to relax. Each one that is classified (a recorded divergence
//! or a deliberate wasmrt choice) is listed in [`KNOWN`] with its reason, so the gate still fails on
//! anything new.

use alloc::format;
use alloc::string::String;
use alloc::vec;
use alloc::vec::Vec;

use alloc::string::ToString;

use crate::definitions::{OpDef, FEATURES, OPCODES, VERDICTS};
use crate::features::{op_feature, simd_sub_feature, Feature};
use crate::opcode::{decode_body, Imm, Op};
use crate::types::DecodeError;

/// Differences that are classified. `(check, key, reason)`; `key` is the D1 encoding in hex or the
/// D2 / wasmrt feature name. A KNOWN entry that stops occurring also fails the gate, so this list
/// cannot outlive the difference it excuses.
const KNOWN: &[(&str, &str, &str)] = &[
    // ---- the D1 table differs from wasm-tools; wasmrt agrees with wasm-tools (reported upstream) ----
    ("feature", "15",
     "return_call_ref: D1 gates it under tail-call. MEASURED 2026-10-23, wasm-tools 1.262: it needs \
      function-references ONLY (accepted with tail-call off; refused with function-references off, \
      'function references support is not enabled'), and wasmrt does exactly that. Reported to \
      binaryang through the workspace; the change flows source → copy."),
    // ---- naming conventions of the two TABLES; the bytes and the text forms agree ----
    ("name", "1c",
     "D1 names both select opcodes `select`. wasmrt's 0x1c carries the internal sentinel `select.t`, \
      which no source can spell; its text form is `select (result t)`, as in D1."),
    ("name", "fb 15", "D1 spells the nullable form `ref.test null`; wasmrt keeps one mnemonic and the \
      nullability in the RefType immediate. Same bytes; wasmrt's assembler reads `(ref null ht)`."),
    ("name", "fb 17", "as fb 15, for `ref.cast null`."),
    ("name", "fb 24", "as fb 15, for `ref.cast_desc_eq null`."),
    // ---- D2 vocabulary: what wasmrt's --features accepts (a CONTRACT surface, interop.md §2.2) ----
    ("d2-spelling", "satFloatToInt",
     "wasmrt accepts `saturating-float-to-int` and `nontrapping-float-to-int-conversions`, not \
      binaryang's `sat-float-to-int`. Adding it is a --features change, so it is coordinated first. \
      The gating itself agrees: see D2_ALIASES."),
    ("d2-membership", "nontrapping-float-to-int-conversions", "the same gap, seen from wasmrt's side."),
    ("d2-spelling", "mutableGlobals",
     "no wasmrt flag: importing/exporting mutable globals is always on (WebAssembly 2.0)."),
    ("d2-spelling", "annotations",
     "no wasmrt flag: custom annotations are always parsed (T13 track A shipped without a flag)."),
    ("d2-spelling", "codeMetadata", "no wasmrt flag: wasmrt does not implement code metadata."),
    ("d2-spelling", "compactImports",
     "no wasmrt flag; binaryang marks it implemented:false too. Whether wasmrt decodes the compact \
      import form is UNMEASURED."),
];

/// D2 features whose CLI spelling wasmrt does not accept (each has a `d2-spelling` KNOWN entry),
/// mapped to the wasmrt feature they are, so the per-op gating check still runs for their ops.
const D2_ALIASES: &[(&str, Feature)] = &[("satFloatToInt", Feature::SaturatingFloatToInt)];

fn leb(mut v: u32) -> Vec<u8> {
    let mut out = Vec::new();
    loop {
        let b = (v & 0x7f) as u8;
        v >>= 7;
        if v == 0 {
            out.push(b);
            return out;
        }
        out.push(b | 0x80);
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect::<Vec<_>>().join(" ")
}

/// The smallest well-formed bytes for one immediate kind (D1's `rules.immediates`).
fn imm_bytes(kind: &str, align: Option<u32>) -> Option<Vec<u8>> {
    Some(match kind {
        "blocktype" => vec![0x40],
        "labelidx" | "funcidx" | "typeidx" | "tableidx" | "memidx" | "globalidx" | "localidx"
        | "tagidx" | "dataidx" | "elemidx" | "fieldidx" | "u32" => vec![0x00],
        "laneidx" | "castflags" | "zerobyte" => vec![0x00],
        // align as log2 of the natural width, then offset 0.
        "memarg" => vec![align.unwrap_or(1).trailing_zeros() as u8, 0x00],
        "i32" | "i64" => vec![0x00],
        "f32" => vec![0; 4],
        "f64" => vec![0; 8],
        "v128" | "lane16" => vec![0; 16],
        "heaptype" => vec![0x70],
        "vec(labelidx)" | "vec(catch)" => vec![0x00],
        "vec(valtype)" => vec![0x01, 0x7f],
        _ => return None,
    })
}

/// What a decoded instruction is called by wasmrt, and the feature wasmrt gates it with.
fn wasmrt_view(op: Op, imm: &Imm, d1_name: &str) -> (Result<(), String>, Option<Feature>) {
    match (op, imm) {
        (Op::Simd, Imm::Simd(s)) => {
            let named = match crate::wat::lookup_simd(d1_name) {
                Some((sub, _)) if sub == s.sub => Ok(()),
                Some((sub, _)) => Err(format!("wasmrt spells 0x{sub:x} that way, not 0x{:x}", s.sub)),
                None => Err(String::from("wasmrt's assembler has no such SIMD mnemonic")),
            };
            (named, Some(simd_sub_feature(s.sub)))
        }
        (Op::Atomic, Imm::Atomic(a)) => {
            let named = match crate::wat::lookup_atomic(d1_name) {
                Some(sub) if sub == a.sub => Ok(()),
                Some(sub) => Err(format!("wasmrt spells 0x{sub:x} that way, not 0x{:x}", a.sub)),
                None => Err(String::from("wasmrt's assembler has no such atomic mnemonic")),
            };
            (named, op_feature(op))
        }
        _ => {
            let n = op.text_name();
            let named = if n == d1_name { Ok(()) } else { Err(format!("wasmrt calls it `{n}`")) };
            (named, op_feature(op))
        }
    }
}

/// Wrap one instruction in the structure it needs. Returns the body and the index of the
/// instruction under test in the decoded list.
fn body_for(e: &OpDef, instr: &[u8]) -> (Vec<u8>, usize) {
    let mut b = Vec::new();
    let idx = match (e.prefix, e.opcode) {
        // `end` is the body's own terminator.
        (None, 0x0b) => {
            b.extend_from_slice(instr);
            return (b, 0);
        }
        // `else` inside an `if`; legacy `catch` / `catch_all` inside a `try`.
        (None, 0x05) => { b.extend_from_slice(&[0x04, 0x40]); b.extend_from_slice(instr); b.push(0x0b); 1 }
        (None, 0x07 | 0x19) => { b.extend_from_slice(&[0x06, 0x40]); b.extend_from_slice(instr); b.push(0x0b); 1 }
        // `delegate` closes its `try` itself.
        (None, 0x18) => { b.extend_from_slice(&[0x06, 0x40]); b.extend_from_slice(instr); 1 }
        // Openers need their own `end`.
        (None, 0x02 | 0x03 | 0x04 | 0x06 | 0x1f) => { b.extend_from_slice(instr); b.push(0x0b); 0 }
        _ => { b.extend_from_slice(instr); 0 }
    };
    b.push(0x0b);
    (b, idx)
}

#[test]
fn wasmrt_agrees_with_the_shared_definitions() {
    let mut found: Vec<(&str, String, String)> = Vec::new();
    let d2_cli = |name: &str| FEATURES.iter().find(|f| f.name == name).map(|f| f.cli);

    // ---- 1–3: every D1 entry, decoded, named and gated by wasmrt ----
    for e in OPCODES {
        let key = hex(e.encoding);
        let mut instr = e.encoding.to_vec();
        let mut ok = true;
        for k in e.immediates {
            match imm_bytes(k, e.align) {
                Some(b) => instr.extend(b),
                None => {
                    found.push(("immediate-kind", key.clone(), format!("{}: D1 kind `{k}` unknown to this check", e.name)));
                    ok = false;
                }
            }
        }
        if !ok {
            continue;
        }
        let (body, idx) = body_for(e, &instr);
        let list = match decode_body(&body) {
            Ok(l) => l,
            Err(err) => {
                found.push(("decode", key, format!("{}: wasmrt refuses `{}` ({err:?})", e.name, hex(&body))));
                continue;
            }
        };
        let Some(got) = list.get(idx) else {
            found.push(("decode", key, format!("{}: decoded to {} instructions", e.name, list.len())));
            continue;
        };
        let end = list.get(idx + 1).map_or(body.len(), |n| n.offset as usize);
        let used = end - got.offset as usize;
        if used != instr.len() {
            found.push(("decode", key.clone(), format!("{}: wasmrt consumed {used} bytes, D1 says {}", e.name, instr.len())));
            continue;
        }
        let (named, feat) = wasmrt_view(got.op, &got.imm, e.name);
        if let Err(why) = named {
            found.push(("name", key.clone(), format!("D1 `{}`: {why}", e.name)));
        }
        let want = match e.feature {
            None => Ok(None),
            Some(f) => match d2_cli(f).and_then(Feature::from_name) {
                Some(w) => Ok(Some(w)),
                None => match D2_ALIASES.iter().find(|(n, _)| *n == f) {
                    Some(&(_, w)) => Ok(Some(w)),
                    None => Err(f),
                },
            },
        };
        match want {
            Ok(w) if w == feat => {}
            Ok(w) => found.push(("feature", key.clone(), format!("{}: D1 {:?}, wasmrt {:?}", e.name, w.map(Feature::name), feat.map(Feature::name)))),
            Err(f) => found.push(("feature", key.clone(), format!("{}: D1 feature `{f}` has no wasmrt flag", e.name))),
        }
    }

    // ---- 4: the reverse sweep — what wasmrt accepts that D1 does not list ----
    let in_d1 = |prefix: Option<u8>, op: u32| OPCODES.iter().any(|e| e.prefix == prefix && e.opcode == op);
    for b in 0u16..=0xff {
        let b = b as u8;
        if Op::from_u8(b).is_some() && !in_d1(None, u32::from(b)) {
            found.push(("membership", hex(&[b]), format!("wasmrt decodes 0x{b:02x} as `{}`; D1 has no such opcode", Op::from_u8(b).unwrap().text_name())));
        }
    }
    for (prefix, top) in [(0xfbu8, 0x7fu32), (0xfc, 0x7f), (0xfd, 0x1ff), (0xfe, 0x7f)] {
        for sub in 0..=top {
            let mut body = vec![prefix];
            body.extend(leb(sub));
            body.extend([0u8; 40]); // zero immediates: lane 0, align 0, index 0; then `unreachable`s
            let recognised = !matches!(decode_body(&body), Err(DecodeError::UnsupportedOpcode));
            let listed = in_d1(Some(prefix), sub);
            if recognised && !listed {
                found.push(("membership", hex(&body[..body.len() - 40]), String::from("wasmrt decodes it; D1 has no such opcode")));
            }
        }
    }

    // ---- D2 both ways ----
    for f in FEATURES {
        if Feature::from_name(f.cli).is_none() {
            found.push(("d2-spelling", String::from(f.name), format!("wasmrt's --features cannot resolve D2's `{}`", f.cli)));
        }
    }
    for w in Feature::ALL {
        if !FEATURES.iter().any(|f| Feature::from_name(f.cli) == Some(w)) {
            found.push(("d2-membership", String::from(w.name()), String::from("wasmrt has this feature; no D2 entry resolves to it")));
        }
    }

    // ---- D3 both ways: the `.wast` runner's trap vocabulary (`wast::TRAP_VERDICTS`) ----
    // Each D3 message must be in the table AND classify to a verdict whose name is D3's key (so a
    // message mapped to the WRONG verdict is a finding too); and the table holds nothing D3 lacks.
    // Every message the vendored spec suite uses is one of D3's (measured 2026-10-24: 5,267
    // assertions, 20 messages, plus `bulk.wast`'s "uninitialized element 2", a prefix match).
    for v in VERDICTS {
        let key = || format!("{}:{}", v.verdict, v.key);
        match crate::wast::TRAP_VERDICTS.iter().find(|(m, _)| *m == v.message) {
            None => found.push(("d3-membership", key(), format!("D3's `{}` is not in wast::TRAP_VERDICTS", v.message))),
            Some((_, verdict)) => {
                let want: String = v.key.split('-').map(|w| {
                    let mut c = w.chars();
                    c.next().map(|f| f.to_ascii_uppercase().to_string() + c.as_str()).unwrap_or_default()
                }).collect();
                let got = format!("{verdict:?}");
                if !got.eq_ignore_ascii_case(&want) {
                    found.push(("d3-verdict", key(), format!("`{}` classifies as {got}, D3's key names {want}", v.message)));
                }
            }
        }
    }
    for (m, _) in crate::wast::TRAP_VERDICTS {
        if !VERDICTS.iter().any(|v| v.message == *m) {
            found.push(("d3-membership", String::from(*m), String::from("in wast::TRAP_VERDICTS; D3 has no such message")));
        }
    }

    // ---- verdict ----
    let unexplained: Vec<_> = found.iter().filter(|(c, k, _)| !KNOWN.iter().any(|(kc, kk, _)| kc == c && kk == k)).collect();
    let stale: Vec<_> = KNOWN.iter().filter(|(kc, kk, _)| !found.iter().any(|(c, k, _)| c == kc && k == kk)).collect();
    let mut report = String::new();
    for (c, k, why) in &unexplained {
        report.push_str(&format!("  [{c}] {k}: {why}\n"));
    }
    for (c, k, why) in &stale {
        report.push_str(&format!("  [STALE KNOWN] [{c}] {k}: {why} — no longer occurs; remove it\n"));
    }
    assert!(
        unexplained.is_empty() && stale.is_empty(),
        "wasmrt vs binaryang {} D1/D2: {} unexplained difference(s), {} stale KNOWN entr(ies)\n{report}",
        crate::definitions::SOURCE_TAG,
        unexplained.len(),
        stale.len()
    );
}
