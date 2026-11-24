# review-process.md — wasmrt's slots in the workspace review standard

Last verified: 2026-11-19. 🔒 **The process is the workspace's `../workspace/cmem/review-process.md`**
(owner, 2026-11-17, "Review standard — final"; letter H37). It replaced H35's standard (the three
review words, seven surfaces, the two record paragraphs) on 2026-11-19 for wasmrt. **It is not copied
here.** This file fills the slots its § 12 leaves to each project. Where the two seem to disagree, the
workspace file is the process and this one is the facts.

## 1. The owner's words

| the owner says | what runs |
| --- | --- |
| **"review"** | all five required classes — basic, hardening, licensing, security, privacy — in that order, one loop (§ 9) |
| **"basic review"**, **"hardening review"**, **"licensing review"**, **"security review"**, **"privacy review"** | the same loop for that class alone |
| **"efficiency review"** | optional, BEFORE the five; never blocks a release |

🔒 **"review" is required before every release** (§ 9): `release.ts` runs `gate.ts --release`, whose
`review-gate.ts` step refuses unless `review-issues.md` says `Review complete: <commit>` and nothing a
review reads has changed since. A reviewing agent never commits, pushes or releases. wasmrt's ladder
maps on: T9 hardening → "hardening review", T10 bug hunt → "basic review", T12 security → "security
review", T11 (optimization, the contest's measurement) → "efficiency review" (`archive/roadmap-to-2.0.2.md`).

## 2. Private data a reviewer never reads

`cmem/local/` (gitignored machine facts and backups) and any sibling's `cmem/local/`;
`cmem/review-issues.md` is read only through what the main agent puts in a brief. A reviewer's
scratch folder is under the main session's scratchpad, removed at triage (workspace Tooling rule 15).

## 3. Reference results — re-run after each class's fixes, and once at the end

Each a dated claim; the current values are the newest entry's "Platforms verified" in `release.md`.

- the spec suite, **64,603 / 0 / 0 over 288 files** (`bun scripts/behaviour-s2.ts`: 0 regressed);
- S1, the behaviour corpus (`tests/behaviour/`, 38 configurations), in every `cargo test`, and the
  floor against the last tag (`bun scripts/carry-forward.ts <tag> WORKTREE`: 0 / 0);
- `cargo test --workspace` (608 / 0 / 1 on 2026-11-12);
- the shared definitions: `bun scripts/definitions.ts --check`; D2 judgements, 0 of 6,860 differ
  from binaryang 2.2.0;
- the swappability contract: wazmrt ⇄ wasmrt by RUNNING both (`interop.md`);
- the C ABI: `bun scripts/c-gate.ts` and `bun scripts/miri-gate.ts`;
- size and speed (the contest): `vision.md`, `bench/README.md` — a change is a finding until explained.

The worst silent case, for the basic and hardening classes: **a module that runs to completion with
exit 0 and a WRONG result**, or **a WASI guest that reaches outside its preopens with exit 0** (that
one is security). Next: an invalid module ACCEPTED; a `.wat` assembled to bytes wasm-tools would not
write.

## 4. Support matrix and platform notes

[platforms.md](platforms.md) — tier 3, the full matrix; today only `win-x64` has a machine run.

## 5. Licence inventory and notices (slot new in H37)

- **Own licence:** `MIT OR Apache-2.0` — `LICENSE-MIT`, `LICENSE-APACHE`, `NOTICE` at the root; the
  root `Cargo.toml` `license`, inherited by all three crates (`license.workspace = true`).
- **Inventory:** `third_party/LICENSES.md` (the compliance ledger; the Adoption Checklist) and
  [licensing.md](licensing.md) (the why). **Crate dependencies: none** — `Cargo.lock` holds the three
  wasmrt packages only (re-measure: `cargo tree --workspace -e normal,dev,build`).
- **Vendored data:** `definitions/binaryang/*.json` (binaryang, MIT, same owner; generates
  `crates/wasmrt-core/src/definitions.rs`); `third_party/wabt/LICENSE` (wabt's data by way of
  binaryang).
- **Test corpora:** the spec suite is read from a sibling checkout (wasmtk), not shipped; what is
  committed under `tests/` and shipped in each `.crate` is the question for the licensing review
  (`cargo package --list`).

## 6. Outputs that can carry user facts (slot new in H37)

- **CLI diagnostics** name the user's paths (a refusal quotes the module path; `--dir` errors quote
  the host path) — on stderr, to the user who typed them.
- **`wasmrt wat -o`** writes a module from the user's source; whether any path or environment value
  reaches the bytes (a `name` section, a custom section) is the privacy review's to check.
- **A WASI guest** sees only `--dir` / `--ro-dir` preopens, `--env` variables (contract v35: no host
  environment inherited) and its own argv.
- **The C ABI** returns error strings to the embedder; the same question as the CLI's.
- **The built binary and `.crate`s**: panic and debug paths (release profile `panic = "abort"`).
- **Network:** none — wasmrt makes no request at run time. Only the release scripts do (GitHub,
  crates.io), from the owner's machine and from CI.

## 7. Gate scripts — scripted, not reviewed (§ 10)

All in `bun scripts/gate.ts` (local only; CI tests nothing — H37 (e)): eol, **privacy and
credential scan** (`privacy-gate.ts`, tree + untracked + commit messages since the last tag), the
shared definitions, build, tests, clippy (both OSes), the two wasm32 builds, the API surface
(`surface.ts --check`), the C ABI, the release scripts' self-tests, the previous release's tests, the
publish dry run; `--release` adds the floor (`bump.ts --verify-tag`), the CHANGELOG section and the
`release.md` entry with their Tested on lines (`release-record.ts`), and the review's result
(`review-gate.ts`). Outside the gate, by nature: S2 (`behaviour-s2.ts`), Miri, fuzzing
(`differential-fuzz.ts`). Vulnerability check and licence allowlist: no dependency to check (§ 5);
a gate is owed the day one is added.

## 8. Items that do not apply, and why

- **Security — native library loading:** a loaders item; wasmrt loads no native library.
- **Security — actions pinned by commit hash:** `release.yml` has no `uses:` at all; tools are
  fetched by version and checked by sha256 or by rustc's commit.
- **Security — repository settings:** reviewable only with the owner's GitHub login (no `gh`,
  Tooling rule 9); the reviewer lists what to check and the owner reads it.
- **Privacy — third-party data (redaction):** wasmrt processes no one else's documents.
- **Licensing — fonts, images, bundled binaries:** none in the repository or the crates.

## 9. Records

| what | where |
| --- | --- |
| open findings, the current review's log, rejected findings with reasons, `Review complete:` | `review-issues.md` (gitignored) |
| a fixed finding's lasting lesson | `known-issues.md` (the fixed record) or `platforms.md` (a platform quirk) |
| the release: summary, Tested on lines, "Platforms verified" result lines | [release.md](release.md), the version's entry |
| a claim found wrong | corrected where it stands, marked 🔁 with the date and the finding |

Fixes are made on a local review branch (`review-<version>`), merged to `main` when the review is
complete.
