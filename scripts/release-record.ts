// release-record.ts — what a release must have WRITTEN before it may be tagged (workspace letters
// H33 and H37; release-process.md § 5, U1 and U11; workspace platforms.md, the "Tested on" rule).
//
//   bun scripts/release-record.ts notes X.Y.Z   CHANGELOG.md has a non-empty `## [X.Y.Z]` section
//                                               with its Tested on lines
//   bun scripts/release-record.ts entry X.Y.Z   cmem/release.md § "Release History" has a
//                                               `### X.Y.Z — YYYY-MM-DD — …` entry with a summary
//                                               and its Tested on lines
//
// 🔒 Tested on (owner, 2026-11-19; letter H37): every release carries one line per platform actually
// run — `Tested on: <OS and version> (<platform ID>)`, the ID one of win-x64, win-arm64, mac-x64,
// mac-arm64, linux-x64, linux-arm64 — on the Release page (made from the CHANGELOG section), in the
// release.md entry and in the README, and claims nothing for the others: unless all six are listed,
// a line saying "other platforms: not yet tested". A Tested on line may be a list item.
//
// The reviews are no longer checked here: H37 (d) replaced H35's two record paragraphs with
// `scripts/review-gate.ts`, which reads the review's result in the gitignored issues file.
//
// `notes` exists because the Release page is made FROM the CHANGELOG section AFTER CI has tagged: a
// missing section found then cannot be fixed without a new version (a published tag never moves), so
// it is checked before the tag — by `gate.ts --release`, which `release.ts` runs before it pushes.
// `github-release.ts page` applies the SAME rule (`sectionFor`, kept identical there because CI fetches
// that one file alone): the heading is exactly `## [X.Y.Z]` followed by a space or the line's end, so
// `## [1.2.3]-rc.1` is not 1.2.3's; the body runs to the next `## [`; lines inside ``` fences and
// `<!-- … -->` comments do not count as body, and a heading inside a fence is not a heading.
//
// `entry` needs a summary — at least one line of prose that is not a Tested on line (U11). Fenced
// code and HTML comments are ignored everywhere, in both files.
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
if (!["notes", "entry"].includes(command ?? "")) fail(`the first argument must be notes | entry (got "${command ?? ""}")`);
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
    // Comment markers are FOUND in a mask where inline code spans are blanked (a `<!--` inside
    // backticks opens no comment — review round 2), and CUT from the original line, so code text
    // itself stays (review round 3: blanking the text emptied page titles and hid text after the
    // review clause). The mask keeps every position.
    const mask = comment ? l : l.replace(/`[^`]*`/g, (s) => " ".repeat(s.length));
    let kept = "";
    let i = 0;
    while (i < l.length) {
      if (comment) {
        const end = mask.indexOf("-->", i);
        if (end < 0) { i = l.length; break; }
        comment = false;
        i = end + 3;
      } else {
        const start = mask.indexOf("<!--", i);
        if (start < 0) { kept += l.slice(i); break; }
        kept += l.slice(i, start);
        comment = true;
        i = start + 4;
      }
    }
    out.push(kept);
  }
  return out;
}

const esc = version.replace(/\./g, "\\.");

/** YYYY-MM-DD that names a day that exists (2026-13-45 does not). */
function realDate(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

const PLATFORMS = ["win-x64", "win-arm64", "mac-x64", "mac-arm64", "linux-x64", "linux-arm64"];
const TESTED_ON = /^\s*(?:(?:[-*+]|\d+[.)])\s+)?(?:\*\*)?Tested on:(?:\*\*)?\s+(\S.*?)\s+\(`?([\w.-]+)`?\)\s*\.?\s*$/;

/** The platform IDs the Tested on lines name; fails on a malformed or unknown one, on none, or on a
 *  partial list without "other platforms: not yet tested". */
function testedOn(lines: string[], where: string): string[] {
  const ids: string[] = [];
  for (const l of lines) {
    if (!/Tested on:/.test(l)) continue;
    const m = TESTED_ON.exec(l);
    if (!m) fail(`${where}: a Tested on line must read "Tested on: <OS and version> (<platform ID>)" (got "${l.trim()}")`);
    if (!PLATFORMS.includes(m[2])) fail(`${where}: "${m[2]}" is not a platform ID (${PLATFORMS.join(", ")})`);
    if (ids.includes(m[2])) fail(`${where}: ${m[2]} has two Tested on lines`);
    ids.push(m[2]);
  }
  if (ids.length === 0) fail(`${where} has no "Tested on: <OS and version> (<platform ID>)" line (owner, 2026-11-19)`);
  if (ids.length < PLATFORMS.length && !lines.some((l) => /other platforms: not yet tested/i.test(l))) {
    fail(`${where} names ${ids.join(", ")} only, and does not say "other platforms: not yet tested"`);
  }
  return ids;
}

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
  const ids = testedOn(lines.slice(start + 1, end), `the CHANGELOG section "## [${version}]"`);
  console.log(`CHANGELOG ## [${version}]: ${body.length} characters, tested on ${ids.join(", ")} — the Release page can be made`);
  process.exit(0);
}

// entry
const path = process.env.WASMRT_RELEASE_MD || join(repo, "cmem", "release.md");
const lines = prose(read(path).split("\n"));
const history = lines.findIndex((l) => /^## Release History\s*$/.test(l));
if (history < 0) fail(`${path} has no "## Release History" section`);
const nextH2 = lines.findIndex((l, i) => i > history && /^## /.test(l));
const stop = nextH2 < 0 ? lines.length : nextH2;
const head = new RegExp(`^### ${esc}(\\s|$)`);
const start = lines.findIndex((l, i) => i > history && i < stop && head.test(l));
if (start < 0) fail(`no "### ${version}" entry under "## Release History" in ${path}`);
// The separators may be an em dash, an en dash or a hyphen (review round 2: a plausible "–" or "-"
// was refused); the date must be a real calendar date.
const hm = new RegExp(`^### ${esc} [—–-] (\\d{4}-\\d{2}-\\d{2}) [—–-] \\S`).exec(lines[start]);
if (!hm || !realDate(hm[1])) {
  fail(`the ${version} heading must read "### ${version} — YYYY-MM-DD — <one line>" with a real date (got "${lines[start]}")`);
}
let end = lines.findIndex((l, i) => i > start && /^#{2,3} /.test(l));
if (end < 0 || end > stop) end = stop;
const entry = lines.slice(start + 1, end);

const ids = testedOn(entry, `the ${version} entry`);
const summary = entry.filter((l) => l.trim() && !/Tested on:|other platforms: not yet tested/i.test(l) && !/^(\s{2,}|\t)\S/.test(l));
if (summary.length === 0) fail(`the ${version} entry has no summary of what changed (U11)`);
console.log(`cmem/release.md ${version}: summary (${summary.length} lines); tested on ${ids.join(", ")}`);
