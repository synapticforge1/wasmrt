# release.md — every release, newest first

🔒 **One place for the release record in every project** (owner, 2026-11-10, decision D3: "releases
should be recorded in one place in every project; … release.md should be the file name with the
newest first in the 'Release History' with a summary of what changed in each one"; workspace letter
H33, release-process.md § 5 U11). How a release RUNS is `releasing.md` (the checklist, the tooling);
what each one WAS is here. Moved here on 2026-11-12 from `releasing.md` § Status, § 1.0.0, § 0.9.0
and § Previous, with every claim as it was written; `CHANGELOG.md` stays the public note per version.

**Each entry, from the next release on** (checked by `bun scripts/release-record.ts entry X.Y.Z`
in `gate.ts --release`, which `release.ts` runs locally BEFORE it pushes; 🔁 since 2026-11-19, H37):

- the heading `### X.Y.Z — YYYY-MM-DD — <one line>` (an em dash, en dash or hyphen; a real date);
- a summary of what changed (prose, at least one line);
- 🔒 one `Tested on: <OS and version> (<platform ID>)` line per platform the full suite ran on (the
  distro named for Linux), and — unless all six IDs are listed — `Other platforms: not yet tested.`
  (owner, 2026-11-19; `platforms.md`). The same lines open the CHANGELOG section, which the Release
  page is made from (`release-record.ts notes` checks them there too);
- "Platforms verified": one result line per platform — version, commit, date, platform ID, suite
  counts (`review-process.md` § 12 of the workspace standard);
- after CI: the run id, the tag's commit, the Release page's author, the three crates read back from
  crates.io, and what was checked as a user (U10: `cargo install wasmrt --version X.Y.Z` in a
  scratch folder, then `wasmrt --version`).

