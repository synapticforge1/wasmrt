// review-gate.ts — the release's first step (workspace review standard, letter H37 (d);
// review-process.md § 9: "the release tooling runs the review set as its first step"). The review is
// agent work and cannot run inside a script, so the release checks its RESULT: the gitignored
// `cmem/review-issues.md` must hold ONE line `Review complete: <commit>` — written by the main agent
// only when a re-review came back empty in every class and the full suite passed — and nothing a
// review reads may have changed between that commit and HEAD. Shape taken from LeptonPad's
// `scripts/review-gate.ts` (2026-11-19).
//
// What may change after the reviewed commit (everything else is code the review did not read):
//   - the bump commit's files, `Cargo.toml` and `Cargo.lock`, in `version = "…"` lines only;
//   - the release notes: `CHANGELOG.md`, and `cmem/` (but not the issues file itself);
//   - `README.md` lines that name a version or say `Tested on:` (the release's own facts).
//
//   bun scripts/review-gate.ts      exit 0 when the review covers HEAD; 1 with the reason otherwise
//
// It replaces `release-record.ts reviews` (the two record paragraphs of H35). Run by
// `gate.ts --release`, which `release.ts` runs before it pushes. `node:` builtins only.
// Self-test: `bun scripts/check-review-gate.ts`.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

export const ISSUES_FILE = "cmem/review-issues.md";

/** The reviewed commit recorded in the issues file's text, or why there is none. */
export function reviewedCommit(text: string): { commit: string } | { refusal: string } {
  text = text.replace(/^﻿/, ""); // a Windows editor's byte-order mark would hide a first-line match
  const lines = [...text.matchAll(/^Review complete:[ \t]*(\S*)[ \t]*\r?$/gm)];
  if (lines.length === 0) return { refusal: `no "Review complete:" line in ${ISSUES_FILE}` };
  if (lines.length > 1) return { refusal: `more than one "Review complete:" line in ${ISSUES_FILE}` };
  const value = lines[0][1];
  if (value === "none" || value === "") return { refusal: `${ISSUES_FILE} says no review is complete ("Review complete: none")` };
  if (!/^[0-9a-f]{7,40}$/.test(value)) return { refusal: `"Review complete: ${value}" is not a commit id` };
  return { commit: value };
}

/** Whether every changed line of a unified diff (`git diff -U0`) satisfies `ok`. */
function onlyLines(diff: string, ok: (line: string) => boolean): boolean {
  return diff.split("\n").filter((l) => /^[-+](?![-+]{2} )/.test(l)).every((l) => ok(l.slice(1)));
}

const VERSION_LINE = /^version\s*=\s*"\d+\.\d+\.\d+"\s*$/;
const README_LINE = (l: string) => /Tested on:/.test(l) || /\b\d+\.\d+\.\d+\b/.test(l) || l.trim() === "";

/** The changed paths the review did not read, given each path's `git diff -U0` text. */
export function unreviewed(changed: ReadonlyMap<string, string>): string[] {
  const out: string[] = [];
  for (const [path, diff] of changed) {
    if (path === ISSUES_FILE) out.push(path);
    else if (path === "CHANGELOG.md" || path.startsWith("cmem/")) continue;
    else if (path === "Cargo.toml" || path === "Cargo.lock") { if (!onlyLines(diff, (l) => VERSION_LINE.test(l))) out.push(path); }
    else if (path === "README.md") { if (!onlyLines(diff, README_LINE)) out.push(path); }
    else out.push(path);
  }
  return out;
}

function git(root: string, args: string[]): { status: number | null; out: string; err: string } {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
  return { status: r.status, out: r.stdout ?? "", err: (r.stderr ?? "").trim() };
}

if (import.meta.main) {
  const root = process.env.WASMRT_REVIEW_ROOT || join(import.meta.dirname!, "..");
  const fail = (msg: string): never => {
    console.error(`review-gate: ${msg} — run the review (cmem/review-process.md) before releasing`);
    process.exit(1);
  };
  if (process.argv.length > 2) fail(`unexpected arguments: ${process.argv.slice(2).join(" ")}`);
  const file = join(root, ISSUES_FILE);
  if (!existsSync(file)) fail(`${ISSUES_FILE} does not exist`);
  const r = reviewedCommit(readFileSync(file, "utf8"));
  if ("refusal" in r) fail(r.refusal);
  const commit = (r as { commit: string }).commit;
  const full = git(root, ["rev-parse", "--verify", "--quiet", `${commit}^{commit}`]);
  if (full.status !== 0) fail(`the reviewed commit ${commit} is not in this repository`);
  const reviewed = full.out.trim();
  if (git(root, ["merge-base", "--is-ancestor", reviewed, "HEAD"]).status !== 0) fail(`the reviewed commit ${commit} is not an ancestor of HEAD`);
  const names = git(root, ["diff", "--name-only", "-z", reviewed, "HEAD"]);
  if (names.status !== 0) fail(`git diff failed: ${names.err}`);
  const changed = new Map<string, string>();
  for (const p of names.out.split("\0").filter(Boolean)) changed.set(p, git(root, ["diff", "-U0", reviewed, "HEAD", "--", p]).out);
  const bad = unreviewed(changed);
  if (bad.length) fail(`changed since the reviewed commit ${commit}, and not reviewed:\n  ${bad.join("\n  ")}`);
  console.log(`review-gate: the review at ${commit} covers HEAD (${changed.size} release-note or version file(s) changed since)`);
}
