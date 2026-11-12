// gate.ts — THE gate, one list, run by CI's `checks` job and by `scripts/release.ts` alike, so the
// local gate IS CI's gate (workspace working-rules § The gate; letter H33, slots U4 and U5).
//
//   bun scripts/gate.ts             every push of `main`: build, tests, lints, the self-tests, the
//                                   previous release's tests, the publish dry run
//   bun scripts/gate.ts --release   also what only a NEW version needs: the floor since the last
//                                   release (`bump.ts --verify-tag`), the CHANGELOG section the page
//                                   is made from, and the release's entry in cmem/release.md with
//                                   both required reviews (review-process.md § 0, letter H35)
//
// Each step's exit code is read; the first failure stops the gate with that step's name — and in
// GitHub Actions also as an error annotation carrying the step's failing lines, readable through the
// public API without a login (the job log is not; found 2026-11-12, run 43287131453). Steps that
// need a tool this host lacks fail loudly rather than skip (a C compiler: set CC, `c-gate.ts`).
// Not here, by nature: S2 (`behaviour-s2.ts`, the spec suite from wasmtk's corpus — a sibling
// checkout CI does not have) and S3; `cmem/releasing.md` keeps them in the local checklist.
import { spawn } from "node:child_process";
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

type Step = [label: string, cmd: string, args: string[], env?: Record<string, string>];
const bun = process.execPath;
const steps: Step[] = [
  ["eol", bun, ["scripts/eol-gate.ts"]],
  ["shared definitions", bun, ["scripts/definitions.ts", "--check"]],
  ["build (release)", "cargo", ["build", "--workspace", "--release", "--locked"]],
  ["tests", "cargo", ["test", "--workspace", "--locked"]],
  ["clippy", "cargo", ["clippy", "--workspace", "--all-targets", "--locked", "--", "-D", "warnings"]],
  ["public surface is current", bun, ["scripts/surface.ts", "--check"]],
  ["C ABI", bun, ["scripts/c-gate.ts"]],
  ["release-page script self-test", bun, ["scripts/check-github-release.ts"]],
  ["crates.io script self-test", bun, ["scripts/check-crates-io.ts"]],
  ["release-record check self-test", bun, ["scripts/check-release-record.ts"]],
  ["previous release's tests against this tree", bun, ["scripts/prev-tag-tests.ts"]],
  ["publish dry run (all three crates, dependency order)", "cargo", ["publish", "--workspace", "--locked", "--no-verify", "--dry-run"]],
];
if (release) {
  steps.push(
    ["the floor since the last release", bun, ["scripts/bump.ts", "--verify-tag", `v${version}`]],
    ["the CHANGELOG section the page is made from", bun, ["scripts/release-record.ts", "notes", version]],
    ["cmem/release.md records both required reviews", bun, ["scripts/release-record.ts", "reviews", version]],
  );
}

/** Run a step with its output streamed through (a 10-minute test run must show progress) and its
 *  last lines kept, so a failure can be reported by name WITH its cause. */
function runStep(cmd: string, args: string[], env: Record<string, string> | undefined): Promise<{ code: number | null; tail: string[] }> {
  return new Promise((resolve) => {
    const tail: string[] = [];
    const keep = (chunk: Buffer) => {
      for (const l of chunk.toString("utf8").split(/\r?\n/)) if (l.trim()) tail.push(l);
      if (tail.length > 200) tail.splice(0, tail.length - 200);
    };
    const p = spawn(cmd, args, { cwd: repo, stdio: ["inherit", "pipe", "pipe"], env: { ...process.env, ...env } });
    p.stdout.on("data", (c: Buffer) => { process.stdout.write(c); keep(c); });
    p.stderr.on("data", (c: Buffer) => { process.stderr.write(c); keep(c); });
    p.on("error", (e) => { tail.push(`could not start ${cmd}: ${e.message}`); resolve({ code: -1, tail }); });
    p.on("close", (code) => resolve({ code, tail }));
  });
}

console.log(`gate${release ? " --release" : ""}: ${steps.length} steps, version ${version}`);
for (const [label, cmd, args, env] of steps) {
  console.log(`\n== ${label}: ${cmd === bun ? "bun" : cmd} ${args.join(" ")}`);
  const r = await runStep(cmd, args, env);
  if (r.code !== 0) {
    console.error(`\ngate: FAILED at "${label}" (exit ${r.code})`);
    // In GitHub Actions, also as an error ANNOTATION: the API serves annotations to anyone, while a
    // job's log needs a login — and this project reads CI without `gh` (workspace Tooling rule 9).
    if (process.env.GITHUB_ACTIONS === "true") {
      const esc = (s: string) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
      const why = r.tail.filter((l) => /error|fail|panick|refus|✗|FAILED|warning: unused/i.test(l)).slice(-25);
      const body = (why.length ? why : r.tail.slice(-25)).join("\n").slice(-3500);
      console.log(`::error title=${esc(`gate failed at "${label}" (exit ${r.code})`).replace(/[:,]/g, " ")}::${esc(body)}`);
    }
    process.exit(1);
  }
}
console.log(`\ngate${release ? " --release" : ""}: all ${steps.length} steps passed for ${version}`);
