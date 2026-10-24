#!/usr/bin/env bun
// carry-forward.ts — has a release's ACCEPTED behaviour been carried forward? (workspace letter H23)
//
//   bun scripts/carry-forward.ts [--corpus <dir>] <ref> <ref> [<ref>…]
//   e.g. bun scripts/carry-forward.ts v0.9.0 WORKTREE            # S1's floor against the last release
//        bun scripts/carry-forward.ts --corpus ../wasmtk/tests v0.9.0 WORKTREE   # S3, local only
//
// For each ref (a tag, a commit, or `WORKTREE` for this tree as it stands), build a throwaway harness
// against THAT ref's `wasmrt-core` and judge every module of the corpus under every configuration,
// with the CURRENT judge (`crates/wasmrt-core/tests/behaviour/judge.rs`). Nothing is ever run: the
// judge decodes and validates. Then diff consecutive refs:
//
//   refused → accepted   floor: minor
//   accepted → refused   floor: MAJOR (pre-1.0: a minor plus a Breaking Changes row, rule 6)
//
// The judge may use only API every release since 0.9.0 has, and the feature TABLE is generated from
// each ref's own `Feature::name()` arms, so an old release is judged by its own vocabulary. A
// configuration naming a feature a release did not have yet simply does not appear for it.
//
// A ref is checked out with `git worktree add --detach` into a temp directory and removed after; the
// harness builds into its own temp target directory, so the repo's build cache is never touched.
// The default corpus is `tests/behaviour/` (S1). `--corpus` takes any directory: every `.wasm` is
// used as is, and every `.wat` is assembled by `wasm-tools parse` first (S3).
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";

const repo = resolve(join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), ".."));
const argv = process.argv.slice(2);
const ci = argv.indexOf("--corpus");
const corpusArg = ci >= 0 ? resolve(argv[ci + 1]) : join(repo, "tests", "behaviour");
const refs = (ci >= 0 ? argv.filter((_, i) => i !== ci && i !== ci + 1) : argv).filter((a) => a !== "--all");
if (refs.length < 2) {
  console.error("usage: bun scripts/carry-forward.ts [--corpus <dir>] <ref> <ref> [<ref>…]   (WORKTREE = this tree)");
  process.exit(2);
}

const tmp = mkdtempSync(join(tmpdir(), "wasmrt-carry-forward-"));
const judgeSrc = join(repo, "crates", "wasmrt-core", "tests", "behaviour", "judge.rs");

// ---- the corpus: .wasm as is, .wat assembled by an outside reader --------------------------------
function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules") walk(p, acc);
    else if (e.isFile() && (e.name.endsWith(".wasm") || e.name.endsWith(".wat"))) acc.push(p);
  }
  return acc;
}
const corpus = join(tmp, "corpus");
mkdirSync(corpus);
const hash = createHash("sha256");
let skipped = 0;
// The S1 corpus's `.wat` files are the SOURCES of its `.wasm` (documentation); judging both would
// count every module twice. Any other corpus (S3) keeps both, because there they are different
// modules: wasmtk's `.wasm` are separate builds, not the `.wat` beside them.
const s1 = ci < 0;
for (const f of walk(corpusArg).sort().filter((f) => !(s1 && f.endsWith(".wat")))) {
  const rel = relative(corpusArg, f).replace(/[\\/]/g, "__");
  if (f.endsWith(".wat")) {
    // The same source can appear as .wat and .wasm; keep both, distinguished by extension.
    const out = join(corpus, `${rel}.wasm`);
    if (spawnSync("wasm-tools", ["parse", f, "-o", out]).status !== 0) { skipped++; continue; }
  } else {
    copyFileSync(f, join(corpus, rel));
  }
}
const names = readdirSync(corpus).sort();
for (const n of names) hash.update(n).update(readFileSync(join(corpus, n)));
console.log(`corpus: ${relative(repo, corpusArg) || "."} — ${names.length} modules` +
  (skipped ? ` (${skipped} .wat that wasm-tools refuses, skipped)` : "") + `, content sha256 ${hash.digest("hex").slice(0, 16)}`);

