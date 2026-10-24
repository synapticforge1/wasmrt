#!/usr/bin/env bun
// behaviour-s2.ts — S2 of the behaviour carry-forward (workspace letter H23): does code still RUN
// correctly? Per-file pass / fail / skip of `wasmrt wast` over wasmtk's vendored spec testsuite,
// against a committed snapshot PINNED to a wasmtk commit and a file-list hash.
//
//   bun scripts/behaviour-s2.ts                  compare against tests/spec-snapshot.txt
//   bun scripts/behaviour-s2.ts --rebaseline     write tests/spec-snapshot.txt (its OWN commit)
//   [--wasmrt <exe>]                             default: cargo's release binary
//
// A RELEASE-CHECKLIST step, not part of `cargo test`: it needs the sibling checkout. Compared on the
// INTERSECTION of files when the corpus moves (wasmtk syncs the suite upstream), so a moved
// denominator is reported, never silently scored. A file that lost a pass, or gained a failure or a
// skip, is a REGRESSION and fails; an improvement is reported and passes.
//
// 🔒 Order (owner, H23): S1 (`cargo test`, the behaviour test) → S2 (this) → S3 (local only), and
// STOP at the first stage that finds an issue until it is resolved. "Resolved" includes INTENDED,
// re-baselined in its own commit.
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import process from "node:process";
import { releaseWasmrt } from "./target-dir.ts";

const repo = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const argv = process.argv.slice(2);
const exeAt = argv.indexOf("--wasmrt");
const WASMRT = exeAt >= 0 ? argv[exeAt + 1] : releaseWasmrt();
const REBASE = argv.includes("--rebaseline");
const SUITE_REL = "../wasmtk/tests/module/wasm_wast/testsuite-main"; // relative: no machine path is recorded
const suite = join(repo, SUITE_REL);
const SNAP = join(repo, "tests", "spec-snapshot.txt");

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".wast")) acc.push(relative(suite, p).replace(/\\/g, "/"));
  }
  return acc;
}
const files = walk(suite).sort();
const listSha = createHash("sha256").update(files.join("\n")).digest("hex");
// ⚠️ The CONTENT hash is the pin; the wasmtk commit is information only. Measured 2026-10-23:
// wasmtk's local HEAD was on a working branch GitHub did not have, so a commit id alone could not
// be fetched by anyone else (H23: "the corpus cannot be pinned, only content-hashed").
const contentHash = createHash("sha256");
for (const f of files) contentHash.update(f).update(readFileSync(join(suite, f)));
const contentSha = contentHash.digest("hex");
const wasmtk = execFileSync("git", ["-C", join(repo, "..", "wasmtk"), "rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim();

const r = spawnSync(WASMRT, ["wast", SUITE_REL], { cwd: repo, encoding: "utf8", maxBuffer: 1 << 26 });
type Row = { p: number; f: number; s: number };
const now = new Map<string, Row>();
for (const line of `${r.stdout}${r.stderr}`.split(/\r?\n/)) {
  const m = /^(.*\.wast): (\d+) passed, (\d+) failed, (\d+) skipped/.exec(line.trim());
  if (!m) continue;
  const key = relative(suite, join(repo, m[1])).replace(/\\/g, "/");
  now.set(key, { p: +m[2], f: +m[3], s: +m[4] });
}
if (now.size === 0) {
  console.error(`behaviour S2: the runner reported no files (exit ${r.status})`);
  process.exit(1);
}
const fmt = (k: string, x: Row) => `${k}: ${x.p} passed, ${x.f} failed, ${x.s} skipped`;
const total = [...now.values()].reduce((a, x) => ({ p: a.p + x.p, f: a.f + x.f, s: a.s + x.s }), { p: 0, f: 0, s: 0 });

if (REBASE) {
  const body = [...now.keys()].sort().map((k) => fmt(k, now.get(k)!)).join("\n");
  writeFileSync(SNAP,
    `# S2 behaviour snapshot (letter H23) — per-file \`wasmrt wast\` results over wasmtk's testsuite-main.\n` +
    `# wasmtk ${wasmtk} (information only); ${files.length} .wast files, file-list sha256 ${listSha}\n` +
    `# corpus content sha256 ${contentSha}\n` +
    `# totals: ${total.p} passed, ${total.f} failed, ${total.s} skipped\n` +
    `# Re-baseline ONLY in its own commit: bun scripts/behaviour-s2.ts --rebaseline\n${body}\n`);
  console.log(`behaviour S2: wrote tests/spec-snapshot.txt (${now.size} files; ${total.p} / ${total.f} / ${total.s})`);
  process.exit(0);
}

const text = readFileSync(SNAP, "utf8");
const was = new Map<string, Row>();
for (const line of text.split("\n")) {
  const m = /^(.*\.wast): (\d+) passed, (\d+) failed, (\d+) skipped/.exec(line);
  if (m) was.set(m[1], { p: +m[2], f: +m[3], s: +m[4] });
}
const pinned = /corpus content sha256 ([0-9a-f]{64})/.exec(text)?.[1];
const pinnedTk = /# wasmtk (\S+) /.exec(text)?.[1];
if (pinned !== contentSha) {
  console.log(`⚠️ the corpus MOVED since the snapshot (content hash differs; wasmtk ${pinnedTk} → ${wasmtk}): comparing the intersection`);
}
const regressed: string[] = [], improved: string[] = [];
for (const [k, b] of was) {
  const a = now.get(k);
  if (!a) { regressed.push(`${k}: in the snapshot, NOT REPORTED now`); continue; }
  if (a.p < b.p || a.f > b.f || a.s > b.s) regressed.push(`${fmt(k, b)}  →  ${a.p} / ${a.f} / ${a.s}`);
  else if (a.p > b.p || a.f < b.f || a.s < b.s) improved.push(`${fmt(k, b)}  →  ${a.p} / ${a.f} / ${a.s}`);
}
const added = [...now.keys()].filter((k) => !was.has(k));
for (const l of regressed) console.log(`  REGRESSED  ${l}`);
for (const l of improved.slice(0, 20)) console.log(`  improved   ${l}`);
if (added.length) console.log(`  new files (not in the snapshot): ${added.length}, e.g. ${added.slice(0, 3).join(", ")}`);
console.log(`behaviour S2: ${regressed.length ? "FAILED" : "PASSED"} — ${was.size} files in the snapshot, ${now.size} now; ` +
  `regressed ${regressed.length}, improved ${improved.length}, new ${added.length}; now ${total.p} / ${total.f} / ${total.s}`);
process.exit(regressed.length ? 1 : 0);
