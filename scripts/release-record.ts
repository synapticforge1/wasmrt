// release-record.ts — what a release must have WRITTEN before it may be tagged (workspace letters
// H33 and H35; release-process.md § 5, U1 and U11; review-process.md § 0 and § 6).
//
//   bun scripts/release-record.ts notes   X.Y.Z   CHANGELOG.md has a non-empty `## [X.Y.Z]` section
//   bun scripts/release-record.ts reviews X.Y.Z   cmem/release.md § "Release History" has a
//                                                 `### X.Y.Z — YYYY-MM-DD — …` entry with a summary
//                                                 and BOTH required reviews, each ended by an empty round
//
// `notes` exists because the Release page is made FROM the CHANGELOG section AFTER CI has tagged: a
// missing section found then cannot be fixed without a new version (a published tag never moves), so
// it is checked before the tag — by `gate.ts --release` in CI and by `release.ts` locally.
// `github-release.ts page` applies the SAME rule (`sectionFor`, kept identical there because CI fetches
// that one file alone): the heading is exactly `## [X.Y.Z]` followed by a space or the line's end, so
// `## [1.2.3]-rc.1` is not 1.2.3's; the body runs to the next `## [`; lines inside ``` fences and
// `<!-- … -->` comments do not count as body, and a heading inside a fence is not a heading.
//
// `reviews`: 🔒 owner, 2026-11-12: "security and hardening reviews should be required before every
// release". The entry must carry ONE line starting `**Security review:**` and ONE starting
// `**Hardening review:**` (a list bullet before it is fine; it may wrap onto indented lines), and each
// must END with the fixed clause
//
//     Ended by an empty round: round <N>, <YYYY-MM-DD>.
//
// A fixed sentence, not a phrase search: a search for "empty round" passed "did not end with an empty
// round" and "no empty round reached" (review round 1, 2026-11-12, two reviewers independently). The
// entry also needs a summary — at least one line of prose that is not a review line (U11). Fenced code
// and HTML comments are ignored everywhere in the entry.
//
// Paths can be overridden for the self-test: WASMRT_CHANGELOG, WASMRT_RELEASE_MD.
// `node:` builtins only. Self-test: `bun scripts/check-release-record.ts`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const repo = join(import.meta.dirname!, "..");
const [command, version] = process.argv.slice(2);

function fail(msg: string): never {
  console.error(`release-record: ${msg}`);
  process.exit(1);
}
if (!["notes", "reviews"].includes(command ?? "")) fail(`the first argument must be notes | reviews (got "${command ?? ""}")`);
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) fail(`the second argument must be X.Y.Z (got "${version ?? ""}")`);
if (process.argv.length > 4) fail(`unexpected arguments: ${process.argv.slice(4).join(" ")}`);

function read(path: string): string {
  try {
    return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  } catch (e) {
    fail(`cannot read ${path}: ${(e as Error).message}`);
  }
}

/** The lines that are text: fenced code blocks and HTML comments become empty lines (kept, so line
 *  positions stay meaningful). */
function prose(lines: string[]): string[] {
  const out: string[] = [];
  let fence = false, comment = false;
  for (const raw of lines) {
    let l = raw;
    if (/^\s*```/.test(l)) { fence = !fence; out.push(""); continue; }
    if (fence) { out.push(""); continue; }
    let kept = "";
    while (l.length) {
      if (comment) {
        const end = l.indexOf("-->");
        if (end < 0) { l = ""; break; }
        comment = false;
        l = l.slice(end + 3);
      } else {
        const start = l.indexOf("<!--");
        if (start < 0) { kept += l; break; }
        kept += l.slice(0, start);
        comment = true;
        l = l.slice(start + 4);
      }
    }
    out.push(kept);
  }
  return out;
}

const esc = version.replace(/\./g, "\\.");

if (command === "notes") {
  const path = process.env.WASMRT_CHANGELOG || join(repo, "CHANGELOG.md");
  const lines = prose(read(path).split("\n"));
  const head = new RegExp(`^## \\[${esc}\\](\\s|$)`);
  const start = lines.findIndex((l) => head.test(l));
  if (start < 0) fail(`no CHANGELOG section "## [${version}]" in ${path}: the Release page would be refused after CI tags`);
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## ["));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end).join("\n").trim();
  if (!body) fail(`the CHANGELOG section "## [${version}]" is empty: the Release page would be refused after CI tags`);
  console.log(`CHANGELOG ## [${version}]: ${body.length} characters — the Release page can be made`);
  process.exit(0);
}

// reviews
const path = process.env.WASMRT_RELEASE_MD || join(repo, "cmem", "release.md");
const lines = prose(read(path).split("\n"));
const history = lines.findIndex((l) => /^## Release History\s*$/.test(l));
if (history < 0) fail(`${path} has no "## Release History" section`);
const nextH2 = lines.findIndex((l, i) => i > history && /^## /.test(l));
const stop = nextH2 < 0 ? lines.length : nextH2;
const head = new RegExp(`^### ${esc}(\\s|$)`);
const start = lines.findIndex((l, i) => i > history && i < stop && head.test(l));
if (start < 0) fail(`no "### ${version}" entry under "## Release History" in ${path}`);
if (!new RegExp(`^### ${esc} — \\d{4}-\\d{2}-\\d{2} — \\S`).test(lines[start])) {
  fail(`the ${version} heading must read "### ${version} — YYYY-MM-DD — <one line>" (got "${lines[start]}")`);
}
let end = lines.findIndex((l, i) => i > start && /^#{2,3} /.test(l));
if (end < 0 || end > stop) end = stop;
const entry = lines.slice(start + 1, end);

const CLAUSE = /Ended by an empty round: round ([1-9]\d*), (\d{4}-\d{2}-\d{2})\.$/;
const REVIEW_LINE = /\*\*(Security|Hardening) review:\*\*/;
function review(kind: "Security" | "Hardening"): string {
  const re = new RegExp(`^\\s*(?:[-*]\\s+)?\\*\\*${kind} review:\\*\\*\\s*(.*)$`);
  const at = entry.map((l, i) => (re.test(l) ? i : -1)).filter((i) => i >= 0);
  if (at.length === 0) fail(`the ${version} entry has no "**${kind} review:**" line (required before every release, H35)`);
  if (at.length > 1) fail(`the ${version} entry has ${at.length} "**${kind} review:**" lines; write one`);
  // The record may wrap: take the line and its indented continuation lines.
  let text = re.exec(entry[at[0]])![1];
  for (let i = at[0] + 1; i < entry.length && /^\s{2,}\S/.test(entry[i]) && !REVIEW_LINE.test(entry[i]); i++) {
    text += ` ${entry[i].trim()}`;
  }
  text = text.replace(/\s+/g, " ").trim();
  if (!CLAUSE.test(text)) {
    fail(`the ${version} ${kind.toLowerCase()} review must END with "Ended by an empty round: round <N>, <YYYY-MM-DD>." (got "${text.slice(-120)}")`);
  }
  return text;
}
const sec = review("Security");
const hard = review("Hardening");
const summary = entry.filter((l) => l.trim() && !REVIEW_LINE.test(l) && !/^\s{2,}\S/.test(l));
if (summary.length === 0) fail(`the ${version} entry has no summary of what changed (U11)`);
console.log(`cmem/release.md ${version}: summary (${summary.length} lines); security review — ${CLAUSE.exec(sec)![0]}; hardening review — ${CLAUSE.exec(hard)![0]}`);
