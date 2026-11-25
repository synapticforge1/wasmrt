# STATE: wasmrt

Updated: 2026-11-25, releasing 3.0.0 (owner: "release 3.0.0") — notes merged; the bump and CI run follow

## Version
- Released: 2.0.2 on 2026-11-20 (UTC); tag `v2.0.2`, crates.io; first published by CI
- Being released: 3.0.0, a MAJOR — the release review complete, the notes merged (CHANGELOG `[3.0.0]`, release.md
  entry); next `bump.ts major`, `release.ts`, CI's tag / page / publish, then the read-back as a user (release.md)

## Now
- 3.0.0's content: wasmtime's implementation limits (the measured-needed set, owner 2026-11-24); decode and
  validation refusals in wasmtime's words, almost always at its offset (wasmparser 0.263's); one-pass load (`module::parse` /
  `Parsed::validate` / `decode_validated`); the efficiency review (function calls ~3× faster, memory roughly halved); the
  CLI's safe writes (temp + rename, a new file's usual mode) and `pin`'s OS lock; the C ABI store guard
- Toolchains (owner, 2026-11-24): gnu on both OSes, the same versions — stable 1.100.0 (the MSRV, `rust-version`)
  and `nightly-2026-11-04` (pinned in `rust-toolchain.toml` and release.yml, the default); gnullvm dropped
- Measured for 3.0.0 against 2.0.2 built the same way: CLI 915,968 B (+8.3%), DLL 583,680 B (+8.9%); cold start
  3.2–3.9 ms (4.1–4.4), steady 192–223 Mops/s (166–181); no corpus module changes verdict
- W2 performed and closed 2026-11-24; W4 (the cargo token) revoked
- Workspace letters: C50 (48afb6e) and H42's wasmrt answer (b668926) committed in the workspace repo, not pushed

## Review
- The 3.0.0 release review over `v2.0.2..f17127e`: five classes in order (basic R1 — a new file 0600 on Unix;
  licensing L1 — README's component count; notes), fixed; re-review 1 found the DB read through the unresolved
  path, fixed; re-review 2 EMPTY; the full suite green on win-x64 and linux-x64. `Review complete:` at the notes
  commit (review-issues.md, gitignored)
- Open issues: none at or above the floor; recorded notes not acted on are in review-issues.md and open-work.md

## Next
1. Finish the 3.0.0 release: bump, `release.ts`, CI, the read-back, the released surface (releasing.md steps 5–9)
2. The owner's open calls: F2 (opt-level speed vs size), the remaining efficiency items; the 234 offset differences
   left (end-of-file offsets, module-level refusals without an offset)
3. `interop.md` (187 KB; co-owned with wazmrt): agree one split; the §3.7 limits rows after wazmrt answers C50
4. W6: the C ABI linker has the store's old re-entry shape (open-work.md)

## Waiting on owner
- the workspace repo's push; the calls in Next 2

## Read next
- open-work.md: the open list
- review-issues.md (gitignored): the review log
