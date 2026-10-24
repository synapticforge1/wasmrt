# open-work.md — what is outstanding, and the current state

**The ONE list of open work, and the only place the status line lives** (workspace
`memory-conventions.md`). Each item points at its record. Completed work leaves this file; its record
stays in the topic file named.

## 🚦 State — measured 2026-10-24

* Spec suite **64,603 / 0 / 0 over 288 files** (`bun scripts/behaviour-s2.ts`: 0 regressed).
* **604 workspace tests**, 0 failed, 1 ignored (2026-10-24, after the trap fixes); clippy clean;
  `surface.ts --check`, eol, definitions and the C-ABI gate green.
* Version **0.9.0** (last release). The bump floor since then is **MAJOR** (`releasing.md`, "THE
  NUMBER"), which `1.0.0` meets.
* Contract mirror **v38**, byte-identical to wazmrt's (`interop.md`); `--features` AGREED (v38); release lockstep ended at v33.
* History was rewritten twice (2026-10-23 paths, 2026-10-24 drive letters). An old commit id is looked
  up in `history-map-2026-10-23.md`, then `history-map-2026-10-24.md`.
* Workspace letters closed on wasmrt's side: H1, H2, H6, H8, H10 step 1, H13, H15, H16, H18, H19,
  H20, H21, H22, H23 (both).

## Open, in the order they unblock each other

1. **H10 step 2, stage 2** — generate the `define_ops!` list and the `0xFB`/`0xFC` decode dispatch
   too (variant names and internal tags stay wasmrt's own: they are public surface). Hot path, so an
   A/B/A benchmark first. ✅ Stage 1 done 2026-10-24 (`op_feature` exhaustive, the SIMD/atomic tables
   and relaxed set generated and shipped; attribution updated). ✅ D3 checked. Also read binaryang's
   new `opcode-guide.md` first (owner, 2026-10-24). Record: `shared-definitions.md`.
2. **1.0.0 release prep** — the README's status and intro, the CHANGELOG `[1.0.0]` section, the
   checklist; then the owner's tag, a green gate job (its first run on a runner), and the publish.
   Record: `releasing.md`.
3. ✅ **DONE 2026-10-24 — the v37 migration** (matrix identical to wazmrt, 0 of 86 lines differ;
   `known-issues.md`, top). Kept for the record of what it was:
   **The D2 `--features` migration — UNBLOCKED, and now directed (contract v37, 2026-10-24).**
   wazmrt implemented it; "wasmrt migrates once, to this". binaryang **v2.1.0** (`b7fdb9de`) carries
   D1 1.0.1 (`return_call_ref` → function-references, so wasmrt's one override goes stale and the
   generator will say so) and D2 2.1.0 (`requires`, recorded NOT enforced; `presets` wasm1/wasm2/
   wasm3/all). The work: re-pin to v2.1.0; D2 `cli` names in `Feature::from_name`; the presets plus
   `mvp`, `lime1`, `-all`; the six wasm-tools-only names as deprecated aliases with a warning; stop
   refusing incoherent CONFIGURATIONS (`check_coherent`), so `call_ref` is refused while a GC struct
   is accepted with gc on and function-references off; verify with wazmrt's
   `cmem/probes/feature-matrix.ts` run on both binaries. Guide: binaryang `docs/opcode-guide.md`.
   S1 will report a MAJOR floor (wazmrt's did). Record: `shared-definitions.md`, `interop.md` §2.2.
4. **The `1.0.x` ladder** — T9 hardening `1.0.1`, T10 bug hunt `1.0.2`, T11 optimization `1.0.3`,
   T12 security `1.0.4`. T11 decides the contest: the CLI's 3.4 ms on the 48 KB module, in-process
   cold start, the unattributed ~5% loop regression, the interpreter ladder, rsxtk on wasmtime vs
   wasmrt, the cdylib size gap, and the rlib (what rsxtk links) never measured. Record: `roadmap.md`
   (T9–T12), `vision.md`, `bench/README.md`.

## To relay — wasmrt cannot write there

* **binaryang** (its letter of 2026-10-24 asked two things): ✅ D1's `return_call_ref` and D2's rules
  are fixed upstream and adopted. **(a) The two fuzz inputs** are in the gitignored
  `cmem/local/handoffs/binaryang-fuzz-2026-10-23/` (with a README): both STILL reproduce on binaryang
  `v2.1.0-6-g521c5db02` (binaryang "OK"; wasm-tools and wasmrt refuse). **(b) The matrix against
  D1/D2 2.1.0**: wasmrt = wazmrt on all 86 lines; D1 per-instruction gating has 0 unexplained
  differences. Two rules wasmrt and wazmrt apply that D1/D2 do not STATE, for binaryang to record if
  it wants them in the data: a typed reference needs reference-types AND (function-references OR
  gc); an overlong `call_indirect` table index needs reference-types (an encoding, not an
  instruction). Remaining naming KNOWNs: `select.t` (0x1c) and the `null` forms of `ref.test` /
  `ref.cast` / `ref.cast_desc_eq`.
* **wasmtk:** its generated (gitignored) `tests/wasi/wasm_wasi_bundle/**/*.wat` include about ten
  modules that `throw 0` with no tag declared (`dynrt_eval_bundle/main_*.wat`,
  `sharedheap_bundle/main_wasic.wat`): wasm-tools refuses the source, and so does wasmrt. A
  generator defect, found by `scripts/wat-corpus.ts` on 2026-10-24 (the files appear and disappear
  between runs, so their builds are live).
* **wazmrt:** const-expr depth > 8 and the element flags are not re-measured since its 2026-09-21
  build. *(Closed 2026-10-24: `call_ref` with GC on and function-references off is now refused
  (v37, measured); §5 #13 AGREED (v36); `--features` AGREED and the ladder line corrected (v38).)*
* **GitHub:** old commit ids from both rewrites stay retrievable until its garbage collection; a full
  purge is a Support request (owner).
