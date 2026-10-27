# cmem — wasmrt's project memory

> **At session start, and before each new work item, read `../cmem/workspace-correspondence.md`**
> for every open row addressed to wasmrt or touching what you will change, then the letter it points
> to in `../cmem/handoffs.md` (🔒 owner, 2026-10-26). Answer in the row's "full text" cell; only the
> row's creator closes it. Nothing is written into this repo from outside (owner, 2026-09-20).

`cmem/` is the single home for ALL project memory: committed, portable, one topic file per domain,
and this INDEX one line per file (workspace `../cmem/memory-conventions.md`). **The current state and
the open list are in [open-work.md](open-work.md), and only there.** Machine facts live in the
gitignored `local/`. `README.md`, `ROADMAP.md` and `CHANGELOG.md` are public documents, not memory.

*Until 2026-10-24 this file also carried a dated narrative of every pass from July to September
(about 800 lines): `git show cfeee31:cmem/INDEX.md`. Its substance lives in `roadmap.md` (per pass),
`known-issues.md` (each defect), `testing.md` (each gate) and `best-practices.md` (each lesson).*

**Reading order for a new session:** [open-work.md](open-work.md) → [best-practices.md](best-practices.md)
→ [design-decisions.md](design-decisions.md) → the topic file the task touches.

## Triggers (binding on every agent)

### "Update the project memory"

1. Fold the decisions, findings and state into the matching topic files; refresh their line in the
   table below; absolute dates; update entries rather than duplicate.
2. ⚠️ **AUDIT for stale LIVE claims, not just the files you touched**: grep the OLD values, classify
   each hit as live (fix) or dated (leave; mark it superseded if it claims to be current). When two
   files disagree, **measure**; do not pick the newer. Re-read "by design" / "out of scope" lines when
   a track closes.
3. Sync `README.md` only where the change is user-relevant.
4. 🔒 Scan the diff and the message for anything private (`design-decisions.md`, "PRIVACY"), then
   **commit and push** (`origin` = github.com/synapticforge1/wasmrt).

### 🤝 "Coordinate" (owner, 2026-08-19) — wasmrt ⇄ wazmrt through [interop.md](interop.md)

**Regime A is in force: wazmrt holds the pen**; wasmrt mirrors its copy, measures, objects, and
contributes findings as an UNNUMBERED annex. **Regime B** (each side numbers its changes; the two
reconcile at the END of each `1.0.x` stage) begins when wasmrt reaches `1.0.1`. A version is a PIN,
not a LOCK. Release lockstep ended at v33; the rows and the mirror rule did not.

1. Read `interop.md` first: the only file either project may treat as binding on the other.
2. **Byte-compare the two copies.** A difference means the contract is unknown until reconciled; an
   unadopted proposal is a normal in-flight state, but never binding.
3. **Verify a row by RUNNING both runtimes, never by reading either.** An ⬜ UNVERIFIED row is not
   quoted as agreed.
4. 🔒 Scope: the CLI options and the security checks only. Reading the sibling to verify a row is
   expected; reading it to adopt a design is not; performance and size are out (that is the contest).
5. **Record what you found in THIS copy, with date and evidence.** Under regime A as an annex (the
   pen holder numbers it on fold-in); under regime B with a version bump and a change-log row.
6. A disagreement is an OBSERVATION until its cause is traced; neither runtime is the oracle.
7. 🔒🔒 **Commit and push only this repo. Never write into the sibling's tree**, its `interop.md`
   included, unless the owner directs it that time; propose instead, and let its session commit it.

⚠️ **The inverse binds too: coordinate BEFORE shipping a change to a contract surface** — any CLI
option, any security check (pin, WASI rights, `--dir`/`--ro-dir`, the guest environment), any resource
ceiling, any exit code. A change shipped without it is how the two stop being swappable, silently.

### "Evaluate a reference project"

Before adapting code from any reference project ([reference-projects.md](reference-projects.md)),
complete an Adoption Checklist in `third_party/LICENSES.md`, add a Component Ledger entry, and update
`reference-projects.md`. Looking is free; porting always needs the ledger entry.

### "Look for code issues"

Audit tested AND untested paths: stale workarounds; dead code (grep-verified: the C ABI reaches
symbols too); bugs; and **fall-throughs (worst)**, a placeholder where an error belongs. Report
`file:line` + severity, fix the safe ones, and **diff the OUTPUT counts, not exit codes**.

### "Reflect a shipped stage"

At every release: the per-release checklist in [releasing.md](releasing.md), docs and memory
committed BEFORE the publish handoff.

## Files

| file | holds |
| --- | --- |
| [open-work.md](open-work.md) | 🚦 the current state (measured, dated) and the ONE list of open work |
| [overview.md](overview.md) | what wasmrt is and who uses it |
| [vision.md](vision.md) | the contest: smallest and fastest binary; the three success axes and their measurements |
| [architecture.md](architecture.md) | the crates, the dual native/`wasm32` target, how a module flows through the engine |
| [design-decisions.md](design-decisions.md) | 🔒 owner rules (PROVE DO NOT ASSUME, TOOLING, PRIVACY, oracle retired) and invariants not to revert |
| [best-practices.md](best-practices.md) | 🎓 the lessons this port paid for, each with its defect; the workspace ★ rules copied at the end |
| [interop.md](interop.md) | 🤝 the wasmrt ⇄ wazmrt swappability contract, mirrored verbatim (v41 on 2026-10-27; the version lives in `open-work.md`) |
| [shared-definitions.md](shared-definitions.md) | binaryang's D1/D2/D3, vendored and GENERATED into `definitions.rs` and the shipped `tables.rs`; what the cross-check asserts; the type rule that is ahead of the pin |
| [testing.md](testing.md) | every gate, how to run it, what it can and cannot see; dated counts |
| [known-issues.md](known-issues.md) | the defect log, newest first: cause, fix, the test that pins it |
| [security-model.md](security-model.md) | the WASI sandbox, the pin gate, the ceilings, the threat model |
| [releasing.md](releasing.md) | SemVer and the gated bump; the binding per-release checklist |
| [roadmap.md](roadmap.md) | the task ladder (T0–T13), each pass's record, the scoped plans |
| [loaders.md](loaders.md) | the consumers (`universalWasmLoader-*`, wasmtk, rsxtk) and the `wasmrt.h` surface they call |
| [licensing.md](licensing.md) | MIT OR Apache-2.0, the SPDX convention, provenance and attribution |
| [reference-projects.md](reference-projects.md) | the reference runtimes and what may be read from each |
| [history-map-2026-10-23.md](history-map-2026-10-23.md) | 🔑 old → new commit ids after the first history rewrite (drive paths) |
| [history-map-2026-10-24.md](history-map-2026-10-24.md) | 🔑 old → new commit ids after the second rewrite (drive letters); look up 10-23 first |
| `local/` | gitignored: machine facts, backups, local measurements |

## Related files outside cmem

* `README.md`, `ROADMAP.md`, `CHANGELOG.md` — public; kept in step with each release.
* `scripts/` — every gate, a Bun script (`testing.md`); `surface/` — the compatibility gate's snapshots.
* `docs/port/` — the port's wazmrt deep-read maps; historical.
* `LICENSE`, `LICENSE-MIT`, `LICENSE-APACHE`, `NOTICE`, `third_party/LICENSES.md`.
