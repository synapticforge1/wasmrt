#!/usr/bin/env bun
// surface.ts — wasmrt's PUBLIC SURFACE, generated from the sources, and the FLOOR it sets on a bump
// (workspace letter H6; `../cmem/layout-and-packaging.md` § "The compatibility gate").
//
//   bun scripts/surface.ts                      print the floor: surface/released.txt → this tree
//   bun scripts/surface.ts --check              exit 1 unless surface/current.txt equals this tree
//   bun scripts/surface.ts --update             re-baseline surface/current.txt (its OWN commit, rule 5)
//   bun scripts/surface.ts --release-from <tag> regenerate surface/released.txt from a tag's sources
//
// One line per thing a consumer can depend on, never written by hand:
//
//   rust:wasmrt-core / rust:wasmrt-capi   every `pub` item as rustdoc sees it (`cargo public-api -s`)
//   c                                     wasmrt.h: prototypes (parameter names dropped), typedefs,
//                                         struct bodies, `#define`s, every enum MEMBER with its ordinal
//   cli                                   `wasmrt --help`: each usage shape and each flag spelling
//                                         (descriptions excluded)
//
// The floor (rule 2): a line in released.txt missing from the tree → MAJOR; only new lines → minor;
// nothing → patch. A textual diff cannot see every Rust break (a variant added to an exhaustive enum
// is an ADDED line and a major change), so `bump.ts` also asks `cargo semver-checks`, and takes the
// higher of the two.
//
// ⚠️ `cargo public-api` reads rustdoc JSON, so its output can shift with the nightly toolchain. Each
// file records the tools that produced it; when they differ from this machine's, the floor is still
// printed but flagged, and the honest fix is `--release-from <tag>` — the tag is the source of truth,
// the file is a cache of it.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { releaseWasmrt } from "./target-dir.ts";

export const repo = resolve(join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), ".."));
export const CURRENT = join(repo, "surface", "current.txt");
export const RELEASED = join(repo, "surface", "released.txt");
const CRATES = ["wasmrt-core", "wasmrt-capi"];

function run(cmd: string, args: string[], env: Record<string, string> = {}, cwd = repo): string {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 1 << 28, env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${r.status}):\n${r.stderr}`);
  return r.stdout;
}

export function tools(): string {
  const api = run("cargo", ["public-api", "--version"]).trim();
  const rustc = run("rustup", ["run", "nightly", "rustc", "-V"]).trim();
  return `${api}; ${rustc}`;
}

// ---- C: wasmrt.h --------------------------------------------------------------------------------
const KEEP_BEFORE_NAME = new Set(["const", "struct", "enum", "union", "unsigned", "signed", "long", "short", "volatile"]);

/** `const uint8_t *bytes` → `const uint8_t *`; `bool enabled` → `bool`; `wasmrt_engine_t *` unchanged. */
function dropParamName(p: string): string {
  const toks = p.replace(/\*/g, " * ").trim().split(/\s+/);
  if (toks.length >= 2) {
    const last = toks[toks.length - 1], prev = toks[toks.length - 2];
    if (/^[A-Za-z_]\w*$/.test(last) && (prev === "*" || !KEEP_BEFORE_NAME.has(prev))) toks.pop();
  }
  return toks.join(" ").replace(/ \* /g, " *").replace(/ \*$/, " *").replace(/\* \*/g, "**");
}

/** A parameter list with every name dropped, including inside a function-pointer parameter. */
function paramList(s: string): string {
  return splitTop(s, ",").map((p) => {
    const fp = /^(.*?)\(\s*\*\s*\w*\s*\)\s*\((.*)\)$/.exec(p.trim());
    return fp ? `${fp[1].trim()} (*)(${paramList(fp[2])})` : dropParamName(p.trim());
  }).join(", ");
}

function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "{") depth++;
    if (ch === ")" || ch === "}") depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export function cSurface(header: string): string[] {
  const lines: string[] = [];
  const noComments = header.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, "");
  const code: string[] = [];
  for (const l of noComments.split("\n")) {
    const t = l.trim();
    const def = /^#\s*define\s+(\w+)(?:\s+(.*))?$/.exec(t);
    if (def) { if (def[2] !== undefined) lines.push(`#define ${def[1]} ${def[2].trim()}`); continue; } // the guard has no value
    if (t.startsWith("#")) continue;
    code.push(t);
  }
  const body = code.join(" ").replace(/extern\s+"C"\s*\{/, "").replace(/\s+/g, " ");
  for (let stmt of splitTop(body, ";")) {
    stmt = stmt.trim().replace(/^\}\s*/, "");
    if (!stmt) continue;
    const en = /^typedef enum \{(.*)\} (\w+)$/.exec(stmt);
    if (en) {
      let next = 0;
      for (const m of en[1].split(",").map((x) => x.trim()).filter(Boolean)) {
        const [name, val] = m.split("=").map((x) => x.trim());
        const n = val === undefined ? next : Number(val);
        lines.push(`enum ${en[2]} ${name} = ${n}`);
        next = n + 1;
      }
      continue;
    }
    const fpt = /^typedef (.*?)\(\s*\*\s*(\w+)\s*\)\s*\((.*)\)$/.exec(stmt);
    if (fpt) { lines.push(`typedef ${fpt[1].replace(/\s*\*\s*/g, " *").trim()} (*${fpt[2]})(${paramList(fpt[3])})`); continue; }
    if (stmt.startsWith("typedef")) { lines.push(stmt.replace(/\s*([{}();,])\s*/g, "$1").replace(/,/g, ", ")); continue; }
    const fn = /^(.*?)\s*\b(\w+)\s*\((.*)\)$/.exec(stmt);
    if (fn) {
      lines.push(`${fn[1].replace(/\s*\*\s*/g, " *").trim()} ${fn[2]}(${paramList(fn[3])})`.replace(/\* /g, "*"));
      continue;
    }
    lines.push(stmt);
  }
  return lines;
}

