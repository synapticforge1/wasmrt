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
* Contract mirror **v35**, byte-identical to wazmrt's (`interop.md`); release lockstep ended at v33.
* History was rewritten twice (2026-10-23 paths, 2026-10-24 drive letters). An old commit id is looked
  up in `history-map-2026-10-23.md`, then `history-map-2026-10-24.md`.
* Workspace letters closed on wasmrt's side: H1, H2, H6, H8, H10 step 1, H13, H15, H16, H18, H19,
  H20, H21, H22, H23 (both).

## Open, in the order they unblock each other

1. **H10 step 2** — derive the hand tables (`define_ops!`, the `0xFB`/`0xFC` dispatch, the
   SIMD/atomic tables, `op_feature`) from the generated definitions, so nothing is hand-kept; hot
   path, so an A/B/A benchmark first. 🔒 The owner cleared SHIPPING D1-derived tables (2026-10-24:
   attribution now; binaryang's future rewrite addresses it), so NOTICE, README and `licensing.md`
   change with it. ✅ D3 is checked (2026-10-24). Record: `shared-definitions.md`.
2. **1.0.0 release prep** — the README's status and intro, the CHANGELOG `[1.0.0]` section, the
   checklist; then the owner's tag, a green gate job (its first run on a runner), and the publish.
   Record: `releasing.md`.
3. **The D2 `--features` migration**, names and meanings (contract v32/v33), once binaryang's FL1
   settles D2's spellings; re-pin binaryang (v1.14.0 → v1.17.0 or later) with it. Blocked upstream:
   D2 has no dependency or preset rules, and D1 gates `return_call_ref` under `tailCall`. Record:
   `shared-definitions.md`, `known-issues.md` (top).
4. **The `1.0.x` ladder** — T9 hardening `1.0.1`, T10 bug hunt `1.0.2`, T11 optimization `1.0.3`,
   T12 security `1.0.4`. T11 decides the contest: the CLI's 3.4 ms on the 48 KB module, in-process
   cold start, the unattributed ~5% loop regression, the interpreter ladder, rsxtk on wasmtime vs
   wasmrt, the cdylib size gap, and the rlib (what rsxtk links) never measured. Record: `roadmap.md`
   (T9–T12), `vision.md`, `bench/README.md`.

## To relay — wasmrt cannot write there

* **binaryang:** D1's `return_call_ref` feature, and D2's missing dependency rules (item 3).
* **wazmrt:** `call_ref` with GC on and function-references off is admitted (measured on 2.0.0);
  const-expr depth > 8 and the element flags are not re-measured since its 2026-09-21 build.
  wasmrt implemented v35's §5 #13 in `cfeee31`, so the contract's wasmrt cell can read agreed.
  `interop.md:83` still says wasmrt's "`1.0.0` (the conformance clear-out, T13) is not started";
  the source has met it since 2026-09-19 (64,603 / 0 / 0).
* **GitHub:** old commit ids from both rewrites stay retrievable until its garbage collection; a full
  purge is a Support request (owner).
