# open-work.md — the open items, and nothing else

Every item still to do, one per entry. Last verified: 2026-11-23. Done items leave this file for
`archive/` (the file up to 2026-11-23: [archive/open-work-to-2026-11-23.md](archive/open-work-to-2026-11-23.md));
where the project stands: [STATE.md](STATE.md); each release's record: [release.md](release.md).

## Open

- **W1 — the open review issues**, in the gitignored `review-issues.md` (never on GitHub, letter H37): I1–I10
  fixed or closed in the working tree (2026-11-23, re-review pending); open: basic 1 (I11, the locals limit).
- **W2 — the review stages T9–T12** (T9 hardening, T10 bug hunt, T11 optimization, T12 security) predate
  the five-class review. 🔒 **Not published** (owner, 2026-11-23: "we will not publish the review ladder in
  the public space"): their rows left `ROADMAP.md` that day; they are tracked here only. 🗓️ The owner decides
  whether they become those reviews or stay separate stages. Their version numbers come from the gate.
  T11 holds the contest's open measurements: the CLI's 3.4 ms on the 48 KB module, in-process cold start,
  the unattributed ~5% loop regression, the CLI's +31% since 0.9.0 (≈33 KiB attributed), the interpreter
  ladder, rsxtk on wasmtime vs wasmrt, the cdylib size gap, the rlib never measured, and whether to pin a
  dated nightly locally (the floating `nightly` moves the sizes with no source change). Records:
  [vision.md](vision.md), `bench/README.md`, `CHANGELOG.md` [1.0.0] "Size and speed".
- **W3 — split `interop.md`** (187 KB, the one file over the memory guide's limits). Co-owned with wazmrt
  (owner, 2026-11-20), byte-identical in both: one split, agreed through "Coordinate", made in both copies.
- **W4 — 🗓️ owner: revoke the workstation's `cargo login` token.** CI publishes by trusted publishing now
  (first used for 2.0.2), so the token is no longer needed.

## To relay — wasmrt cannot write there

- **R1 — binaryang:** wasmrt and binaryang 2.2.0 agree on all 6,860 judgements; naming differences remain
  in D1: `select.t` (0x1c) and the `null` forms of `ref.test` / `ref.cast` / `ref.cast_desc_eq`.
- **R2 — wasmtk:** about ten generated `tests/wasi/wasm_wasi_bundle/**/*.wat` modules `throw 0` with no tag
  declared (`dynrt_eval_bundle/main_*.wat`, `sharedheap_bundle/main_wasic.wat`): a generator defect that
  wasm-tools and wasmrt both refuse (found by `scripts/wat-corpus.ts`, 2026-10-24).
- **R3 — wazmrt (an observation, not a contract row):** `0edbc5c` built `-Doptimize=ReleaseSmall` from a
  scratch `git archive` (2026-10-27) failed wazmrt's size gate: `wazmrt.lib` 1,075,426 vs ceiling 1,075,310
  (+116). Cause unmeasured (a guess: a static library records object paths). Relay through the owner.
- **R5 — wazmrt (through "Coordinate", 2026-11-23):** three verdicts changed with a proposal disabled, to match
  wasm-tools and binaryang D2 — without multi-memory wasmrt now refuses `memory.size`/`memory.grow`'s overlong `80 00`
  index and a memarg's memory-index flag; without reference-types it now accepts an overlong `return_call_indirect`
  table index (D2 gates only `call_indirect`'s). The `--features` row is a contract surface: tell wazmrt before release.
- **R4 — GitHub:** commit ids from wasmrt's two history rewrites stay retrievable until GitHub's garbage
  collection; a full purge is a support request (the owner's call).
