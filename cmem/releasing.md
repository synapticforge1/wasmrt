# Releasing & Versioning

How wasmrt is versioned and published so others can follow progress. Decisions locked by the owner
**2026-07-27**. Public-facing trackers: `ROADMAP.md` + `CHANGELOG.md` (repo root — NOT project memory,
but this file defines the process that keeps them current).

## Versioning = port-progress ladder (owner decision)

The destination is fixed and known: **a complete runtime, small and fast enough to be chosen.** The
version number measures how far wasmrt has climbed toward it and reflects what genuinely runs and passes
its gate — never inflated to signal the effort's maturity (that story is told by `ROADMAP.md`'s use-case
matrix + a fast cadence).

*Through T9 the destination was phrased as "the completed, frozen `wazmrt` oracle". **Retired 2026-08-11
(owner)** — see the 1.0 entry below.*

- **`0.x`** — in progress; each release lands one gated stage.
- **`1.0.0`** — 🆕 **RE-CUT 2026-08-19 (owner): the CONFORMANCE CLEAR-OUT.** The spec corpus driven to
  **zero failures, zero skips, zero unrun files**, an **empty baseline**, and **zero deliberate spec
  deviations**. This is a specific deliverable, not a summary of the phases before it — and it brings the
  proposals the corpus contains into scope (custom-descriptors/`exact`, table64, wide-arithmetic,
  custom-page-sizes, custom-annotations, memory64-imports, legacy `delegate`). WASI p2/p3 and the
  component model stay out. Task **T13** in `roadmap.md`.
- **`1.0.x`** — the four review phases, behind it and in this order: **`1.0.1`** T9 hardening (incl.
  `pin`), **`1.0.2`** T10 bug hunt + code hygiene, **`1.0.3`** T11 optimization review, **`1.0.4`** T12
  security review. ⚠️ **The API stability promise starts at `1.0.0`**, so the C ABI and `wasmrt-core`
  surfaces freeze when the clear-out ships — a proposal added at 1.0.0 may add a `wasmrt_feature_t`
  value, which is additive and keeps `abi_version() == 1`; anything that is not additive must land
  BEFORE 1.0.0 or wait for 2.0.
- *(Superseded: `1.0.0` previously meant "complete on wasmrt's own terms — every in-scope proposal
  implemented, conformance at its achievable ceiling, C ABI stable, size/speed measured and defended".
  That reading made 1.0 a judgement call; the clear-out makes it a number.)* 🔒 **The wazmrt oracle was retired as the 1.0 criterion on
  2026-08-11 (owner)** — the two runtimes now compete independently for inclusion in wasmtk and the
  universalWasmLoader-\* runtimes, so parity with a competitor is neither the goal nor a meaningful gate.
- Pre-1.0 the public API (both `wasmrt-core` and `wasmrt.h`) is **unstable** — breaking changes bump the
  minor (`0.y`), which is the SemVer compatibility unit below 1.0. Expect frequent `0.y` bumps until T8.

🔒 **THE NUMBER IS SemVer 2.0.0, AND A GATE SETS ITS FLOOR (workspace letter H6, adopted 2026-10-24).**
`bun scripts/bump.ts patch|minor|major` is the only way the version moves. It computes the FLOOR since
the last release from three diffs and refuses a bump below it, printing what set it:

| diff | tool | shows |
| --- | --- | --- |
| surface | `bun scripts/surface.ts` (`surface/released.txt` → the tree) | the Rust `pub` API of `wasmrt-core` and `wasmrt-capi` (`cargo public-api -s`), `wasmrt.h` (prototypes without parameter names, typedefs, struct bodies, `#define`s, enum members WITH ordinals), and `--help`'s usage shapes and flag spellings |
| semver | `cargo semver-checks --baseline-rev <last tag>` | Rust breaks a line diff calls additions: a variant added to an exhaustive enum, a field added to a constructible struct, a lost auto trait |
| behaviour | `bun scripts/carry-forward.ts <last tag> WORKTREE` (S1, step 1c) | a module the release ACCEPTED that the tree refuses |

