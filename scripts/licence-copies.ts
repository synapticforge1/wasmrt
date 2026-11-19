// licence-copies.ts — every published crate carries the licence set, byte-equal to the root's
// (review L1, 2026-11-19). Cargo packages only what is inside a crate's own folder, so the root's
// LICENSE-MIT, LICENSE-APACHE, NOTICE and third_party/ never reached crates.io: MIT's notice
// condition and Apache-2.0 § 4(a) (the wabt-derived tables in wasmrt-core) were unmet. Each crate
// now holds copies; this gate refuses a missing or drifted one.  bun scripts/licence-copies.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

export const CRATES = ["wasmrt-core", "wasmrt-capi", "wasmrt"];
export const FILES = ["LICENSE-MIT", "LICENSE-APACHE", "NOTICE", "third_party/LICENSES.md", "third_party/wabt/LICENSE"];

/** The problems in `root` (empty when every crate holds an exact copy of every file). */
export function problems(root: string): string[] {
  const out: string[] = [];
  for (const f of FILES) {
    const master = join(root, f);
    if (!existsSync(master)) { out.push(`${f}: missing at the root`); continue; }
    const want = readFileSync(master);
    for (const c of CRATES) {
      const copy = join(root, "crates", c, f);
      if (!existsSync(copy)) out.push(`crates/${c}/${f}: missing`);
      else if (!readFileSync(copy).equals(want)) out.push(`crates/${c}/${f}: differs from ./${f}`);
    }
  }
  return out;
}

if (import.meta.main) {
  const root = join(import.meta.dir, "..");
  const p = problems(root);
  if (p.length) {
    console.error(`licence copies: ${p.length} problem(s) — copy the root file over each crate's:\n  ${p.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`licence copies: PASSED — ${FILES.length} files in each of ${CRATES.length} crates match the root`);
}
