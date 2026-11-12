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
- **After `1.0.0`** — **`2.0.0`** (owner, 2026-10-24: the `exact`-type correction is major by the
  gate), then the four review phases, in this order: T9 hardening, T10 bug hunt + code hygiene, T11
  optimization review, T12 security review, **each numbered by the gate** *(they were pre-assigned
  `1.0.1`–`1.0.4` until 2026-10-24)*. ⚠️ **The API stability promise starts at `1.0.0`**, so the C ABI and `wasmrt-core`
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
- **Rule 3's "previous tag's tests against the new source"**: 🆕 **wired 2026-11-12** —
  `scripts/prev-tag-tests.ts` (the last release's `crates/*/tests/` and `tests/` over this tree; run by
  `bump.ts` for a patch or a minor, and by every `gate.ts`, which skips it when the version is a major
  past that release). Unit tests live inside `src/` and are not carried. The behaviour equivalent
  (step 1c, S1–S3) stays. *(Until 2026-11-12 this line said "not wired".)* **Consumers' suites**:
  rsxtk is the named consumer and does not link wasmrt yet.
- **Behaviour the S1 corpus does not contain** (§4.13): S3 over wasmtk's corpus is the wide net.

*(Retired 2026-10-24 by H6: the cadence rule that "the patch component stays a single digit" — a
`0.y.z` line ran `z = 0…9` and the release after `0.y.9` was `0.(y+1).0`. Under SemVer the number says
what changed, not how many slices a line has held, so `0.y.10` is legal and a gate decides the
component. The rule is why the 0.6 line closed at v0.6.9 and the next release was 0.7.0.)*

**Stage → version map** (the ladder lives in `ROADMAP.md`; the port tasks in `roadmap.md`) — *shifted by
one from 0.8 onward when the 0.6 line filled up; T6 and the T4 completion then shipped together in 0.7.0*:
0.1 T0 scaffold · 0.2 T1 types+reader · 0.3 T2 opcode · 0.4 T3 decode · 0.5 T4 validate (core) ·
0.6.x T5 interp (patch per feature slice, 0.6.0–0.6.9) · **0.7 T6 text toolchain + T4 completion (the deferred SIMD/atomics/GC/EH typing arms)** ·
0.8 T7 wasi+cli · 0.9 T8 C-ABI · 🆕 **1.0.0 T13 conformance clear-out** · **2.0.0 the `exact`-type correction** · then T9 hardening · T10 bug hunt + code hygiene · T11 optimization review · T12 security review, numbered by the gate.

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
early to avoid squatting. 🆕 **Since 2026-11-12 CI publishes them** (owner's D2, below), through
crates.io trusted publishing: no stored token anywhere.

## Release cadence (owner decision: per-task)

Release on **each completed, parity-gated task**, on the owner's "release". *(Until 2026-11-12 this
said "manual now; don't build CI publishing up front". The owner's D2 of 2026-11-10 — "it should be
per the release flow not on my machine" — superseded it.)*

## Per-release checklist (binding — do all, in order)

🔒 **The shape is the workspace's uniform one** (owner, 2026-11-10/12; letters H33 and H35;
`../cmem/release-process.md` § 5, slots U1–U12): **the review → the notes, merged → the bump, its own
commit → `release.ts` pushes `main` → CI checks, tags, makes the page, publishes, reads back.** The
owner's word "release" starts it and gives the level (patch / minor / major — ask when it was not
given). Nobody tags or publishes by hand. Each release is recorded in [release.md](release.md).

0. 🔒 **A security review and a hardening review, each to its EMPTY round** (owner, 2026-11-12;
   [review-process.md](review-process.md), the workspace's `review-process.md` §§ 3–4), on everything
   since the last release, recorded in this version's entry in [release.md](release.md) BEFORE the
   bump. `release.ts` and CI refuse a release whose entry lacks either one.

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
   - `CHANGELOG.md` — move `Unreleased` items into a new `## [X.Y.Z] — <date> — <line>` section (Keep
     a Changelog format). The Release page is made from it AFTER CI tags, so CI refuses to tag
     without a non-empty one (`scripts/release-record.ts notes`).
   - `README.md` — refresh the status line to what the release now runs.
3. **Sync ALL project memory (`cmem/`), not just the roadmap** — this is the step that used to lag a
   turn behind and ship stale. Fold the release into **every** affected file, then update
   `cmem/INDEX.md`'s Files table:
   - [release.md](release.md) — **this version's entry**: the summary and the two review lines (step
     0); the run's read-backs are added after step 7.
   - `cmem/roadmap.md` — mark the task/slice DONE with its per-slice record.
   - `cmem/architecture.md` — advance the "realized so far" snapshot to the new version.
   - `cmem/testing.md` — bump the unit-test count + note what the new slice's tests cover.
   - `cmem/known-issues.md` — log any new intentional divergences / deferrals from the slice.
   - any other `cmem/` file the slice touched (overview/design-decisions/security-model/…).
