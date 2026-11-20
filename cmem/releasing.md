# Releasing & Versioning

How wasmrt is versioned and published so others can follow progress. Decisions locked by the owner
**2026-07-27**. Public-facing trackers: `ROADMAP.md` + `CHANGELOG.md` (repo root — NOT project memory,
but this file defines the process that keeps them current).

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
`../workspace/cmem/release-process.md` § 5, slots U1–U12): **the review → the notes, merged → the bump, its own
commit → `release.ts` pushes `main` → CI checks, tags, makes the page, publishes, reads back.** The
owner's word "release" starts it and gives the level (patch / minor / major — ask when it was not
given). Nobody tags or publishes by hand. Each release is recorded in [release.md](release.md).

0. 🔒 **The five-class review, to an empty re-review and the full suite per platform** (🔁 2026-11-19,
   letter H37; [review-process.md](review-process.md)), on everything since the last release. Its
   result is the `Review complete: <commit>` line of the gitignored `review-issues.md`;
   `review-gate.ts` (in `gate.ts --release`, so in `release.ts`) refuses a release whose code changed
   after that commit. *(2026-11-12 to 11-19, H35: a security and a hardening review, recorded in the
   entry.)*

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
   - `ROADMAP.md` — the version's row. 🔁 2026-11-20: was "`cmem/roadmap.md` — mark the task/slice DONE with
     its per-slice record"; that file is archived, and the record is `release.md`.
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
   the version on all three crates; then the cold gate `bun scripts/gate.ts --release` — the ONLY
   run of the gate (🔁 2026-11-19, H37 (e): CI tests nothing), including the review's result
   (`review-gate.ts`). Then ONE `git push origin main`, read back with `ls-remote`. **It makes no tag.**
7. **CI (U5–U8), one run of `.github/workflows/release.yml`:** `checks` (the version, and
   "is this a release?" — 🔁 no gate since 2026-11-19) →
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

## Tooling — moved

The release tooling (the scripts, the workflow, how each got its shape): [releasing-tooling.md](releasing-tooling.md),
moved there verbatim on 2026-11-20 (letter H38); references to "releasing.md § Tooling" mean that file.
The version ladder: [versioning.md](versioning.md).

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

## Repository settings

Owner-held, set on GitHub (the agent has no login; it reads them back through the public API).
Review S1 (2026-11-19): nothing stood between a push of `main` and a crates.io publish (`main`
unprotected, no rulesets, no environment). As for binaryang (its `main` ruleset 27683565), plus the
approval binaryang does not have:

- setting: ruleset `main` — what: Branch ruleset, target `main`: restrict deletions; block force pushes · state:
  set (owner, 2026-11-19): 27687060, `~DEFAULT_BRANCH`, active — read back with a THIRD rule, `update` (restrict
  updates), which refuses `release.ts`'s push of `main` unless the pusher is a bypass actor (not visible to the
  public API); owner to decide
- setting: ruleset `v*` — what: **Tag** ruleset (not branch: binaryang's was made as a branch ruleset by
  mistake), target `refs/tags/v*`: restrict updates, restrict deletions, block force pushes. NOT "restrict
  creations": CI creates the tag · state: set (owner, 2026-11-19): 27687102, tag, `refs/tags/v*`, active; update,
  deletion, force push (read back)
- **setting: environment** — what: 🔒 **None** (owner, 2026-11-19: "I am not creating a release environment on
  github. My release environment is here."). The release's gate is the owner's machine: `release.ts` runs the full
  local gate and the review gate, then pushes `main`
- **setting: crates.io trusted publisher** — what: per crate (all three): repository, `release.yml`, no environment; set (owner, 2026-11-19) · state: set

**The accepted risk (review S1, owner's decision).** With no environment, a push of `main` carrying a
new version is published by CI without a further approval, so the push credential is the release
credential: whoever can push `main` can publish. The rulesets keep a pushed history and the tags from
being rewritten or deleted; they do not stop a new push. *(A "require signed commits" rule on `main`
would make a stolen push token alone insufficient — not adopted; the commits are not signed today.)*

Unchecked by the review (the public API does not show them): collaborators, deploy keys, webhooks and
apps, secret scanning with push protection, alerts, Actions permissions.

## Status — moved

*The per-version records (this file's § Status, § 1.0.0, § 0.9.0 and § Previous until 2026-11-12) are
in [release.md](release.md) § "Release History", newest first (owner's D3; workspace letter H33).
The old text: `git show 8056e8a:cmem/releasing.md`. Its PowerShell note on chaining `cargo publish`
is retired with the workstation publish.*
