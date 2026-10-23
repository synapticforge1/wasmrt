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
let out = `//! ⚠️ GENERATED by \`scripts/definitions.ts\` — DO NOT EDIT. Editing this file by hand is a DEFECT
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

if (process.argv.includes("--check")) {
  let current = "";
  try { current = readFileSync(OUT, "utf8"); } catch { fail(`${OUT} is missing — run without --check`); }
  if (current !== out) fail("crates/wasmrt-core/src/definitions.rs differs from what the pinned source generates (hand-edited, or the pin moved). Regenerate: bun scripts/definitions.ts");
  console.log(`definitions: PASSED — copy matches ${pin.tag} (${src.opcodes.entries.length} instructions, ${src.features.entries.length} features, ${src.verdicts.entries.length} verdicts)`);
} else {
  writeFileSync(OUT, out);
  console.log(`definitions: wrote crates/wasmrt-core/src/definitions.rs from ${pin.tag}`);
}
