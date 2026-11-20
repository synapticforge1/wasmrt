// check-prev-tag-tests.ts — self-test of `removeScratch` in scripts/prev-tag-tests.ts (I9,
// 2026-11-19): the scratch folder is removed with retries for a transient lock, and a cleanup that
// still fails warns instead of throwing over the tests' result.  bun scripts/check-prev-tag-tests.ts
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { removeScratch } from "./prev-tag-tests.ts";

let pass = 0, failures = 0;
function check(name: string, ok: boolean) {
  if (ok) pass++;
  else {
    failures++;
    console.error(`✗ ${name}`);
  }
}

const dir = mkdtempSync(join(tmpdir(), "wasmrt-check-prev-"));
mkdirSync(join(dir, "target", "debug"), { recursive: true });
writeFileSync(join(dir, "target", "debug", "t.exe"), "x");
check("a real folder is removed", removeScratch(dir) === true && !existsSync(dir));

let opts: { maxRetries?: number; retryDelay?: number } = {};
const locked = ((_: unknown, o: typeof opts) => {
  opts = o;
  throw Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
}) as unknown as typeof rmSync;
let threw = false, ok = true;
try {
  ok = removeScratch("C:\\nowhere\\wasmrt-prev-x", locked);
} catch {
  threw = true;
}
check("a locked folder does not throw", !threw);
check("a locked folder reports false", ok === false);
check("the removal retries a transient lock", (opts.maxRetries ?? 0) >= 3 && (opts.retryDelay ?? 0) > 0);

rmSync(dir, { recursive: true, force: true });
console.log(`check-prev-tag-tests: ${pass} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
