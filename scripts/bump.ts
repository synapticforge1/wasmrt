#!/usr/bin/env bun
// bump.ts — the ONLY way wasmrt's version moves, and it refuses a bump below the floor
// (workspace letter H6; `../cmem/layout-and-packaging.md` § "The compatibility gate"; `cmem/releasing.md`).
//
//   bun scripts/bump.ts patch|minor|major [--dry-run]   compute the floor, refuse or apply the bump
//   bun scripts/bump.ts --verify-tag vX.Y.Z              CI on a tag: the manifest says X.Y.Z, and
//                                                       X.Y.Z clears the floor since the last release
//
// The floor is the HIGHEST of three, each printed with what set it:
//
//   surface    scripts/surface.ts: surface/released.txt → this tree (Rust pub API, wasmrt.h, --help)
//   semver     `cargo semver-checks` on wasmrt-core and wasmrt-capi against the released tag — it
//              sees Rust breaks a line diff cannot (a variant added to an exhaustive enum, a lost
//              auto trait)
//   behaviour  scripts/carry-forward.ts: a module the release ACCEPTED that this tree refuses is a
//              major ("accepting less", even when correct)
//
// Rule 6: before 1.0.0, a minor is allowed where the floor says major (SemVer's 0.y rule), but the
// README's `### ⚠️ Breaking Changes` table must carry a `_next release_` row. A bump also resets the
// lower components, so `0.9.3 → minor` is `0.10.0`.
//
// The bump commit never touches surface/ (rule 5): an intended surface change is re-baselined in its
// own commit with `bun scripts/surface.ts --update`, and after the release commit is tagged,
// `bun scripts/surface.ts --release-from vX.Y.Z` records it, in its own commit.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { CURRENT, type Floor, floorOf, generate, generateFromRef, printDiff, readSnapshot, RELEASED, repo, tools } from "./surface.ts";

const RANK: Record<Floor, number> = { patch: 0, minor: 1, major: 2 };
const max = (a: Floor, b: Floor): Floor => (RANK[a] >= RANK[b] ? a : b);

type V = [number, number, number];
const parse = (s: string): V => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(s.trim());
  if (!m) throw new Error(`not a MAJOR.MINOR.PATCH version: ${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const show = (v: V) => v.join(".");
const cmp = (a: V, b: V) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
function inc(v: V, k: Floor): V {
  if (k === "major") return [v[0] + 1, 0, 0];
  if (k === "minor") return [v[0], v[1] + 1, 0];
  return [v[0], v[1], v[2] + 1];
}
/** What kind of step `from → to` is (the highest component that moved). */
function kindOf(from: V, to: V): Floor {
  return to[0] !== from[0] ? "major" : to[1] !== from[1] ? "minor" : "patch";
}

function manifestVersion(): string {
  const m = /\[workspace\.package\][^[]*?\nversion\s*=\s*"([^"]+)"/.exec(readFileSync(join(repo, "Cargo.toml"), "utf8"));
  if (!m) throw new Error("no [workspace.package] version in Cargo.toml");
  return m[1];
}

// ---- the three floors ---------------------------------------------------------------------------
function surfaceFloor(released: string): Floor {
  const now = generate(repo);
  const cur = readSnapshot(CURRENT);
  const t = tools();
  if (cur.tools === t) {
    const drift = floorOf(cur.lines, now);
    if (drift.removed.length || drift.added.length) {
      console.log(`✗ surface/current.txt does not match the sources — re-baseline in its own commit first (rule 5):`);
      printDiff(drift, 10);
      process.exit(1);
    }
  } else {
    // Another toolchain (a CI runner) renders rustdoc differently, so current.txt cannot be compared
    // line for line here. The FLOOR below still compares like with like: both sides are generated now.
    console.log(`  (current.txt was made with "${cur.tools}"; this machine has "${t}", so its freshness is checked where it was made)`);
  }
  let rel = readSnapshot(RELEASED);
  if (rel.releasedAs !== released) throw new Error(`surface/released.txt says ${rel.releasedAs}, the last tag is v${released}`);
  if (rel.tools !== t) {
    // The committed file was made with other tools; the tag is the truth, so regenerate from it.
    console.log(`  (released.txt was made with "${rel.tools}"; regenerating v${released} with "${t}")`);
    rel = { ...rel, lines: generateFromRef(`v${released}`).lines };
  }
  const f = floorOf(rel.lines, now);
  console.log(`surface    ${f.floor.padEnd(6)} ${f.removed.length} removed or changed, ${f.added.length} added`);
  printDiff(f, 8);
  return f.floor;
}

function semverFloor(released: string): Floor {
  let floor: Floor = "patch";
  for (const c of ["wasmrt-core", "wasmrt-capi"]) {
    const r = spawnSync("cargo", ["semver-checks", "--color", "never", "--baseline-rev", `v${released}`, "-p", c],
      { cwd: repo, encoding: "utf8", maxBuffer: 1 << 28 });
    const out = `${r.stdout}\n${r.stderr}`;
    const m = /Summary (?:semver requires new (major|minor) version|(no semver update required))/.exec(out);
    if (!m) throw new Error(`cargo semver-checks on ${c} gave no verdict (status ${r.status}):\n${out.slice(-2000)}`);
    const f: Floor = m[1] === "major" ? "major" : m[1] === "minor" ? "minor" : "patch";
    const failed = [...out.matchAll(/--- failure (\w+):/g)].map((x) => x[1]);
    console.log(`semver     ${f.padEnd(6)} ${c}${failed.length ? `: ${[...new Set(failed)].join(", ")}` : ""}`);
    floor = max(floor, f);
  }
  return floor;
}

function behaviourFloor(released: string): Floor {
  const r = spawnSync("bun", [join(repo, "scripts", "carry-forward.ts"), `v${released}`, "WORKTREE"],
    { cwd: repo, encoding: "utf8", maxBuffer: 1 << 28 });
  const m = /carry-forward floor over .*: (patch|minor|major)/.exec(r.stdout);
  if (r.status !== 0 || !m) throw new Error(`carry-forward failed (status ${r.status}):\n${r.stdout.slice(-1500)}\n${r.stderr.slice(-1500)}`);
  const line = /== .* floor .*/.exec(r.stdout)?.[0] ?? "";
  console.log(`behaviour  ${m[1].padEnd(6)} ${line.replace(/^== /, "")}`);
  return m[1] as Floor;
}

function breakingRowPresent(): boolean {
  const readme = readFileSync(join(repo, "README.md"), "utf8");
  const at = readme.indexOf("### ⚠️ Breaking Changes");
  if (at < 0) return false;
  const table = readme.slice(at).split("\n").slice(1).join("\n").split(/\n#{1,3} /)[0];
  return /^\|\s*_next release_\s*\|/m.test(table);
}

/** Is `target` allowed after `released` given `floor`? Returns the reason it is not, or "". */
function judge(released: V, target: V, floor: Floor): string {
  if (cmp(target, released) <= 0) return `${show(target)} is not after the last release ${show(released)}`;
  const step = kindOf(released, target);
  const expect = inc(released, step);
  if (cmp(target, expect) !== 0) return `a ${step} bump from ${show(released)} is ${show(expect)}, not ${show(target)} (lower components reset)`;
  if (RANK[step] >= RANK[floor]) return "";
  // Rule 6: pre-1.0, a minor stands in for a major — with the Breaking Changes row.
  if (released[0] === 0 && floor === "major" && step === "minor") {
    return breakingRowPresent() ? "" : "pre-1.0 a minor may carry a major change, but README.md has no `### ⚠️ Breaking Changes` row for `_next release_`";
  }
  return `the floor is ${floor}, and ${show(released)} → ${show(target)} is a ${step}`;
}

