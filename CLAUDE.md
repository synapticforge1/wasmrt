# wasmrt

> **At session start, read `../cmem/handoffs.md` for letters addressed to this repo.** The workspace
> session reviews across the sibling repos and reports there; nothing is ever written into this repo
> from outside (owner, 2026-09-20).

A fast, small, idiomatic-**Rust** WebAssembly runtime, built to replace wasmtime under the owner's
`universalWasmLoader-*` projects. It began as a port of the Zig runtime `wazmrt`; 🔒 **since
2026-08-11 the oracle is retired**: the two are independent entrants competing for inclusion in wasmtk
and the loaders, decided on the **smallest and fastest binary**, and `rsxtk` takes wasmrt by default.
Do not follow wazmrt's design; correctness anchors on the spec testsuite, wasmtime's behaviour and the
wasmtk WASI corpus.

**Project memory is [`cmem/`](cmem/). Start at [`cmem/INDEX.md`](cmem/INDEX.md).** The current state
and the open list are in [`cmem/open-work.md`](cmem/open-work.md), and nowhere else.

**State (2026-10-24):** `1.0.0` released, the conformance clear-out (spec suite 64,603 / 0 / 0 over
288 files); the `2.0.0` release commit is made (the owner's tag and publish
are next), then the review stages T9–T12, each numbered by the bump gate. Detail: `cmem/open-work.md`.

## Triggers (full text: `cmem/INDEX.md`)

- **"Update the project memory"** — fold into `cmem/`, AUDIT for stale live claims (grep the old
  values), refresh the INDEX line, scan for anything private, commit and push.
- **"Coordinate"** — sync with wazmrt through [`cmem/interop.md`](cmem/interop.md), the
  swappability contract (CLI options + security checks only). Regime A: wazmrt holds the pen and
  wasmrt mirrors it verbatim; byte-compare the copies; verify rows by RUNNING both. Coordinate
  BEFORE shipping a change to a contract surface.
- **"Look for code issues"**, **"evaluate a reference project"** — `cmem/INDEX.md`.
- **A release** — the checklist in [`cmem/releasing.md`](cmem/releasing.md); 🔒 memory, roadmap,
  README and CHANGELOG are committed BEFORE the publish handoff; the version moves only through
  `bun scripts/bump.ts`.

## Rules that bite in the first five minutes (full text: `cmem/design-decisions.md`)

- 🔒 **PROVE, DO NOT ASSUME** (owner, 2026-09-19): every claim that leaves the session — a report, a
  commit message, a `cmem/` entry, a test's expected value — is measured first, or said to be
  unmeasured.
- 🔒🔒 **Never write into a sibling's tree** (its source, its `cmem/`, its `interop.md`) unless the
  owner directs it that time. Reading is free.
- 🔒 **Nothing is pushed, published or tagged unless the owner says so.**
- 🔒 **PRIVACY — this repo is public.** No secrets, no machine-specific detail (a user profile, a
  project-tree location, even a bare drive letter saying where something lives); one maintainer email,
  in `Cargo.toml` `authors` only; machine facts in the gitignored `cmem/local/`. Scan the staged diff
  AND the message before every commit.
- 🔒 **Tooling:** committed scripts are TypeScript run by **Bun** (`node:` builtins only; no Deno APIs,
  no Python); a one-time script may be shell and is deleted after use; **never a heredoc** — write the
  file, then run it; prefer the `Edit` tool, and check every scripted edit applied.
- 🔒 **Line endings are LF everywhere** (`.gitattributes`; `cargo test` fails on a CR).
- ⚠️ cargo's target directory is not `./target` on every host: ask `cargo metadata`
  (`scripts/target-dir.ts`). Run `cargo test` from either shell; all tests pass from both.
- 🔑 **History was rewritten on 2026-10-23 and 2026-10-24**: an old commit id is looked up in
  `cmem/history-map-2026-10-23.md`, then `cmem/history-map-2026-10-24.md`.

*Until 2026-10-24 this file carried a 300-line status narrative (a third copy of INDEX and roadmap);
it is summarized into `cmem/` and kept at `git show cfeee31:CLAUDE.md`.*
