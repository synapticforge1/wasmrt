// prev-tag-tests.ts — the PREVIOUS release's tests against THIS tree (workspace letter H33, slot U3:
// "for a patch or a minor runs the PREVIOUS release's tests against this tree").
//
//   bun scripts/prev-tag-tests.ts [<tag>]     default: the highest vX.Y.Z tag below Cargo.toml's version
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

/** The highest vX.Y.Z tag strictly below Cargo.toml's version, or null. */
export function previousTag(): string | null {
  const have = manifestVersion();
  const tags = must("git", ["tag", "-l", "v*"], repo).split(/\r?\n/)
    .map((t) => ({ t, v: parse(t) }))
    .filter((x): x is { t: string; v: V } => x.v !== null && /^v\d+\.\d+\.\d+$/.test(x.t) && cmp(x.v, have) < 0)
    .sort((a, b) => cmp(a.v, b.v));
  return tags.at(-1)?.t ?? null;
}

/** Run <tag>'s integration tests against HEAD. Returns the verdict; throws only when it cannot run. */
export function prevTagTests(tag: string): { green: boolean; summary: string; failures: string } {
  must("git", ["rev-parse", "--verify", "-q", `${tag}^{commit}`], repo);
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
    const present = CARRIED.filter((p) => run("git", ["cat-file", "-e", `${tag}:${p}`], repo).status === 0);
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
    console.log("no release tag below Cargo.toml's version: nothing to run");
    process.exit(0);
  }
  console.log(`== ${tag}'s integration tests (crates/*/tests/, tests/) against HEAD`);
  const t = prevTagTests(tag);
  console.log(`${tag} tests against HEAD: ${t.green ? "green" : "RED"} — ${t.summary}`);
  if (!t.green) console.log(t.failures);
  process.exit(t.green ? 0 : 1);
}
