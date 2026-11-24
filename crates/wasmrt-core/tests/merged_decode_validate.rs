//! **One pass, the same verdicts** (owner, 2026-11-24: "merge the decoding with validation").
//!
//! `module::decode_validated` reads a module's structure, validates every section outside the code,
//! then decodes each function body an instruction at a time, checking each as it is read. It must accept
//! EXACTLY what `decode` followed by `validate_with_features` accepts, and produce the same `Module`;
//! only which fault is reported first may differ. Checked over the behaviour corpus, each module whole and
//! with thousands of one-byte corruptions, under every proposal and under `wasm1`.

use std::path::Path;
use wasmrt_core::features::Features;
use wasmrt_core::module::{decode, decode_validated};
use wasmrt_core::validate::validate_with_features;

fn corpus() -> Vec<Vec<u8>> {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/behaviour");
    let mut files: Vec<_> = std::fs::read_dir(&dir)
        .expect("tests/behaviour")
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "wasm"))
        .collect();
    files.sort();
    assert!(files.len() > 20, "the corpus is missing: {}", dir.display());
    files.iter().map(|p| std::fs::read(p).expect("read")).collect()
}

/// Whether both accepted (`true`) or both refused (`false`); panics where they differ.
fn agree(bytes: &[u8], features: &Features, what: &str) -> bool {
    let two = decode(bytes).ok().filter(|m| validate_with_features(m, features).is_ok());
    let one = decode_validated(bytes, features).ok();
    match (&two, &one) {
        (Some(a), Some(b)) => {
            assert_eq!(a, b, "{what}: both accept, different modules");
            true
        }
        (None, None) => false,
        _ => panic!("{what}: two passes {}, one pass {}", two.is_some(), one.is_some()),
    }
}

/// The case the one pass exists for: a body ill-typed at one byte (`i32.add` on an empty stack, offset
/// 23) and malformed at the next (`0xff`, offset 24). wasm-tools 1.263 (wasmparser, as wasmtime) reports
/// "type mismatch: expected i32 but nothing on stack (at offset 0x17)"; reading the whole body first
/// reported the illegal opcode at 24.
#[test]
fn an_ill_typed_instruction_is_reported_before_a_later_malformed_one() {
    let bytes = [
        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // magic, version
        0x01, 0x04, 0x01, 0x60, 0x00, 0x00, // type: [] -> []
        0x03, 0x02, 0x01, 0x00, // func 0: type 0
        0x0a, 0x06, 0x01, 0x04, 0x00, 0x6a, 0xff, 0x0b, // code: no locals; i32.add, 0xff, end
    ];
    match decode_validated(&bytes, &Features::all()) {
        Err(wasmrt_core::module::LoadError::Invalid(_)) => {}
        other => panic!("expected the type error, got {other:?}"),
    }
    assert_eq!(wasmrt_core::validate::last_failure_site().offset, Some(23));
    // …in wasmtime's words
    assert_eq!(
        wasmrt_core::validate::last_failure_message().as_deref(),
        Some("type mismatch: expected i32 but nothing on stack")
    );
    // the two-pass read still meets the malformed byte first
    assert_eq!(decode(&bytes), Err(wasmrt_core::types::DecodeError::IllegalOpcode(0xff)));
}

/// Review round 1 (2026-11-24), each answer measured with wasm-tools 1.263, on BOTH paths: an `if` whose param is
/// a subtype of its result needs no `else` (equality refused it); `array.new_fixed` in unreachable code takes as
/// many operands as it names (a length bound refused it on the two-pass path, B1); a missing `else` that leaves
/// the result unproduced is refused in wasmtime's words.
#[test]
fn review_round_one_cases() {
    let asm = |s: &str| wasmrt_core::wat::assemble(s.as_bytes()).expect("assemble");
    let valid = [
        "(module (type $t (struct)) (func (param (ref $t)) (result (ref null $t)) local.get 0 i32.const 1 if (param (ref $t)) (result (ref null $t)) end))",
        "(module (type $a (array i32)) (func (result (ref $a)) unreachable array.new_fixed $a 6))",
    ];
    for w in valid {
        let b = asm(w);
        assert!(decode_validated(&b, &Features::all()).is_ok(), "one pass refuses {w}");
        let m = decode(&b).expect("decode");
        assert!(validate_with_features(&m, &Features::all()).is_ok(), "two passes refuse {w}");
    }
    let b = asm("(module (func (result i32) i32.const 1 if (result i32) end))");
    assert!(decode_validated(&b, &Features::all()).is_err());
    assert_eq!(
        wasmrt_core::validate::last_failure_message().as_deref(),
        Some("type mismatch: expected i32 but nothing on stack")
    );
    assert_eq!(wasmrt_core::validate::last_failure_site().offset, Some(28));
}

#[test]
fn one_pass_accepts_what_two_passes_accept() {
    let sets = [("all", Features::all()), ("wasm1", Features::from_preset("wasm1").expect("wasm1"))];
    // a fixed LCG: the same corruptions every run
    let mut seed: u64 = 0x2026_1124;
    let mut next = || {
        seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1_442_695_040_888_963_407);
        (seed >> 33) as usize
    };
    let (mut accepted, mut refused) = (0, 0);
    for (n, original) in corpus().iter().enumerate() {
        for (name, f) in &sets {
            let whole = agree(original, f, &format!("file {n} under {name}"));
            assert!(whole || *name != "all", "file {n} is part of the corpus, so valid under all");
            for c in 0..60 {
                let mut b = original.clone();
                let at = 8 + next() % (b.len() - 8);
                b[at] = (next() & 0xff) as u8;
                if agree(&b, f, &format!("file {n}, corruption {c} (byte {at}) under {name}")) {
                    accepted += 1;
                } else {
                    refused += 1;
                }
            }
        }
    }
    // Both verdicts must be well represented, or the comparison proves little.
    // (measured 2026-11-24: 742 accepted, 7,778 refused)
    assert!(accepted > 500 && refused > 5_000, "accepted {accepted}, refused {refused}");
    println!("accepted {accepted}, refused {refused}");
}
