# open-work.md — the open items, and nothing else

Every item still to do, one per entry. Last verified: 2026-11-23. Done items leave this file for
`archive/` (the file up to 2026-11-23: [archive/open-work-to-2026-11-23.md](archive/open-work-to-2026-11-23.md));
where the project stands: [STATE.md](STATE.md); each release's record: [release.md](release.md).

## Open

- **W1 — the open review issues**, in the gitignored `review-issues.md` (never on GitHub, letter H37): I1–I10
  fixed or closed (2026-11-23, review complete at `820669f`). Since then, UNCOMMITTED and REVIEWED (W2's five-class
  review, complete 2026-11-24 on win-x64 and linux-x64; `Review complete: <commit>` written at the owner's commit):
  I11, wasmtime's implementation limits — measured and decided (🔒 owner, 2026-11-24: "accept the measured limits
  that keep the program as robust as needed and as small as possible": the needed ones kept, type size adopted,
  `MAX_CTRL_DEPTH` kept); I12–I14, decode refusals in wasmtime's words and offsets; the efficiency review's fixes
  (calls 3.1×, memory roughly halved); the review's own fixes (CLI writes, pin lock). Open: the opt-level speed /
  size decision (F2), the efficiency items not done (see the archive's W2 entry), and the structural difference
  (wasmtime validates a body while reading it).
  🔒 The five `--features` changes are DECIDED (owner, 2026-11-24: "I agree with the recommendations"): the three
  verdict changes are approved as implemented (multi-memory off: `memory.size`/`memory.grow` need `0x00`, a memarg's
  `0x40` flag is refused; reference-types off: an overlong `return_call_indirect` index is accepted); the `wasm3`
  preset keeps following binaryang (no threads, contract v32's rule); `atomic.fence` with a nonzero byte stays
  refused until shared-everything-threads is in scope.
- **W3 — split `interop.md`** (187 KB, the one file over the memory guide's limits). Co-owned with wazmrt
  (owner, 2026-11-20), byte-identical in both: one split, agreed through "Coordinate", made in both copies.

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
  ✅ Relayed with the implementation limits and the refusal wording as workspace letter **C50** (owner, 2026-11-24:
  "relay the changes to wazmrt via the workspace"); open until wazmrt answers and wasmrt, its creator, closes it.
- **R4 — GitHub:** commit ids from wasmrt's two history rewrites stay retrievable until GitHub's garbage
  collection; a full purge is a support request (the owner's call).
