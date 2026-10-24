# open-work.md — what is outstanding, and the current state

**The ONE list of open work, and the only place the status line lives** (workspace
`memory-conventions.md`). Each item points at its record. Completed work leaves this file; its record
stays in the topic file named.

## 🚦 State — measured 2026-10-24

* Spec suite **64,603 / 0 / 0 over 288 files** (`bun scripts/behaviour-s2.ts`: 0 regressed).
* **606 workspace tests**, 0 failed, 1 ignored (2026-10-24, after the binaryang 2.2.0 re-pin);
  clippy clean; `surface.ts --check`, eol, definitions and the C-ABI gate green.
* **1.0.0 RELEASED 2026-10-24**: tag `v1.0.0` = release commit `9871fd4`; `wasmrt-core`,
  `wasmrt-capi` and `wasmrt` at 1.0.0 on crates.io (verified through its API);
  `surface/released.txt` records it. ⚠️ **The bump floor since then is MAJOR** (one module accepted
  → refused: the `exact`-type fix; `bump.ts patch --dry-run` refuses), so the next release is
  `2.0.0` unless the owner decides otherwise (item 1).
* **binaryang pinned at v2.2.0** (`6e1923397def`; D2 2.2.0 with `typeRules` / `encodingRules`).
  **wasmrt = binaryang 2.2.0 on all 6,860 judgements** (wazmrt's `d2-matrix.ts`: wasmrt's S1 corpus
  × D2's 49 configurations), and `definitions_check` holds both rule lists in `cargo test`.
* Contract mirror **v39**, byte-identical to wazmrt's committed copy (`interop.md`); the type rule
  AGREED (v39); release lockstep ended at v33.
* History was rewritten twice (2026-10-23 paths, 2026-10-24 drive letters). An old commit id is looked
  up in `history-map-2026-10-23.md`, then `history-map-2026-10-24.md`.
* Workspace letters closed on wasmrt's side: H1, H2, H6, H8, H10 (steps 1 and 2), H13, H15, H16, H18, H19,
  H20, H21, H22, H23 (both).

## Open, in the order they unblock each other

1. **OWNER DECISION: the next version number.** The gate says MAJOR since 1.0.0 (`bump.ts`: accepting
   less is major even when correct), for one correction: `(ref null (exact $t))` now needs
   reference-types (README Breaking Changes `_next release_`; CHANGELOG Unreleased). The ladder
   planned `1.0.1` for T9. Either the next release is `2.0.0`, or the owner rules on how a conformance
   fix that only refuses more under a non-default feature set is numbered. Record: `releasing.md`,
   "THE NUMBER".
2. **The `1.0.x` ladder** — T9 hardening `1.0.1`, T10 bug hunt `1.0.2`, T11 optimization `1.0.3`,
   T12 security `1.0.4` (the numbers wait on item 1). T11 decides the contest: the CLI's 3.4 ms on
   the 48 KB module, in-process cold start, the unattributed ~5% loop regression, **the CLI's +31%
   since 0.9.0 (≈33 KiB of it attributed)**, the interpreter ladder, rsxtk on wasmtime vs wasmrt, the
   cdylib size gap, and the rlib (what rsxtk links) never measured. Record: `roadmap.md` (T9–T12),
   `vision.md`, `bench/README.md`, `CHANGELOG.md` [1.0.0] "Size and speed".

## To relay — wasmrt cannot write there

* **wazmrt:** 🔴 **a D2 `encodingRules` gap the v39 row says it met.** `(table 1 funcref (ref.null
  func))` (wasmrt's `tests/behaviour/gate-function-references__table-init.wat`) is ACCEPTED by
  wazmrt 4.0.1 with function-references off; wasmrt 1.0.0+, wasm-tools 1.262 and binaryang 2.2.0
  all refuse it (D2: "a table initializer expression" needs functionReferences). Measured
  2026-10-24 with wazmrt's own `cmem/probes/d2-matrix.ts --runtime` over **wasmrt's** S1 corpus: 54
  of 6,860 judgements differ, all this one module (27 configurations × its `.wat` and `.wasm`);
  over wazmrt's own corpus 0 of 2,352, because that corpus has no such module. v39's "AGREED on
  both" holds for the corpus it was measured on. Suggest: run the row over both corpora. ⏳ **wazmrt is
  fixing it (owner, 2026-10-24)**; re-run the matrix over wasmrt's corpus when it lands. Also, for
  the record: wasmrt 1.0.0 accepted an `exact` reference with reference-types off; fixed on `main`
  (`known-issues.md`, top); wazmrt already refused it. Still open: const-expr depth > 8 and the
  element flags, not re-measured since its 2026-09-21 build. *(Sent by the owner 2026-10-24: the
  type-rule relay, which v39 answered.)*
* **binaryang (its § 44 asks for every difference back):** re-pinned to v2.2.0; **wasmrt vs
  binaryang 2.2.0: 0 of 6,860 differ** after one wasmrt fix (an `exact` reference skipped
  reference-types; binaryang was right). wazmrt differs from binaryang on the table-initializer
  module above (wazmrt's to fix). Remaining naming KNOWNs: `select.t` (0x1c) and the `null` forms of
  `ref.test` / `ref.cast` / `ref.cast_desc_eq`.
* **wasmtk:** its generated (gitignored) `tests/wasi/wasm_wasi_bundle/**/*.wat` include about ten
  modules that `throw 0` with no tag declared (`dynrt_eval_bundle/main_*.wat`,
  `sharedheap_bundle/main_wasic.wat`): wasm-tools refuses the source, and so does wasmrt. A
  generator defect, found by `scripts/wat-corpus.ts` on 2026-10-24 (the files appear and disappear
  between runs, so their builds are live).
* **GitHub:** old commit ids from both rewrites stay retrievable until its garbage collection; a full
  purge is a Support request (owner).