Anything removed, changed, retyped or "accepting less" (even when correct) → **major**; only additions →
**minor**; nothing → **patch**. **Pre-1.0 (rule 6), a minor may carry a major floor**, but the README's
`### ⚠️ Breaking Changes` table must have a `_next release_` row, or the bump is refused. A bump resets
the lower components. **The surface files obey two rules:** `surface/current.txt` must equal the
sources (`bun scripts/surface.ts --check`), and an intended change is re-baselined with `--update` **in
its own commit, with the reason, never in the bump commit** (rule 5); after the release commit is
tagged, `bun scripts/surface.ts --release-from vX.Y.Z` records it as `surface/released.txt`, again its
own commit. Tools: `cargo-public-api` 0.52.0 and `cargo-semver-checks` 0.51.0 (installed with
`cargo binstall`), on the nightly toolchain. ⚠️ rustdoc output moves with the nightly, so each surface
file records its tools; when they differ, `bump.ts` regenerates the released surface from the tag
itself rather than trust the file.

✅ **Inverted 2026-10-24.** The C/CLI readers on 17 mutations: a removed prototype, a retyped parameter,
a struct field added, two enum members swapped, `WASMRT_ABI_VERSION` 1 → 2, a renamed or removed flag
and a changed usage shape each give MAJOR; an added prototype, an appended enum member and an added
flag give minor; a renamed parameter (also inside a callback type), re-indentation, a changed comment
and a reworded description give nothing. End to end: an unrecorded header change fails `--check` and
the bump; `bump patch` from 0.9.0 is refused (floor MAJOR: 54 surface lines removed or changed, 8
semver lints, 6 accepted → refused); `bump minor` is refused without the Breaking Changes row and
allowed with it (0.9.0 → 0.10.0); `--verify-tag` refuses a tag the manifest does not carry and a
re-tag of the last release; an argument that is not a bump kind is refused (exit 2).

⚠️ **What the gate cannot see, said plainly:**
- **Exit codes and parseable output** beyond `--help`'s syntax: the `interop.md` contract rows carry
  those, and the CLI tests pin them.
- **Rule 3's "previous tag's tests against the new source"**: not wired. wasmrt's integration tests
  (`crates/*/tests/`) could in principle be run against a newer tree, but `0.9.0 → now` has a major
  floor, so they cannot be expected to pass until a release follows `1.0.0`. The behaviour
  equivalent IS wired (step 1c, S1–S3). **Consumers' suites**: rsxtk is the named consumer and does
  not link wasmrt yet.
- **Behaviour the S1 corpus does not contain** (§4.13): S3 over wasmtk's corpus is the wide net.

*(Retired 2026-10-24 by H6: the cadence rule that "the patch component stays a single digit" — a
`0.y.z` line ran `z = 0…9` and the release after `0.y.9` was `0.(y+1).0`. Under SemVer the number says
what changed, not how many slices a line has held, so `0.y.10` is legal and a gate decides the
component. The rule is why the 0.6 line closed at v0.6.9 and the next release was 0.7.0.)*

**Stage → version map** (the ladder lives in `ROADMAP.md`; the port tasks in `roadmap.md`) — *shifted by
one from 0.8 onward when the 0.6 line filled up; T6 and the T4 completion then shipped together in 0.7.0*:
0.1 T0 scaffold · 0.2 T1 types+reader · 0.3 T2 opcode · 0.4 T3 decode · 0.5 T4 validate (core) ·
0.6.x T5 interp (patch per feature slice, 0.6.0–0.6.9) · **0.7 T6 text toolchain + T4 completion (the deferred SIMD/atomics/GC/EH typing arms)** ·
0.8 T7 wasi+cli · 0.9 T8 C-ABI · 🆕 **1.0.0 T13 conformance clear-out** · **1.0.1 T9 hardening** · **1.0.2 T10 bug hunt + code hygiene** · **1.0.3 T11 optimization review** · **1.0.4 T12 security review**.

