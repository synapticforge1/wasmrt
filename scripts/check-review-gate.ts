// check-review-gate.ts — self-test of scripts/review-gate.ts (H37 (d)): the issues-file line, and
// which changes after the reviewed commit the review did not read.  bun scripts/check-review-gate.ts
import process from "node:process";
import { reviewedCommit, unreviewed } from "./review-gate.ts";

let pass = 0, failures = 0;
function check(name: string, ok: boolean) {
  if (ok) pass++;
  else {
    failures++;
    console.error(`✗ ${name}`);
  }
}
const refused = (t: string) => "refusal" in reviewedCommit(t);
const commitOf = (t: string) => (reviewedCommit(t) as { commit?: string }).commit;

check("a commit id is read", commitOf("# x\nReview complete: abc1234\n") === "abc1234");
check("a full id is read", commitOf(`Review complete: ${"a".repeat(40)}`) === "a".repeat(40));
check("CRLF is tolerated", commitOf("Review complete: abc1234\r\n") === "abc1234");
check("a BOM is tolerated", commitOf("﻿Review complete: abc1234") === "abc1234");
check("no line is refused", refused("# issues\n"));
check("none is refused", refused("Review complete: none"));
check("empty is refused", refused("Review complete:"));
check("two lines are refused", refused("Review complete: abc1234\nReview complete: def5678"));
check("a non-hex value is refused", refused("Review complete: HEAD"));
check("too short is refused", refused("Review complete: abc12"));
check("indented (inside a quote or list) does not count", refused("  Review complete: abc1234"));

const m = (o: Record<string, string>) => new Map(Object.entries(o));
const ver = "@@ -1 +1 @@\n-version = \"2.0.1\"\n+version = \"2.0.2\"\n";
check("the bump's Cargo.toml passes", unreviewed(m({ "Cargo.toml": ver })).length === 0);
check("the bump's Cargo.lock passes", unreviewed(m({ "Cargo.lock": ver })).length === 0);
check("a dependency added to Cargo.toml is unreviewed", unreviewed(m({ "Cargo.toml": "@@ -5 +5,2 @@\n+foo = \"1\"\n" })).length === 1);
// The real bump's Cargo.toml diff (2026-11-19), the internal pin included: it must pass.
const pin = (v: string, p = "crates/wasmrt-core") => `wasmrt-core = { path = "${p}", version = "${v}" }`;
const realBump = `@@ -11 +11 @@\n-version = "2.0.1"\n+version = "2.0.2"\n@@ -20 +20 @@\n-${pin("2.0.1")}\n+${pin("2.0.2")}\n`;
check("the real bump (version + internal pin) passes", unreviewed(m({ "Cargo.toml": realBump })).length === 0);
check("the pin with a changed path is unreviewed", unreviewed(m({ "Cargo.toml": `@@ -20 +20 @@\n-${pin("2.0.1")}\n+${pin("2.0.2", "../evil")}\n` })).length === 1);
check("a new dependency carrying a version is unreviewed", unreviewed(m({ "Cargo.toml": `@@ -20 +20,2 @@\n+evil = { version = "1.0.0" }\n` })).length === 1);
check("a removed dependency is unreviewed", unreviewed(m({ "Cargo.lock": `@@ -20,2 +20 @@\n-version = "1.0.0"\n` })).length === 1);
check("a version swapped for a different key is unreviewed", unreviewed(m({ "Cargo.toml": `@@ -11 +11 @@\n-version = "2.0.1"\n+rust-version = "2.0.2"\n` })).length === 1);
check("a profile change in Cargo.toml is unreviewed", unreviewed(m({ "Cargo.toml": "@@ -9 +9 @@\n-opt-level = \"z\"\n+opt-level = 3\n" })).length === 1);
check("CHANGELOG passes", unreviewed(m({ "CHANGELOG.md": "@@ +1 @@\n+anything\n" })).length === 0);
check("cmem notes pass", unreviewed(m({ "cmem/release.md": "+x\n" })).length === 0);
check("the issues file itself is refused (it must never be tracked)", unreviewed(m({ "cmem/review-issues.md": "+x\n" })).length === 1);
check("README Tested on passes", unreviewed(m({ "README.md": "@@ +3 @@\n+Tested on: Windows 11 (win-x64)\n" })).length === 0);
check("README version passes", unreviewed(m({ "README.md": "@@ -2 +2 @@\n-cargo install wasmrt --version 2.0.1\n+cargo install wasmrt --version 2.0.2\n" })).length === 0);
check("README prose is unreviewed", unreviewed(m({ "README.md": "@@ +9 @@\n+The CLI now accepts --foo.\n" })).length === 1);
check("source is unreviewed", unreviewed(m({ "crates/wasmrt-core/src/lib.rs": "+x\n" })).length === 1);
check("a script is unreviewed", unreviewed(m({ "scripts/gate.ts": "+x\n" })).length === 1);
check("a workflow is unreviewed", unreviewed(m({ ".github/workflows/release.yml": "+x\n" })).length === 1);
check("the diff header lines do not count", unreviewed(m({ "Cargo.toml": "--- a/Cargo.toml\n+++ b/Cargo.toml\n" + ver })).length === 0);

console.log(`check-review-gate: ${pass} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
