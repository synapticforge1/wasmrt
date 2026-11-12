// prev-tag-tests.ts — the PREVIOUS release's tests against THIS tree (workspace letter H33, slot U3:
// "for a patch or a minor runs the PREVIOUS release's tests against this tree").
//
//   bun scripts/prev-tag-tests.ts [<tag>]     default: the highest vX.Y.Z tag at or below Cargo.toml's
//                                             version that is not on HEAD (between releases: the last one)
//
// Refuses (exit 1, by name) when the tag carries none of the test paths, or when a symlink lies on the
// way to one in HEAD's tree or the tag's; skips (exit 0) when Cargo.toml is a MAJOR past the tag.
//
// What is carried forward: every INTEGRATION test and its data — `crates/*/tests/` and the root
// `tests/` (the `.wast` regressions, the behaviour corpus and its snapshot, the C-ABI sources) — taken
// from the tag and laid over a scratch copy of this tree's committed HEAD, then
// `cargo test --workspace --locked --no-fail-fast --test '*'`. wasmrt's UNIT tests live inside `src/`, so they cannot
// be separated from the code they test and are not carried (they run in every `cargo test` anyway);
// what a consumer relies on is the public behaviour these files pin. The floor's behaviour stage
// (`scripts/carry-forward.ts`, run by `bump.ts`) is the other half: the modules the release ACCEPTED.
//
// A red run means this tree breaks something the previous release promised: a major, by the floor's
// own rule, or a regression. `bump.ts` refuses a patch or a minor on it; a major does not run it.
//
// The scratch copy and its own target directory live under the system temp folder and are removed
// afterwards; nothing in the working tree or cargo's usual target directory is touched.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const repo = join(import.meta.dirname!, "..");
/** The paths carried from the tag. Each is REPLACED, so a file the tag did not have is gone too. */
const CARRIED = ["crates/wasmrt-core/tests", "crates/wasmrt/tests", "tests"];

function run(cmd: string, args: string[], cwd: string, inherit = false) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 1 << 28, stdio: inherit ? "inherit" : "pipe" });
  return { status: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}