🆕 **RE-CUT 2026-08-19 (owner).** The `0.10`–`0.13` rungs are gone: T9–T12 became the `1.0.x` line and a
new task, **T13 — the conformance clear-out — takes `1.0.0` and runs FIRST**. ⚠️ **T-numbers are
identifiers, not an order** (they are cited across every `cmem/` file), so the order is **T13 → T9 → T10
→ T11 → T12** while the names stay put. ⚠️ **Under SemVer (above) these numbers are a PLAN, not a
promise**: if a stage's diff sets a minor or major floor, the gate overrides the ladder and the map
shifts. (The next release from 0.9.0 has a MAJOR floor, which `1.0.0` satisfies.)

*(T10, T11 and T12 added by the owner 2026-08-06.)*

## Crates & names (owner decision: CLI takes the bare `wasmrt` name)

Three crates, **one shared version** (`workspace.package.version`), released together:

| Published name | Dir | Kind | Install |
| --- | --- | --- | --- |
| `wasmrt` | `crates/wasmrt` | CLI bin | `cargo install wasmrt` |
| `wasmrt-core` | `crates/wasmrt-core` | library | `wasmrt-core = "0.x"` |
| `wasmrt-capi` | `crates/wasmrt-capi` | C ABI (cdylib/staticlib) | build from source |

Names verified **available** on crates.io 2026-07-27 (`wasmrt`, `wasmrt-core`, `wasmrt-capi`,
`wasmrt-cli`, `wazmrt` all unregistered). The **first publish (0.1.0) claims all three names** — do it
early to avoid squatting. Needs the owner's crates.io API token (`cargo login`, or a `CRATES_IO_TOKEN`
repo secret if/when CI publish is added).

## Release cadence (owner decision: per-task, manual now)

Release on **each completed, parity-gated task**. Automate later (a tag-triggered GitHub Action or
`release-plz`) once the manual flow is proven; don't build CI publishing up front.

## Per-release checklist (binding — do all, in order)

**Steps 1–6 happen BEFORE the owner is notified of the publish needs** (the 🔒 rule below): the commit
that gets published must already carry every doc + memory update. The agent does 1–6 and commits; the
owner does 7–8; the agent then does 9.

1. **Task is DONE**: its conformance gate passes, `cargo test`/`clippy` green on all surfaces, no
   regression in the spec-suite numbers and **no file losing a pass**.
1a. **The size and speed numbers are re-measured and recorded**, because they are what decides inclusion
   (`cmem/vision.md`). A release that grows the cdylib or slows the steady loop must say so in the
   CHANGELOG with the reason — an unexplained regression is the one thing this project cannot ship.
1b. **The shipped binary is STANDALONE.** Copy `wasmrt.exe` to an empty directory and run it with
   `PATH` reduced to the system directories; it must print its version, not exit 127. `objdump -p`
   should list only `KERNEL32`, `ntdll`, `bcryptprimitives` and `api-ms-win-*`. ⚠️ This is a real step,
   not a formality — the CLI silently needed a **toolchain** DLL (`libunwind.dll`) until 2026-08-10,
   and every dev-box test passed the whole time. See the distribution manifest below.
1c. 🆕 **Behaviour is carried forward** (workspace letter H23, adopted 2026-10-23): what a consumer
   can RELY ON, which no surface diff sees. Three stages, **IN ORDER, STOPPING at the first one that
   finds an issue** until it is resolved (owner). "Resolved" includes INTENDED: a correct new refusal
   is re-baselined in its OWN commit, with the version and the CHANGELOG Breaking Changes row it
   demands.
   - **S1 — accepted modules, every `cargo test`:** `crates/wasmrt-core/tests/behaviour.rs` judges
     `tests/behaviour/` (71 modules, `bun scripts/behaviour-corpus.ts --check`) under 38
     configurations, decode + validate, nothing runs, against `tests/behaviour-snapshot.txt`. **At
     release, also run the floor against the LAST TAG:** `bun scripts/carry-forward.ts <last tag>
     WORKTREE`.
   - **S2 — code runs correctly, at release:** `bun scripts/behaviour-s2.ts`. Per-file spec results
     against `tests/spec-snapshot.txt`, pinned by the suite's CONTENT hash (a wasmtk commit id
     alone is not fetchable when wasmtk is mid-rewrite).
   - **S3 — the wide net, local only:** `bun scripts/carry-forward.ts --corpus ../wasmtk/tests
     <last tag> WORKTREE`, over wasmtk's ~1,190 modules by content hash. Not binding, and not
     pinnable.
   - **The floor:** refused → accepted = minor; **accepted → refused = MAJOR** (pre-1.0, rule 6:
     the minor this ladder allows, plus a Breaking Changes row). A changed run result is
     classified by hand.
