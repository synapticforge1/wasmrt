# release.md — every release, newest first

🔒 **One place for the release record in every project** (owner, 2026-11-10, decision D3: "releases
should be recorded in one place in every project; … release.md should be the file name with the
newest first in the 'Release History' with a summary of what changed in each one"; workspace letter
H33, release-process.md § 5 U11). How a release RUNS is `releasing.md` (the checklist, the tooling);
what each one WAS is here. Moved here on 2026-11-12 from `releasing.md` § Status, § 1.0.0, § 0.9.0
and § Previous, with every claim as it was written; `CHANGELOG.md` stays the public note per version.

**Each entry, from the next release on** (checked by `bun scripts/release-record.ts reviews X.Y.Z`,
in `release.ts` and in CI's `gate.ts --release`, BEFORE CI may tag):

- the heading `### X.Y.Z — <date> — <one line>`;
- a summary of what changed (prose, at least one line);
- 🔒 `- **Security review:** …` and `- **Hardening review:** …` — each run to its EMPTY round on
  everything since the last release, and the line says so ("ended by an empty round"); written
  BEFORE the bump (owner, 2026-11-12: "security and hardening reviews should be required before every
  release"; workspace letter H35, `review-process.md`);
- after CI: the run id, the tag's commit, the Release page's author, the three crates read back from
  crates.io, and what was checked as a user (U10: `cargo install wasmrt --version X.Y.Z` in a
  scratch folder, then `wasmrt --version`).

Releases before 2026-11-12 predate the review requirement and record no reviews.

## Release History

### 2.0.1 — 2026-11-09 — the Release page through GitHub's REST API

No code changes since 2.0.0. It carries the H30 release-page change (`releasing.md` § Tooling) and
the records.

- **Owner:** "update the project memory files, commit, push, release". Checklist, measured
  2026-11-09 on rustc nightly `708c94ef0`: 606 workspace tests, 0 failed, 1 ignored; clippy
  `-D warnings` clean; surface check, eol, definitions and C-ABI gate (`CC=gcc`) green; S1 in
  `cargo test`; the floor against `v2.0.0` 0 / 0; S2 64,603 / 0 / 0, 0 regressed. S3 (wasmtk's
  corpus) was not run: the source is identical. Size and speed: see the CHANGELOG [2.0.1] and
  `open-work.md` (the floating nightly, proven by building on both). Both binaries import only
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
  `roadmap.md`.
