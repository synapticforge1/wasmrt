#!/usr/bin/env bun
// definitions.ts — wasmrt's GENERATED copy of the workspace's shared definitions (letter H10).
//
//   bun scripts/definitions.ts                    verify the pinned source, write the Rust copy
//   bun scripts/definitions.ts --check            verify, regenerate in memory, diff; exit 1 on drift
//   bun scripts/definitions.ts fetch <tag> <commit>   re-pin: download the source from GitHub
//
// The SOURCE is binaryang's `src/definitions/{opcodes,features,verdicts}.json` (D1 instructions,
// D2 features, D3 verdicts; `../cmem/divergences.md`, "The shared definitions"). It is vendored at
// a PUBLISHED tag in `definitions/binaryang/`, so a clone builds and checks without binaryang
// present, and `definitions/binaryang/PIN.json` records where it came from.
//
// Every run verifies the source before using it, two ways:
//   1. each file's own `sha256` header: SHA-256 of the canonical JSON (keys sorted, no whitespace)
//      with that field emptied — binaryang's rule, reproduced here (`canonical` below);
//   2. each file's git blob id against PIN.json, so a vendored file cannot be edited by hand.
// The copy is `crates/wasmrt-core/src/definitions.rs`. Editing it by hand is a DEFECT (H10): change
// flows source → copy, and `--check` fails on any difference.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";

const ROOT = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const SRC_DIR = join(ROOT, "definitions", "binaryang");
const PIN = join(SRC_DIR, "PIN.json");
const OUT = join(ROOT, "crates", "wasmrt-core", "src", "definitions.rs");
const FILES = ["opcodes", "features", "verdicts"] as const;
const REPO = "synapticforge1/binaryang";

type Pin = { source: string; tag: string; commit: string; files: Record<string, { blob: string; sha256: string }> };

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}
const contentHash = (src: Record<string, unknown>) =>
  createHash("sha256").update(canonical({ ...src, sha256: "" })).digest("hex");
const gitBlob = (bytes: Buffer) =>
  createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest("hex");

function fail(msg: string): never {
  console.error(`definitions: ${msg}`);
  process.exit(1);
}

// ---- fetch ---------------------------------------------------------------------------------------
if (process.argv[2] === "fetch") {
  const [tag, commit] = process.argv.slice(3);
  if (!tag || !/^[0-9a-f]{40}$/.test(commit ?? "")) fail("usage: fetch <tag> <40-hex commit>");
  // The tag must name that commit on GitHub, so the pin is a PUBLISHED version, not a local one.
  const ls = spawnSync("git", ["ls-remote", `https://github.com/${REPO}.git`, `refs/tags/${tag}`, `refs/tags/${tag}^{}`], { encoding: "utf8" });
  const shas = ls.stdout.trim().split("\n").map((l) => l.split("\t")[0]);
  if (!shas.includes(commit)) fail(`tag ${tag} on GitHub is ${shas.join(", ") || "absent"}, not ${commit}`);
  mkdirSync(SRC_DIR, { recursive: true });
  const pin: Pin = { source: `https://github.com/${REPO}`, tag, commit, files: {} };
  for (const f of FILES) {
    const url = `https://raw.githubusercontent.com/${REPO}/${commit}/src/definitions/${f}.json`;
    const r = await fetch(url);
    if (!r.ok) fail(`${url}: HTTP ${r.status}`);
    const bytes = Buffer.from(await r.arrayBuffer());
    const json = JSON.parse(bytes.toString("utf8"));
    if (contentHash(json) !== json.sha256) fail(`${f}.json: header sha256 does not match its content`);
    writeFileSync(join(SRC_DIR, `${f}.json`), bytes);
    pin.files[f] = { blob: gitBlob(bytes), sha256: json.sha256 };
  }
  writeFileSync(PIN, JSON.stringify(pin, null, 2) + "\n");
  console.log(`pinned ${REPO} ${tag} (${commit.slice(0, 12)})`);
  process.exit(0);
}

// ---- verify the vendored source ------------------------------------------------------------------
const pin: Pin = JSON.parse(readFileSync(PIN, "utf8"));
const src: Record<string, any> = {};
for (const f of FILES) {
  const bytes = readFileSync(join(SRC_DIR, `${f}.json`));
  if (gitBlob(bytes) !== pin.files[f].blob) fail(`${f}.json is not the pinned file (blob ${gitBlob(bytes)}, pin ${pin.files[f].blob})`);
  const json = JSON.parse(bytes.toString("utf8"));
  if (contentHash(json) !== json.sha256 || json.sha256 !== pin.files[f].sha256) fail(`${f}.json: content hash mismatch`);
  src[f] = json;
}