2. **Update the public trackers:**
   - `ROADMAP.md` — flip the stage row to ✅ and check off every use-case the release makes real.
   - `CHANGELOG.md` — move `Unreleased` items into a new `[x.y.z]` section (Keep a Changelog format).
   - `README.md` — refresh the status line to what the release now runs.
3. **Sync ALL project memory (`cmem/`), not just the roadmap** — this is the step that used to lag a
   turn behind and ship stale. Fold the release into **every** affected file, then update
   `cmem/INDEX.md`'s Files table:
   - `cmem/roadmap.md` — mark the task/slice DONE with its per-slice record.
   - `cmem/architecture.md` — advance the "realized so far" snapshot to the new version.
   - `cmem/testing.md` — bump the unit-test count + note what the new slice's tests cover.
   - `cmem/known-issues.md` — log any new intentional divergences / deferrals from the slice.
   - `cmem/releasing.md` (this file) — advance the **Status** section to the new version.
   - any other `cmem/` file the slice touched (overview/design-decisions/security-model/…).
4. **Bump the version with the gate** — `bun scripts/bump.ts patch|minor|major` (try `--dry-run`
   first). It refuses a bump below the floor (see "THE NUMBER" above), then rewrites both
   `workspace.package.version` and the internal dep pin `wasmrt-core = { …, version = "x.y.z" }` (they
   MUST match or publish fails) and refreshes `Cargo.lock`. Never bump by hand. Before it:
   `bun scripts/surface.ts --check` is green, and any intended surface change has already been
   re-baselined in its own commit (rule 5).
5. **Re-verify green** after the doc/version edits: `cargo test --workspace` + `clippy` still pass (a
   version bump or doctest can break the build).
6. **Commit** the code + version + trackers + full `cmem/` sync as ONE release commit, and **notify the
   owner** it's ready to publish, handing over the exact commands for steps 7–9. *(This is the publish
   handoff — everything above is already committed, so the published artifact captures it.)*
7. **(Owner) Tag + push FIRST** — `git tag vX.Y.Z` then `git push origin main vX.Y.Z` (push the one
   tag: GitHub fires no tag event when more than three tags are pushed at once). 🆕 **Pushing the `v*`
   tag fires `.github/workflows/release.yml`, whose first job is the COMPATIBILITY GATE**:
   `bun scripts/bump.ts --verify-tag vX.Y.Z` checks the manifest carries `X.Y.Z` and that `X.Y.Z`
   clears the floor since the last release. Only if it passes does the second job extract this
   version's `CHANGELOG.md` section and create the GitHub Release (built-in `GITHUB_TOKEN`; it fails
   loudly if the CHANGELOG has no `## [X.Y.Z]` section). ⚠️ **The order changed on 2026-10-24**: the
   publish used to come before the tag, which would make a CI gate on the tag a check that runs after
   the crates are already on crates.io. Locally, `bun scripts/bump.ts --verify-tag vX.Y.Z` is the same
   check and can run before the push.
8. **(Owner) Publish, ONLY after the gate job is green**, in dependency order (crates.io requires deps
   published first): `cargo publish -p wasmrt-core` → `-p wasmrt-capi` → `-p wasmrt`.
9. **Record the release's surface**, its own commit: `bun scripts/surface.ts --release-from vX.Y.Z`
   (rewrites `surface/released.txt` with `# released-as: X.Y.Z`), and the S2 snapshot if it moved.

