#!/usr/bin/env bun
// bump.ts — the ONLY way wasmrt's version moves, and it refuses a bump below the floor
// (workspace letter H6; `../cmem/layout-and-packaging.md` § "The compatibility gate"; `cmem/releasing.md`).
//
//   bun scripts/bump.ts patch|minor|major [--dry-run]   compute the floor, refuse or apply the bump
//   bun scripts/bump.ts --verify-tag vX.Y.Z              `gate.ts --release` (CI's `checks` and
//                                                       `release.ts`): the manifest says X.Y.Z, and
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
// own commit with `bun scripts/surface.ts --update`, and after CI has tagged the release,
// `bun scripts/surface.ts --release-from vX.Y.Z` records it, in its own commit.
//
// 🔒 The workspace's uniform release shape (letter H33, release-process.md § 5; owner, 2026-11-10):
//   U1  the level is an ARGUMENT, never a default — and before it, a security and a hardening review,
//       each ended by an empty round, recorded in cmem/release.md (H35; `release.ts` checks it);
//   U2  the bump is ITS OWN commit, made here: `bump to vX.Y.Z`, Cargo.toml + Cargo.lock only, on top
//       of the release notes already merged into `main`;
//   U3  a real bump refuses a dirty tree (untracked files count), and for a patch or a minor runs the
//       PREVIOUS release's integration tests against this tree (`prev-tag-tests.ts`); a major skips
//       them, since breaking them is what a major is for.
// Then `bun scripts/release.ts` (U4) pushes `main`, and CI does the rest.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { prevTagTests } from "./prev-tag-tests.ts";
import { CURRENT, type Floor, floorOf, generate, generateFromRef, printDiff, readSnapshot, RELEASED, repo, tools } from "./surface.ts";
import { cmp, nextVersion, parse, show, type TagState, type V, verifyTarget } from "./versions.ts";

const RANK: Record<Floor, number> = { patch: 0, minor: 1, major: 2 };
const max = (a: Floor, b: Floor): Floor => (RANK[a] >= RANK[b] ? a : b);

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

/** A Breaking Changes row for the coming release: `_next release_` before the bump, or, once the
 *  release commit has renamed its rows, the manifest's version when that is past `released`. */
function breakingRowPresent(released: string): boolean {
  const readme = readFileSync(join(repo, "README.md"), "utf8");
  const at = readme.indexOf("### ⚠️ Breaking Changes");
  if (at < 0) return false;
  const table = readme.slice(at).split("\n").slice(1).join("\n").split(/\n#{1,3} /)[0];
  const have = manifestVersion();
  const names = ["_next release_", ...(cmp(parse(have), parse(released)) > 0 ? [have] : [])];
  return names.some((n) => new RegExp(`^\\|\\s*${n.replace(/\./g, "\\.")}\\s*\\|`, "m").test(table));
}

/** Is `target` allowed after `released` given `floor` and the tagged versions above `released`?
 *  Returns the reason it is not, or "". Which version comes next is `versions.ts`'s `verifyTarget` —
 *  the SAME arithmetic `nextVersion` gives the bump, burned versions included (review round 2). */
function judge(released: V, target: V, floor: Floor, tags: Map<string, TagState>): string {
  const v = verifyTarget(released, target, tags);
  if ("refuse" in v) return v.refuse;
  const step = v.level;
  if (RANK[step] >= RANK[floor]) return "";
  // Rule 6: pre-1.0, a minor stands in for a major — with the Breaking Changes row.
  if (released[0] === 0 && floor === "major" && step === "minor") {
    return breakingRowPresent(show(released)) ? "" : "pre-1.0 a minor may carry a major change, but README.md has no `### ⚠️ Breaking Changes` row for `_next release_`";
  }
  return `the floor is ${floor}, and ${show(released)} → ${show(target)} is a ${step}`;
}

const CRATES = ["wasmrt-core", "wasmrt-capi", "wasmrt"];

/** Every version crates.io lists for `crate`: all pages, at most 50, never the same page twice (review
 *  round 2: the earlier reader took page 1 only, so a published version on page 2 read as "burned"). */
async function cratesVersions(crate: string): Promise<Set<string>> {
  const out = new Set<string>();
  const seen = new Set<string>();
  for (let url: string | null = `https://crates.io/api/v1/crates/${crate}/versions`, page = 1; url; page++) {
    if (seen.has(url) || page > 50) { console.log(`✗ crates.io's version list for ${crate}: pagination did not end`); process.exit(1); }
    seen.add(url);
    const res = await fetch(url, {
      headers: { "User-Agent": "wasmrt bump script (https://github.com/synapticforge1/wasmrt)" },
      signal: AbortSignal.timeout(30_000),
    }).catch((e) => { console.log(`✗ crates.io: ${(e as Error).message}`); process.exit(1); });
    if (res.status === 404 && page === 1) return out;
    if (!res.ok) { console.log(`✗ crates.io's version list for ${crate}: HTTP ${res.status} (page ${page})`); process.exit(1); }
    const j = (await res.json()) as { versions: { num: string }[]; meta?: { next_page?: string | null } };
    for (const x of j.versions) out.add(x.num);
    url = j.meta?.next_page ? `https://crates.io/api/v1/crates/${crate}/versions${j.meta.next_page}` : null;
  }
  return out;
}

/** Every vX.Y.Z tag above `released`, after fetching origin's tags (CI makes the tags, so a clone
 *  that never fetched them would miss a burned one — review round 2), with its state from crates.io. */
async function tagStates(released: V): Promise<Map<string, TagState>> {
  const f = spawnSync("git", ["fetch", "-q", "--tags", "origin"], { cwd: repo, encoding: "utf8" });
  if (f.status !== 0) { console.log(`✗ git fetch --tags origin failed — the tags decide the next version:\n${f.stderr}`); process.exit(1); }
  const above = spawnSync("git", ["tag", "-l", "v*"], { cwd: repo, encoding: "utf8" }).stdout.split(/\r?\n/)
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t)).map((t) => t.slice(1)).filter((t) => cmp(parse(t), released) > 0);
  const states = new Map<string, TagState>();
  if (!above.length) return states;
  const listed = await Promise.all(CRATES.map(cratesVersions));
  for (const t of above) {
    const n = listed.filter((s) => s.has(t)).length;
    states.set(t, n === 0 ? "burned" : n === CRATES.length ? "released" : "partial");
  }
  return states;
}

