# STATE: wasmrt

Updated: 2026-11-25, after the 3.0.0 release (owner: "release 3.0.0")

## Version
- Released: 3.0.0 on 2026-11-25 (UTC); tag `v3.0.0` on `6f18955`, crates.io (all three crates), Release page by CI
  (run `45681894710`); read back as a user (`cargo install wasmrt --version 3.0.0` → `wasmrt 3.0.0 (abi 1)`)
- Previous: 2.0.2 on 2026-11-20. Working branch: `main`; the released surface recorded (`e79ed16`)

## Now
- 3.0.0's content: wasmtime's implementation limits (the measured-needed set); decode and validation refusals in
  wasmtime's words, almost always at its offset (wasmparser 0.263's, credited); the one-pass load (`module::parse`
  / `Parsed::validate` / `decode_validated`); the efficiency review (function calls ~3× faster, a large module's
  memory a third to two thirds lower); the CLI's safe writes and `pin`'s OS lock; the C ABI store guard; MSRV 1.100
- Toolchains (owner, 2026-11-24): gnu on both OSes, the same versions — stable 1.100.0 (the MSRV, `rust-version`)
  and `nightly-2026-11-04` (pinned in `rust-toolchain.toml` and release.yml, the default); gnullvm dropped
- Measured for 3.0.0 against 2.0.2 built the same way: CLI 915,968 B (+8.3%), DLL 583,680 B (+8.9%); cold start
  3.2–3.9 ms (4.1–4.4), steady 192–223 Mops/s (166–181); no corpus module changes verdict (release.md)
- Workspace letters: C50 (48afb6e), H42's wasmrt answer (b668926) and C51 (3df888d, the interop split for wazmrt to
  mirror) — all pushed to the workspace repo (2026-11-25)

## Review
- The 3.0.0 release review over `v2.0.2..f17127e`: five classes (basic R1, licensing L1, notes) fixed, re-reviewed
  to EMPTY; the notes re-reviewed to EMPTY; `Review complete: 52034dc` (review-issues.md, gitignored)
- Open issues: none at or above the floor; recorded notes not acted on are in review-issues.md and open-work.md

## Next
1. The owner's open calls: F2 (opt-level speed vs size), the remaining efficiency items; the 234 offset differences
   left (end-of-file offsets, validation refusals outside a body without an offset or wasmtime's words)
2. `interop.md`: SPLIT 2026-11-25 into 12 files, then its long tables made lists (every limit held, no word changed);
   ⏳ wazmrt mirrors both (R6); the §3.7 limits rows after wazmrt answers C50

## Waiting on owner
- the calls in Next 1; wazmrt's answer to C50 and its mirror of C51

## Read next
- open-work.md: the open list
- review-issues.md (gitignored): the review log