function floors(released: string): Floor {
  console.log(`floor since v${released}:`);
  const f = max(max(surfaceFloor(released), semverFloor(released)), behaviourFloor(released));
  console.log(`=> FLOOR ${f.toUpperCase()}`);
  if (f === "major" && !breakingRowPresent()) console.log(`⚠ a major floor needs a \`_next release_\` row in README.md's ### ⚠️ Breaking Changes table`);
  return f;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const released = readSnapshot(RELEASED).releasedAs;
  if (!released) { console.error("surface/released.txt has no `# released-as:` line"); process.exit(2); }

  if (argv[0] === "--verify-tag") {
    const tag = argv[1];
    if (!tag) { console.error("usage: bun scripts/bump.ts --verify-tag vX.Y.Z"); process.exit(2); }
    const v = parse(tag), have = parse(manifestVersion());
    if (cmp(v, have) !== 0) { console.log(`✗ tag ${tag} but Cargo.toml says ${show(have)}`); process.exit(1); }
    const why = judge(parse(released), v, floors(released));
    if (why) { console.log(`✗ ${tag} refused: ${why}`); process.exit(1); }
    console.log(`✓ ${tag} clears the floor since v${released}`);
    process.exit(0);
  }

  const kind = argv[0] as Floor;
  // `Object.hasOwn`, not `in`: `in` also matches inherited names such as `toString`.
  if (!Object.hasOwn(RANK, kind)) { console.error("usage: bun scripts/bump.ts patch|minor|major [--dry-run] | --verify-tag vX.Y.Z"); process.exit(2); }
  const rel = parse(released), have = parse(manifestVersion());
  const target = inc(rel, kind);
  if (cmp(have, rel) > 0 && cmp(target, have) < 0) {
    console.log(`✗ Cargo.toml is already at ${show(have)}, past ${released}; a ${kind} bump (${show(target)}) would move it backwards`);
    process.exit(1);
  }
  const why = judge(rel, target, floors(released));
  if (why) { console.log(`✗ bump ${kind} REFUSED: ${why}`); process.exit(1); }
  console.log(`✓ ${released} → ${show(target)} (${kind})`);
  if (argv.includes("--dry-run")) process.exit(0);

  const path = join(repo, "Cargo.toml");
  const src = readFileSync(path, "utf8");
  const old = manifestVersion();
  const next = src
    .replace(/(\[workspace\.package\][^[]*?\nversion\s*=\s*")[^"]+(")/, `$1${show(target)}$2`)
    .replace(/(wasmrt-core = \{ path = "crates\/wasmrt-core", version = ")[^"]+(")/, `$1${show(target)}$2`);
  const moved = (next.match(new RegExp(`"${show(target).replace(/\./g, "\\.")}"`, "g")) ?? []).length;
  if (moved !== 2) { console.log(`✗ expected to rewrite 2 version strings in Cargo.toml, rewrote ${moved}; nothing written`); process.exit(1); }
  writeFileSync(path, next);
  const u = spawnSync("cargo", ["update", "--workspace", "--offline"], { cwd: repo, encoding: "utf8" });
  if (u.status !== 0) { console.log(`✗ cargo update failed:\n${u.stderr}`); process.exit(1); }
  console.log(`Cargo.toml + Cargo.lock: ${old} → ${show(target)}. Next: the CHANGELOG heading and README status (cmem/releasing.md).`);
}