function floors(released: string): Floor {
  console.log(`floor since v${released}:`);
  const f = max(max(surfaceFloor(released), semverFloor(released)), behaviourFloor(released));
  console.log(`=> FLOOR ${f.toUpperCase()}`);
  if (f === "major" && !breakingRowPresent(released)) console.log(`⚠ a major floor needs a \`_next release_\` (or the new version's) row in README.md's ### ⚠️ Breaking Changes table`);
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
    const why = judge(parse(released), v, floors(released), await tagStates(parse(released)));
    if (why) { console.log(`✗ ${tag} refused: ${why}`); process.exit(1); }
    console.log(`✓ ${tag} clears the floor since v${released}`);
    process.exit(0);
  }

  const kind = argv[0] as Floor;
  // `Object.hasOwn`, not `in`: `in` also matches inherited names such as `toString`.
  if (!Object.hasOwn(RANK, kind)) { console.error("usage: bun scripts/bump.ts patch|minor|major [--dry-run] | --verify-tag vX.Y.Z"); process.exit(2); }
  const dryRun = argv.includes("--dry-run");
  for (const a of argv.slice(1)) {
    if (a !== "--dry-run") { console.error(`unknown argument "${a}"`); process.exit(2); }
  }
  const git = (...args: string[]) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
  if (!dryRun) {
    const dirty = git("status", "--porcelain", "--untracked-files=all");
    if (dirty.status !== 0 || dirty.stdout.trim()) {
      console.log(`✗ the tree is not clean (untracked files count) — commit the release notes first (U2):\n${dirty.stdout}${dirty.stderr}`);
      process.exit(1);
    }
  }
  const rel = parse(released), have = parse(manifestVersion());
  // Which version comes next: the level from the last COMPLETED release, burned versions skipped,
  // partial or released-without-step-9 ones refused (versions.ts — the same answer `--verify-tag`
  // gives in the gate). If a release run is still in progress for a tagged version, it reads as
  // burned or partial here: wait for that run first.
  const tags = await tagStates(rel);
  const n = nextVersion(rel, kind, tags);
  if ("refuse" in n) { console.log(`✗ bump ${kind} REFUSED: ${n.refuse}`); process.exit(1); }
  for (const b of n.skipped) console.log(`burned     v${show(b)} is tagged but on crates.io for none of the crates: skipped (record it in cmem/release.md)`);
  const target = n.version;
  const why = judge(rel, target, floors(released), tags);
  if (why) { console.log(`✗ bump ${kind} REFUSED: ${why}`); process.exit(1); }
  if (cmp(have, rel) > 0 && cmp(target, have) < 0) {
    console.log(`✗ Cargo.toml is already at ${show(have)}, past ${released}; a ${kind} bump (${show(target)}) would move it backwards`);
    process.exit(1);
  }
  if (kind === "major") {
    console.log(`previous   skipped: a major may break v${released}'s tests`);
  } else {
    let t: ReturnType<typeof prevTagTests>;
    try {
      t = prevTagTests(`v${released}`);
    } catch (e) {
      console.log(`✗ bump ${kind} REFUSED: the previous release's tests could not run: ${(e as Error).message}`);
      process.exit(1);
    }
    console.log(`previous   ${t.green ? "green" : "RED"}   v${released}'s integration tests against this tree: ${t.summary}`);
    if (!t.green) {
      console.log(`${t.failures}\n✗ bump ${kind} REFUSED: this tree breaks what v${released}'s tests pin — a major, or a regression to fix`);
      process.exit(1);
    }
  }
  console.log(`✓ ${released} → ${show(target)} (${kind})`);
  if (dryRun) process.exit(0);

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
  // U2: the bump is its own commit, made here, holding exactly the two version files.
  const msg = `bump to v${show(target)}`;
  const c = git("commit", "-q", "-m", msg, "--", "Cargo.toml", "Cargo.lock");
  if (c.status !== 0) { console.log(`✗ git commit failed:\n${c.stdout}${c.stderr}`); process.exit(1); }
  const files = git("show", "--name-only", "--format=", "HEAD").stdout.split(/\r?\n/).filter(Boolean).sort().join(",");
  if (files !== "Cargo.lock,Cargo.toml") { console.log(`✗ the bump commit holds ${files}, not Cargo.toml + Cargo.lock`); process.exit(1); }
  const left = git("status", "--porcelain", "--untracked-files=all").stdout.trim();
  if (left) { console.log(`✗ the bump left the tree dirty:\n${left}`); process.exit(1); }
  console.log(`Cargo.toml + Cargo.lock: ${old} → ${show(target)}, committed as "${msg}". Next: bun scripts/release.ts (cmem/releasing.md).`);
}
