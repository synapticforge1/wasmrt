# open-work.md — the open items, and nothing else

Every item still to do, one per entry. Last verified: 2026-11-25. Done items leave this file for
`archive/` (the file up to 2026-11-23, and items closed since: [archive/open-work-to-2026-11-23.md](archive/open-work-to-2026-11-23.md));
where the project stands: [STATE.md](STATE.md); each release's record: [release.md](release.md).

## Open

- **W5 — the owner's calls (2026-11-25: "fix items 1"), in progress:** ✅ F2 opt-level "s" (`e4ca7db`); ✅ offsets
  and words (`a0e24ed`: offset differences 234 → 56, words 9 → 2, the rest explained in the CHANGELOG); ✅ efficiency
  items 5 (function types looked up once; it also fixed validation quadratic in imports × calls) and 6 (element
  segments hold no copy of their items). Left: item 9 (lazy per-function decode) and item 7 (a smaller `Instr`,
  public API, 4.0.0).

## To relay — wasmrt cannot write there

- **R6 — wazmrt: mirror the `interop.md` split** (owner, 2026-11-25: "wazmrt will follow suit"). wasmrt's copy is
  now `interop.md` + 11 `interop-*.md` parts, every section moved verbatim (the 12 files rebuild the old file byte for
  byte); the CONTRACT VERSION stays 41 (no row changed). The mirror is complete when wazmrt's 12 files `cmp` equal.
- **R1 — binaryang:** wasmrt and binaryang 2.2.0 agree on all 6,860 judgements; naming differences remain
  in D1: `select.t` (0x1c) and the `null` forms of `ref.test` / `ref.cast` / `ref.cast_desc_eq`.
  ✅ Relayed as workspace letter **C52** (owner, 2026-11-25; workspace `1c281d5`): does D1 intend its four spellings,
  and is the encoding D1's unique key? Open until binaryang answers and wasmrt, its creator, closes it.
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
