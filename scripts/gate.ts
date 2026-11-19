// gate.ts — THE gate, one list, run LOCALLY: by hand before a push, and by `scripts/release.ts` before
// it pushes a release. 🔒 Workspace review standard (letter H37 § 10; owner, 2026-11-17): "every gate,
// the test suites included, runs locally and is not repeated on GitHub — CI only publishes". It runs
// on every supported platform that has a machine (cmem/platforms.md).
//
//   bun scripts/gate.ts             build, tests, lints, the privacy scan, the self-tests, the
//                                   previous release's tests, the publish dry run
//   bun scripts/gate.ts --release   also what only a NEW version needs: the floor since the last
//                                   release (`bump.ts --verify-tag`), the CHANGELOG section the page
//                                   is made from, the release's entry in cmem/release.md (both with
//                                   their Tested on lines), and the review's result (`review-gate.ts`:
//                                   the review set has run and covers HEAD — H37 (d))
//
// Each step's exit code is read; the first failure stops the gate with that step's name. Steps that
// need a tool this host lacks fail loudly rather than skip (a C compiler: set CC, `c-gate.ts`).
// Not here, by nature: S2 (`behaviour-s2.ts`, the spec suite from wasmtk's corpus — a sibling
// checkout) and S3; `cmem/releasing.md` keeps them in the local checklist.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const repo = join(import.meta.dirname!, "..");
const release = process.argv.slice(2).includes("--release");
for (const a of process.argv.slice(2)) {
  if (a !== "--release") {
    console.error(`gate: unknown argument "${a}" — use --release or nothing`);
    process.exit(2);
  }
}

