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
* Contract mirror **v37**, byte-identical to wazmrt's (`interop.md`); release lockstep ended at v33.
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
3. **The D2 `--features` migration — UNBLOCKED, and now directed (contract v37, 2026-10-24).**
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

* **binaryang:** D1's `return_call_ref` feature, and D2's missing dependency rules (item 3).
* **wasmtk:** its generated (gitignored) `tests/wasi/wasm_wasi_bundle/**/*.wat` include about ten
  modules that `throw 0` with no tag declared (`dynrt_eval_bundle/main_*.wat`,
  `sharedheap_bundle/main_wasic.wat`): wasm-tools refuses the source, and so does wasmrt. A
  generator defect, found by `scripts/wat-corpus.ts` on 2026-10-24 (the files appear and disappear
  between runs, so their builds are live).
* **wazmrt:** `call_ref` with GC on and function-references off is admitted (measured on 2.0.0);
  const-expr depth > 8 and the element flags are not re-measured since its 2026-09-21 build.
  wasmrt implemented v35's §5 #13 in `cfeee31`, so the contract's wasmrt cell can read agreed.
  `interop.md:83` still says wasmrt's "`1.0.0` (the conformance clear-out, T13) is not started";
  the source has met it since 2026-09-19 (64,603 / 0 / 0).
* **GitHub:** old commit ids from both rewrites stay retrievable until its garbage collection; a full
  purge is a Support request (owner).
