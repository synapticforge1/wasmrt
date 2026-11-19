#!/usr/bin/env bun
// bump.ts — the ONLY way wasmrt's version moves, and it refuses a bump below the floor
// (workspace letter H6; `../workspace/cmem/layout-and-packaging.md` § "The compatibility gate"; `cmem/releasing.md`).
//
//   bun scripts/bump.ts patch|minor|major [--dry-run]   compute the floor, refuse or apply the bump
//   bun scripts/bump.ts --verify-tag vX.Y.Z              `gate.ts --release` (run by `release.ts`,
//                                                       locally): the manifest says X.Y.Z, and
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
//   U1  the level is an ARGUMENT, never a default — and before it, the review set (five classes, one
//       loop, ended by an empty re-review; H37), its result in cmem/review-issues.md (`release.ts`
//       checks it through `gate.ts --release` → `review-gate.ts`);
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
import { cmp, nextVersion, parse, show, TAG, type TagState, type V, verifyTarget } from "./versions.ts";

// Every subprocess has a time limit (review H2, 2026-11-19): a stalled remote or a credential
// prompt ends as a named error, not a hang. A timeout comes back as status null + `error`.
const GIT_MS = 120_000;
const LONG_MS = 3_600_000; // cargo semver-checks and carry-forward build the released tag

type Ran = { status: number | null; error?: Error; stdout?: string | null; stderr?: string | null };
const said = (r: Ran) => `exit ${r.status}${r.error ? `, ${r.error.message}` : ""}):\n${r.stdout ?? ""}${r.stderr ?? ""}`;

/** Writes `next` as `dir`/Cargo.toml, then runs the lockfile update and the commit. Failure
 *  atomicity (review H1, 2026-11-19): until the commit exists, ANY failure puts Cargo.toml and
 *  Cargo.lock back byte for byte, so a failed bump leaves the clean tree it started from. Returns
 *  null on success, else the reason (the files already restored). Self-test: check-bump.ts. */
export function commitBump(dir: string, next: string, update: () => Ran, commit: () => Ran): string | null {
  const toml = join(dir, "Cargo.toml"), lock = join(dir, "Cargo.lock");
  const before = { toml: readFileSync(toml), lock: readFileSync(lock) };
  const undo = (why: string) => {
    writeFileSync(toml, before.toml);
    writeFileSync(lock, before.lock);
    return `${why}\n  Cargo.toml and Cargo.lock are restored; nothing was committed.`;
  };
  try {
    writeFileSync(toml, next);
    const u = update();
    if (u.status !== 0) return undo(`cargo update failed (${said(u)}`);
    const c = commit();
    if (c.status !== 0) return undo(`git commit failed (${said(c)}`);
  } catch (e) {
    return undo(`the bump threw: ${(e as Error).message}`);
  }
  return null;
}

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
      { cwd: repo, encoding: "utf8", maxBuffer: 1 << 28, timeout: LONG_MS });
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
    { cwd: repo, encoding: "utf8", maxBuffer: 1 << 28, timeout: LONG_MS });
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
function judge(released: V, target: V, floor: Floor, tags: Map<string, TagState>, ownTagHere = false): string {
  const v = verifyTarget(released, target, tags, ownTagHere);
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

/** Origin's vX.Y.Z tags with the commit each peels to — read from ORIGIN (`git ls-remote`), not the
 *  local clone: a tag deleted on origin stays in a clone after `fetch --tags` (review round 3), and
 *  CI's fresh clone sees only origin's. Names with leading zeros are not versions (`TAG`). */
function originTags(): Map<string, string> {
  const r = spawnSync("git", ["ls-remote", "--tags", "origin"], { cwd: repo, encoding: "utf8", timeout: GIT_MS });
  if (r.status !== 0) { console.log(`✗ git ls-remote --tags origin failed — the tags decide the next version:\n${r.stderr}`); process.exit(1); }
  const at = new Map<string, string>();
  for (const line of r.stdout.split(/\r?\n/)) {
    const m = /^([0-9a-f]{40})\trefs\/tags\/(\S+?)(\^\{\})?$/.exec(line);
    if (!m || !TAG.test(m[2])) continue;
    if (m[3] || !at.has(m[2])) at.set(m[2], m[1]); // the peeled ^{} line wins for an annotated tag
  }
  return at;
}

/** Is a release workflow run for `sha` still queued or running on GitHub (public REST API, no `gh`)?
 *  A tagged version mid-release reads as burned or partial on crates.io; it must be waited for, not
 *  stepped over (review round 3). */
async function runInFlight(sha: string): Promise<boolean> {
  // In CI (`--verify-tag` in the gate) the `state` step has already refused an unfinished release of
  // THIS version, and a bump is made locally, where this check runs; an unauthenticated runner IP
  // shares GitHub's 60-an-hour limit, which must not be able to block a release.
  if (process.env.GITHUB_ACTIONS === "true") return false;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "wasmrt bump script" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  for (const status of ["in_progress", "queued"]) {
    const res = await fetch(`https://api.github.com/repos/synapticforge1/wasmrt/actions/runs?head_sha=${sha}&status=${status}&per_page=1`, {
      headers,
      signal: AbortSignal.timeout(30_000),
    }).catch((e) => { console.log(`✗ GitHub: ${(e as Error).message}`); process.exit(1); });
    if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
      const reset = new Date(Number(res.headers.get("x-ratelimit-reset")) * 1000).toISOString().slice(11, 16);
      console.log(`✗ GitHub's API rate limit is used up (unauthenticated: 60 an hour); it resets at ${reset} UTC — run this again then, or set GITHUB_TOKEN`);
      process.exit(1);
    }
    if (!res.ok) { console.log(`✗ GitHub's run list for ${sha}: HTTP ${res.status} — cannot tell whether a release is in flight`); process.exit(1); }
    if (((await res.json()) as { total_count?: number }).total_count) return true;
  }
  return false;
}