// ---- CLI: wasmrt --help -------------------------------------------------------------------------
export function cliSurface(help: string): string[] {
  const out: string[] = [];
  for (const l of help.split("\n")) {
    const m = /^ {4}((?:wasmrt |-).*?)(?: {2,}.*)?$/.exec(l.replace(/\r$/, ""));
    if (m) out.push(m[1].trim());
  }
  return out;
}

// ---- the whole surface of a tree ----------------------------------------------------------------
/** `tree` = a checkout; `targetDir` = where to build it (undefined = cargo's own, for this repo). */
export function generate(tree: string, targetDir?: string): string[] {
  const env: Record<string, string> = targetDir ? { CARGO_TARGET_DIR: targetDir } : {};
  const manifest = join(tree, "Cargo.toml");
  const lines: string[] = [];
  for (const c of CRATES) {
    for (const l of run("cargo", ["public-api", "--manifest-path", manifest, "-p", c, "-s"], env).split("\n")) {
      if (l.trim()) lines.push(`rust:${c}\t${l.trim()}`);
    }
  }
  for (const l of cSurface(readFileSync(join(tree, "crates", "wasmrt-capi", "include", "wasmrt.h"), "utf8"))) {
    lines.push(`c\t${l}`);
  }
  run("cargo", ["build", "-q", "--release", "--manifest-path", manifest, "-p", "wasmrt"], env);
  const bin = targetDir ? join(targetDir, "release", process.platform === "win32" ? "wasmrt.exe" : "wasmrt") : releaseWasmrt();
  for (const l of cliSurface(run(bin, ["--help"]))) lines.push(`cli\t${l}`);
  return [...new Set(lines)].sort();
}

export interface Snapshot { releasedAs?: string; tools?: string; lines: string[] }

export function readSnapshot(path: string): Snapshot {
  const s: Snapshot = { lines: [] };
  for (const l of readFileSync(path, "utf8").split("\n")) {
    if (l.startsWith("# released-as: ")) s.releasedAs = l.slice(15).trim();
    else if (l.startsWith("# tools: ")) s.tools = l.slice(9).trim();
    else if (l && !l.startsWith("#")) s.lines.push(l);
  }
  return s;
}

