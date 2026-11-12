// Self-test of scripts/release-record.ts: each case writes a CHANGELOG.md or a release.md, runs the
// script as a subprocess, and asserts the exit code and a fragment of the output. Inverted by mutants
// (cmem/releasing.md § Tooling). The hostile wordings are the ones review round 1 (2026-11-12) found
// passing the first version of the check.
//
//   bun scripts/check-release-record.ts [path/to/release-record.ts]
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const SCRIPT = process.argv[2] ?? join(import.meta.dirname!, "release-record.ts");
const dir = mkdtempSync(join(tmpdir(), "wasmrt-record-"));
const CHANGELOG = join(dir, "CHANGELOG.md");
const RELEASE = join(dir, "release.md");

let pass = 0, failed = 0;
function run(name: string, args: string[], files: { changelog?: string; release?: string }, want: { code: number; out: string }) {
  if (files.changelog !== undefined) writeFileSync(CHANGELOG, files.changelog);
  if (files.release !== undefined) writeFileSync(RELEASE, files.release);
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", WASMRT_CHANGELOG: CHANGELOG, WASMRT_RELEASE_MD: RELEASE },
  });
  const out = `${r.stdout}${r.stderr}`;
  if (r.status === want.code && out.includes(want.out)) pass++;
  else {
    failed++;
    console.log(`  FAIL: ${name} — exit ${r.status} (want ${want.code}), output: ${out.trim().slice(0, 240)}`);
  }
}

// ── notes ──
const cl = "# Changelog\n\n## [Unreleased]\n\n## [1.2.3] — 2026-11-12\n\n### Fixed\n- a thing\n\n## [1.2.2] — empty\n\n## [1.2.1]\n- x\n";
run("notes: a section with a body", ["notes", "1.2.3"], { changelog: cl }, { code: 0, out: "can be made" });
run("notes: the last section, to end of file", ["notes", "1.2.1"], { changelog: cl }, { code: 0, out: "can be made" });
run("notes: no section", ["notes", "9.9.9"], { changelog: cl }, { code: 1, out: "no CHANGELOG section" });
run("notes: an empty section", ["notes", "1.2.2"], { changelog: cl }, { code: 1, out: "is empty" });
run("notes: a CRLF file reads the same", ["notes", "1.2.3"], { changelog: cl.replace(/\n/g, "\r\n") }, { code: 0, out: "can be made" });
run("notes: `## [1.2.4]-rc.1` is not 1.2.4's section", ["notes", "1.2.4"], { changelog: "## [1.2.4]-rc.1\n- x\n" }, {
  code: 1, out: "no CHANGELOG section",
});
run("notes: a body that is only an HTML comment is empty", ["notes", "1.2.4"], { changelog: "## [1.2.4]\n<!-- later -->\n\n## [1.2.3]\n- x\n" }, {
  code: 1, out: "is empty",
});
run("notes: a heading inside a code fence is not a heading", ["notes", "1.2.4"], { changelog: "## [1.2.3]\n```\n## [1.2.4]\n- x\n```\n" }, {
  code: 1, out: "no CHANGELOG section",
});

// ── reviews ──
const entry = (body: string, v = "1.2.3", head = `### ${v} — 2026-11-12 — a test`) =>
  `# release.md\n\n## Release History\n\nNewest first.\n\n${head}\n\n${body}\n### 1.2.2 — 2026-11-01 — older\n\nolder\n\n## Process\n\ntext\n`;
const SUM = "A fix to the widget; nothing else changed.";
const SEC = "- **Security review:** two rounds (3 findings, then 0). Ended by an empty round: round 2, 2026-11-12.";
const HARD = "- **Hardening review:** one round. Ended by an empty round: round 1, 2026-11-12.";
const ok = (name: string, body: string) => run(name, ["reviews", "1.2.3"], { release: entry(body) }, { code: 0, out: "Ended by an empty round" });
const no = (name: string, body: string, out: string) => run(name, ["reviews", "1.2.3"], { release: entry(body) }, { code: 1, out });

