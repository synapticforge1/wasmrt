#!/usr/bin/env bun
// behaviour-corpus.ts — the S1 behaviour corpus (workspace letter H23): one minimal module per
// feature, the modules a configuration may ACCEPT or REFUSE, judged without running anything by
// `crates/wasmrt-core/tests/behaviour.rs`.
//
//   bun scripts/behaviour-corpus.ts            write tests/behaviour/*.{wat,wasm} and MANIFEST.txt
//   bun scripts/behaviour-corpus.ts --check    regenerate in a temp dir and diff; exit 1 on drift
//
// The modules are BINARIES assembled by `wasm-tools parse` (an outside reader), with the `.wat`
// beside each for the reader. Binaries, so a verdict measures what a release ACCEPTS, not what its
// assembler could spell, and so a carry-forward can judge an old release on the same bytes.
//
// Sources:
//   * `feature-rows.ts` — wasmrt's own one-module-per-proposal list (`gate-*`);
//   * the contract's feature matrix (`interop.md` §2.2, `cmem/probes/feature-matrix.ts` in the
//     sibling): the per-feature probes, the reference types, the per-instruction cases (`matrix-*`);
//   * one binary-only case text cannot write: an OVERLONG `call_indirect` table index.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { ROWS } from "./feature-rows.ts";

const repo = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const OUT = join(repo, "tests", "behaviour");
const check = process.argv.includes("--check");

const wat: Record<string, string> = {};
for (const r of ROWS) wat[`gate-${r.id.replace(/\//g, "__")}`] = `(module ${r.wat})`;
const matrix: Record<string, string> = {
  "mutable-global": `(global (export "g") (mut i32) (i32.const 0))`,
  "floats": `(func (result f32) f32.const 0)`,
  "sign-extension": `(func (result i32) i32.const 0 i32.extend8_s)`,
  "saturating-float-to-int": `(func (result i32) f32.const 0 i32.trunc_sat_f32_s)`,
  "multi-value": `(func (result i32 i32) i32.const 0 i32.const 0)`,
  "reference-types": `(func (result externref) ref.null extern)`,
  "bulk-memory": `(memory 1) (data "x") (func i32.const 0 i32.const 0 i32.const 0 memory.init 0)`,
  "bulk-memory-opt": `(memory 1) (func i32.const 0 i32.const 0 i32.const 0 memory.copy)`,
  "simd": `(func (result v128) v128.const i64x2 0 0)`,
  "relaxed-simd": `(func (result v128) v128.const i64x2 0 0 v128.const i64x2 0 0 v128.const i64x2 0 0 f32x4.relaxed_madd)`,
  "threads": `(memory 1 1 shared) (func (result i32) i32.const 0 i32.atomic.load)`,
  "tail-call": `(func return_call 0)`,
  "multi-memory": `(memory 1) (memory 1)`,
  "exceptions": `(tag) (func throw 0)`,
  "legacy-exceptions": `(tag) (func try catch 0 end)`,
  "memory64": `(memory i64 1)`,
  "extended-const": `(global i32 (i32.add (i32.const 1) (i32.const 2)))`,
  "function-references": `(type $t (func)) (func (param (ref $t)))`,
  "gc": `(type $s (struct)) (func (result (ref $s)) struct.new $s)`,
  "gc-types": `(type $s (struct))`,
  "custom-page-sizes": `(memory 1 (pagesize 1))`,
  "wide-arithmetic": `(func (result i64 i64) i64.const 0 i64.const 0 i64.const 0 i64.const 0 i64.add128)`,
  "simd-float": `(func (result v128) v128.const i64x2 0 0 v128.const i64x2 0 0 f32x4.add)`,
  "simd-int": `(func (result v128) v128.const i64x2 0 0 v128.const i64x2 0 0 i32x4.add)`,
  "f32x4.splat": `(func (result v128) f32.const 0 f32x4.splat)`,
  "i64.add128-dropped": `(func i64.const 0 i64.const 0 i64.const 0 i64.const 0 i64.add128 drop drop)`,
  "table-funcref": `(table 1 funcref)`,
  "table-externref": `(table 1 externref)`,
};
// WebAssembly 1.0 shapes every compiled program has. ⚠️ Added 2026-10-23 after S3 found what S1
// could not: wasmrt refused EVERY active function-index element segment with function-references
// off (`--features mvp` refused fib-rs). The per-proposal modules above contain no element segment,
// so S1 passed throughout. *A corpus of one module per FEATURE misses the core everyone uses.*
const core: Record<string, string> = {
  "mvp-elem-func": `(table 2 funcref) (func) (elem (i32.const 1) func 0)`,
  "mvp-elem-legacy": `(table 2 funcref) (func) (elem (i32.const 1) 0)`,
  "mvp-call-indirect": `(type (func)) (table 1 funcref) (func) (elem (i32.const 0) 0) (func i32.const 0 call_indirect (type 0))`,
  "mvp-mutable-global-internal": `(global (mut i32) (i32.const 0))`,
  "mvp-memory-data": `(memory 1) (data (i32.const 0) "x")`,
};
for (const [n, body] of Object.entries(core)) wat[`core-${n}`] = `(module ${body})`;
for (const [n, body] of Object.entries(matrix)) wat[`matrix-${n}`] = `(module ${body})`;
const refTypes = ["funcref", "externref", "anyref", "eqref", "i31ref", "structref", "arrayref", "exnref",
  "nullref", "nullexternref", "nullfuncref", "(ref func)", "(ref extern)", "(ref any)"];
