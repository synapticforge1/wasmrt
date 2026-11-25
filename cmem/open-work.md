# open-work.md — the open items, and nothing else

Every item still to do, one per entry. Last verified: 2026-11-25. Done items leave this file for
`archive/` (the file up to 2026-11-23: [archive/open-work-to-2026-11-23.md](archive/open-work-to-2026-11-23.md));
where the project stands: [STATE.md](STATE.md); each release's record: [release.md](release.md).

## Open

- **W1 — the 3.0.0 release review**, then the release (owner's word). Committed and pushed since 2.0.2
  (`e54754c`): I11 (wasmtime's implementation limits, 🔒 owner 2026-11-24: "accept the measured limits that keep
  the program as robust as needed and as small as possible"), I12–I14 (decode refusals in wasmtime's words and
  offsets), the efficiency review (calls 3.1×, a large module's memory a third to a half lower), the CLI's safe writes and `pin`'s OS lock,
  the gnu toolchains and MSRV 1.100, the one-pass load (wasmtime's structural difference, closed), validation
  refusals in wasmtime's words, the C ABI store guard. 2026-11-25: the release review over the whole range is
  COMPLETE (R1, L1 and notes fixed, re-reviewed to empty, full suite on both platforms), the notes merged; open
  until CI has published and the release is read back as a user (`release.md`).
- **W5 — owner calls left open:** F2 (opt-level speed vs size); the efficiency items not done (the archive's W2
  entry); the 234 offset differences from wasmtime on the 4,000-corruption comparison (end-of-file offsets,
  module-level refusals with no offset) and 9 wording singletons (`review-issues.md`).
- **W6 — a C callback can call a linker function on a linker the outer code holds `&mut`** (2026-11-25 review
  note, unproved): live only across `resolve` in `wasmrt_linker_instantiate` (a start function's callback). Same
  shape as the store hole; a `RefCell` on the linker would close it the same way.
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