4. **Merge the notes first (U2)** — steps 1–3 are committed and pushed to `main` (the owner's
   "push"). That push runs the workflow's `checks` job only: the version is still the released one.
5. **Bump with the gate (U1–U3)** — `bun scripts/bump.ts patch|minor|major` (the level is the owner's;
   try `--dry-run` first). On a clean tree only (untracked files count), it refuses a bump below the
   floor (surface, `cargo semver-checks`, behaviour carry-forward — "THE NUMBER" above), runs the
   PREVIOUS release's integration tests against this tree for a patch or a minor
   (`scripts/prev-tag-tests.ts`), rewrites both `workspace.package.version` and the internal dep pin
   `wasmrt-core = { …, version = "x.y.z" }` (they MUST match or publish fails), refreshes
   `Cargo.lock`, and **commits `bump to vX.Y.Z` itself** — those two files only. Never bump by hand.
   Any intended surface change has already been re-baselined in its own commit (rule 5).
6. **Release (U4)** — `bun scripts/release.ts` (try `--dry-run` first). Guards: clean tree, on `main`
   = `origin/main` + exactly the bump commit, the tag absent here and on origin, crates.io without
   the version on all three crates; then the cold gate `bun scripts/gate.ts --release` — the SAME list
   CI's `checks` job runs (set `CC=gcc` on this host for the C-ABI gate). Then ONE `git push origin
   main`, read back with `ls-remote`. **It makes no tag.**
7. **CI (U5–U8), one run of `.github/workflows/release.yml`:** `checks` (the gate, `--release`) →
   `tag` (CI's annotated `vX.Y.Z` on that commit, read back) → `release` (the page from the tag,
   CHANGELOG title and body) → `publish` (trusted publishing; wasmrt-core → wasmrt-capi → wasmrt,
   each skipped if crates.io lists it FROM THIS COMMIT — `.cargo_vcs_info.json` inside the `.crate`;
   the token revoked; all three read back, FATAL, provenance included). A failed job: **"Re-run failed
   jobs"**, never a new or moved tag (U12).
   - ⚠️ **Only that run can finish its release** (review round 1, 2026-11-12): a re-run re-runs the
     tagged commit's own workflow and scripts, and any LATER push of `main` stops at `checks` with
     "`vX` is tagged on <commit>, but its release is UNFINISHED" — red, never a green "nothing to
     do". **GitHub keeps a run re-runnable for 30 days.** If the run cannot succeed (a defect in the
     release path itself, or the 30 days passed), the version is **burned**: record it in
     [release.md](release.md) as unfinished, fix the cause, and release the NEXT version: `bump.ts`
     judges the level against the last COMPLETED release, then skips any target that is tagged but
     not on crates.io ("burned", printed) to the next patch — and refuses one that IS on crates.io
     (then step 9 was missed: run it first).
   - The per-version concurrency makes two commits racing for one version wait for each other; the
     tag goes to whichever one's `checks` finish FIRST (not necessarily the first pushed — review
     round 2, N4); the other's `tag` job then says another commit took the version (re-running it
     cannot help). A push while a release run is still going reads "not finished … if STILL IN
     PROGRESS, wait": wait, then re-run it.
   - 🔁 **Burned-version arithmetic is `scripts/versions.ts`** (review round 2, R17: the round-1
     version did not work): `bump.ts` and the gate's `--verify-tag` ask the same `nextVersion`.
     A tagged version above the last completed release is *burned* (on crates.io for none of the
     three crates: skipped), *partial* (some: finish its run, refused) or *released* (all three:
     run step 9 first, refused). `bump.ts` fetches origin's tags first.
8. **Read back as a user (U10)** — in a scratch folder: `cargo install wasmrt --version X.Y.Z --root
   <scratch>` and run `wasmrt --version`; record it, with the run id and the read-backs, in
   [release.md](release.md).
9. **Record the release's surface**, its own commit: `bun scripts/surface.ts --release-from vX.Y.Z`
   (rewrites `surface/released.txt` with `# released-as: X.Y.Z`), and the S2 snapshot if it moved.
   *(Until 2026-11-12, steps 4–8 were: ONE release commit with code + version + docs, then the owner
   tagged, pushed, and ran `cargo publish` ×3 from the workstation. H33 replaced that.)*

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