// ---- judge each ref --------------------------------------------------------------------------------
function featureTable(featuresRs: string): string[][] {
  const at = featuresRs.indexOf("pub const fn name(self)");
  if (at < 0) throw new Error("this ref has no Feature::name()");
  const body = featuresRs.slice(at, featuresRs.indexOf("\n    }\n", at));
  return [...body.matchAll(/Feature::(\w+)\s*=>\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]);
}

function verdicts(ref: string): Set<string> {
  let tree = repo;
  if (ref !== "WORKTREE") {
    tree = join(tmp, `wt-${ref.replace(/[^\w.-]/g, "_")}`);
    execFileSync("git", ["-C", repo, "worktree", "add", "--detach", "--quiet", tree, ref]);
  }
  try {
    const table = featureTable(readFileSync(join(tree, "crates", "wasmrt-core", "src", "features.rs"), "utf8"));
    const h = join(tmp, `harness-${ref.replace(/[^\w.-]/g, "_")}`);
    mkdirSync(join(h, "src"), { recursive: true });
    const core = join(tree, "crates", "wasmrt-core").replace(/\\/g, "/");
    writeFileSync(join(h, "Cargo.toml"),
      `[package]\nname = "behaviour-judge"\nversion = "0.0.0"\nedition = "2021"\n\n` +
      `[dependencies]\nwasmrt-core = { path = "${core}" }\n\n[workspace]\n`);
    copyFileSync(judgeSrc, join(h, "src", "judge.rs"));
    writeFileSync(join(h, "src", "main.rs"),
      `mod judge;\nuse wasmrt_core::features::Feature;\n` +
      `const TABLE: &[(Feature, &str)] = &[${table.map(([v, n]) => `(Feature::${v}, "${n}")`).join(", ")}];\n` +
      `fn main() {\n    let dir = std::env::args().nth(1).expect("corpus dir");\n` +
      `    for l in judge::verdict_lines(TABLE, &judge::load_corpus(std::path::Path::new(&dir))) { println!("{l}"); }\n}\n`);
    const r = spawnSync("cargo", ["run", "-q", "--release", "--manifest-path", join(h, "Cargo.toml"), "--", corpus], {
      encoding: "utf8", maxBuffer: 1 << 28, env: { ...process.env, CARGO_TARGET_DIR: join(tmp, "target") },
    });
    if (r.status !== 0) throw new Error(`judging ${ref} failed:\n${r.stderr}`);
    const lines = r.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
    console.log(`${ref.padEnd(10)} ${table.length} features, ${lines.length} accepted pairs`);
    return new Set(lines);
  } finally {
    if (ref !== "WORKTREE") spawnSync("git", ["-C", repo, "worktree", "remove", "--force", tree]);
  }
}

let floor = "patch";
try {
  const results = refs.map((r) => ({ ref: r, set: verdicts(r) }));
  for (let i = 1; i < results.length; i++) {
    const a = results[i - 1], b = results[i];
    // Compare only configurations BOTH refs have: a feature added later is new vocabulary, not a change.
    const labels = (s: Set<string>) => new Set([...s].map((l) => l.split(" accepts ")[0]));
    const common = new Set([...labels(a.set)].filter((l) => labels(b.set).has(l)));
    const inCommon = (l: string) => common.has(l.split(" accepts ")[0]);
    const less = [...a.set].filter((l) => inCommon(l) && !b.set.has(l)).sort();
    const more = [...b.set].filter((l) => inCommon(l) && !a.set.has(l)).sort();
    const verdict = less.length ? "MAJOR (pre-1.0: minor + Breaking Changes row)" : more.length ? "minor" : "patch";
    if (less.length) floor = "major"; else if (more.length && floor === "patch") floor = "minor";
    console.log(`\n== ${a.ref} → ${b.ref}: accepted → refused ${less.length}; refused → accepted ${more.length}; floor ${verdict}`);
    const show = argv.includes("--all") ? less.length : 40;
    for (const l of less.slice(0, show)) console.log(`  - ${l}`);
    if (less.length > show) console.log(`  … ${less.length - show} more (--all lists them)`);
    for (const l of more.slice(0, 15)) console.log(`  + ${l}`);
    if (more.length > 15) console.log(`  … ${more.length - 15} more`);
  }
} finally {
  spawnSync("git", ["-C", repo, "worktree", "prune"]);
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`\ncarry-forward floor over ${refs.join(" → ")}: ${floor}`);
