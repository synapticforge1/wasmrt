# Known Issues — the fixed record

A fixed defect's lasting lesson: its cause, its fix and the test that pins it. Last verified: 2026-11-25.

- OPEN issues and review findings are not here: they live in the gitignored `review-issues.md` (letter H37).
- Everything up to 2.0.2 (the defect log from 2026-07-27, review rounds 1–3 for 2.0.2, R1–R26) is in
  [archive/known-issues-to-2.0.2.md](archive/known-issues-to-2.0.2.md), verbatim; search it by ID.
- The port's intentional divergences: [divergences.md](divergences.md).

## Fixed since 2.0.2

- **L1 (2.0.2):** no published crate carried a licence text — cargo packages only a crate's own folder.
  Fixed: the licence set copied into each crate, held equal to the root by `scripts/licence-copies.ts`.
- **I9 (2026-11-20):** `prev-tag-tests.ts` let a failed cleanup override its result. Fixed: `removeScratch`
  retries and warns; `scripts/check-prev-tag-tests.ts`.
- **B1 / H1 (2026-11-24):** `array.new_fixed` was bounded by the body's instruction count: two passes refused a
  valid unreachable `array.new_fixed $a 6`, and the per-operand loop made unreachable code quadratic (400 KB
  body: 116 s). Fixed: the loop stops at an unreachable frame's base (0.14 s). Lesson: a bound standing in for
  a proof of termination becomes a verdict. Test: `review_round_one_cases`.
- **if-without-else (2026-11-24):** judged by EQUALITY of params and results; a subtype is valid. Fixed:
  simulated as wasmparser's `visit_end` (params popped against results by subtyping). Same test.
- **C ABI store re-entry (2026-11-25):** each entry point took `&mut` to the store afresh, so a host callback
  calling back into its own store made a second live `&mut` — undefined behaviour, found by Miri on the new
  test, invisible to every other gate. Fixed: the store in a `RefCell`, borrowed per call; a nested use is
  refused. Test: `a_callback_cannot_reenter_or_delete_its_own_store` (run under Miri).
