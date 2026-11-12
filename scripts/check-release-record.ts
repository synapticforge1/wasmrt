// Self-test of scripts/release-record.ts: each case writes a CHANGELOG.md or a release.md, runs the
// script as a subprocess, and asserts the exit code and a fragment of the output. Inverted by mutants
// (cmem/releasing.md § Tooling).
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

// ── reviews ──
const entry = (body: string, v = "1.2.3") =>
  `# release.md\n\n## Release History\n\nNewest first.\n\n### ${v} — 2026-11-12\n\n${body}\n### 1.2.2 — 2026-11-01\n\nolder\n\n## Process\n\ntext\n`;
const SUM = "A fix to the widget; nothing else changed.";
const SEC = "- **Security review:** two rounds (3 findings, then 0); ended by an empty round, round 2.";
const HARD = "- **Hardening review:** one round, an empty round; the reference sets re-run.";
run("reviews: summary and both reviews ended by an empty round", ["reviews", "1.2.3"], { release: entry(`${SUM}\n\n${SEC}\n${HARD}\n`) }, {
  code: 0, out: "security review — two rounds",
});
run("reviews: a wrapped review line counts", ["reviews", "1.2.3"], {
  release: entry(`${SUM}\n\n- **Security review:** two rounds (3 findings, then 0); ended by\n  an empty round, round 2.\n${HARD}\n`),
}, { code: 0, out: "hardening review" });
run("reviews: no security review", ["reviews", "1.2.3"], { release: entry(`${SUM}\n\n${HARD}\n`) }, {
  code: 1, out: 'no "**Security review:**" line',
});
run("reviews: no hardening review", ["reviews", "1.2.3"], { release: entry(`${SUM}\n\n${SEC}\n`) }, {
  code: 1, out: 'no "**Hardening review:**" line',
});
run("reviews: a review not ended by an empty round", ["reviews", "1.2.3"], {
  release: entry(`${SUM}\n\n- **Security review:** round 1 found 3; fixed.\n${HARD}\n`),
}, { code: 1, out: "does not say it ended with an empty round" });
run("reviews: a review still pending", ["reviews", "1.2.3"], {
  release: entry(`${SUM}\n\n- **Security review:** pending — will end with an empty round.\n${HARD}\n`),
}, { code: 1, out: "is not finished" });
run("reviews: two security lines", ["reviews", "1.2.3"], { release: entry(`${SUM}\n\n${SEC}\n${SEC}\n${HARD}\n`) }, {
  code: 1, out: "2 \"**Security review:**\" lines",
});
run("reviews: no summary", ["reviews", "1.2.3"], { release: entry(`${SEC}\n${HARD}\n`) }, { code: 1, out: "no summary" });
run("reviews: no entry for the version", ["reviews", "1.2.4"], { release: entry(`${SUM}\n\n${SEC}\n${HARD}\n`) }, {
  code: 1, out: 'no "### 1.2.4" entry',
});
run("reviews: 1.2.3's reviews do not count for 1.2.30", ["reviews", "1.2.30"], { release: entry(`${SUM}\n\n${SEC}\n${HARD}\n`) }, {
  code: 1, out: 'no "### 1.2.30" entry',
});
run("reviews: 1.2.30's reviews do not count for 1.2.3", ["reviews", "1.2.3"], { release: entry(`${SUM}\n\n${SEC}\n${HARD}\n`, "1.2.30") }, {
  code: 1, out: 'no "### 1.2.3" entry',
});
run("reviews: an entry under a LATER section does not count", ["reviews", "1.2.3"], {
  release: `# release.md\n\n## Release History\n\n### 1.2.2\n\nolder\n\n## Archive\n\n### 1.2.3\n\n${SUM}\n${SEC}\n${HARD}\n`,
}, { code: 1, out: 'no "### 1.2.3" entry' });
run("reviews: an older entry's reviews do not count for a newer one", ["reviews", "1.2.2"], {
  release: entry(`${SUM}\n\n${SEC}\n${HARD}\n`),
}, { code: 1, out: 'no "**Security review:**" line' });
run("reviews: an entry outside Release History does not count", ["reviews", "1.2.3"], {
  release: `# release.md\n\n## Notes\n\n### 1.2.3\n\n${SUM}\n${SEC}\n${HARD}\n\n## Release History\n\n### 1.2.2\n\nolder\n`,
}, { code: 1, out: 'no "### 1.2.3" entry' });
run("reviews: no Release History section", ["reviews", "1.2.3"], { release: "# release.md\n\nnothing\n" }, {
  code: 1, out: 'no "## Release History"',
});

// ── arguments ──
run("bad version", ["notes", "v1.2.3"], { changelog: cl }, { code: 1, out: "must be X.Y.Z" });
run("unknown command", ["page", "1.2.3"], {}, { code: 1, out: "notes | reviews" });

rmSync(dir, { recursive: true, force: true });
console.log(`\nrelease-record self-test: ${pass} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
