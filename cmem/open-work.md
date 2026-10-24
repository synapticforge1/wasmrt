# open-work.md — what is outstanding, and the current state

**The ONE list of open work, and the only place the status line lives** (workspace
`memory-conventions.md`). Each item points at its record. Completed work leaves this file; its record
stays in the topic file named.

## 🚦 State — measured 2026-10-24

* Spec suite **64,603 / 0 / 0 over 288 files** (`bun scripts/behaviour-s2.ts`: 0 regressed).
* **606 workspace tests**, 0 failed, 1 ignored (2026-10-24, after the D2 type rule); clippy clean;
  `surface.ts --check`, eol, definitions and the C-ABI gate green.
* **1.0.0 RELEASED 2026-10-24**: tag `v1.0.0` = release commit `9871fd4`; `wasmrt-core`,
  `wasmrt-capi` and `wasmrt` at 1.0.0 on crates.io (verified through its API);
  `surface/released.txt` records it. The bump floor since then: **PATCH** (`bump.ts --dry-run`).
* Contract mirror **v38**, byte-identical to wazmrt's (`interop.md`); `--features` AGREED (v38); release lockstep ended at v33.
* History was rewritten twice (2026-10-23 paths, 2026-10-24 drive letters). An old commit id is looked
  up in `history-map-2026-10-23.md`, then `history-map-2026-10-24.md`.
* Workspace letters closed on wasmrt's side: H1, H2, H6, H8, H10 (steps 1 and 2), H13, H15, H16, H18, H19,
  H20, H21, H22, H23 (both).

## Open, in the order they unblock each other

1. **Re-pin to binaryang's next release (≥ 2.2.0) when it ships**, and re-run both matrices
   (`feature-matrix`, D1 gating) with every difference back to binaryang (its § 44 asks this). D2
   gains `typeRules` and `encodingRules`: once vendored, `definitions_check` should hold
   `features::val_type_unmet` and the encoding gates to them, so the rule adopted on 2026-10-24
   cannot drift from the data. Record: `shared-definitions.md`.
2. **The `1.0.x` ladder** — T9 hardening `1.0.1`, T10 bug hunt `1.0.2`, T11 optimization `1.0.3`,
   T12 security `1.0.4`. T11 decides the contest: the CLI's 3.4 ms on the 48 KB module, in-process
   cold start, the unattributed ~5% loop regression, **the CLI's +31% since 0.9.0 (≈33 KiB of it
   attributed)**, the interpreter ladder, rsxtk on wasmtime vs wasmrt, the cdylib size gap, and the
   rlib (what rsxtk links) never measured. Record: `roadmap.md` (T9–T12), `vision.md`,
   `bench/README.md`, `CHANGELOG.md` [1.0.0] "Size and speed".

## To relay — wasmrt cannot write there

* **wazmrt:** 🔴 **wasmrt adopted D2's TYPE RULE on 2026-10-24, owner-directed, ahead of the
  binaryang release** (`cee7bd1`; `known-issues.md`, top). It is a `--features` contract surface, so
  the two runtimes now DIFFER where wazmrt still has the 2.1.0 rule: the abstract GC types and
  `exnref` with reference-types off, and a non-null `(ref func)` / `(ref extern)` with gc on and
  function-references off (wasmrt refuses all of these; wasm-tools 1.262 too). wazmrt's own § 43
  rows (3) and (4) found the same rule missing. Proposed for the contract: a row stating that
  `--features` judges value types by D2's `typeRules`. Also open: const-expr depth > 8 and the
  element flags are not re-measured since its 2026-09-21 build. *(Closed 2026-10-24: `call_ref` with
  GC on and function-references off is refused (v37, measured); §5 #13 AGREED (v36); `--features`
  AGREED and the ladder line corrected (v38).)*
* **binaryang:** ✅ § 43 delivered both fuzz inputs and the matrix; § 44 (drafted, not yet sent by
  the owner) answers them, all fixed on its `main`. wasmrt already implements § 44's type rule
  (measured 0 of 320 judgements differ from wasm-tools 1.262), its mutable-globals rows and the
  overlong index. Remaining naming KNOWNs: `select.t` (0x1c) and the `null` forms of `ref.test` /
  `ref.cast` / `ref.cast_desc_eq`.
* **wasmtk:** its generated (gitignored) `tests/wasi/wasm_wasi_bundle/**/*.wat` include about ten
  modules that `throw 0` with no tag declared (`dynrt_eval_bundle/main_*.wat`,
  `sharedheap_bundle/main_wasic.wat`): wasm-tools refuses the source, and so does wasmrt. A
  generator defect, found by `scripts/wat-corpus.ts` on 2026-10-24 (the files appear and disappear
  between runs, so their builds are live).
* **GitHub:** old commit ids from both rewrites stay retrievable until its garbage collection; a full
  purge is a Support request (owner).