The review is no longer recorded here: its result is the `Review complete: <commit>` line of the
gitignored `review-issues.md`, read by `review-gate.ts` (H37 (d)). *(2026-11-12 to 11-19, H35: each
entry needed `**Security review:**` and `**Hardening review:**` lines ending "Ended by an empty round:
round N, date."; no release was made under that rule.)* Releases before 2026-11-12 record no reviews.

## Release History

### 3.0.0 — 2026-11-25 — wasmtime's refusals in its words, one-pass load, faster and leaner

A major release (owner, 2026-11-25: "release 3.0.0"). wasmtime's implementation limits (the measured-needed
set); decode and validation refusals in wasmtime's words and almost always at its offset (wasmparser 0.263's, credited);
decoding and validation in one pass, as wasmtime reads a module (`module::parse` / `Parsed::validate`); the
efficiency review (function calls ~3× faster, a large module's memory a third to a half lower); `pin` and `wat -o` write files whole (temp + rename)
and `pin` holds an OS file lock; the C ABI refuses a callback that re-enters its own store (was undefined
behaviour); gnu toolchains on both OSes, MSRV 1.100. Breaking: the Rust API's new fields and error variants
(three removed), the limits, the CLI's file writing, the MSRV (README Breaking Changes, six rows).

Tested on: Windows 11 Pro 10.0.26300 (`win-x64`)
Tested on: Ubuntu 26.04.1 LTS under WSL (`linux-x64`)
Other platforms: not yet tested.

- **Review:** the release review over `v2.0.2..f17127e`, five classes in order: basic R1 (a new file created
  0600 on Unix), licensing L1 (README's component count), notes; hardening, security, privacy EMPTY. Fixed;
  re-review 1: one small issue (the DB read through the unresolved path), fixed; re-review 2 EMPTY.
  `Review complete:` at the notes commit (gitignored `review-issues.md`).
- **Platforms verified** (nightly `708c94ef0`, commit `10f032b`, 2026-11-25; only release notes after):
  - `win-x64`: workspace 634 / 0, gate 21 / 22 before the commit (publish dry run: dirty tree), 2.0.2's tests
    72 / 0, C gate, Miri PASSED, S2 64,603 / 0 / 0 over 288 (0 regressed), carry-forward vs v2.0.2 0 / 0 (S1) and
    0 / 0 over 30,023 pairs of wasmtk's corpus (S3).
  - `linux-x64`: workspace 634 / 0, gate 21 / 22 (same), 2.0.2's tests 71 / 0, C gate, Miri PASSED, S2 64,603 /
    0 / 0, carry-forward 0 / 0.
- **Checklist:** floor PATCH by behaviour (0 / 0) and MAJOR by the API (new fields, removed variants). Size: CLI
  915,968 B (2.0.2 built today the same way: 845,824, +8.3%), DLL 583,680 B (536,064, +8.9%) — the refusal
  sentences and limits, the one-pass load beside the kept two-pass API, the CLI's safe writes. Speed (bench, three
  A/B rounds): cold start 3.2–3.9 ms (4.1–4.4), steady 192–223 Mops/s (166–181), toy cold start within noise.
  Both binaries import only Windows-provided DLLs; the CLI runs from an empty folder on a system-only `PATH`.

### 2.0.2 — 2026-11-19 — licence texts in every crate; the first release under the H37 review

The first release reviewed under the five-class standard (H37; owner's "option B", restarting 2.0.2
after the H35 rounds). Runtime behaviour unchanged. Fixed: no published crate had carried a licence
text or NOTICE (L1) — all three now ship `LICENSE-MIT`, `LICENSE-APACHE`, `NOTICE` and `third_party/`,
held equal to the root by `licence-copies.ts`. Release tooling: `bump.ts` restores the version files
when it fails (H1), every release subprocess has a time limit (H2), `release.ts` reads every page of
crates.io's list (B-h1); a README privacy statement (P3). CI only publishes; every gate is local.
The owner kept the release approval local — no GitHub environment (S1, the accepted risk:
`releasing.md` § Repository settings); rulesets on `main` and `v*` tags set.

Tested on: Windows 11 Pro 10.0.26300 (`win-x64`)
Tested on: Ubuntu 26.04.1 LTS under WSL (`linux-x64`)
Other platforms: not yet tested.

- **Review:** `Review complete: f945956` (gitignored `review-issues.md`). First review: B1, H1, H2,
  L1, S1, P3 accepted (plus sibling notes); re-review 1: R-B1, R-S1; re-review 2: empty in all five
  classes. S1 then closed by the owner's decision (the workflow back to the reviewed bytes).
- **Platforms verified** (nightly `708c94ef0`, commit `76ca5a0`, 2026-11-19; no code changed after):
  - `win-x64`: gate 21 / 21 (workspace tests 608 / 0 / 1; v2.0.1's 70 / 0), S2 64,603 / 0 / 0 over
    288 (0 regressed), carry-forward vs v2.0.1 0 / 0 (patch), Miri 33 / 33.
  - `linux-x64`: gate 21 / 21 (607 / 0 / 1 — one test is `#[cfg(windows)]`; v2.0.1's 69 / 0), S2
    64,603 / 0 / 0, carry-forward 0 / 0, Miri PASSED.
- **Checklist:** floor PATCH (`bump.ts patch --dry-run`: surface 0 / 0, semver patch ×2, behaviour
  0 / 0, v2.0.1's tests 70 / 0). Size: CLI 845,824 B, DLL 536,064 B — byte-identical to v2.0.1 built
  the same way today (sha256 compared), so speed unchanged by construction; 2.0.1's recorded
  535,552 B DLL is not reproduced by 2.0.1 itself today. Both binaries import only Windows-provided
  DLLs; the CLI runs from an empty folder on a system-only `PATH`. ROADMAP has no 2.0.2 row
  (review-gate allows only release notes after the reviewed commit).
- **Trial of the changed `release.yml`:** `main` `80891c6`, run 44642273945 — `checks` green, the
  rest skipped (version 2.0.1).
- **The release run.** Owner: "release" (2026-11-19). `bump.ts patch` → `bump to v2.0.2`;
  `release.ts` refused twice before pushing — (1) `review-gate.ts` counted the bump's internal pin as
  unreviewed: fixed in `166e918`, the bump undone and remade (`b3fb838`), `Review complete:` moved
  `f945956` → `166e918` (only gate scripts changed); (2) `prev-tag-tests.ts`'s cleanup hit a
  transient Windows lock (`EBUSY`) after its tests ran (open issue I9) — retried unchanged; (3) green,
  `main` pushed = `b3fb838` (read back).
- **✅ PUBLISHED 2026-11-20 (UTC)**: run 44643955150, all four jobs success. Tag `v2.0.2` (annotated,
  CI's) peels to `b3fb838`. Release page `v2.0.2` by **`github-actions[bot]`**, not a draft, titled
  from the CHANGELOG heading. crates.io: wasmrt-core, wasmrt-capi, wasmrt at 2.0.2, not yanked,
  `MIT OR Apache-2.0` (API; created 00:13:07–00:13:12 UTC) — the first publish through trusted
  publishing from CI. The published `wasmrt-core-2.0.2.crate` holds `LICENSE-MIT`, `LICENSE-APACHE`,
  `NOTICE`, `third_party/LICENSES.md`, `third_party/wabt/LICENSE` (L1 reached users) and
  `.cargo_vcs_info.json` sha1 `b3fb838`. As a user (U10): `cargo install wasmrt --version 2.0.2` in a
  scratch root → `wasmrt 2.0.2 (abi 1)`, twice (2026-11-19 and 11-20). Step 9: `surface/released.txt`
  re-recorded from the tag (`9cd567c`), only its `released-as` line changed. The floor since is PATCH.

### 2.0.1 — 2026-11-09 — the Release page through GitHub's REST API

No code changes since 2.0.0. It carries the H30 release-page change (`releasing.md` § Tooling) and
the records.

- **Owner:** "update the project memory files, commit, push, release". Checklist, measured
  2026-11-09 on rustc nightly `708c94ef0`: 606 workspace tests, 0 failed, 1 ignored; clippy
  `-D warnings` clean; surface check, eol, definitions and C-ABI gate (`CC=gcc`) green; S1 in
  `cargo test`; the floor against `v2.0.0` 0 / 0; S2 64,603 / 0 / 0, 0 regressed. S3 (wasmtk's
  corpus) was not run: the source is identical. Size and speed: see the CHANGELOG [2.0.1] and
  `archive/open-work-to-2026-11-23.md` (the floating nightly, proven by building on both). Both binaries import only
  Windows-provided DLLs, and the CLI runs on a system-only `PATH`. `bump.ts patch`: 2.0.0 → 2.0.1.
  **Steps 7–8 were done by the agent this time, on the owner's "release"**: the crates.io login was
  already on this machine.
- **✅ PUBLISHED 2026-11-09**: release commit `c3cb7dd` = tag `v2.0.1` = `origin/main` (`ls-remote`).
  Workflow run 42724412211 succeeded, with every step of both jobs green (public Actions API),
  including the self-test and the real-API dry run in the gate. **H30 measured on Actions**: the
  Release page `v2.0.1` was made by **`github-actions[bot]`**. It is not a draft; its title is the
  CHANGELOG heading and its body is the 1,972-character section; the tag did not move. Then
  `cargo publish` wasmrt-core → wasmrt-capi → wasmrt: all three at 2.0.1 on crates.io and not yanked
  (its API, created 2026-11-10T00:04 UTC). Step 9: `surface/released.txt` re-recorded from the tag.
  Only its `released-as` and `tools` lines changed, so the public surface is identical to 2.0.0's.
  The floor since is PATCH.
- *(The last release published from the owner's workstation: from the next one, CI publishes —
  `releasing.md` § Tooling, decision D2.)*

### 2.0.0 — 2026-10-24 — a validation correction, and binaryang D2 2.2.0

- **✅ PUBLISHED (release commit `1715139`, tag `v2.0.0`)** — all three crates at 2.0.0 on crates.io
  (checked through its API); `surface/released.txt` re-recorded from the tag (step 9, its own commit;
  only its `released-as` line changed). The floor since is PATCH. **Next: the review stages, T9
  hardening first.** One validation correction (an `exact` reference needs reference-types), MAJOR
  by the gate (owner: "2.0.0 is fine"), and the binaryang 2.2.0 re-pin; it waited for contract v40
  (owner), which is mirrored and verified. Checklist: 606 workspace tests, clippy clean, S1
  re-baselined for the one intended refusal, S2 0 regressed, S3 over wasmtk 0 / 0 against v1.0.0;
  size identical to a v1.0.0 build on the same toolchain (CLI 846,848 B, DLL 534,528 B) and speed
  within noise (interleaved A/B, cold 48 KB 3.21–3.27 vs 3.22–3.30 ms, steady 235–246 vs
  234–252 Mops/s); both binaries import only Windows-provided DLLs and the CLI runs on a system-only
  `PATH`; `bump.ts major` 1.0.0 → 2.0.0 and `--verify-tag v2.0.0` pass. Public surface unchanged.
  Steps 7–8 were the owner's.

### 1.0.0 — 2026-10-24 — T13, the conformance clear-out

- **✅ PUBLISHED (release commit `9871fd4`, tag `v1.0.0`)** — all three crates at 1.0.0 on crates.io
  (checked through its API), and `surface/released.txt` re-recorded from the tag (step 9, its own
  commit). The floor since then is MAJOR (the `exact`-type correction refuses one module more), and
  🔒 **the next release is `2.0.0` (owner, 2026-10-24: "2.0.0 is fine")** — the ladder had planned
  `1.0.1` (T9, hardening). The review stages keep their order; their numbers are whatever the gate
  says. T13, the conformance clear-out: 64,603 / 0 / 0 over 288 files. Checklist steps 1–6 done: 606
  workspace tests and clippy clean; S1 re-baselined for every intended change, S2 0 regressed; sizes
  and speed re-measured beside a v0.9.0 build on the same toolchain (CLI 644,608 → 846,848 B, +31%;
  cdylib 1,235,456 → 534,528 B, −57%; CHANGELOG [1.0.0] "Size and speed"); the CLI and the DLL import
  only Windows-provided DLLs, and the CLI runs from an empty directory on a system-only `PATH`;
  `bump.ts major` applied 0.9.0 → 1.0.0, and `--verify-tag v1.0.0` passes locally. The README's
  Breaking Changes rows are renamed `_next release_` → `1.0.0`; `bump.ts` accepts a row named for the
  manifest's new version as well (inverted: with the rows renamed away, it warns). S3 (the
  wasmtk-wide carry-forward, local, not binding) over v0.9.0 → the tree: 89 accepted → refused, 447
  refused → accepted, **none of the 89 under `all`**, the default. Sampled, all three are intended
  classes and wasm-tools 1.262 refuses the same files: `mutable-globals` under `mvp`-based sets
  (v37), the overlong `call_indirect` index LLVM writes (`1_fib-rs.wasm` under
  `all,-reference-types`, v37), and the D2 type rule (`gc-cast-type.wat` under gc without
  reference-types). Steps 7–8 were the owner's (tag, then publish).
- **Shipped with it, from 2026-08-07 (T9d): per-crate crates.io listing metadata.** All three crates
  carry `keywords`, `categories` and `readme`, and each has **its own short README** (the
  `../../README.md` path is rejected — cargo packages the readme, so it must live inside the
  package). Categories: core `wasm`/`no-std`/`development-tools`, capi
  `wasm`/`external-ffi-bindings`/`development-tools`, CLI
  `wasm`/`command-line-utilities`/`development-tools`. Verified with `cargo package --no-verify` on
  each: clean. The 0.9.0 crates do not have them.

### 0.9.0 — 2026-08-06 — T8, the `wasmrt.h` C ABI

- **✅ PUBLISHED and pushed (release commit `a7abd83`, tag `v0.9.0`).** T8 — the **`wasmrt.h` C ABI**
  — shipped with all three gates green (`abi_symbols.c` 74/74, `c_smoke.c` compiled by a C compiler
  against the shipped header, and Miri over a randomized lifecycle fuzz). Also ships **proposal
  gating** + **configurable resource ceilings**, a **`Linker` in core**, and two
  **silent-wrong-output** fixes (dropped table initializers; element-segment form 4 rewriting a
  segment's type). Conformance **61,033 / 738 / 3,075 — 98.8%**; 351 workspace tests.
  **`abi_version()` is now 1** (was 0) — the C ABI is finalized, and `WASMRT_ABI_VERSION` in the
  header must stay equal to it (a test pins the pair).
- `wasmrt`, `wasmrt-core` and `wasmrt-capi` live on crates.io through v0.9.0. The tag fired
  `.github/workflows/release.yml` for the GitHub release, as it has since v0.6.4.
- **The pre-publish doc-sync gate held again:** the version bump, `ROADMAP.md`/`CHANGELOG.md`/
  `README.md` and the **full** `cmem/` sync were all in the release commit `a7abd83` itself, so the
  published artifact carries its own docs. Nine `cmem/` files plus `tests/README.md` were touched, and
  the v0 header draft in `docs/port/` was marked HISTORICAL rather than left to mislead.
- *(Superseded plan, kept as written: "Next release: T13 — the conformance clear-out (`1.0.0`, owner
  2026-08-19) … Then T9 hardening (`1.0.1`), T10 bug hunt + code hygiene (`1.0.2`), T11 optimization
  review (`1.0.3`), T12 security review (`1.0.4`)". Since 2026-10-24 the numbers come from the gate.)*

### 0.8.0 — 2026-08-05 — T7, host imports, module linking, WASI preview 1

- **✅ PUBLISHED and pushed (release commit `81d1c24`, tag `v0.8.0`).** It ships **all of T7** — host
  imports, module linking on a shared store, and WASI preview 1 **including the sandboxed
  filesystem** with `--dir`/`--ro-dir` — plus the **safety pass** (`#![forbid(unsafe_code)]` in core
  and the CLI) and the **literal/text edges**. Spec-suite conformance at release: **98.8%** (61,013
  passing / 751 failing / 3,094 skipped) and **all 284 files parse for the first time**. 281
  workspace tests.

### 0.1.0 – 0.7.0 — 2026-07-27 onward — the port's ladder

- **The full release chain:** T0 v0.1.0 → T3 v0.4.0 → T4-core v0.5.0 → T5 integer v0.6.0 → float
  v0.6.1 → linear memory v0.6.2 → tables/reftypes v0.6.3 → WasmGC v0.6.4 → SIMD v0.6.5 →
  multi-memory v0.6.6 → threads/atomics v0.6.7 → memory64 v0.6.8 → exception handling v0.6.9 → text
  toolchain + validator completion v0.7.0 (then v0.8.0 and v0.9.0 above). The owner ran each
  publish; the rhythm was implement → **full-doc prep** → owner publishes. **v0.6.4 onward ran under
  the pre-publish doc-sync gate, and each v0.6.4+ GitHub release was created automatically by the
  tag-triggered `.github/workflows/release.yml`.** Per-version detail: `CHANGELOG.md` and
  `archive/roadmap-to-2.0.2.md`.
