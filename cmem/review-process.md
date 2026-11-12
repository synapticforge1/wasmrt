# review-process.md — wasmrt's slots in the workspace review standard

🔒 **Owner, 2026-11-12:** "accept the review process and make it a standard for all projects. each
project may have differing individual issues, but the overall process should be the same." The
process is the workspace's [`../cmem/review-process.md`](../../cmem/review-process.md) (letter H35;
S3D-ReportCompiler's, ledger C46) — the floor, the three kinds, the brief, the records. **It is not
copied here.** This file fills only the slots that file leaves to each project (its § 7), and is read
WITH it. Where the two seem to disagree, the workspace file is the process and this one is the facts.

## 1. The owner's words → the workspace file

| the owner says | what runs | workspace § |
| --- | --- | --- |
| **"review"** | a targeted agent code review, in rounds, until a round finds nothing | § 2 |
| **"security review"** | a security review over the seven surfaces (§ 4 below), in rounds | § 3 |
| **"hardening review"** | a hardening review over the seven axes (§ 5 below), in rounds | § 4 |

None of them commits, pushes or releases. 🔒 **A security review and a hardening review are required
before every release**, each ended by an empty round on everything since the last release, and
recorded in that release's entry in [release.md](release.md) BEFORE the bump —
`scripts/release-record.ts reviews X.Y.Z` refuses the release otherwise, in `release.ts` and in CI
(`releasing.md` step 0). wasmrt's ladder stages map onto the words: T9 hardening → "hardening review",
T10 bug hunt → "review" (full-project), T12 security → "security review"; T11 (optimization) is the
contest's own measurement, not a review kind (`roadmap.md`).

## 2. The floor's slots (workspace § 1)

- **Private data a reviewer never reads (§ 1.1):** `cmem/local/` (gitignored machine facts and
  backups), and any sibling's `cmem/local/`. A reviewer's scratch folder is outside the repository.
- **The worst silent case (§ 1.2):** **a module that runs to completion with exit 0 and a WRONG
  result** — a value, a trap that should not happen or one that should and does not, a memory or table
  left in the wrong state — or **a WASI guest that reaches outside its preopens with exit 0**. Next:
  an invalid module ACCEPTED (validation is a security boundary, `security-model.md`), then a `.wat`
  assembled to different bytes than wasm-tools writes (pins and interop depend on them). Every
  serious wasmrt defect so far was one of these (`known-issues.md`; best-practices 4.3).
- **The reference results, re-run after every group of fixes (§ 1.3.4)** — each a dated claim, the
  current values in `open-work.md` § State:
  - the spec suite, **64,603 / 0 / 0 over 288 files**, per file against `tests/spec-snapshot.txt`
    (`bun scripts/behaviour-s2.ts`: 0 regressed);
  - S1, the behaviour corpus (`tests/behaviour/`, 38 configurations) in every `cargo test`, and the
    floor against the last tag (`bun scripts/carry-forward.ts <tag> WORKTREE`: 0 / 0);
  - `cargo test --workspace`: **606 / 0 / 1** (2026-11-12);
  - the shared definitions: `bun scripts/definitions.ts --check` and the D2 judgements — **0 of
    6,860** differ from binaryang 2.2.0;
  - the swappability contract: wazmrt ⇄ wasmrt by RUNNING both (`interop.md`; 0 of 2,401 and 0 of
    6,860 at v40);
  - the C ABI: `bun scripts/c-gate.ts` (`abi_symbols.c`, `c_smoke.c`) and `bun scripts/miri-gate.ts`;
  - size and speed (the contest): `vision.md`, `bench/README.md` — a change is a finding until
    explained.
- **CI jobs and platforms (§ 1.5):** `.github/workflows/release.yml` `checks` on every push of `main`
  — `bun scripts/gate.ts` on **Linux x86_64** (`ubuntu-latest`, Rust `nightly-2026-11-04`). The
  owner's machine is **Windows x86_64** (the gnullvm and gnu hosts; both shells). There is no macOS
  runner: macOS is unmeasured and said to be. CI's run on the pushed commit is part of done.