/** Every tag above `released` with its state from crates.io (all three crates, all pages). A tag
 *  whose release run is still in flight refuses: wait for it. `ownSha`: this commit, whose own run
 *  is the one in flight during a CI re-run. */
async function tagStates(released: V, ownSha?: string): Promise<{ states: Map<string, TagState>; at: Map<string, string> }> {
  const at = originTags();
  const above = [...at.keys()].map((t) => t.slice(1)).filter((t) => cmp(parse(t), released) > 0);
  const states = new Map<string, TagState>();
  if (!above.length) return { states, at };
  const listed = await Promise.all(CRATES.map(cratesVersions));
  for (const t of above) {
    const n = listed.filter((s) => s.has(t)).length;
    const state: TagState = n === 0 ? "burned" : n === CRATES.length ? "released" : "partial";
    const sha = at.get(`v${t}`)!;
    if (state !== "released" && sha !== ownSha && await runInFlight(sha)) {
      console.log(`✗ v${t}'s release run (commit ${sha}) is still IN PROGRESS on GitHub — wait for it to finish, then run this again`);
      process.exit(1);
    }
    states.set(t, state);
  }
  return { states, at };
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
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8", timeout: GIT_MS }).stdout.trim();
    const { states, at } = await tagStates(parse(released), head);
    // Its own tag is expected only when it is on THIS commit (a CI re-run); elsewhere it is taken.
    const why = judge(parse(released), v, floors(released), states, at.get(tag) === head);
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
  const git = (...args: string[]) => spawnSync("git", args, { cwd: repo, encoding: "utf8", timeout: GIT_MS });
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
  const { states: tags } = await tagStates(rel);
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
  // U2: the bump is its own commit, made here, holding exactly the two version files.
  const msg = `bump to v${show(target)}`;
  const failed = commitBump(repo, next,
    () => spawnSync("cargo", ["update", "--workspace", "--offline"], { cwd: repo, encoding: "utf8", timeout: GIT_MS }),
    () => git("commit", "-q", "-m", msg, "--", "Cargo.toml", "Cargo.lock"));
  if (failed) { console.log(`✗ ${failed}`); process.exit(1); }
  const files = git("show", "--name-only", "--format=", "HEAD").stdout.split(/\r?\n/).filter(Boolean).sort().join(",");
  if (files !== "Cargo.lock,Cargo.toml") { console.log(`✗ the bump commit holds ${files}, not Cargo.toml + Cargo.lock`); process.exit(1); }
  const left = git("status", "--porcelain", "--untracked-files=all").stdout.trim();
  if (left) { console.log(`✗ the bump left the tree dirty:\n${left}`); process.exit(1); }
  console.log(`Cargo.toml + Cargo.lock: ${old} → ${show(target)}, committed as "${msg}". Next: bun scripts/release.ts (cmem/releasing.md).`);
}