function writeSnapshot(path: string, lines: string[], toolsLine: string, releasedAs?: string) {
  const head = [
    "# wasmrt public surface — GENERATED by `bun scripts/surface.ts`; never edit by hand.",
    ...(releasedAs ? [`# released-as: ${releasedAs}`] : []),
    `# tools: ${toolsLine}`,
  ];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, [...head, ...lines, ""].join("\n"));
}

export type Floor = "patch" | "minor" | "major";
export function floorOf(released: string[], current: string[]): { floor: Floor; removed: string[]; added: string[] } {
  const a = new Set(released), b = new Set(current);
  const removed = released.filter((l) => !b.has(l));
  const added = current.filter((l) => !a.has(l));
  return { floor: removed.length ? "major" : added.length ? "minor" : "patch", removed, added };
}

export function printDiff(d: { removed: string[]; added: string[] }, limit = 25) {
  for (const l of d.removed.slice(0, limit)) console.log(`  - ${l}`);
  if (d.removed.length > limit) console.log(`  … ${d.removed.length - limit} more removed or changed`);
  for (const l of d.added.slice(0, limit)) console.log(`  + ${l}`);
  if (d.added.length > limit) console.log(`  … ${d.added.length - limit} more added`);
}

function cargoVersion(tree: string): string {
  const m = /\[workspace\.package\][^[]*?\nversion\s*=\s*"([^"]+)"/.exec(readFileSync(join(tree, "Cargo.toml"), "utf8"));
  if (!m) throw new Error("no [workspace.package] version in Cargo.toml");
  return m[1];
}

/** Generate a tag's surface in a throwaway worktree with its own target directory. */
export function generateFromRef(ref: string): { lines: string[]; version: string } {
  const tmp = mkdtempSync(join(tmpdir(), "wasmrt-surface-"));
  const tree = join(tmp, "tree");
  execFileSync("git", ["-C", repo, "worktree", "add", "--detach", "--quiet", tree, ref]);
  try {
    return { lines: generate(tree, join(tmp, "target")), version: cargoVersion(tree) };
  } finally {
    spawnSync("git", ["-C", repo, "worktree", "remove", "--force", tree]);
    spawnSync("git", ["-C", repo, "worktree", "prune"]);
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const t = tools();
  if (argv[0] === "--release-from") {
    const ref = argv[1];
    if (!ref) { console.error("usage: bun scripts/surface.ts --release-from <tag>"); process.exit(2); }
    const { lines, version } = generateFromRef(ref);
    writeSnapshot(RELEASED, lines, t, version);
    console.log(`surface/released.txt ← ${ref} (released-as ${version}): ${lines.length} lines`);
    process.exit(0);
  }
  const now = generate(repo);
  if (argv[0] === "--update") {
    writeSnapshot(CURRENT, now, t);
    console.log(`surface/current.txt re-baselined: ${now.length} lines — commit it ON ITS OWN, with the reason (rule 5)`);
    process.exit(0);
  }
  if (!existsSync(CURRENT)) { console.error("surface/current.txt is missing: run --update"); process.exit(1); }
  const cur = readSnapshot(CURRENT);
  const drift = floorOf(cur.lines, now);
  if (drift.removed.length || drift.added.length) {
    console.log(`✗ surface/current.txt does not match the sources (${drift.removed.length} gone, ${drift.added.length} new):`);
    printDiff(drift);
    console.log("  An intended change is re-baselined with --update, in its own commit (rule 5).");
    if (cur.tools !== t) console.log(`  ⚠ recorded with "${cur.tools}", this machine has "${t}" — the toolchain may be the cause`);
    process.exit(1);
  }
  if (argv[0] === "--check") { console.log(`✓ surface/current.txt matches the sources (${now.length} lines)`); process.exit(0); }
  const rel = readSnapshot(RELEASED);
  const f = floorOf(rel.lines, now);
  console.log(`surface floor, ${rel.releasedAs} → this tree: ${f.floor.toUpperCase()} (${f.removed.length} removed or changed, ${f.added.length} added)`);
  printDiff(f);
  if (rel.tools !== t) console.log(`⚠ released.txt was generated with "${rel.tools}", this machine has "${t}": regenerate it with --release-from v${rel.releasedAs}`);
}