## 📦 Distribution manifest — exactly which files a user needs (2026-08-10)

**Measured on a clean `PATH`**, not read off the build files: each binary was copied to an empty
directory and run with `PATH=C:\Windows\system32;C:\Windows`. That is the only way to tell a real
dependency from one the dev box happens to satisfy.

| you are shipping | files a user needs | not needed |
| --- | --- | --- |
| **the CLI** | `wasmrt.exe` — **one file** | — |
| **the C ABI, dynamic** | `wasmrt_capi.dll` + `include/wasmrt.h` | `libwasmrt_capi.dll.a` (import lib: needed to **link**, not to run) |
| **the C ABI, static** | `libwasmrt_capi.a` + `include/wasmrt.h` | — |
| **the freestanding engine** | the `wasm32-unknown-unknown` `.wasm` | — |

⚠️ **`libwasmrt_capi.a` is ~22 MB and that is NOT shipped size.** A Rust `.a` carries crate metadata;
only the code the consumer actually links lands in their binary. Do not quote it as a size figure — the
honest numbers are the CLI and the cdylib (see `testing.md` / T9b).

### 🔒 The gotcha this manifest exists to prevent

Before 2026-08-10, `wasmrt.exe` was **not standalone**: it imported **`libunwind.dll`**, supplied by the
mingw-llvm toolchain rather than by Windows. On a dev box it resolves off `PATH`; on a user's machine
the process died before `main` with **exit 127, "cannot open shared object file"** — no output, no
diagnostic worth the name.

Fixed by pinning `-C target-feature=+crt-static` for the host triple in **`.cargo/config.toml`**, so it
cannot regress depending on who types the build command. Cost ~33 KiB on the CLI (650.5 → 684.0);
`wasmrt_capi.dll` gets the same treatment. Remaining imports are Windows-provided only: `KERNEL32`,
`ntdll`, `bcryptprimitives`, and the `api-ms-win-crt-*` Universal CRT set (Windows 10+).

**The lesson, worth applying to any artifact:** *"it runs here"* is not evidence that it ships. Copy the
binary somewhere empty, strip `PATH` to the system directories, and run it. `objdump -p <exe>` lists the
imports — anything not `KERNEL32`/`ntdll`/`api-ms-win-*`/`bcrypt*` is a file you are also shipping,
whether you meant to or not.

*(The oracle is clean here by construction: `wazmrt.exe` and `wazmrt.dll` import only `ntdll` and
`KERNEL32`. ⚠️ Do not ship `wazmrt.pdb` — 3.6 MB of debug symbols, and the largest file in its
`zig-out`.)*

## Tooling

- **`.github/workflows/release.yml`** (in place since v0.6.4): a tag-triggered GitHub Action. Push a
  `v*` tag → it extracts the matching `CHANGELOG.md` `## [X.Y.Z]` section (literal-string match, no regex
  escaping) and runs `gh release create` with those notes. Secret-free (built-in `GITHUB_TOKEN`). This is
  the **only** CI automation so far — deliberately scoped to the GitHub-release step; **`cargo publish`
  remains manual** (needs the owner's crates.io token, and the owner chose not to build CI publishing up
  front). To add crate publishing later, extend this workflow with a `CRATES_IO_TOKEN` repo secret.
- 🏢 **The org move does not touch publishing (workspace letter H20, recorded 2026-10-23).** H20 exists
  because a registry's trusted-publishing (OIDC) policy is locked to the GitHub owner and repository
  **IDs**, and the move to `synapticforge1` changed the owner ID (nuget.org refused loader-dotnet's
  next publish). wasmrt publishes with the owner's **API token**, with no OIDC policy, so nothing is
  pinned to the old ID. **If CI publishing is ever adopted through crates.io trusted publishing,
  create the policy under `synapticforge1/wasmrt`, never the old owner.** crates.io shows the
  corrected `repository` field (`synapticforge1/wasmrt`, fixed 2026-10-23) from the next publish.