for (const t of refTypes) wat[`matrix-param-${t.replace(/[()]/g, "").replace(/ /g, "-")}`] = `(module (func (param ${t})))`;

// Binary-only: `call_indirect type 0, table 0` with the table index written `80 00` (overlong) and,
// as the control, `00`. Text cannot spell an overlong LEB.
const hex = (s: string) => Buffer.from(s.trim().split(/\s+/).map((h) => parseInt(h, 16)));
const binary: Record<string, Buffer> = {
  "matrix-call-indirect-overlong": hex("00 61 73 6d 01 00 00 00 01 04 01 60 00 00 03 02 01 00 04 04 01 70 00 01 0a 0a 01 08 00 41 00 11 00 80 00 0b"),
  "matrix-call-indirect-normal": hex("00 61 73 6d 01 00 00 00 01 04 01 60 00 00 03 02 01 00 04 04 01 70 00 01 0a 09 01 07 00 41 00 11 00 00 0b"),
};

function generate(dir: string): string {
  mkdirSync(dir, { recursive: true });
  const lines: string[] = [];
  for (const name of Object.keys(wat).sort()) {
    writeFileSync(join(dir, `${name}.wat`), wat[name] + "\n");
    const r = spawnSync("wasm-tools", ["parse", join(dir, `${name}.wat`), "-o", join(dir, `${name}.wasm`)], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`wasm-tools parse ${name}: ${r.stderr}`);
  }
  for (const [name, bytes] of Object.entries(binary)) writeFileSync(join(dir, `${name}.wasm`), bytes);
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".wasm")).sort()) {
    lines.push(`${createHash("sha256").update(readFileSync(join(dir, f))).digest("hex")}  ${f}`);
  }
  const manifest = `# S1 behaviour corpus — GENERATED by scripts/behaviour-corpus.ts; do not edit.\n` +
    `# ${lines.length} modules, assembled by ${spawnSync("wasm-tools", ["--version"], { encoding: "utf8" }).stdout.trim()}\n` +
    lines.join("\n") + "\n";
  writeFileSync(join(dir, "MANIFEST.txt"), manifest);
  return manifest;
}

if (!check) {
  rmSync(OUT, { recursive: true, force: true });
  const m = generate(OUT);
  console.log(`behaviour corpus: wrote ${m.split("\n").filter((l) => /^[0-9a-f]{64}/.test(l)).length} modules to tests/behaviour/`);
} else {
  const tmp = mkdtempSync(join(tmpdir(), "behaviour-corpus-"));
  try {
    const fresh = generate(tmp).split("\n").filter((l) => /^[0-9a-f]{64}/.test(l));
    const committed = readFileSync(join(OUT, "MANIFEST.txt"), "utf8").split("\n").filter((l) => /^[0-9a-f]{64}/.test(l));
    const actual = readdirSync(OUT).filter((f) => f.endsWith(".wasm")).sort()
      .map((f) => `${createHash("sha256").update(readFileSync(join(OUT, f))).digest("hex")}  ${f}`);
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
    if (!same(fresh, committed) || !same(actual, committed)) {
      console.error("behaviour corpus: FAILED — tests/behaviour/ is not what scripts/behaviour-corpus.ts generates (or MANIFEST.txt is stale)");
      process.exit(1);
    }
    console.log(`behaviour corpus: PASSED — ${committed.length} modules match their sources`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