// ---- generate ------------------------------------------------------------------------------------
/** A Rust string literal: escapes `\` and `"`, writes anything outside printable ASCII as `\u{…}`. */
const rs = (s: string) =>
  `"${[...s].map((ch) => {
    const c = ch.codePointAt(0)!;
    if (ch === "\\" || ch === '"') return `\\${ch}`;
    return c >= 0x20 && c < 0x7f ? ch : `\\u{${c.toString(16)}}`;
  }).join("")}"`;
const opt = (v: string | null | undefined) => (v == null ? "None" : `Some(${rs(v)})`);
const strs = (xs: string[]) => `&[${xs.map(rs).join(", ")}]`;
const bytesOf = (hex: string) => hex.trim().split(/\s+/).map((b) => `0x${b}`).join(", ");

const header = (d: any, f: string) => `/// ${d.definition}: ${d.title}. dataVersion ${d.dataVersion}, sha256 \`${d.sha256}\` (\`${f}.json\`).`;
let out = `// SPDX-License-Identifier: Apache-2.0
// Data derived from WebAssembly/wabt (Copyright 2016 WebAssembly Community Group participants,
// Apache-2.0), by way of binaryang's shared definitions; re-expressed as Rust constants by wasmrt's
// \`scripts/definitions.ts\`. See third_party/LICENSES.md and third_party/wabt/LICENSE.

//! ⚠️ GENERATED by \`scripts/definitions.ts\` — DO NOT EDIT. Editing this file by hand is a DEFECT
//! (workspace letter H10): change the source in binaryang, re-pin, regenerate.
//!
//! Source: ${pin.source} at tag \`${pin.tag}\`, commit \`${pin.commit}\`, vendored in
//! \`definitions/binaryang/\` and verified by content hash and git blob id on every run.
//! \`bun scripts/definitions.ts --check\` regenerates this file and fails on any difference.
//!
//! Compiled for tests only (\`lib.rs\`): the cross-check in \`definitions_check.rs\` holds wasmrt's
//! hand-kept opcode and feature tables to it, so it adds nothing to any shipped artifact.
#![allow(dead_code)]

/// One WebAssembly instruction (D1).
#[derive(Debug, Clone, Copy)]
pub struct OpDef {
    /// The text mnemonic, as binaryang prints it (may carry a form: \`ref.test null\`).
    pub name: &'static str,
    /// The opcode bytes: prefix and LEB128 sub-opcode.
    pub encoding: &'static [u8],
    /// \`None\`, or the prefix byte.
    pub prefix: Option<u8>,
    /// The single byte, or the sub-opcode after the prefix.
    pub opcode: u32,
    /// Immediate kinds, in binary order.
    pub immediates: &'static [&'static str],
    /// Memory access width in bytes, for an instruction with a memarg.
    pub align: Option<u32>,
    /// Fixed stack signature (operands bottom-first, results), or \`None\`.
    pub signature: Option<(&'static [&'static str], &'static [&'static str])>,
    /// The D2 feature (its \`name\`) that gates it; \`None\` for core.
    pub feature: Option<&'static str>,
    /// Coarse class.
    pub class: &'static str,
}

/// One WebAssembly feature or proposal (D2).
#[derive(Debug, Clone, Copy)]
pub struct FeatureDef {
    pub name: &'static str,
    /// The \`--enable-<cli>\` spelling.
    pub cli: &'static str,
    pub default_on: bool,
    pub implemented: bool,
    pub testsuite_dirs: &'static [&'static str],
    pub only_in: &'static [&'static str],
    pub off_in: &'static [&'static str],
    pub since: &'static str,
}

/// One verdict class (D3).
#[derive(Debug, Clone, Copy)]
pub struct VerdictDef {
    pub verdict: &'static str,
    pub key: &'static str,
    /// The testsuite's text, exactly.
    pub message: &'static str,
}

pub const SOURCE_TAG: &str = ${rs(pin.tag)};
pub const SOURCE_COMMIT: &str = ${rs(pin.commit)};

${header(src.opcodes, "opcodes")}
pub const OPCODES: &[OpDef] = &[
`;
for (const e of src.opcodes.entries) {
  const sig = e.signature ? `Some((${strs(e.signature.params)}, ${strs(e.signature.results)}))` : "None";
  out += `    OpDef { name: ${rs(e.name)}, encoding: &[${bytesOf(e.encoding)}], prefix: ${e.prefix == null ? "None" : `Some(${e.prefix})`}, ` +
    `opcode: ${e.opcode}, immediates: ${strs(e.immediates)}, align: ${e.align == null ? "None" : `Some(${e.align})`}, ` +
    `signature: ${sig}, feature: ${opt(e.feature)}, class: ${rs(e.class)} },\n`;
}
out += `];

${header(src.features, "features")}
pub const FEATURES: &[FeatureDef] = &[
`;
for (const e of src.features.entries) {
  out += `    FeatureDef { name: ${rs(e.name)}, cli: ${rs(e.cli)}, default_on: ${e.defaultOn}, implemented: ${e.implemented}, ` +
    `testsuite_dirs: ${strs(e.testsuiteDirs)}, only_in: ${strs(e.onlyIn ?? [])}, off_in: ${strs(e.offIn ?? [])}, since: ${rs(e.since)} },\n`;
}
out += `];

${header(src.verdicts, "verdicts")}
pub const VERDICTS: &[VerdictDef] = &[
`;
for (const e of src.verdicts.entries) out += `    VerdictDef { verdict: ${rs(e.verdict)}, key: ${rs(e.key)}, message: ${rs(e.message)} },\n`;
out += "];\n";