- 🆕 **`.github/workflows/release.yml` — the owner's order, in CI (2026-11-12; workspace letter H33,
  decisions D1 and D2).** It runs on every push of `main` (no longer on a tag), with top-level
  `permissions: {}` and **no `uses:`** at all. `checks` (`contents: read`, a credential-free clone) asks
  `github-release.ts state` whether this push is a release (`new`: the version has no tag; `rerun`: its
  tag is on this commit; `none`: elsewhere), installs the toolchain and runs **`bun scripts/gate.ts`**
  (`--release` unless `none`) — the same list `release.ts` runs locally. Only for a release: `tag`
  (`contents: write`, no checkout) makes CI's annotated tag; `release` (`contents: write`, no checkout)
  makes the page from it; `publish` (`id-token: write`, `contents: read`) runs `scripts/crates-io.ts`:
  `has` → `token` (GitHub OIDC → a short-lived crates.io token) → `publish` (core, capi, CLI, each
  skipped if listed; `--no-verify`, nothing built) → `revoke` (always) → `readback` (all three, not
  yanked, FATAL). **Pins (U9):** Rust `nightly-2026-11-04`, refused unless `rustc -V` names
  `708c94ef0` (the nightly 2.0.1 was built on; CI's pin only — the local `rust-toolchain.toml` still
  floats, a T11 question); `cargo-public-api` 0.52.0 and `cargo-semver-checks` 0.51.0 `--locked`; Bun
  1.4.4 by sha256 (checked against Bun's `SHASUMS256.txt` 2026-11-12). Concurrency: one group per
  commit, never cancelled. **Measured `cargo public-api` follows `RUSTUP_TOOLCHAIN`** (2026-11-12: it
  built with the 2026-10-21 nightly when told to), so `surface.ts` now names the ACTIVE toolchain
  (`rustc -V`, identical locally to the old `rustup run nightly`).
  - 🔒 **Branch scope (owner, 2026-11-12, on review finding N1: "we will keep the current setup"):**
    the trusted publisher names the repository and `release.yml`, not a branch or an environment;
    what limits publishing to `main` is the workflow's `main`-only trigger and who can push.
  - 🔑 **Owner setting — SET (owner, 2026-11-12: "trusted publisher is already set"):** on crates.io, a **trusted publisher** on
    EACH of `wasmrt-core`, `wasmrt-capi` and `wasmrt` — repository `synapticforge1/wasmrt`, workflow
    `release.yml`, no environment. Then the workstation's `cargo login` token can be revoked. Without
    it, `publish` fails at `token` with "is a trusted publisher … configured" AFTER the tag and page:
    set it, then "Re-run failed jobs" (no new version needed).
  - **Rehearsed 2026-11-12 (best-practices 7.22), in a scratch clone behind a scratch bare origin:**
    the whole gate (12 steps; 606 / 0 / 1 tests) green; `bump.ts patch` refused a dirty tree, then
    floor PATCH ×3, v2.0.1's tests 70 / 0, the `bump to v2.0.2` commit (two files); `release.ts
    --dry-run` passed every guard and `gate.ts --release` (15 steps), pushed nothing; refusals shown
    for an extra commit, an untracked file, a CR (the gate stops at `eol`) and a missing entry.
    `cargo publish --workspace --dry-run` at an UNPUBLISHED 2.0.2 packages all three (per-crate
    `-p wasmrt-capi --dry-run` cannot: it resolves core from crates.io — hence the workspace form in
    `checks` and the per-crate form, as 2.0.1 ran it, in `publish`). The scripts against the REAL
    APIs, read-only: crates.io `has`/`readback` on 2.0.1 (listed, served) and 2.0.2 (missing ×3);
    GitHub `state` new / rerun / none, `tag` and `page --dry-run` on v2.0.1 (found, nothing written).
    The workflow's own shell (version, toolchain check, tag peel) 7 / 7 with negatives. **Not
    rehearsable here:** the OIDC exchange (needs a runner and the owner's setting) and the Linux
    `checks` run — the first push of this change measures the latter with `state=none`, before any
    release depends on it.
  - 🔁 **Review round 1 (2026-11-12) changed this flow** — `known-issues.md` R1–R15: `state` checks
    what a tag claims (R4), crates are matched by provenance (R5), the review clause is fixed (R3),
    per-version concurrency (R11), time limits (R14). Self-tests now 44 / 44 / 37; the numbers just
    below are the first version's.
  - **Self-tests (each inverted by mutants, 2026-11-12):** `check-github-release.ts` 34 checks (+ `state`
    and `tag`; 8 mutants caught), `check-crates-io.ts` 36 (mock registry + OIDC + a fake cargo; 11
    mutants — one survived first, the exchange's status check, until a case gave an error status a
    token), `check-release-record.ts` 22 (9 mutants — two survived first, the version prefix and the
    later-section guard, until cases aimed at them). `prev-tag-tests.ts` inverted by a committed mutant
    (guest exit codes ignored → RED, 6 failures) with HEAD's copy of the catching test deleted, proving
    the TAG's tests ran; control green 70 / 0.
- **The release page (2026-11-09; workspace letters H30 and H32): no `gh`.** Until then the page was
  made by `gh release create --verify-tag`. Now `scripts/github-release.ts` (Bun, `fetch`, REST API)
  makes it, keeping H32's order: (0) the CHANGELOG has a non-empty `## [X.Y.Z]` section, checked before
  any request; (1) the tag exists on GitHub and peels, with annotated tags followed, to `GITHUB_SHA`
  (`POST /releases` would otherwise CREATE a missing tag); (2) a page already there means done, with no
  write, so a re-run is safe; (3) POST, then read the page back (the tag, not a draft) and peel the tag
  again. Each request has a 30 s limit, body included. The page is the same as before: the CHANGELOG
  heading as the title and the section as the body. No generated notes, and no
  `generate_release_notes`, which is the one place wasmrt departs from H32's recipe: the CHANGELOG is
  the release note. *(Jobs until 2026-11-12: `compatibility-gate` then `github-release`, on a tag push;
  now the page is `github-release.ts page` in the `release` job above, keyed on `VERSION`.)* **The
  self-test** (as of 2026-11-09; 34 checks since 2026-11-12) is `bun scripts/check-github-release.ts`: a
  `node:http` mock API, 17 checks. Missing, other-commit or annotated-other tags are refused with no POST; a
  CHANGELOG with no section or an empty one is refused with no request at all; the cases also cover an
  existing page, a lightweight and an annotated create (with the POST body checked), POST 422, a
  read-back draft, a tag moved after the POST, a dry run, no token, a non-`vX.Y.Z` tag, an unknown
  argument and a stalled API. **Inverted 2026-11-09** by six one-line mutants, each caught only by its
  own case or cases. They removed the sha check, the existing-page stop, the time limit, the
  empty-section refusal, the draft read-back check and the re-peel. **Real GitHub, read-only
  `--dry-run`, 2026-11-09:** `v2.0.0` at `1715139` peels and finds its page (exit 0, no write); the same
  tag given `v1.0.0`'s commit is refused. ✅ **Measured on GitHub Actions by 2.0.1** (run 42724412211):
  the page's `author.login` is `github-actions[bot]` (§ Status). Owner, 2026-11-09: only new tags get pages; nothing is backfilled.
- 🏢 **The org move does not touch publishing (workspace letter H20, recorded 2026-10-23).** H20 exists
  because a registry's trusted-publishing (OIDC) policy is locked to the GitHub owner and repository
  **IDs**, and the move to `synapticforge1` changed the owner ID (nuget.org refused loader-dotnet's
  next publish). Through 2.0.1 wasmrt published with the owner's **API token**, with no OIDC policy,
  so nothing is pinned to the old ID. **CI publishing through crates.io trusted publishing is adopted
  (2026-11-12): create the trusted publisher under `synapticforge1/wasmrt`, never the old owner.**
  crates.io shows the corrected `repository` field (`synapticforge1/wasmrt`, fixed 2026-10-23) from
  the next publish.
- *(Retired 2026-11-12: the `cargo-release` / `release-plz` suggestions of 2026-07-27 — the release
  is now `bump.ts` + `release.ts` + the workflow above.)*

## 🔒 The "reflect a shipped stage" trigger (binding on every agent)

When a task/stage completes and is released, the public `ROADMAP.md` use-case matrix, `CHANGELOG.md`,
`README.md`, **and the full `cmem/` project memory** are **part of the definition of done** — not
optional docs, and **not a follow-up after publish**. A release that advances the code without advancing
them misreports progress to the people following along. **The owner's 2026-07-31 directive:** memory +
roadmap SHALL be updated and committed *before* the agent notifies the owner of the publish needs, so
the published commit already carries them. Keep them in lockstep with the version: since 2026-11-12
the docs are merged into `main` first and the bump is the ONE commit after them (U2), so the tagged
commit carries every doc of its release.

## Who runs the publish

**CI** (since 2026-11-12; owner's D1 and D2). The owner gives the word "release" and its level, and
holds the one setting CI cannot (the crates.io trusted publishers, § Tooling). The agent does the
review (step 0), the notes and the full `cmem/` sync, the bump and `release.ts`; CI tags, makes the
page, publishes and reads back; the agent then reads back as a user and records it in
[release.md](release.md). *(Through 2.0.1 the owner — once the agent, on the owner's word — ran
`git tag`, the push and `cargo publish` from the workstation; the pre-publish doc-sync gate dates from
2026-07-31, v0.6.4.)*

## Status — moved

*The per-version records (this file's § Status, § 1.0.0, § 0.9.0 and § Previous until 2026-11-12) are
in [release.md](release.md) § "Release History", newest first (owner's D3; workspace letter H33).
The old text: `git show 8056e8a:cmem/releasing.md`. Its PowerShell note on chaining `cargo publish`
is retired with the workstation publish.*
