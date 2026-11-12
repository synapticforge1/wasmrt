// Self-test of scripts/versions.ts — pure, so every case runs in-process. The burned-version cases are
// review round 2's: the bump and the gate disagreed after a burned 2.0.2.
//
//   bun scripts/check-versions.ts [path/to/versions.ts]
import { join } from "node:path";
import process from "node:process";

const mod = await import(process.argv[2] ?? join(import.meta.dirname!, "versions.ts"));
const { nextVersion, verifyTarget, parse, show } = mod;
type TagState = "burned" | "partial" | "released";

let pass = 0, failed = 0;
function check(name: string, ok: boolean, detail: string) {
  if (ok) pass++;
  else {
    failed++;
    console.log(`  FAIL: ${name} — ${detail}`);
  }
}
const tags = (o: Record<string, TagState>) => new Map(Object.entries(o));
const next = (rel: string, level: string, t: Record<string, TagState>) => nextVersion(parse(rel), level, tags(t));
const verify = (rel: string, target: string, t: Record<string, TagState>) => verifyTarget(parse(rel), parse(target), tags(t));
const is = (r: any, want: string) => "version" in r && show(r.version) === want;
const refuses = (r: any, frag: string) => "refuse" in r && r.refuse.includes(frag);

// ── nextVersion ──
check("patch, no tags: 2.0.2", is(next("2.0.1", "patch", {}), "2.0.2"), JSON.stringify(next("2.0.1", "patch", {})));
check("minor resets patch: 2.1.0", is(next("2.0.1", "minor", {}), "2.1.0"), "");
check("major resets both: 3.0.0", is(next("2.0.1", "major", {}), "3.0.0"), "");
check("a burned 2.0.2 is skipped: 2.0.3", is(next("2.0.1", "patch", { "2.0.2": "burned" }), "2.0.3"), "");
check("two burned in a row: 2.0.4", is(next("2.0.1", "patch", { "2.0.2": "burned", "2.0.3": "burned" }), "2.0.4"), "");
check("a burned minor 2.1.0 → 2.1.1", is(next("2.0.1", "minor", { "2.1.0": "burned" }), "2.1.1"), "");
check("a PARTLY published 2.0.2 refuses (finish it)", refuses(next("2.0.1", "patch", { "2.0.2": "partial" }), "PARTLY"), "");
check("a fully published 2.0.2 refuses (run step 9)", refuses(next("2.0.1", "patch", { "2.0.2": "released" }), "step 9"), "");
check("a patch below a burned minor refuses (above every tag)", refuses(next("2.0.1", "patch", { "2.1.0": "burned" }), "at or above"), "");
check("tags BELOW released are irrelevant", is(next("2.0.1", "patch", { "1.9.0": "released" } as any), "2.0.2"), "");

// ── verifyTarget: the gate must accept exactly what the bump produces ──
check("verify 2.0.2 after 2.0.1", "level" in verify("2.0.1", "2.0.2", {}), JSON.stringify(verify("2.0.1", "2.0.2", {})));
check("verify 2.0.3 after a burned 2.0.2 (the round-2 defect)", "level" in verify("2.0.1", "2.0.3", { "2.0.2": "burned" }), JSON.stringify(verify("2.0.1", "2.0.3", { "2.0.2": "burned" })));
check("refuse 2.0.3 when 2.0.2 is NOT burned (skipping a version)", refuses(verify("2.0.1", "2.0.3", {}), "is 2.0.2"), JSON.stringify(verify("2.0.1", "2.0.3", {})));
check("verify on the release's own tagged commit (a CI re-run): its own tag is expected", "level" in verify("2.0.1", "2.0.2", { "2.0.2": "partial" }), JSON.stringify(verify("2.0.1", "2.0.2", { "2.0.2": "partial" })));
check("verify 2.1.1 after a burned 2.1.0", "level" in verify("2.0.1", "2.1.1", { "2.1.0": "burned" }), "");
check("refuse a target not after released", refuses(verify("2.0.1", "2.0.1", {}), "not after"), "");
check("refuse a target with lower components not reset (2.1.3)", refuses(verify("2.0.1", "2.1.3", {}), "is 2.1.0"), "");
// The bump's answer always verifies: every level × a set of tag situations.
const situations: Record<string, TagState>[] = [{}, { "2.0.2": "burned" }, { "2.0.2": "burned", "2.0.3": "burned" }, { "2.1.0": "burned" }, { "3.0.0": "burned" }];
let agree = 0, total = 0;
for (const t of situations) {
  for (const level of ["patch", "minor", "major"]) {
    const n = next("2.0.1", level, t);
    if (!("version" in n)) continue;
    total++;
    if ("level" in verify("2.0.1", show(n.version), t)) agree++;
    else console.log(`  disagree: ${level} with ${JSON.stringify(t)} → ${show(n.version)}: ${JSON.stringify(verify("2.0.1", show(n.version), t))}`);
  }
}
check(`the gate accepts every version the bump produces (${agree} of ${total})`, agree === total && total > 0, `${agree}/${total}`);

console.log(`\nversions self-test: ${pass} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
