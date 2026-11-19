// Self-test of scripts/release-record.ts: each case writes a CHANGELOG.md or a release.md, runs the
// script as a subprocess, and asserts the exit code and a fragment of the output. Inverted by mutants
// (cmem/releasing.md § Tooling). The heading, section and fence cases are the hostile wordings review
// rounds 1–3 (2026-11-12) found passing earlier versions; the Tested on cases are H37's (2026-11-19).
//
//   bun scripts/check-release-record.ts [path/to/release-record.ts]
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const SCRIPT = process.argv[2] ?? join(import.meta.dirname!, "release-record.ts");
const dir = mkdtempSync(join(tmpdir(), `wasmrt-record-${process.pid}-`));
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

const T = "Tested on: Windows 11 24H2 (win-x64)\nOther platforms: not yet tested.";
const T2 = "- Tested on: Windows 11 24H2 (win-x64)\n- Tested on: Ubuntu 24.04 under WSL (linux-x64)\n- Other platforms: not yet tested.";

// ── notes ──
const cl = `# Changelog\n\n## [Unreleased]\n\n## [1.2.3] — 2026-11-12\n\n### Fixed\n- a thing\n\n${T}\n\n## [1.2.2] — empty\n\n## [1.2.1]\n- x\n${T}\n`;
run("notes: a section with a body", ["notes", "1.2.3"], { changelog: cl }, { code: 0, out: "can be made" });
run("notes: the last section, to end of file", ["notes", "1.2.1"], { changelog: cl }, { code: 0, out: "can be made" });
run("notes: no section", ["notes", "9.9.9"], { changelog: cl }, { code: 1, out: "no CHANGELOG section" });
run("notes: an empty section", ["notes", "1.2.2"], { changelog: cl }, { code: 1, out: "is empty" });
run("notes: a CRLF file reads the same", ["notes", "1.2.3"], { changelog: cl.replace(/\n/g, "\r\n") }, { code: 0, out: "can be made" });
run("notes: `## [1.2.4]-rc.1` is not 1.2.4's section", ["notes", "1.2.4"], { changelog: `## [1.2.4]-rc.1\n- x\n${T}\n` }, {
  code: 1, out: "no CHANGELOG section",
});
run("notes: a body that is only an HTML comment is empty", ["notes", "1.2.4"], { changelog: "## [1.2.4]\n<!-- later -->\n\n## [1.2.3]\n- x\n" }, {
  code: 1, out: "is empty",
});
run("notes: a heading inside a code fence is not a heading", ["notes", "1.2.4"], { changelog: "## [1.2.3]\n```\n## [1.2.4]\n- x\n```\n" }, {
  code: 1, out: "no CHANGELOG section",
});
run("notes: no Tested on line", ["notes", "1.2.3"], { changelog: "## [1.2.3]\n- a thing\n" }, { code: 1, out: 'no "Tested on:' });
run("notes: another version's Tested on does not count", ["notes", "1.2.3"], { changelog: `## [1.2.3]\n- a thing\n\n## [1.2.2]\n${T}\n` }, {
  code: 1, out: 'no "Tested on:',
});
run("notes: two platforms as a list", ["notes", "1.2.3"], { changelog: `## [1.2.3]\n- a thing\n\n${T2}\n` }, { code: 0, out: "win-x64, linux-x64" });

// ── entry ──
const entry = (body: string, v = "1.2.3", head = `### ${v} — 2026-11-12 — a test`) =>
  `# release.md\n\n## Release History\n\nNewest first.\n\n${head}\n\n${body}\n### 1.2.2 — 2026-11-01 — older\n\nolder\n${T}\n\n## Process\n\ntext\n`;
const SUM = "A fix to the widget; nothing else changed.";
const ok = (name: string, body: string, out = "tested on win-x64") => run(name, ["entry", "1.2.3"], { release: entry(body) }, { code: 0, out });
const no = (name: string, body: string, out: string) => run(name, ["entry", "1.2.3"], { release: entry(body) }, { code: 1, out });

