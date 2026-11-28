# STATE: wasmrt

Updated: 2026-11-27, after W5's items and the move-out before the project drive leaves the dev machine

## Version
- Released: 3.0.0 on 2026-11-25 (UTC); tag `v3.0.0` on `6f18955`, crates.io (all three crates), Release page by CI
  (run `45681894710`); read back as a user (`cargo install wasmrt --version 3.0.0` → `wasmrt 3.0.0 (abi 1)`)
- Previous: 2.0.2 on 2026-11-20. Working branch: `main`
- Unreleased on `main`: W5 below. `6373cb9` changes the public API (a 32-byte `Instr`), so the next release is
  MAJOR (4.0.0); the README's Breaking Changes table has its `_next release_` row; surface re-baselined `c8b70ee`

## Now
- W5, the owner's calls (2026-11-25: "fix items 1"): ✅ F2 `opt-level = "s"` (`e4ca7db`); ✅ offsets and words
  (`a0e24ed`: offset differences 234 → 56, words 9 → 2); ✅ efficiency items 5 and 6 (`a7e7d48`, `no_std` fix
  `c0771fd`); ✅ item 7, a 32-byte `Instr` (`6373cb9`); item 9 (lazy per-function decode) KEPT for more testing
  (open-work.md W5)
- Toolchains (owner, 2026-11-24): gnu on both OSes, the same versions — stable 1.100.0 (the MSRV, `rust-version`)
  and `nightly-2026-11-04` (pinned in `rust-toolchain.toml` and release.yml, the default); gnullvm dropped. Never
  changed unasked (working-rules.md)
- Move-out (2026-11-27, Tooling rule 15): everything of wasmrt's that lived only on this machine is in the project
  folder — the memory-folder note (working-rules.md, and `cmem/local/environment.md`), a load-phase table
  (`cmem/local/measurements/`), six Linux review scripts (`cmem/local/review-scripts/`). What stays behind (the
  shared cargo target dir, the WSL toolchains and Miri sysroot) and how to rebuild it: `cmem/local/environment.md`
- Workspace letters: C50, C51 (to wazmrt, unanswered); C52 (to binaryang) ANSWERED 2026-11-27 (open-work.md R1)

## Review
- The 3.0.0 release review over `v2.0.2..f17127e`: `Review complete: 52034dc` (review-issues.md, gitignored).
  W5's commits are not yet reviewed: the next release's review covers them
- Open issues: none at or above the floor; recorded notes not acted on are in review-issues.md and open-work.md

## Next
1. W5 item 9: test lazy decode further (larger modules, how much of a module runs), then the owner's call
2. R1 / C52: count binaryang's four D1 spellings as a MATCH, then close C52 — on the owner's word
3. `interop.md` (split 2026-11-25 into 12 files): ⏳ wazmrt mirrors it (R6); the §3.7 limits rows after C50
4. `bun scripts/check-cmem.ts`: review-issues.md (gitignored) has 44 lines over 200 characters

## Waiting on owner
- item 9's testing and call; R1's close; wazmrt's answer to C50 and its mirror of C51

## Read next
- open-work.md: the open list
- review-issues.md (gitignored): the review log
