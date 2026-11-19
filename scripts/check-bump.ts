// check-bump.ts — self-test of `commitBump` in scripts/bump.ts (review H1, 2026-11-19): a bump that
// fails after Cargo.toml is written puts Cargo.toml and Cargo.lock back byte for byte, and a bump
// that succeeds leaves the new manifest.  bun scripts/check-bump.ts
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { commitBump } from "./bump.ts";

let pass = 0, failures = 0;
function check(name: string, ok: boolean) {
  if (ok) pass++;
  else {
    failures++;
    console.error(`✗ ${name}`);
  }
}

// CRLF and a trailing byte without a newline: the restore must be exact, not re-encoded.
const TOML = '[workspace.package]\r\nversion = "2.0.1"\r\nx = "é"';
const LOCK = 'version = 4\n[[package]]\nname = "wasmrt"\nversion = "2.0.1"\n';
const NEXT = '[workspace.package]\r\nversion = "2.0.2"\r\nx = "é"';
const ok = { status: 0, stdout: "", stderr: "" };
const bad = { status: 1, stdout: "", stderr: "boom" };
const timedOut = { status: null, error: Object.assign(new Error("spawnSync cargo ETIMEDOUT"), { code: "ETIMEDOUT" }) };

const root = mkdtempSync(join(tmpdir(), "wasmrt-check-bump-"));
try {
  let n = 0;
  function trial(update: (dir: string) => typeof ok | typeof timedOut, commit: (dir: string) => typeof ok) {
    const dir = join(root, String(n++));
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir);
    writeFileSync(join(dir, "Cargo.toml"), TOML);
    writeFileSync(join(dir, "Cargo.lock"), LOCK);
    const why = commitBump(dir, NEXT, () => update(dir), () => commit(dir));
    return { why, toml: readFileSync(join(dir, "Cargo.toml"), "utf8"), lock: readFileSync(join(dir, "Cargo.lock"), "utf8") };
  }
  const lockMoved = (dir: string) => (writeFileSync(join(dir, "Cargo.lock"), LOCK.replace(/2\.0\.1/g, "2.0.2")), ok);

  const a = trial(() => bad, () => ok);
  check("a failed cargo update is reported", a.why?.includes("cargo update failed") === true);
  check("a failed cargo update restores Cargo.toml exactly", a.toml === TOML);
  check("a failed cargo update restores Cargo.lock", a.lock === LOCK);

  const b = trial(lockMoved, () => bad);
  check("a failed commit is reported", b.why?.includes("git commit failed") === true);
  check("a failed commit restores Cargo.toml exactly", b.toml === TOML);
  check("a failed commit restores the UPDATED Cargo.lock", b.lock === LOCK);

  const c = trial(() => timedOut, () => ok);
  check("a timed-out update names the timeout", c.why?.includes("ETIMEDOUT") === true);
  check("a timed-out update restores both files", c.toml === TOML && c.lock === LOCK);

  const d = trial(() => { throw new Error("spawn failed"); }, () => ok);
  check("a throwing step is reported", d.why?.includes("spawn failed") === true);
  check("a throwing step restores both files", d.toml === TOML && d.lock === LOCK);

  const e = trial(lockMoved, () => ok);
  check("a good bump returns null", e.why === null);
  check("a good bump leaves the new manifest", e.toml === NEXT);
  check("a good bump keeps the updated lock", e.lock === LOCK.replace(/2\.0\.1/g, "2.0.2"));

  let committed = false;
  trial(() => bad, () => ((committed = true), ok));
  check("no commit is attempted after a failed update", !committed);
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log(`check-bump: ${pass} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
