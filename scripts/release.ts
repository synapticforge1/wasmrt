// release.ts — release the bumped version: check everything, then push `main` ONLY (workspace letter
// H33, slot U4; 🔒 the owner's order, 2026-11-10: "CI to check first, then push the tag, and then
// create the release page from the tag, then publish the package to the registry").
//
//   bun scripts/bump.ts <patch|minor|major>   first: the floor, then the `bump to vX.Y.Z` commit
//   bun scripts/release.ts                    then: the guards, the cold gate, ONE push of `main`
//   bun scripts/release.ts --dry-run          every guard and the gate, nothing pushed
//
// It makes and pushes NO tag, ever (no `git tag`, no `-f`): the `release` workflow runs `checks` on
// the pushed commit and only when green, for an untagged version, CI tags it, makes the Release page
// from the tag, then publishes the three crates to crates.io through trusted publishing and reads
// them back (`.github/workflows/release.yml`). A published tag never moves.
//
// Guards, each refusing with nothing pushed:
//   - the tree is clean (untracked files count);
//   - on `main`; HEAD = `origin/main` (just fetched) + exactly one commit, `bump to vX.Y.Z`, changing
//     only Cargo.toml and Cargo.lock, with X.Y.Z = Cargo.toml's version (U2: the release notes are
//     already merged and pushed; the bump is its own commit);
//   - the tag `vX.Y.Z` absent here and on `origin`;
//   - crates.io lists X.Y.Z for none of the three crates (read from each crate's version LIST);
//   - the cold gate: `bun scripts/gate.ts --release` — the SAME list CI's `checks` job runs, which
//     includes the CHANGELOG section and cmem/release.md's entry with both required reviews (H35).
// Then `git push origin main` (never forced) and a read-back: `origin/main` = HEAD, still no tag.
//
// Adapted from universalWasmLoader-rs `scripts/release.ts` (read 2026-11-12). `node:` builtins and
// `fetch` only.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const repo = join(import.meta.dirname!, "..");
const CRATES = ["wasmrt-core", "wasmrt-capi", "wasmrt"];
const UA = "wasmrt release script (https://github.com/synapticforge1/wasmrt)";

function fail(msg: string, code = 1): never {
  console.error(`release: ${msg} — nothing pushed`);
  process.exit(code);
}

let dryRun = false;
for (const arg of process.argv.slice(2)) {
  if (arg === "--dry-run" || arg === "-n") dryRun = true;
  else fail(`unknown argument "${arg}" — use --dry-run or nothing`, 2);
}

function run(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { cwd: repo, encoding: "utf8", maxBuffer: 1 << 26 });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}
function git(...args: string[]): string {
  const r = run("git", args);
  if (r.status !== 0) fail(`git ${args.join(" ")} failed:\n${r.stderr.trim()}`);
  return r.stdout.trim();
}

// ── the tree and the branch ──
const dirty = git("status", "--porcelain", "--untracked-files=all");
if (dirty) fail(`the tree is not clean (untracked files count):\n${dirty}`);
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "main") fail(`on "${branch}", not main — merge first, then release from main`);

const m = /\[workspace\.package\][^[]*?\nversion\s*=\s*"(\d+\.\d+\.\d+)"/.exec(readFileSync(join(repo, "Cargo.toml"), "utf8"));
if (!m) fail("no X.Y.Z [workspace.package] version in Cargo.toml");
const version = m[1];
const tag = `v${version}`;
git("fetch", "-q", "origin", "main");
const upstream = git("rev-parse", "origin/main");
const head = git("rev-parse", "HEAD");
const ahead = git("rev-list", "--count", `${upstream}..HEAD`);
const behind = git("rev-list", "--count", `HEAD..${upstream}`);
if (behind !== "0") fail(`main is ${behind} commit(s) behind origin/main — pull first`);
if (ahead !== "1") fail(`main must be origin/main + exactly the bump commit; it is ${ahead} ahead (push the release notes first: U2)`);
const subject = git("log", "-1", "--format=%s", "HEAD");
if (subject !== `bump to ${tag}`) fail(`the commit on top is "${subject}", not "bump to ${tag}" (run bun scripts/bump.ts <level>)`);
const files = git("show", "--name-only", "--format=", "HEAD").split(/\r?\n/).filter(Boolean).sort();
if (files.join(",") !== "Cargo.lock,Cargo.toml") fail(`the bump commit changes ${files.join(", ")}, not only Cargo.toml + Cargo.lock`);

// ── the tag: absent here and on origin ──
if (run("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`]).status === 0) fail(`tag ${tag} exists locally`);
const remoteTag = run("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`]);
if (remoteTag.status === 0) fail(`tag ${tag} exists on origin`);
if (remoteTag.status !== 2) fail(`could not ask origin whether ${tag} exists (git ls-remote exit ${remoteTag.status})`);

// ── crates.io: each crate's version LIST (never the version URL before it exists) ──
for (const c of CRATES) {
  let listed: string[];
  try {
    const res = await fetch(`https://crates.io/api/v1/crates/${c}/versions`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    listed = ((await res.json()) as { versions: { num: string }[] }).versions.map((v) => v.num);
  } catch (e) {
    fail(`could not read crates.io's version list for ${c}: ${(e as Error).message}`);
  }
  if (listed.includes(version)) fail(`crates.io already lists ${c} ${version}`);
}
console.log(`guards: clean, main = origin/main + "bump to ${tag}", ${tag} absent here and on origin, crates.io without ${version}`);

// ── the cold gate: CI's own list ──
const g = spawnSync(process.execPath, ["scripts/gate.ts", "--release"], { cwd: repo, stdio: "inherit" });
if (g.status !== 0) fail(`the gate failed (exit ${g.status})`);
const after = git("status", "--porcelain", "--untracked-files=all");
if (after) fail(`the gate left the tree dirty:\n${after}`);

if (dryRun) {
  console.log(`release (dry-run): every guard and the gate passed for ${tag}; nothing pushed`);
  process.exit(0);
}

// ── ONE push of main, read back; no tag ──
const push = spawnSync("git", ["push", "origin", "main"], { cwd: repo, stdio: "inherit" });
if (push.status !== 0) {
  console.error(`release: git push origin main failed (exit ${push.status})`);
  process.exit(1);
}
const remoteMain = git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0];
if (remoteMain !== head) {
  console.error(`release: after the push, origin/main is ${remoteMain}, not ${head}`);
  process.exit(1);
}
if (run("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`]).status === 0) {
  console.error(`release: a tag ${tag} appeared on origin — nothing here makes one; investigate`);
  process.exit(1);
}
console.log(`pushed main = ${head} (read back), no tag. CI now: checks -> tag ${tag} -> Release page -> crates.io.`);
console.log("Watch: https://github.com/synapticforge1/wasmrt/actions");