ok("reviews: summary and both reviews with the closing clause", `${SUM}\n\n${SEC}\n${HARD}\n`);
ok("reviews: a wrapped review line counts", `${SUM}\n\n- **Security review:** two rounds (3 findings, then 0).\n  Ended by an empty round: round 2, 2026-11-12.\n${HARD}\n`);
ok("reviews: 'none pending' and 'not run' in the text are fine", `${SUM}\n\n- **Security review:** every finding fixed, none pending; S3 was not run. Ended by an empty round: round 3, 2026-11-12.\n${HARD}\n`);
// Review round 2: plausible correct entries that were refused…
const okHead = (name: string, head: string) => run(name, ["reviews", "1.2.3"], { release: entry(`${SUM}\n\n${SEC}\n${HARD}\n`, "1.2.3", head) }, { code: 0, out: "Ended by an empty round" });
okHead("reviews: an en dash in the heading", "### 1.2.3 – 2026-11-12 – a test");
okHead("reviews: a hyphen in the heading", "### 1.2.3 - 2026-11-12 - a test");
ok("reviews: `+` and numbered list markers", `${SUM}\n\n+ **Security review:** one round. Ended by an empty round: round 1, 2026-11-12.\n1. **Hardening review:** one round. Ended by an empty round: round 1, 2026-11-12.\n`);
ok("reviews: a tab-indented wrap", `${SUM}\n\n- **Security review:** one round.\n\tEnded by an empty round: round 1, 2026-11-12.\n${HARD}\n`);
ok("reviews: an inline-code `<!--` in the summary opens no comment", `The parser now handles \`<!--\` in strings.\n\n${SEC}\n${HARD}\n`);
// …and wrong ones that passed.
no("reviews: the clause hidden in a sub-bullet under 'round 2 is OWED.'", `${SUM}\n\n- **Security review:** round 2 is OWED.\n  - Ended by an empty round: round 1, 2026-11-12.\n${HARD}\n`, "must END with");
no("reviews: an impossible date in the clause", `${SUM}\n\n- **Security review:** one round. Ended by an empty round: round 1, 2026-13-45.\n${HARD}\n`, "not a real date");
run("reviews: an impossible date in the heading", ["reviews", "1.2.3"], { release: entry(`${SUM}\n\n${SEC}\n${HARD}\n`, "1.2.3", "### 1.2.3 — 2026-02-30 — x") }, {
  code: 1, out: "real date",
});
no("reviews: no security review", `${SUM}\n\n${HARD}\n`, 'no "**Security review:**" line');
no("reviews: no hardening review", `${SUM}\n\n${SEC}\n`, 'no "**Hardening review:**" line');
for (const bad of [
  "did not end with an empty round; skipped.",
  "no empty round reached.",
  "will end with an empty round.",
  "skipped (the empty round rule waived).",
  "nonempty round left open.",
  "round 3 found two defects, so it was not an empty round; round 4 is owed.",
  "stopped before an empty round (owner).",
  "Ended by an empty round: round 0, 2026-11-12.",
  "Ended by an empty round: round 2, 2026-11-12. Round 3 is owed.",
  "Ended by an empty round: round 2.",
]) {
  no(`reviews: refused — "${bad}"`, `${SUM}\n\n- **Security review:** ${bad}\n${HARD}\n`, "must END with");
}
no("reviews: a review inside a code fence does not count", `${SUM}\n\n\`\`\`\n${SEC}\n\`\`\`\n${HARD}\n`, 'no "**Security review:**" line');
no("reviews: a review inside an HTML comment does not count", `${SUM}\n\n<!--\n${SEC}\n-->\n${HARD}\n`, 'no "**Security review:**" line');
no("reviews: two security lines", `${SUM}\n\n${SEC}\n${SEC}\n${HARD}\n`, "2 \"**Security review:**\" lines");
no("reviews: no summary", `${SEC}\n${HARD}\n`, "no summary");
no("reviews: a fence and a comment are not a summary", `\`\`\`\n\`\`\`\n<!-- todo -->\n${SEC}\n${HARD}\n`, "no summary");
run("reviews: a bare `### 1.2.3` heading is refused", ["reviews", "1.2.3"], { release: entry(`${SUM}\n\n${SEC}\n${HARD}\n`, "1.2.3", "### 1.2.3") }, {
  code: 1, out: "heading must read",
});
run("reviews: no entry for the version", ["reviews", "1.2.4"], { release: entry(`${SUM}\n\n${SEC}\n${HARD}\n`) }, {
  code: 1, out: 'no "### 1.2.4" entry',
});
run("reviews: 1.2.30's reviews do not count for 1.2.3", ["reviews", "1.2.3"], { release: entry(`${SUM}\n\n${SEC}\n${HARD}\n`, "1.2.30") }, {
  code: 1, out: 'no "### 1.2.3" entry',
});
run("reviews: an entry under a LATER section does not count", ["reviews", "1.2.3"], {
  release: `# release.md\n\n## Release History\n\n### 1.2.2 — 2026-11-01 — older\n\nolder\n\n## Archive\n\n### 1.2.3 — 2026-11-12 — x\n\n${SUM}\n${SEC}\n${HARD}\n`,
}, { code: 1, out: 'no "### 1.2.3" entry' });
run("reviews: an entry BEFORE Release History does not count", ["reviews", "1.2.3"], {
  release: `# release.md\n\n## Notes\n\n### 1.2.3 — 2026-11-12 — x\n\n${SUM}\n${SEC}\n${HARD}\n\n## Release History\n\n### 1.2.2 — 2026-11-01 — older\n\nolder\n`,
}, { code: 1, out: 'no "### 1.2.3" entry' });
run("reviews: an older entry's reviews do not count for a newer one", ["reviews", "1.2.2"], {
  release: entry(`${SUM}\n\n${SEC}\n${HARD}\n`),
}, { code: 1, out: 'no "**Security review:**" line' });
run("reviews: no Release History section", ["reviews", "1.2.3"], { release: "# release.md\n\nnothing\n" }, {
  code: 1, out: 'no "## Release History"',
});

// ── arguments ──
run("bad version", ["notes", "v1.2.3"], { changelog: cl }, { code: 1, out: "must be X.Y.Z" });
run("unknown command", ["page", "1.2.3"], {}, { code: 1, out: "notes | reviews" });

rmSync(dir, { recursive: true, force: true });
console.log(`\nrelease-record self-test: ${pass} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
