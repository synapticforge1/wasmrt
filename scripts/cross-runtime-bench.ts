#!/usr/bin/env bun
// cross-runtime-bench.ts — wasmrt against wasmtime, Bun and Deno on the SAME machine, SAME bytes.
//
//   bun scripts/cross-runtime-bench.ts [--wasmrt <exe>] [--rounds N] [--json <file>]
//
// Two regimes, reported separately and never conflated (bench/README.md):
//
// 1. END TO END: one process per run (spawn, load, compile/decode, instantiate, call, print, exit).
//    This is what a short-lived program pays. Every runtime's FLOOR is measured beside it: a run that
//    does no wasm work at all (`--version`, or an empty script). The floor is reported next to every
//    number and subtracted, because a spawn floor larger than the signal measures the floor
//    (best-practices.md §3A.2, "For T11"). Quote the DIFFERENCE: a ratio depends on load.
// 2. IN PROCESS: the same two measurements as crates/wasmrt-core/examples/bench.rs (cold =
//    compile+instantiate+one call, mean; steady = sum(n) Mops/s at 13 wasm ops per iteration),
//    run inside Bun and Deno. wasmrt's own figures come from `cargo run --release -p wasmrt-core
//    --example bench` in the same session. wasmtime has no in-process arm here (that needs a Rust
//    embedding; out of scope for this script).
//
// Every module is assembled by `wasm-tools parse`, an outside reader, so all four runtimes run
// byte-identical inputs. Every run's stdout is checked for the workload's answer before its time
// counts; a run that computes the wrong thing aborts the benchmark. Runs are INTERLEAVED (round-robin,
// rotated start) so a load change hits every runtime alike. wasmtime runs with `-C cache=n`: plain
// `.wasm`, compiled each run, the regime `cmem/vision.md` names (no `.cwasm`).
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const argv = process.argv.slice(2);
const opt = (name: string, dflt: string) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const WASMRT = opt("--wasmrt", "wasmrt");
const ROUNDS = Number(opt("--rounds", "30"));
const JSON_OUT = opt("--json", "");

// ---- modules (the same WAT as bench.rs) ---------------------------------------------------------
const SUM_WAT = `(module
  (func (export "sum") (param $n i32) (result i32)
    (local $i i32) (local $acc i32)
    (block $done
      (loop $l
        (br_if $done (i32.ge_s (local.get $i) (local.get $n)))
        (local.set $acc (i32.add (local.get $acc) (local.get $i)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $l)))
    (local.get $acc)))`;
const OPS_PER_ITER = 13;
const TRIVIAL_WAT = `(module (func (export "f") (result i32) (i32.const 42)))`;
const bigWat = (n: number) => {
  let s = "(module\n";
  for (let i = 0; i < n; i++)
    s += `  (func (export "f${i}") (param i32 i32) (result i32)\n` +
      `    (i32.add (i32.mul (local.get 0) (i32.const ${i}))\n` +
      `             (i32.sub (local.get 1) (i32.const ${i}))))\n`;
  return s + ")\n";
};
/** sum(0..n) mod 2^32, as a signed i32, which is what the guest returns. */
const sumOf = (n: number) => String(BigInt.asIntN(32, (BigInt(n) * BigInt(n - 1)) / 2n));

const dir = mkdtempSync(join(tmpdir(), "wasmrt-xbench-"));
function assemble(name: string, wat: string): string {
  const src = join(dir, `${name}.wat`), out = join(dir, `${name}.wasm`);
  writeFileSync(src, wat);
  const r = spawnSync("wasm-tools", ["parse", src, "-o", out], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`wasm-tools parse ${name}: ${r.stderr}`);
  return out;
}
const trivial = assemble("trivial", TRIVIAL_WAT);
const sum = assemble("sum", SUM_WAT);
const big = assemble("big", bigWat(1900));