- **`cargo-release`** (recommended): workspace-aware — bumps the shared version, syncs the internal dep
  pin, publishes in order, tags. `cargo install cargo-release`; then `cargo release minor` (or `patch`
  for an interp slice). Not yet installed as of 2026-07-27.
- Alternative: the manual steps above. `release-plz` if/when full CI automation is wanted.

## 🔒 The "reflect a shipped stage" trigger (binding on every agent)

When a task/stage completes and is released, the public `ROADMAP.md` use-case matrix, `CHANGELOG.md`,
`README.md`, **and the full `cmem/` project memory** are **part of the definition of done** — not
optional docs, and **not a follow-up after publish**. A release that advances the code without advancing
them misreports progress to the people following along. **The owner's 2026-07-31 directive:** memory +
roadmap SHALL be updated and committed *before* the agent notifies the owner of the publish needs, so
the published commit already carries them. Keep them in lockstep with the version — in the *same* commit.

## Who runs the publish

The **owner** runs `cargo publish` + `git tag` + `gh release` + push for each version (needs the
crates.io token). The agent implements the task and does the **entire** release prep first — version
bump + public trackers + **full `cmem/` sync** + release commit (checklist steps 1–6) — and only then
hands over the publish commands. Established rhythm since v0.1.0; the pre-publish doc-sync gate added
2026-07-31 (v0.6.4) after earlier releases shipped with docs lagging a turn behind.

## Status (2026-10-24)

- **✅ v1.0.0 PUBLISHED (2026-10-24, release commit `9871fd4`, tag `v1.0.0`)** — all three crates at
  1.0.0 on crates.io (checked through its API), and `surface/released.txt` re-recorded from the tag
  (step 9, its own commit); the floor since is PATCH. **Next release: 1.0.1 (T9, hardening).** T13, the
  conformance clear-out: 64,603 / 0 / 0 over 288 files. Checklist steps 1–6 done: 606 workspace
  tests and clippy clean; S1 re-baselined for every intended change, S2 0 regressed; sizes and speed
  re-measured beside a v0.9.0 build on the same toolchain (CLI 644,608 → 846,848 B, +31%; cdylib
  1,235,456 → 534,528 B, −57%; CHANGELOG [1.0.0] "Size and speed"); the CLI and the DLL import only
  Windows-provided DLLs, and the CLI runs from an empty directory on a system-only `PATH`; `bump.ts
  major` applied 0.9.0 → 1.0.0, and `--verify-tag v1.0.0` passes locally. The README's Breaking
  Changes rows are renamed `_next release_` → `1.0.0`; `bump.ts` accepts a row named for the
  manifest's new version as well (inverted: with the rows renamed away, it warns). S3 (the wasmtk-wide
  carry-forward, local, not binding) over v0.9.0 → the tree: 89 accepted → refused, 447 refused →
  accepted, **none of the 89 under `all`**, the default. Sampled, all three are intended classes and
  wasm-tools 1.262 refuses the same files: `mutable-globals` under `mvp`-based sets (v37), the overlong
  `call_indirect` index LLVM writes (`1_fib-rs.wasm` under `all,-reference-types`, v37), and the D2
  type rule (`gc-cast-type.wat` under gc without reference-types). Steps 7–8 were
  the owner's (tag, then publish).

### 0.9.0