- **Classes, for a class-by-class review (§ 2.2):** decoder (binary format), validator (incl. feature
  gating and D2's type rule), interpreter (values, traps, control, GC, SIMD, threads, exceptions),
  text format (`.wat` / `.wast` → bytes), linker and store (imports, identity across modules), WASI
  preview 1 (the sandbox, rights, the environment), the pin gate, resource ceilings, the C ABI
  (`wasmrt.h`, `unsafe` in `wasmrt-capi`), the CLI contract (`interop.md`), the release path.

## 3. Records (workspace § 6)

| what | where |
| --- | --- |
| each finding: measured, its class, the fix, the test, the inversion; and what was NOT fixed, with why | [known-issues.md](known-issues.md), newest first |
| the round: reviewers, scope, counts, what is next | [roadmap.md](roadmap.md) (the T9–T12 pass records) and [open-work.md](open-work.md) |
| the release's security and hardening reviews, each ended by an empty round | [release.md](release.md), the version's entry, BEFORE the bump |
| a claim found wrong | corrected where it stands, marked 🔁 with the date and the finding |

## 4. The seven security surfaces, for wasmrt (workspace § 3.1)

1. **Untrusted input runs nothing and loads nothing it was not given:** a `.wasm` / `.wat` / `.wast`
   module (CLI, `wasmrt-core`, the C ABI's byte buffers), a WASI guest's every syscall argument, the
   CLI's argv, a pin DB file. A module imports only what the host supplies (`Linker`); nothing is
   fetched.
2. **Malformed input is a refusal by name:** decode and validation errors, never a panic, an abort or
   a guess — from Rust, from the CLI (exit status, `interop.md` § 2.3) and from C (an error code, and
   no unwind across the boundary — a review checks both). The tools: `scripts/differential-fuzz.ts`
   and Miri (`scripts/miri-gate.ts`).
3. **Paths:** the WASI preopen sandbox (`--dir` / `--ro-dir`; `..`, symlinks, device and NT-namespace
   names, NULs, non-UTF-8 — `security-model.md` § Sandbox). To check, not yet measured as such
   (2026-11-12): whether `wat -o` can overwrite its own input, and whether a refused run can leave a
   partial output file.
4. **Resources:** the configurable ceilings (memory, tables, the iteration budget, stack depth) and
   absurd guest requests (an iovec count, an fd, `random_get` sizes) fault before allocating; the
   largest real modules measured; every network request in the release scripts has a 30 s limit.
5. **The release path:** `releasing.md` § Tooling — CI publishes (trusted publishing, the token
   revoked after use), no `uses:`, the toolchain and Bun pinned and checked, no `gh`, the read-backs
   fatal.
6. **Dependencies: none.** `cargo tree` over the workspace, normal, dev and build edges: only the
   three wasmrt crates (measured 2026-11-12; `Cargo.lock` holds 3 packages). A review re-measures
   that, and any new dependency needs the Adoption Checklist (`third_party/LICENSES.md`,
   `reference-projects.md`) and an audit — `cargo audit` / `cargo deny` are not installed here.
7. **Privacy:** `design-decisions.md` § PRIVACY — no secret, personal datum or machine path in any
   committed file, message, crate or binary fixture (`git grep -I` and `git grep -a`); the scan stops
   a commit.

## 5. The environment matrix, for wasmrt (workspace § 4.1)

| axis | wasmrt |
| --- | --- |
| hosts | Windows x86_64 (gnullvm, gnu) — local; Linux x86_64 — CI; macOS unmeasured |
| targets | native, and the dual-target contract's `wasm32-unknown-unknown` / `wasm32-wasip1` (`architecture.md`) |
| the artifact users get | the crates from crates.io (`cargo install wasmrt --version X.Y.Z` in a scratch folder — U10); the CLI as ONE standalone file (`releasing.md` § Distribution manifest: copied to an empty folder, run on a system-only `PATH`); the C library + `wasmrt.h` as the loaders link them |
| toolchain | the floating local nightly vs CI's pinned `nightly-2026-11-04` — a difference between them is a finding |
| consumers | the `universalWasmLoader-*` ports, wasmtk, rsxtk (`loaders.md`) |

**The evidence re-run (axis 5) is § 2's reference list; inverted (axis 7) means each new check was
shown to fail — `testing.md` records how for each gate.**