// ---- the SHIPPED tables (H10 step 2): generated from D1, keyed on wasmrt's own `Op` ------------
// Owner, 2026-10-24: shipping D1-derived data is cleared, with the wabt attribution it carries
// (NOTICE); binaryang's future rewrite of its tables addresses the provenance.
const TABLES_OUT = join(ROOT, "crates", "wasmrt-core", "src", "tables.rs");
const opcodeRs = readFileSync(join(ROOT, "crates", "wasmrt-core", "src", "opcode.rs"), "utf8");
const featuresRs = readFileSync(join(ROOT, "crates", "wasmrt-core", "src", "features.rs"), "utf8");

// wasmrt's `Op` variants, from the one `define_ops!` invocation: `Variant = value => "text name"`.
const opsAt = opcodeRs.indexOf("define_ops! {\n    wire {");
if (opsAt < 0) fail("opcode.rs: no `define_ops! { wire {` invocation");
const opsBody = opcodeRs.slice(opsAt, opcodeRs.indexOf("\n}\n", opsAt));
const internalAt = opsBody.indexOf("internal {");
const grabOps = (s: string) => [...s.matchAll(/(\w+)\s*=\s*(0x[0-9a-fA-F]+|\d+)\s*=>\s*"([^"]*)"/g)].map((m) => ({ variant: m[1], value: Number(m[2]), name: m[3] }));
const wireOps = grabOps(opsBody.slice(0, internalAt));
const internalOps = grabOps(opsBody.slice(internalAt));