- **✅ v0.9.0 PUBLISHED and pushed (2026-08-06, release commit `a7abd83`, tag `v0.9.0`) — no release is
  pending.** T8 — the **`wasmrt.h` C ABI** — shipped with all three gates green (`abi_symbols.c` 74/74,
  `c_smoke.c` compiled by a C compiler against the shipped header, and Miri over a randomized lifecycle
  fuzz). Also ships **proposal gating** + **configurable resource ceilings**, a **`Linker` in core**, and
  two **silent-wrong-output** fixes (dropped table initializers; element-segment form 4 rewriting a
  segment's type). Conformance **61,033 / 738 / 3,075 — 98.8%**; 351 workspace tests.
  **`abi_version()` is now 1** (was 0) — the C ABI is finalized, and `WASMRT_ABI_VERSION` in the header
  must stay equal to it (a test pins the pair).
- **Published through v0.9.0.** `wasmrt`, `wasmrt-core` and `wasmrt-capi` are live on crates.io through
  v0.9.0. The tag fired `.github/workflows/release.yml` for the GitHub release, as it has since v0.6.4.
- **The pre-publish doc-sync gate held again:** the version bump, `ROADMAP.md`/`CHANGELOG.md`/`README.md`
  and the **full** `cmem/` sync were all in the release commit `a7abd83` itself, so the published
  artifact carries its own docs. Nine `cmem/` files plus `tests/README.md` were touched, and the v0
  header draft in `docs/port/` was marked HISTORICAL rather than left to mislead.
- **Next release: T13 — the conformance clear-out** (`1.0.0`, owner 2026-08-19): the corpus to zero failed / zero skipped / zero unrun, empty baseline, zero deliberate deviations. **Then T9 hardening (`1.0.1`, and `pin` is its headline since the clear-out ships without it), T10 bug hunt + code hygiene (`1.0.2`), T11 optimization review (`1.0.3`), T12 security review (`1.0.4`)**. Order: **clear → measure → find → optimize → attack**. *(Superseded: "Next release: T9 … (0.10.0), then T10 (0.11.0), T11 (0.12.0), T12 (0.13.0)".)*

### Previous

- **✅ v0.8.0 PUBLISHED and pushed (2026-08-05, release commit `81d1c24`, tag `v0.8.0`).** It ships **all of
  T7** — host imports, module linking on a shared store, and WASI preview 1 **including the sandboxed
  filesystem** with `--dir`/`--ro-dir` — plus the **safety pass** (`#![forbid(unsafe_code)]` in core and
  the CLI) and the **literal/text edges**. Spec-suite conformance at release: **98.8%** (61,013 passing /
  751 failing / 3,094 skipped) and **all 284 files parse for the first time**. 281 workspace tests.
- **The full release chain** (T0 v0.1.0 → T3 v0.4.0 →
  T4-core v0.5.0 → T5 integer v0.6.0 → float v0.6.1 → linear memory v0.6.2 → tables/reftypes v0.6.3 →
  WasmGC v0.6.4 → SIMD v0.6.5 → multi-memory v0.6.6 → threads/atomics v0.6.7 → memory64 v0.6.8 →
  exception handling v0.6.9 → text toolchain + validator completion v0.7.0 → WASI p1 + host imports +
  module linking v0.8.0 → **the `wasmrt.h` C ABI v0.9.0**). The owner
  runs each publish; the rhythm (implement →
  **full-doc prep** → owner publishes) holds. **v0.6.4 onward run under the pre-publish doc-sync gate, and
  each v0.6.4+ GitHub release was created automatically by the tag-triggered `.github/workflows/release.yml`**
  (push the `v*` tag → the release + notes publish themselves).
- **✅ DONE 2026-08-07 (T9d) — per-crate crates.io listing metadata.** All three crates now carry
  `keywords`, `categories` and `readme`, and each has **its own short README** (the `../../README.md`
  path is indeed rejected — cargo packages the readme, so it must live inside the package). Categories
  used: core `wasm`/`no-std`/`development-tools`, capi `wasm`/`external-ffi-bindings`/`development-tools`,
  CLI `wasm`/`command-line-utilities`/`development-tools`. Verified with `cargo package --no-verify` on
  each: clean. **These ship with the next publish (`1.0.0`)** — the already-published 0.9.0 crates do not
  have them.
- **Next release after v0.7.0: T7 — host imports + WASI preview 1** (0.8.0). Per-release checklist above
  — full doc sync before the publish handoff.
- **PowerShell note (owner's shell):** Windows PowerShell 5.1 has no `&&`. Chain the publishes with
  `cargo publish -p wasmrt-core; if ($LASTEXITCODE -eq 0) { cargo publish -p wasmrt-capi }; …` — not
  `; if ($?) {…}`, which reports the *`if` statement's* success after a skipped block and would run
  step 3 even when step 1 failed.
