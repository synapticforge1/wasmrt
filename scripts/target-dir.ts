// target-dir.ts — where cargo ACTUALLY builds, for the gate scripts' default binary paths.
//
// ⚠️ The gates used to default to `<repo>/target/release/wasmrt.exe`. cargo honours
// `CARGO_TARGET_DIR` and `build.target-dir` in any cargo config, so on a host that builds elsewhere
// that path is either missing or, worse, a STALE build that still runs: on 2026-10-23 a September
// `wasmrt.exe` sat there, five weeks old, and a script would have tested it in silence. Asking cargo
// is the only answer that is right on every machine.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";

const repo = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

/** cargo's target directory for this workspace (`cargo metadata` → `target_directory`). */
export function targetDir(): string {
  const out = execFileSync("cargo", ["metadata", "--no-deps", "--format-version", "1"], { cwd: repo, encoding: "utf8" });
  return JSON.parse(out).target_directory as string;
}

/** The release `wasmrt` CLI cargo builds, with the platform's executable suffix. */
export function releaseWasmrt(): string {
  return join(targetDir(), "release", process.platform === "win32" ? "wasmrt.exe" : "wasmrt");
}