const m = /\[workspace\.package\][^[]*?\nversion\s*=\s*"(\d+\.\d+\.\d+)"/.exec(readFileSync(join(repo, "Cargo.toml"), "utf8"));
if (!m) {
  console.error("gate: no X.Y.Z [workspace.package] version in Cargo.toml");
  process.exit(1);
}
const version = m[1];

/** The newest `vX.Y.Z` tag reachable from HEAD — the last release, whose commits since the privacy
 *  scan reads. Refuses rather than scan nothing. */
function lastTag(): string {
  const r = spawnSync("git", ["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*.[0-9]*.[0-9]*", "HEAD"], { cwd: repo, encoding: "utf8" });
  const t = r.stdout?.trim() ?? "";
  if (r.status !== 0 || !/^v\d+\.\d+\.\d+$/.test(t)) {
    console.error(`gate: no release tag reachable from HEAD (git describe: ${r.stderr?.trim() || t}) — fetch the tags`);
    process.exit(1);
  }
  return t;
}

type Step = [label: string, cmd: string, args: string[], env?: Record<string, string>];
const bun = process.execPath;
// platform: win-x64 linux-x64 — each OS compiles out the other's `#[cfg]` code. So clippy also runs for the
// OTHER OS's target — a type-check, no linker needed — so a lint or error in code only one OS
// compiles is found on either (review round 1, 2026-11-12: `rng.rs`'s unix block failed
// `clippy -D warnings` on Linux only). It does not replace running the suite there (platforms.md).
const otherOs = process.platform === "win32" ? "x86_64-unknown-linux-gnu" : "x86_64-pc-windows-gnu";
// This Windows host has no `cc`; mingw's `gcc` is what the C-ABI gate was measured with.
const cc = process.env.CC ?? (process.platform === "win32" ? "gcc" : "cc");
const steps: Step[] = [
  ["eol", bun, ["scripts/eol-gate.ts"]],
  ["privacy and credential scan (tree, untracked files, commits since the last release)", bun, ["scripts/privacy-gate.ts", "--commits", `${lastTag()}..HEAD`]],
  ["privacy scan self-test", bun, ["scripts/check-privacy-gate.ts"]],
  ["review gate self-test", bun, ["scripts/check-review-gate.ts"]],
  ["bump self-test", bun, ["scripts/check-bump.ts"]],
  ["licence copies in every crate", bun, ["scripts/licence-copies.ts"]],
  ["shared definitions", bun, ["scripts/definitions.ts", "--check"]],
  ["build (release)", "cargo", ["build", "--workspace", "--release", "--locked"]],
  ["tests", "cargo", ["test", "--workspace", "--locked"]],
  ["clippy", "cargo", ["clippy", "--workspace", "--all-targets", "--locked", "--", "-D", "warnings"]],
  [`clippy for the other OS (${otherOs})`, "cargo", ["clippy", "--workspace", "--all-targets", "--locked", "--target", otherOs, "--", "-D", "warnings"]],
  // The dual-target contract (architecture.md): the engine builds FREESTANDING for wasm32 — without
  // its default `std` feature (review round 2: with defaults, an ungated `std` use still built, so the
  // step proved nothing about `no_std`); and with `std` on WASI.
  ["wasmrt-core freestanding (no_std) for wasm32-unknown-unknown", "cargo", ["build", "-p", "wasmrt-core", "--release", "--locked", "--no-default-features", "--target", "wasm32-unknown-unknown"]],
  ["wasmrt-core for wasm32-wasip1", "cargo", ["build", "-p", "wasmrt-core", "--release", "--locked", "--target", "wasm32-wasip1"]],
  ["public surface is current", bun, ["scripts/surface.ts", "--check"]],
  ["C ABI", bun, ["scripts/c-gate.ts"], { CC: cc }],
  ["release-page script self-test", bun, ["scripts/check-github-release.ts"]],
  ["crates.io script self-test", bun, ["scripts/check-crates-io.ts"]],
  ["release-record check self-test", bun, ["scripts/check-release-record.ts"]],
  ["version arithmetic self-test (bump and gate agree)", bun, ["scripts/check-versions.ts"]],
  ["previous release's tests against this tree", bun, ["scripts/prev-tag-tests.ts"]],
  ["publish dry run (all three crates, dependency order)", "cargo", ["publish", "--workspace", "--locked", "--no-verify", "--dry-run"]],
];
if (release) {
  steps.push(
    ["the floor since the last release", bun, ["scripts/bump.ts", "--verify-tag", `v${version}`]],
    ["the CHANGELOG section the page is made from", bun, ["scripts/release-record.ts", "notes", version]],
    ["the release's entry in cmem/release.md", bun, ["scripts/release-record.ts", "entry", version]],
    ["the review set has run and covers HEAD (H37 (d))", bun, ["scripts/review-gate.ts"]],
  );
}

// The local toolchain floats (rust-toolchain.toml = nightly, a T11 question); CI's publish job packages
// with a pinned one. Say so when they differ: what this gate proved was proved on the local one.
const pin = /RUSTC_COMMIT:\s*["']?(\w+)/.exec(readFileSync(join(repo, ".github", "workflows", "release.yml"), "utf8"))?.[1];
const local = spawnSync("rustc", ["-V"], { cwd: repo, encoding: "utf8" }).stdout?.trim() ?? "";
if (pin && !local.includes(`(${pin} `)) {
  console.log(`⚠ toolchain: this host has "${local}", CI's publish job pins rustc ${pin} (release.yml)`);
}

console.log(`gate${release ? " --release" : ""}: ${steps.length} steps, version ${version}`);
for (const [label, cmd, args, env] of steps) {
  console.log(`\n== ${label}: ${cmd === bun ? "bun" : cmd} ${args.join(" ")}`);
  // Output streams straight through: a 10-minute test run must show progress, and the failing step's
  // own lines are the last thing printed before its name below.
  const r = spawnSync(cmd, args, { cwd: repo, stdio: "inherit", env: { ...process.env, ...env } });
  const code = r.error ? `could not start: ${r.error.message}` : r.status ?? `signal ${r.signal}`;
  if (code !== 0) {
    console.error(`\ngate: FAILED at "${label}" (exit ${code})`);
    process.exit(1);
  }
}
console.log(`\ngate${release ? " --release" : ""}: all ${steps.length} steps passed for ${version}`);
