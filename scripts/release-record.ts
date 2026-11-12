// release-record.ts — what a release must have WRITTEN before it may be tagged (workspace letters
// H33 and H35; release-process.md § 5, U1 and U11; review-process.md § 0 and § 6).
//
//   bun scripts/release-record.ts notes   X.Y.Z   CHANGELOG.md has a non-empty `## [X.Y.Z]` section
//   bun scripts/release-record.ts reviews X.Y.Z   cmem/release.md § "Release History" has a `### X.Y.Z`
//                                                 entry with a summary and BOTH required reviews
//
// `notes` exists because the Release page is made FROM the CHANGELOG section AFTER CI has tagged: a
// missing section found then cannot be fixed without a new version (a published tag never moves), so
// it is checked before the tag — by `gate.ts --release` in CI and by `release.ts` locally. The rule is
// the one `github-release.ts page` applies (heading `## [X.Y.Z]`, body up to the next `## [`).
//
// `reviews`: 🔒 owner, 2026-11-12: "security and hardening reviews should be required before every
// release". The entry must carry one line starting `**Security review:**` and one starting
// `**Hardening review:**` (a list bullet before it is fine), each saying how it ENDED: the words
// "empty round". A line that still says pending / TODO / not run / TBD does not count. The entry also
// needs a summary — at least one line of prose that is not a review line (U11).
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

if (command === "notes") {
  const path = process.env.WASMRT_CHANGELOG || join(repo, "CHANGELOG.md");
  const lines = read(path).split("\n");
  const pre = `## [${version}]`;
  const start = lines.findIndex((l) => l.startsWith(pre));
  if (start < 0) fail(`no CHANGELOG section "${pre}" in ${path}: the Release page would be refused after CI tags`);
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## ["));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end).join("\n").trim();
  if (!body) fail(`the CHANGELOG section "${pre}" is empty: the Release page would be refused after CI tags`);
  console.log(`CHANGELOG ${pre}: ${body.length} characters — the Release page can be made`);
  process.exit(0);
}

// reviews
const path = process.env.WASMRT_RELEASE_MD || join(repo, "cmem", "release.md");
const lines = read(path).split("\n");
const history = lines.findIndex((l) => /^## Release History\s*$/.test(l));
if (history < 0) fail(`${path} has no "## Release History" section`);
const esc = version.replace(/\./g, "\\.");
const head = new RegExp(`^### ${esc}(\\s|$)`);
const start = lines.findIndex((l, i) => i > history && head.test(l));
const nextH2 = lines.findIndex((l, i) => i > history && /^## /.test(l));
if (start < 0 || (nextH2 > 0 && start > nextH2)) fail(`no "### ${version}" entry under "## Release History" in ${path}`);
let end = lines.findIndex((l, i) => i > start && /^#{2,3} /.test(l));
if (end < 0) end = lines.length;
const entry = lines.slice(start + 1, end);

const UNFINISHED = /\b(pending|todo|tbd|not run|not yet)\b/i;
function review(kind: "Security" | "Hardening"): string {
  const re = new RegExp(`^\\s*(?:[-*]\\s+)?\\*\\*${kind} review:\\*\\*\\s*(.*)$`);
  const found = entry.map((l) => re.exec(l)).filter((x): x is RegExpExecArray => x !== null);
  if (found.length === 0) fail(`the ${version} entry has no "**${kind} review:**" line (required before every release, H35)`);
  if (found.length > 1) fail(`the ${version} entry has ${found.length} "**${kind} review:**" lines; write one`);
  // The record may wrap: take the line and its indented continuation lines.
  const at = entry.indexOf(found[0].input);
  let text = found[0][1];
  for (let i = at + 1; i < entry.length && /^\s{2,}\S/.test(entry[i]) && !/\*\*\w+ review:\*\*/.test(entry[i]); i++) {
    text += ` ${entry[i].trim()}`;
  }
  if (UNFINISHED.test(text)) fail(`the ${version} ${kind.toLowerCase()} review is not finished: "${text.slice(0, 120)}"`);
  if (!/empty round/i.test(text)) {
    fail(`the ${version} ${kind.toLowerCase()} review does not say it ended with an empty round: "${text.slice(0, 120)}"`);
  }
  return text;
}
const sec = review("Security");
const hard = review("Hardening");
const prose = entry.filter((l) => l.trim() && !/\*\*(Security|Hardening) review:\*\*/.test(l) && !/^\s{2,}\S/.test(l));
if (prose.length === 0) fail(`the ${version} entry has no summary of what changed (U11)`);
console.log(`cmem/release.md ${version}: summary (${prose.length} lines); security review — ${sec.slice(0, 80)}; hardening review — ${hard.slice(0, 80)}`);