// ---- JS runners, generated so the script stays one file -------------------------------------------
const callJs = join(dir, "call.mjs");
writeFileSync(callJs, `import { readFileSync } from "node:fs";
import process from "node:process";
const [file, fn, ...args] = process.argv.slice(2);
const { instance } = await WebAssembly.instantiate(readFileSync(file));
console.log(String(instance.exports[fn](...args.map(Number))));
`);
const emptyJs = join(dir, "empty.mjs");
writeFileSync(emptyJs, "\n");
const inprocJs = join(dir, "inproc.mjs");
writeFileSync(inprocJs, `import { readFileSync } from "node:fs";
import process from "node:process";
const [sumPath, bigPath] = process.argv.slice(2);
const toy = readFileSync(sumPath), big = readFileSync(bigPath);
// V8 caches compiled modules by their BYTES within a process, so compiling identical bytes in a loop
// times a cache hit (measured: 3.4 µs in Deno vs 51.8 µs in Bun). bench.rs has no such cache. Each
// iteration therefore gets unique bytes: the module plus a custom section "x" holding the counter
// (a custom section is legal after the last section and changes no semantics).
const variants = (bytes, n) => Array.from({ length: n + 1 }, (_, i) => {
  const v = new Uint8Array(bytes.length + 8);
  v.set(bytes);
  v.set([0x00, 0x06, 0x01, 0x78, i & 255, (i >> 8) & 255, (i >> 16) & 255, (i >>> 24) & 255], bytes.length);
  return v;
});
const once = (bytes, fn, args) => new WebAssembly.Instance(new WebAssembly.Module(bytes)).exports[fn](...args);
function cold(bytes, fn, args, iters) {
  const vs = variants(bytes, iters); // built outside the timer
  once(vs[iters], fn, args);
  const t = performance.now();
  for (let i = 0; i < iters; i++) once(vs[i], fn, args);
  return (performance.now() - t) / iters;
}
const out = { coldToyUs: cold(toy, "sum", [1], 2000) * 1e3, coldBigMs: cold(big, "f0", [1, 2], 200), steady: [] };
const s = new WebAssembly.Instance(new WebAssembly.Module(toy)).exports.sum;
const want = ${"BigInt.asIntN(32, (1000000n * 999999n) / 2n)"};
if (BigInt(s(1000000)) !== want) throw new Error("workload computed the wrong sum");
for (const n of [1000000, 10000000, 50000000]) {
  const t = performance.now(); s(n); const ms = performance.now() - t;
  out.steady.push({ n, ms, mops: (n * ${OPS_PER_ITER}) / (ms / 1e3) / 1e6 });
}
console.log(JSON.stringify(out));
`);

// ---- the end-to-end matrix ------------------------------------------------------------------------
type Cmd = { exe: string; args: string[]; expect: string | null };
type Runtime = { name: string; floor: Cmd; call: (file: string, fn: string, args: string[], expect: string) => Cmd };
const RUNTIMES: Runtime[] = [
  { name: "wasmrt", floor: { exe: WASMRT, args: ["--version"], expect: null },
    call: (f, fn, a, e) => ({ exe: WASMRT, args: [f, fn, ...a], expect: e }) },
  { name: "wasmtime", floor: { exe: "wasmtime", args: ["--version"], expect: null },
    call: (f, fn, a, e) => ({ exe: "wasmtime", args: ["run", "-C", "cache=n", "--invoke", fn, f, ...a], expect: e }) },
  { name: "bun", floor: { exe: "bun", args: [emptyJs], expect: null },
    call: (f, fn, a, e) => ({ exe: "bun", args: [callJs, f, fn, ...a], expect: e }) },
  { name: "deno", floor: { exe: "deno", args: ["run", "--quiet", emptyJs], expect: null },
    call: (f, fn, a, e) => ({ exe: "deno", args: ["run", "--quiet", `--allow-read=${dir}`, callJs, f, fn, ...a], expect: e }) },
];
const WORKLOADS = [
  { name: "trivial f()=42", file: trivial, fn: "f", args: [] as string[], expect: "42" },
  { name: "sum(1e6)", file: sum, fn: "sum", args: ["1000000"], expect: sumOf(1_000_000) },
  { name: "sum(1e7)", file: sum, fn: "sum", args: ["10000000"], expect: sumOf(10_000_000) },
  { name: "48 KB module f0(1,2)", file: big, fn: "f0", args: ["1", "2"], expect: "2" },
];

