// The proposal-gate sweep: for EVERY proposal wasmrt gates, a module that uses it, judged with
// that proposal disabled — by wasmrt and by wasm-tools, which must both refuse it.
//
// 🔒 Why this exists (X3, and `best-practices.md` §1.11). A gate is only ever tested where someone
// remembered to test it, and this project has now shipped three proposals gated at ONE entry point
// out of two: wide-arithmetic (missing from `wasmrt_feature_t`), table64 (gated for memories only),
// and the table-initializer form. Each was found by a sweep, never by reading the list.
//
// Every row also runs a CONTROL with every proposal enabled, which both engines must ACCEPT.
// Without it a probe that fails for an unrelated reason reads as a working gate — that is not
// hypothetical: a `(table 1 funcref (ref.func $f))` fixture was refused for its declare segment's
// element type and certified a gate it never exercised.
//
//   bun scripts/feature-gate-sweep.ts [path/to/wasmrt]
//
// Needs `wasm-tools` on PATH. Exits non-zero if any row disagrees or any control fails.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { releaseWasmrt } from "./target-dir.ts";

// Default: the binary cargo actually builds, which need not be `<repo>/target` (`target-dir.ts`).
const wasmrt = resolve(process.argv[2] ?? releaseWasmrt());

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return { code: r.status ?? -1, out: ((r.stdout ?? "") + (r.stderr ?? "")).trim() };
}

// The rows (one minimal module per proposal) live in `feature-rows.ts`, shared with the S1
// behaviour corpus so the two cannot drift apart.
import { ROWS } from "./feature-rows.ts";
const START = `(func (export "_start"))`; // so the module is runnable through the WASI path

const dir = mkdtempSync(join(tmpdir(), "wasmrt-gate-sweep-"));
let bad = 0;
try {
  for (const row of ROWS) {
    const wat = join(dir, "m.wat");
    const wasm = join(dir, "m.wasm");
    writeFileSync(wat, `(module ${START} ${row.wat})\n`);
    const asm = run("wasm-tools", ["parse", wat, "-o", wasm]);
    if (asm.code !== 0) {
      bad++;
      console.log(`${row.id.padEnd(30)} FIXTURE DOES NOT ASSEMBLE: ${asm.out.split("\n")[0]}`);
      continue;
    }
    // Control: every proposal on — both engines must accept, or the row measures nothing.
    const ctlT = run("wasm-tools", ["validate", "-f", "all", wasm]).code === 0;
    // `wasmrt wasi` judges and runs; a module whose only export is `_start` exits 0.
    const ctlO = run(wasmrt, ["wasi", wasm]).code === 0;
    // The gate.
    const t = run("wasm-tools", ["validate", "-f", `all,-${row.wt}`, wasm]).code === 0;
    const o = run(wasmrt, ["wasi", "--features", `all,-${row.ours}`, wasm]);
    const ov = o.code === 0;
    const ok = ctlT && ctlO && !t && !ov;
    if (!ok) {
      bad++;
      console.log(
        `${row.id.padEnd(30)} control(wt=${ctlT} ours=${ctlO}) ` +
          `disabled: wasm-tools ${t ? "ACCEPTS" : "refuses"}, wasmrt ${ov ? "ACCEPTS" : "refuses"}`,
      );
      if (ov) console.log(`    wasmrt accepted a module that names a disabled proposal`);
      else if (!ctlO) console.log(`    wasmrt: ${o.out.split("\n").slice(0, 2).join(" | ")}`);
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(
  bad === 0
    ? `feature-gate sweep: PASSED (${ROWS.length} proposals, each refused by both engines when disabled)`
    : `feature-gate sweep: FAILED — ${bad} row(s)`,
);
process.exit(bad === 0 ? 0 : 1);
