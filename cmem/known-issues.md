# Known Issues — the fixed record

A fixed defect's lasting lesson: its cause, its fix and the test that pins it. Last verified: 2026-11-20.

- OPEN issues and review findings are not here: they live in the gitignored `review-issues.md` (letter H37).
- Everything up to 2.0.2 (the defect log from 2026-07-27, review rounds 1–3 for 2.0.2, R1–R26) is in
  [archive/known-issues-to-2.0.2.md](archive/known-issues-to-2.0.2.md), verbatim; search it by ID.
- The port's intentional divergences: [divergences.md](divergences.md).

## Fixed since 2.0.2

- **L1 (2.0.2):** no published crate carried a licence text — cargo packages only a crate's own folder.
  Fixed: the licence set copied into each crate, held equal to the root by `scripts/licence-copies.ts`.
- **I9 (2026-11-20):** `prev-tag-tests.ts` let a failed cleanup override its result. Fixed: `removeScratch`
  retries and warns; `scripts/check-prev-tag-tests.ts`.
