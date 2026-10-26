# open-work.md — what is outstanding, and the current state

**The ONE list of open work, and the only place the status line lives** (workspace
`memory-conventions.md`). Each item points at its record. Completed work leaves this file; its record
stays in the topic file named.

## 🚦 State — measured 2026-10-24

* Spec suite **64,603 / 0 / 0 over 288 files** (`bun scripts/behaviour-s2.ts`: 0 regressed).
* **606 workspace tests**, 0 failed, 1 ignored (2026-10-24, after the binaryang 2.2.0 re-pin);
  clippy clean; `surface.ts --check`, eol, definitions and the C-ABI gate green.
* **2.0.0 RELEASED 2026-10-24**: tag `v2.0.0` = release commit `1715139`; `wasmrt-core`,
  `wasmrt-capi` and `wasmrt` at 2.0.0 on crates.io (verified through its API);
  `surface/released.txt` records it (public surface identical to 1.0.0's). The bump floor since:
  **PATCH**. *(1.0.0: tag `v1.0.0` = `9871fd4`.)*
* **binaryang pinned at v2.2.0** (`6e1923397def`; D2 2.2.0 with `typeRules` / `encodingRules`).
  **wasmrt = binaryang 2.2.0 on all 6,860 judgements** (wazmrt's `d2-matrix.ts`: wasmrt's S1 corpus
  × D2's 49 configurations), and `definitions_check` holds both rule lists in `cargo test`.
* Contract mirror **v40**, byte-identical to wazmrt's committed copy (`bd97ae2`); the type rule
  AGREED (v39), the table-initializer correction (v40). **Verified by running both** (wazmrt built
  from a `git archive` of `bd97ae2`, since its working tree was mid-edit): wazmrt ⇄ wasmrt **0 of
  2,401** over wazmrt's corpus and **0 of 6,860** over wasmrt's; wazmrt ⇄ binaryang 2.2.0 0 of 6,860
  over wasmrt's. Release lockstep ended at v33.
* History was rewritten twice (2026-10-23 paths, 2026-10-24 drive letters). An old commit id is looked
  up in `history-map-2026-10-23.md`, then `history-map-2026-10-24.md`.
* Workspace letters closed on wasmrt's side: H1, H2, H6, H8, H10 (steps 1 and 2), H13, H15, H16, H18, H19,
  H20, H21, H22, H23 (carry-forward), H24 (the rule 5.2 re-copy, cited as "H23" until the workspace
  renumbered it). H25: nothing addressed to wasmrt.

## Open, in the order they unblock each other

1. **The review ladder** — T9 hardening, T10 bug hunt, T11 optimization, T12 security, in that
   order. 🔒 **Their version numbers come from the gate, not the plan** (owner, 2026-10-24, accepting
   `2.0.0` for the `exact`-type correction): each release after `2.0.0` is whatever `bump.ts` says. *(The ladder had pre-assigned `1.0.1`–`1.0.4`.)* T11 decides the contest: the CLI's 3.4 ms on
   the 48 KB module, in-process cold start, the unattributed ~5% loop regression, **the CLI's +31%
   since 0.9.0 (≈33 KiB of it attributed)**, the interpreter ladder, rsxtk on wasmtime vs wasmrt, the
   cdylib size gap, and the rlib (what rsxtk links) never measured. Record: `roadmap.md` (T9–T12),
   `vision.md`, `bench/README.md`, `CHANGELOG.md` [1.0.0] "Size and speed".

## To relay — wasmrt cannot write there

* **wazmrt: nothing open.** *(Closed 2026-10-24, all measured on wazmrt `bd97ae2`: the
  table-initializer gap (v40; 0 of 6,860 over wasmrt's corpus); a constant expression with 9
  operands is accepted and element flags 8 refused (`b919ef2`), as by wasm-tools 1.262 and wasmrt;
  the type rule (v39); `call_ref` with GC on and function-references off (v37); §5 #13 (v36);
  `--features` (v38).)* For the record: wasmrt 1.0.0 accepted an `exact` reference with
  reference-types off, fixed on `main` (`known-issues.md`, top); wazmrt already refused it.
* **binaryang (its § 44 asks for every difference back):** re-pinned to v2.2.0; **wasmrt vs
  binaryang 2.2.0: 0 of 6,860 differ** after one wasmrt fix (an `exact` reference skipped
  reference-types; binaryang was right); wazmrt at `bd97ae2` 0 of 6,860 too. Remaining naming KNOWNs: `select.t` (0x1c) and the `null` forms of
  `ref.test` / `ref.cast` / `ref.cast_desc_eq`.
* **wasmtk:** its generated (gitignored) `tests/wasi/wasm_wasi_bundle/**/*.wat` include about ten
  modules that `throw 0` with no tag declared (`dynrt_eval_bundle/main_*.wat`,
  `sharedheap_bundle/main_wasic.wat`): wasm-tools refuses the source, and so does wasmrt. A
  generator defect, found by `scripts/wat-corpus.ts` on 2026-10-24 (the files appear and disappear
  between runs, so their builds are live).
* **GitHub:** old commit ids from both rewrites stay retrievable until its garbage collection; a full
  purge is a Support request (owner).
