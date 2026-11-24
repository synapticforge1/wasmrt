// check-prev-tag-tests.ts — self-test of `removeScratch` and `releasedAs` in scripts/prev-tag-tests.ts (I9, I7,
// 2026-11-19): the scratch folder is removed with retries for a transient lock, and a cleanup that
// still fails warns instead of throwing over the tests' result.  bun scripts/check-prev-tag-tests.ts
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { releasedAs, removeScratch } from "./prev-tag-tests.ts";

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

// I7: `releasedAs` — a missing record is "no record" (the tags decide), not a stack trace.
const rel = mkdtempSync(join(tmpdir(), "wasmrt-check-released-"));
try {
  const at = (name: string, text?: string) => {
    const p = join(rel, name);
    if (text !== undefined) writeFileSync(p, text);
    return p;
  };
  check("a released-as line is read", releasedAs(at("ok.txt", "# surface\n# released-as: 2.0.2\nrust:x\n")) === "2.0.2");
  check("a CRLF released-as line is read", releasedAs(at("crlf.txt", "# released-as: 2.0.2\r\nrust:x\r\n")) === "2.0.2");
  check("a missing file is no record", releasedAs(at("missing.txt")) === undefined);
  check("a file without the line is no record", releasedAs(at("none.txt", "# surface\nrust:x\n")) === undefined);
  let named = "";
  try {
    releasedAs(rel); // a directory: an error other than ENOENT
  } catch (e) {
    named = (e as Error).message;
  }
  check("another read error is a named failure", named.startsWith("cannot read "));
} finally {
  rmSync(rel, { recursive: true, force: true });
}
console.log(`check-prev-tag-tests: ${pass} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