// D2 name → wasmrt `Feature` variant, through `Feature::from_name` — the path `--features` takes —
// whose arms are `"a" | "b" => Feature::X`, matched after lowercasing and `-` → `_`.
const fromAt = featuresRs.indexOf("pub fn from_name(s: &str)");
if (fromAt < 0) fail("features.rs: no `Feature::from_name`");
const fromBody = featuresRs.slice(fromAt, featuresRs.indexOf("_ => return None", fromAt));
const spellings = new Map<string, string>();
for (const m of fromBody.matchAll(/((?:"[a-z0-9_]+"\s*\|\s*)*"[a-z0-9_]+")\s*=>\s*\{?\s*Feature::(\w+)/g)) {
  for (const s of m[1].matchAll(/"([a-z0-9_]+)"/g)) spellings.set(s[1], m[2]);
}
if (spellings.size < 10) fail(`features.rs: parsed only ${spellings.size} from_name spellings`);
/** D2 spellings wasmrt's `--features` does not take yet (contract v32: migrate once, at FL1). */
const D2_ALIASES: Record<string, string> = { satFloatToInt: "SaturatingFloatToInt" };
function featureVariant(d2name: string): string {
  if (D2_ALIASES[d2name]) return D2_ALIASES[d2name];
  const cli = src.features.entries.find((f: any) => f.name === d2name)?.cli as string | undefined;
  const variant = cli ? spellings.get(cli.toLowerCase().replace(/-/g, "_")) : undefined;
  if (!variant) fail(`D2 feature \`${d2name}\` (cli \`${cli}\`) maps to no wasmrt Feature`);
  return variant;
}

/** Where wasmrt deliberately differs from D1, each with its measured reason. A stale entry fails. */
const OVERRIDES: Record<string, { feature: string; d1: string; why: string }> = {
  return_call_ref: {
    feature: "FunctionReferences", d1: "tailCall",
    why: "wasm-tools 1.262 gates it on function-references ONLY (measured 2026-10-23); D1's single column says tail-call. Reported to binaryang.",
  },
};

const d1 = src.opcodes.entries as any[];
const strip = (n: string) => n.replace(/ null$/, "");
const arms: string[] = [];
const variantFeature = new Map<string, string | null>();
const assign = (variant: string, feature: string | null, why: string) => {
  if (variantFeature.has(variant) && variantFeature.get(variant) !== feature) fail(`${variant}: D1 forms disagree on the feature (${variantFeature.get(variant)} vs ${feature})`);
  if (!variantFeature.has(variant)) { variantFeature.set(variant, feature); arms.push(`        Op::${variant} => ${feature ? `Some(Feature::${feature})` : "None"},${why ? ` // ${why}` : ""}`); }
};
const featureOf = (e: any): [string | null, string] => {
  const o = OVERRIDES[e.name];
  if (o) {
    if (e.feature !== o.d1) fail(`OVERRIDES.${e.name} is stale: D1 now says \`${e.feature}\`, not \`${o.d1}\` — remove the override`);
    return [o.feature, `override: ${o.why}`];
  }
  return [e.feature ? featureVariant(e.feature) : null, ""];
};
for (const w of wireOps) {
  const e = d1.find((x) => x.prefix === null && x.opcode === w.value);
  if (!e) fail(`Op::${w.variant} = 0x${w.value.toString(16)} is in no D1 single-byte entry`);
  const [f, why] = featureOf(e);
  assign(w.variant, f, why);
}
const familyOf: Record<string, string> = { Simd: "0xfd", Atomic: "0xfe" };
for (const i of internalOps) {
  if (i.name === "") {
    const prefix = familyOf[i.variant];
    if (!prefix) fail(`Op::${i.variant} has no text name and is not a known family tag`);
    const feats = [...new Set(d1.filter((x) => x.prefix === prefix).map((x) => x.feature))];
    // The family's FLOOR: its base feature. `simd_sub_feature` refines 0xFD by sub-opcode.
    const base = prefix === "0xfd" ? "simd" : "threads";
    if (!feats.includes(base)) fail(`family ${prefix}: D1 has no \`${base}\` entry`);
    if (prefix === "0xfe" && feats.length !== 1) fail(`family 0xfe: D1 features ${feats.join(", ")}; the tag has one`);
    if (prefix === "0xfd" && feats.some((f) => f !== "simd" && f !== "relaxedSimd")) fail(`family 0xfd: unexpected features ${feats.join(", ")}`);
    assign(i.variant, featureVariant(base), prefix === "0xfd" ? "family floor; simd_sub_feature refines by sub-opcode" : "");
    continue;
  }
  const es = d1.filter((x) => (x.prefix === "0xfb" || x.prefix === "0xfc") && strip(x.name) === i.name);
  if (!es.length) fail(`Op::${i.variant} ("${i.name}") is in no D1 0xFB/0xFC entry`);
  for (const e of es) { const [f, why] = featureOf(e); assign(i.variant, f, why); }
}
// Every D1 instruction must have been reached: nothing in D1 is left without a wasmrt op.
for (const e of d1.filter((x) => x.prefix === null || x.prefix === "0xfb" || x.prefix === "0xfc")) {
  const hit = e.prefix === null ? wireOps.some((w) => w.value === e.opcode) : internalOps.some((i) => i.name === strip(e.name));
  if (!hit) fail(`D1 \`${e.name}\` maps to no wasmrt Op`);
}

const simdImm = (imm: string[]) => {
  const k = JSON.stringify(imm);
  const m: Record<string, string> = { "[]": "N", '["memarg"]': "Mem", '["v128"]': "Const", '["lane16"]': "Shuffle", '["laneidx"]': "Lane", '["memarg","laneidx"]': "MemLane" };
  if (!m[k]) fail(`no SimdImm for D1 immediates ${k}`);
  return m[k];
};
const simd = d1.filter((x) => x.prefix === "0xfd");
const relaxed = simd.filter((x) => x.feature === "relaxedSimd").map((x) => x.opcode).sort((a, b) => a - b);
const atomics = d1.filter((x) => x.prefix === "0xfe");
const hex = (n: number) => `0x${n.toString(16).padStart(2, "0")}`;

const tables = `// SPDX-License-Identifier: Apache-2.0
// Data derived from WebAssembly/wabt (Copyright 2016 WebAssembly Community Group participants,
// Apache-2.0), by way of binaryang's shared definitions; re-expressed as Rust tables by wasmrt's
// \`scripts/definitions.ts\`. See NOTICE, third_party/LICENSES.md and third_party/wabt/LICENSE.

//! ⚠️ GENERATED by \`scripts/definitions.ts\` — DO NOT EDIT. Editing this file by hand is a DEFECT
//! (workspace letter H10): change the source in binaryang, re-pin, regenerate.
//!
//! The SHIPPED instruction tables, from binaryang's D1 at tag \`${pin.tag}\` (commit
//! \`${pin.commit.slice(0, 12)}\`), keyed on wasmrt's own [\`Op\`] variants as \`define_ops!\` declares
//! them. \`bun scripts/definitions.ts --check\` regenerates this file and fails on any difference.

use crate::features::Feature;
use crate::opcode::Op;
use crate::wat::SimdImm;

/// The proposal an opcode belongs to, or \`None\` for WebAssembly 1.0 core. **EXHAUSTIVE over
/// [\`Op\`]**: there is no catch-all, so an op added to \`define_ops!\` without a D1 entry fails the
/// generator, and one added without regenerating fails the BUILD.
#[must_use]
pub(crate) const fn op_feature(op: Op) -> Option<Feature> {
    match op {
${arms.join("\n")}
    }
}

/// The \`0xFD\` sub-opcodes that are relaxed SIMD (D1 \`relaxedSimd\`); every other one is SIMD.
#[must_use]
pub(crate) const fn is_relaxed_simd(sub: u32) -> bool {
    matches!(sub, ${hex(relaxed[0])}..=${hex(relaxed[relaxed.length - 1])})
}

/// Lowest and highest relaxed-SIMD sub-opcode.
pub(crate) const RELAXED_SIMD_FIRST: u32 = ${hex(relaxed[0])};
pub(crate) const RELAXED_SIMD_LAST: u32 = ${hex(relaxed[relaxed.length - 1])};

/// Every \`0xFD\` mnemonic with its sub-opcode and immediate shape (${simd.length} entries).
pub(crate) const SIMD_OPS: &[(&str, u32, SimdImm)] = {
    use SimdImm::{Const, Lane, Mem, MemLane, None as N, Shuffle};
    &[
${simd.map((e) => `        (${rs(e.name)}, ${hex(e.opcode)}, ${simdImm(e.immediates)}),`).join("\n")}
    ]
};

/// Every \`0xFE\` mnemonic with its sub-opcode (${atomics.length} entries).
pub(crate) const ATOMIC_OPS: &[(&str, u32)] = &[
${atomics.map((e) => `    (${rs(e.name)}, ${hex(e.opcode)}),`).join("\n")}
];
`;
// Contiguity of the relaxed range is an assumption the public constants rest on.
if (relaxed.some((v, i) => v !== relaxed[0] + i)) fail(`relaxed-SIMD sub-opcodes are not contiguous: ${relaxed.map(hex).join(" ")}`);

const outputs: [string, string, string][] = [[OUT, out, "crates/wasmrt-core/src/definitions.rs"], [TABLES_OUT, tables, "crates/wasmrt-core/src/tables.rs"]];
if (process.argv.includes("--check")) {
  for (const [path, want, name] of outputs) {
    let current = "";
    try { current = readFileSync(path, "utf8"); } catch { fail(`${name} is missing — run without --check`); }
    if (current !== want) fail(`${name} differs from what the pinned source generates (hand-edited, the pin moved, or define_ops!/Feature::name() changed). Regenerate: bun scripts/definitions.ts`);
  }
  console.log(`definitions: PASSED — copies match ${pin.tag} (${src.opcodes.entries.length} instructions, ${src.features.entries.length} features, ${src.verdicts.entries.length} verdicts; ${variantFeature.size} ops gated in tables.rs)`);
} else {
  for (const [path, want, name] of outputs) writeFileSync(path, want);
  console.log(`definitions: wrote definitions.rs and tables.rs from ${pin.tag} (${variantFeature.size} ops)`);
}