function must(cmd: string, args: string[], cwd: string): string {
  const r = run(cmd, args, cwd);
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${r.status}):\n${r.out}`);
  return r.out;
}

type V = [number, number, number];
const parse = (s: string): V | null => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(s.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const cmp = (a: V, b: V) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

function manifestVersion(): V {
  const m = /\[workspace\.package\][^[]*?\nversion\s*=\s*"([^"]+)"/.exec(readFileSync(join(repo, "Cargo.toml"), "utf8"));
  const v = m && parse(m[1]);
  if (!v) throw new Error("no X.Y.Z [workspace.package] version in Cargo.toml");
  return v;
}

/** The release whose promises this tree must keep: the highest vX.Y.Z tag at or below Cargo.toml's
 *  version that is NOT on HEAD. Between releases the manifest still says the last release, so that
 *  release IS the previous one (review round 1: "strictly below" ran v2.0.0's tests while v2.0.1 was
 *  current); on a release's own tagged commit (a CI re-run), the one before it. */
export function previousTag(): string | null {
  const have = manifestVersion();
  const head = must("git", ["rev-parse", "HEAD"], repo).trim();
  const tags = must("git", ["tag", "-l", "v*"], repo).split(/\r?\n/)
    .map((t) => ({ t, v: parse(t) }))
    .filter((x): x is { t: string; v: V } => x.v !== null && /^v\d+\.\d+\.\d+$/.test(x.t) && cmp(x.v, have) <= 0)
    .filter((x) => must("git", ["rev-parse", `${x.t}^{commit}`], repo).trim() !== head)
    .sort((a, b) => cmp(a.v, b.v));
  return tags.at(-1)?.t ?? null;
}

/** A path component that is a symlink in <ref>'s tree, on the way to any carried path — or null.
 *  The cleanup below deletes the carried paths recursively, and a symlinked parent would point that
 *  delete OUTSIDE the scratch folder (review round 1, measured in WSL: it deleted a folder outside). */
function symlinkOnTheWay(ref: string): string | null {
  for (const p of CARRIED) {
    const parts = p.split("/");
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join("/");
      const ls = run("git", ["ls-tree", ref, "--", prefix], repo).out.trim();
      if (/^120000 /m.test(ls)) return `${ref}:${prefix}`;
    }
  }
  return null;
}

/** Run <tag>'s integration tests against HEAD. Returns the verdict; throws only when it cannot run. */
export function prevTagTests(tag: string): { green: boolean; summary: string; failures: string } {
  must("git", ["rev-parse", "--verify", "-q", `${tag}^{commit}`], repo);
  for (const ref of ["HEAD", tag]) {
    const link = symlinkOnTheWay(ref);
    if (link) throw new Error(`${link} is a symlink on the way to a carried test path; refusing (the copy would reach outside its folder)`);
  }
  const present = CARRIED.filter((p) => run("git", ["cat-file", "-e", `${tag}:${p}`], repo).status === 0);
  // With no paths, `git archive <tag> --` archives the WHOLE tag, which would replace HEAD's sources
  // with the tag's and test the old release against itself (review round 1).
  if (present.length === 0) throw new Error(`${tag} has none of ${CARRIED.join(", ")}: there are no tests to carry`);
  const scratch = mkdtempSync(join(tmpdir(), "wasmrt-prev-"));
  const tree = join(scratch, "tree");
  try {
    // HEAD's committed tree (never the working tree: a release is cut from a commit), then the tag's
    // test paths in place of HEAD's. `git archive` + `tar`, run with relative names from the scratch
    // folder: no git command runs inside the copy (a worktree's metadata would sit in this repo's
    // `.git`, which git refuses on a filesystem without ownership, such as exFAT), and GNU tar reads
    // a `C:` in an archive path as a remote host.
    mkdirSync(tree);
    must("git", ["archive", "--format=tar", "-o", join(scratch, "head.tar"), "HEAD"], repo);
    must("tar", ["-xf", "../head.tar"], tree);
    for (const p of CARRIED) rmSync(join(tree, p), { recursive: true, force: true });
    must("git", ["archive", "--format=tar", "-o", join(scratch, "tests.tar"), tag, "--", ...present], repo);
    must("tar", ["-xf", "../tests.tar"], tree);
    const r = spawnSync("cargo", ["test", "--workspace", "--locked", "--no-fail-fast", "--test", "*"], {
      cwd: tree,
      encoding: "utf8",
      maxBuffer: 1 << 28,
      env: { ...process.env, CARGO_TARGET_DIR: join(scratch, "target") },
    });
    const out = `${r.stdout}\n${r.stderr}`;
    let passed = 0, failed = 0, suites = 0;
    for (const m of out.matchAll(/test result: \w+\. (\d+) passed; (\d+) failed/g)) {
      suites++;
      passed += Number(m[1]);
      failed += Number(m[2]);
    }
    // Green needs tests that RAN: a build failure or an empty selection is not a pass.
    const green = r.status === 0 && passed > 0 && failed === 0;
    const failures = green ? "" : out.split("\n").filter((l) => /FAILED|panicked|^error(\[|:)/.test(l)).slice(0, 40).join("\n");
    return { green, summary: `${passed} passed, ${failed} failed in ${suites} test binaries (exit ${r.status})`, failures };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const tag = process.argv[2] ?? previousTag();
  if (!tag) {
    console.log("no earlier release tag: nothing to run");
    process.exit(0);
  }
  // A major may break what the previous release's tests pin — that is what a major is for (bump.ts
  // skips them for a major too; review round 1 found the gate did not).
  const have = manifestVersion(), prev = parse(tag)!;
  if (!process.argv[2] && have[0] > prev[0]) {
    console.log(`${tag} → ${have.join(".")} is a major: the previous release's tests are not binding; skipped`);
    process.exit(0);
  }
  console.log(`== ${tag}'s integration tests (crates/*/tests/, tests/) against HEAD`);
  let t: ReturnType<typeof prevTagTests>;
  try {
    t = prevTagTests(tag);
  } catch (e) {
    console.log(`✗ ${(e as Error).message}`);
    process.exit(1);
  }
  console.log(`${tag} tests against HEAD: ${t.green ? "green" : "RED"} — ${t.summary}`);
  if (!t.green) console.log(t.failures);
  process.exit(t.green ? 0 : 1);
}