const cells: { runtime: string; workload: string; cmd: Cmd; ms: number[] }[] = [];
for (const rt of RUNTIMES) {
  cells.push({ runtime: rt.name, workload: "floor", cmd: rt.floor, ms: [] });
  for (const w of WORKLOADS) cells.push({ runtime: rt.name, workload: w.name, cmd: rt.call(w.file, w.fn, w.args, w.expect), ms: [] });
}

function runOnce(c: Cmd): number {
  const t = process.hrtime.bigint();
  const r = spawnSync(c.exe, c.args, { encoding: "utf8" });
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  if (r.error) throw new Error(`${c.exe}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${c.exe} ${c.args.join(" ")} exited ${r.status}: ${r.stderr}`);
  if (c.expect !== null) {
    const lines = r.stdout.trim().split(/\r?\n/).map(l => l.trim());
    if (!lines.includes(c.expect)) throw new Error(`${c.exe} ${c.args.join(" ")}: wanted "${c.expect}", got ${JSON.stringify(r.stdout)}`);
  }
  return ms;
}

// One untimed pass first: it proves every command works and warms the OS file cache for all alike.
for (const c of cells) runOnce(c.cmd);
for (let round = 0; round < ROUNDS; round++) {
  for (let k = 0; k < cells.length; k++) {
    const c = cells[(k + round) % cells.length];
    c.ms.push(runOnce(c.cmd));
  }
}

const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const fmt = (x: number) => x.toFixed(x < 10 ? 2 : 1);
console.log(`cross-runtime-bench — ${ROUNDS} interleaved rounds per cell; ms per process, median [p10–p90]; net = median − floor median\n`);
for (const c of RUNTIMES) {
  const rows = cells.filter(x => x.runtime === c.name);
  const floor = q(rows[0].ms, 0.5);
  for (const r of rows) {
    const med = q(r.ms, 0.5);
    const net = r.workload === "floor" ? "" : `   net ${fmt(med - floor).padStart(7)}`;
    console.log(`${c.name.padEnd(9)} ${r.workload.padEnd(22)} ${fmt(med).padStart(8)} [${fmt(q(r.ms, 0.1))}–${fmt(q(r.ms, 0.9))}]${net}`);
  }
  console.log("");
}

// ---- in-process arm (Bun, Deno) -------------------------------------------------------------------
const inproc: Record<string, unknown> = {};
for (const [name, exe, args] of [["bun", "bun", [inprocJs]], ["deno", "deno", ["run", "--quiet", `--allow-read=${dir}`, inprocJs]]] as const) {
  const r = spawnSync(exe, [...args, sum, big], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${name} in-process: ${r.stderr}`);
  const o = JSON.parse(r.stdout.trim());
  inproc[name] = o;
  console.log(`in-process ${name.padEnd(5)} cold toy ${o.coldToyUs.toFixed(1)} µs · cold 48 KB ${o.coldBigMs.toFixed(3)} ms · steady ` +
    o.steady.map((s: { n: number; mops: number }) => `sum(${s.n}) ${s.mops.toFixed(0)} Mops/s`).join(", "));
}

const versions = Object.fromEntries(RUNTIMES.map(r => [r.name, spawnSync(r.floor.exe, r.name === "bun" ? ["--version"] : r.name === "deno" ? ["--version"] : ["--version"], { encoding: "utf8" }).stdout.split(/\r?\n/)[0].trim()]));
console.log(`\nversions: ${JSON.stringify(versions)}\nmodules: trivial, sum, 48 KB (${big}) — assembled by wasm-tools`);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ rounds: ROUNDS, versions, cells: cells.map(c => ({ runtime: c.runtime, workload: c.workload, ms: c.ms })), inproc }, null, 2));
