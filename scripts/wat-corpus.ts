#!/usr/bin/env bun
// wat-corpus.ts — the `.wat` corpus gate: assemble → decode+validate → HAND THE BYTES TO SOMEONE ELSE.
//
// SPDX-License-Identifier: MIT OR Apache-2.0
// Copyright (c) 2026 Jon Marcum
//
//   bun scripts/wat-corpus.ts [corpus-root]
//
// Default root: ../wasmtk/tests. Exits non-zero unless every file either round-trips completely or
// is one of the known corpus defects (see below).
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THE THIRD STEP EXISTS.
//
// This gate used to stop after wasmrt validated wasmrt's own output, and that pair cannot testify
// about each other: the decoder learned its conventions FROM the assembler. Every format-level
// defect this project has found — the `(ref any)` internal tag on the wire, `try_table`'s off-by-one
// catch label, the raw `0xc5` trunc_sat opcodes, and on 2026-09-19 a missing data-count section for
// `array.new_data` — was invisible to wasmrt-only checking and took ONE command from an outside
// reader to find (`cmem/best-practices.md` §3.8b). So the third step is `wasm-tools validate` on
// every byte we emit.
//
// ⚠️ The output file's EXISTENCE is checked, not just the exit text: an assembler failure that this
// script did not recognise otherwise reappears as "wasm-tools could not read the file", which is a
// true statement filed under the wrong heading.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { releaseWasmrt } from "./target-dir.ts";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = process.argv[2] ?? join(repo, "..", "wasmtk", "tests");
// cargo's real target directory, which need not be `<repo>/target` (see `target-dir.ts`).
const exe = releaseWasmrt();

// Known corpus defects — NOT ours. wasm-tools refuses the same SOURCE on the same lines; they are
// reported upstream and deliberately not worked around.
//   fnany_50 / hostfn_50            : an inline function type that disagrees with its `(type)` ref
//   table_export / table_test       : `anyfunc`, spelled `funcref` since the MVP text format
const KNOWN_BAD = ["fnany_50.wat", "hostfn_50.wat", "table_export.wat", "table_test.wat"];

if (!existsSync(exe)) {
  console.error(`no release binary at ${exe} — run: cargo build --release`);
  process.exit(2);
}

const wats: string[] = [];
const walk = (d: string) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith(".wat")) wats.push(p);
  }
};
walk(root);
wats.sort();

const tmp = join(tmpdir(), `wasmrt-wat-corpus-${process.pid}`);
mkdirSync(tmp, { recursive: true });
const run = (cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return (r.stderr ?? "") + (r.stdout ?? "");
};

let ok = 0;
const bad: string[] = [];
// A file whose SOURCE wasm-tools refuses, and that wasmrt refuses too: a corpus defect found by
// measurement rather than listed by hand (2026-10-24: wasmtk's generated, gitignored
// `wasm_wasi_bundle/**/main_wasic.wat` `throw`s an undeclared tag). Reported, never counted as ours.
const corpusDefects: string[] = [];
/** Does wasm-tools accept the SOURCE itself (parse, then validate)? */
const sourceValid = (w: string, i: number) => {
  const ref = join(tmp, `r${i}.wasm`);
  const parsed = spawnSync("wasm-tools", ["parse", w, "-o", ref], { encoding: "utf8" }).status === 0;
  return parsed && spawnSync("wasm-tools", ["validate", "--features", "all", ref], { encoding: "utf8" }).status === 0;
};
// ⚠️ wasmrt's refusal is read from its verdict text, and that text has three shapes: summarize
// prints "validation FAILED", a decode error "decode failed", and the run path (a `_start` module)
// "invalid module …". The gate knew only the first two until 2026-10-24, so a run-path refusal was
// caught one step later, by wasm-tools, under the wrong heading.
const refused = (v: string) => v.includes("FAILED") || v.includes("decode failed") || v.includes("invalid module");
for (const [i, w] of wats.entries()) {
  const out = join(tmp, `c${i}.wasm`);
  const name = w.split(/[\\/]/).pop() ?? w;
  const asm = run(exe, ["wat", w, "-o", out]);
  if (!existsSync(out)) {
    if (!KNOWN_BAD.includes(name)) bad.push(`ASSEMBLE   ${w}\n             ${asm.trim().split("\n").pop()}`);
    continue;
  }
  const val = run(exe, [out]);
  const outside = run("wasm-tools", ["validate", "--features", "all", out]);
  const weRefused = refused(val), theyRefused = outside.includes("error");
  if (!weRefused && !theyRefused) { ok++; continue; }
  if (!sourceValid(w, i)) {
    // The source is invalid. wasmrt must refuse it too, or wasmrt accepted an invalid module.
    if (weRefused) corpusDefects.push(`${w}\n             ${outside.trim().split("\n").slice(-1)[0]?.trim()}`);
    else bad.push(`ACCEPTED AN INVALID MODULE: ${w}\n             wasm-tools refuses the source; wasmrt accepted it`);
    continue;
  }
  if (weRefused) {
    bad.push(`VALIDATE   ${w}\n             ${val.split("\n").find((l) => refused(l))?.trim()}`);
  } else {
    bad.push(`WASM-TOOLS REFUSED OUR BYTES: ${w}\n             ${outside.trim().split("\n").slice(0, 3).join(" ")}`);
  }
}
rmSync(tmp, { recursive: true, force: true });

console.log(`.wat corpus: ${wats.length} files, ${KNOWN_BAD.length} known corpus defects skipped`);
console.log(`  assembled, validated, and ACCEPTED BY WASM-TOOLS: ${ok}`);
if (corpusDefects.length) {
  console.log(`  corpus defects found (wasm-tools refuses the SOURCE, and so does wasmrt): ${corpusDefects.length}`);
  for (const c of corpusDefects) console.log(`   ${c}`);
}
if (bad.length) {
  console.log(`  problems: ${bad.length}`);
  for (const b of bad) console.log(`   ${b}`);
  process.exit(1);
}
console.log("wat corpus: PASSED");
