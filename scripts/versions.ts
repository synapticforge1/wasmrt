// versions.ts — the version arithmetic a release depends on, PURE (no network, no git), so it can be
// tested exhaustively (`bun scripts/check-versions.ts`). `bump.ts` gathers the facts (tags, what
// crates.io lists) and asks this file; `bump.ts <level>` and `bump.ts --verify-tag` both use
// `nextVersion`, so the bump and the gate cannot disagree about which version comes next — review
// round 2 found they did: the bump skipped a burned 2.0.2 to 2.0.3, and the gate then refused 2.0.3
// because "a patch from 2.0.1 is 2.0.2".
//
// The states of a TAGGED version above the last completed release (`surface/released.txt`):
//   burned    tagged, on crates.io for NONE of the three crates — its release never got through; the
//             version is never reused, the next one is taken
//   partial   tagged, on crates.io for SOME — an unfinished publish: finish that run, never skip it
//   released  tagged, on crates.io for ALL three — a completed release whose step 9 (released.txt)
//             was not run: run it, never skip it

export type V = [number, number, number];
export type Level = "patch" | "minor" | "major";
export type TagState = "burned" | "partial" | "released";

export const parse = (s: string): V => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(s.trim());
  if (!m) throw new Error(`not a MAJOR.MINOR.PATCH version: ${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
export const show = (v: V) => v.join(".");
export const cmp = (a: V, b: V) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
export function inc(v: V, k: Level): V {
  if (k === "major") return [v[0] + 1, 0, 0];
  if (k === "minor") return [v[0], v[1] + 1, 0];
  return [v[0], v[1], v[2] + 1];
}
/** What kind of step `from → to` is (the highest component that moved). */
export function kindOf(from: V, to: V): Level {
  return to[0] !== from[0] ? "major" : to[1] !== from[1] ? "minor" : "patch";
}

/**
 * The version a `level` release after `released` gets, given the tags above `released` and their
 * states (`tags`: "X.Y.Z" → state). Burned versions are skipped by patch steps; a partial or released
 * one refuses; the answer must be above every existing tag. `exclude`: a version whose own tag is
 * expected (the release being verified on its tagged commit, a CI re-run).
 */
export function nextVersion(
  released: V,
  level: Level,
  tags: Map<string, TagState>,
  exclude?: V,
): { version: V; skipped: V[] } | { refuse: string } {
  let v = inc(released, level);
  const skipped: V[] = [];
  for (let guard = 0; ; guard++) {
    if (guard > 1000) return { refuse: "more than 1000 burned versions in a row" };
    if (exclude && cmp(v, exclude) === 0) break;
    const s = tags.get(show(v));
    if (s === undefined) break;
    if (s === "partial") {
      return { refuse: `v${show(v)} is tagged and PARTLY on crates.io: its release is unfinished — finish its run ("Re-run failed jobs"), never skip it` };
    }
    if (s === "released") {
      return { refuse: `v${show(v)} is tagged and on crates.io: a completed release whose surface/released.txt step was not run — run step 9 first: bun scripts/surface.ts --release-from v${show(v)}` };
    }
    skipped.push(v);
    v = inc(v, "patch");
  }
  // Above every tag (a burned MINOR followed by a patch request would otherwise land below it).
  for (const t of tags.keys()) {
    const tv = parse(t);
    if (exclude && cmp(tv, exclude) === 0) continue;
    if (cmp(tv, v) >= 0) return { refuse: `v${t} exists at or above v${show(v)}: a ${level} after ${show(released)} cannot be released — choose a higher level` };
  }
  return { version: v, skipped };
}

/** Is `target` the version a release after `released` gets? Returns its level, or the refusal. */
export function verifyTarget(released: V, target: V, tags: Map<string, TagState>): { level: Level } | { refuse: string } {
  if (cmp(target, released) <= 0) return { refuse: `${show(target)} is not after the last release ${show(released)}` };
  const level = kindOf(released, target);
  const next = nextVersion(released, level, tags, target);
  if ("refuse" in next) return next;
  if (cmp(next.version, target) !== 0) {
    return { refuse: `a ${level} release after ${show(released)} is ${show(next.version)}${next.skipped.length ? ` (burned: ${next.skipped.map(show).join(", ")})` : ""}, not ${show(target)}` };
  }
  return { level };
}