ok("entry: summary and Tested on", `${SUM}\n\n${T}\n`);
ok("entry: bold label, backticked ID", `${SUM}\n\n**Tested on:** Windows 11 (\`win-x64\`)\nOther platforms: not yet tested.\n`);
ok("entry: two platforms", `${SUM}\n\n${T2}\n`, "win-x64, linux-x64");
ok("entry: an inline-code `<!--` in the summary opens no comment", `The parser now handles \`<!--\` in strings.\n\n${T}\n`);
ok("entry: all six need no 'not yet tested'", `${SUM}\n\n${["win-x64", "win-arm64", "mac-x64", "mac-arm64", "linux-x64", "linux-arm64"].map((p) => `- Tested on: OS (${p})`).join("\n")}\n`, "linux-arm64");
no("entry: no Tested on line", `${SUM}\n`, 'no "Tested on:');
no("entry: no platform ID", `${SUM}\n\nTested on: Windows 11\nOther platforms: not yet tested.\n`, "must read");
no("entry: a toolchain triple is not a platform ID", `${SUM}\n\nTested on: Windows 11 (x86_64-pc-windows-gnullvm)\nOther platforms: not yet tested.\n`, "not a platform ID");
no("entry: no OS named", `${SUM}\n\nTested on: (win-x64)\nOther platforms: not yet tested.\n`, "must read");
no("entry: a partial list that claims nothing about the rest", `${SUM}\n\nTested on: Windows 11 (win-x64)\n`, "not yet tested");
no("entry: one platform twice", `${SUM}\n\nTested on: Windows 11 (win-x64)\nTested on: Windows 10 (win-x64)\nOther platforms: not yet tested.\n`, "two Tested on lines");
no("entry: Tested on inside a code fence does not count", `${SUM}\n\n\`\`\`\n${T}\n\`\`\`\n`, 'no "Tested on:');
no("entry: Tested on inside an HTML comment does not count", `${SUM}\n\n<!--\n${T}\n-->\n`, 'no "Tested on:');
no("entry: no summary", `${T}\n`, "no summary");
no("entry: a fence and a comment are not a summary", `\`\`\`\n\`\`\`\n<!-- todo -->\n${T}\n`, "no summary");
const okHead = (name: string, head: string) => run(name, ["entry", "1.2.3"], { release: entry(`${SUM}\n\n${T}\n`, "1.2.3", head) }, { code: 0, out: "tested on" });
okHead("entry: an en dash in the heading", "### 1.2.3 – 2026-11-12 – a test");
okHead("entry: a hyphen in the heading", "### 1.2.3 - 2026-11-12 - a test");
okHead("entry: a heading whose line starts with inline code", "### 1.2.3 — 2026-11-12 — `release.yml`: CI tags");
run("entry: an impossible date in the heading", ["entry", "1.2.3"], { release: entry(`${SUM}\n\n${T}\n`, "1.2.3", "### 1.2.3 — 2026-02-30 — x") }, {
  code: 1, out: "real date",
});
run("entry: a bare `### 1.2.3` heading is refused", ["entry", "1.2.3"], { release: entry(`${SUM}\n\n${T}\n`, "1.2.3", "### 1.2.3") }, {
  code: 1, out: "heading must read",
});
run("entry: no entry for the version", ["entry", "1.2.4"], { release: entry(`${SUM}\n\n${T}\n`) }, { code: 1, out: 'no "### 1.2.4" entry' });
run("entry: 1.2.30's entry does not count for 1.2.3", ["entry", "1.2.3"], { release: entry(`${SUM}\n\n${T}\n`, "1.2.30") }, {
  code: 1, out: 'no "### 1.2.3" entry',
});
run("entry: an entry under a LATER section does not count", ["entry", "1.2.3"], {
  release: `# release.md\n\n## Release History\n\n### 1.2.2 — 2026-11-01 — older\n\nolder\n\n## Archive\n\n### 1.2.3 — 2026-11-12 — x\n\n${SUM}\n${T}\n`,
}, { code: 1, out: 'no "### 1.2.3" entry' });
run("entry: an entry BEFORE Release History does not count", ["entry", "1.2.3"], {
  release: `# release.md\n\n## Notes\n\n### 1.2.3 — 2026-11-12 — x\n\n${SUM}\n${T}\n\n## Release History\n\n### 1.2.2 — 2026-11-01 — older\n\nolder\n`,
}, { code: 1, out: 'no "### 1.2.3" entry' });
run("entry: a newer entry's Tested on does not count for an older one", ["entry", "1.2.2"], {
  release: `# release.md\n\n## Release History\n\n### 1.2.3 — 2026-11-12 — x\n\n${SUM}\n${T}\n### 1.2.2 — 2026-11-01 — older\n\nolder\n`,
}, { code: 1, out: 'no "Tested on:' });
run("entry: no Release History section", ["entry", "1.2.3"], { release: "# release.md\n\nnothing\n" }, { code: 1, out: 'no "## Release History"' });

// ── arguments ──
run("bad version", ["notes", "v1.2.3"], { changelog: cl }, { code: 1, out: "must be X.Y.Z" });
run("unknown command", ["page", "1.2.3"], {}, { code: 1, out: "notes | entry" });
run("the retired `reviews` command is refused", ["reviews", "1.2.3"], {}, { code: 1, out: "notes | entry" });

rmSync(dir, { recursive: true, force: true });
console.log(`\nrelease-record self-test: ${pass} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
