# STATE: wasmrt

Updated: 2026-11-24, at the end of the session (the review's fixes and the toolchain move committed, not pushed)

## Version
- Released: 2.0.2 on 2026-11-20 (UTC); tag `v2.0.2`, crates.io; first published by CI
- Working branch: `main`, ahead of `origin/main`; the next release is a MAJOR, 3.0.0 (unreleased: CHANGELOG
  `[Unreleased]`)

## Now
- 3.0.0's content committed: wasmtime's implementation limits (the measured-needed set, owner 2026-11-24), every
  decode refusal in wasmtime's words and offsets (I11–I14), the efficiency review's fixes (calls 3.1× faster, memory
  roughly halved), the CLI's safe writes, and `pin`'s OS file lock on its DB
- Toolchains (owner, 2026-11-24): gnu on both OSes, the same versions — stable 1.100.0 (the MSRV, `rust-version`)
  and `nightly-2026-11-04` (pinned in `rust-toolchain.toml` and release.yml, the default); gnullvm dropped
  (platforms.md, architecture.md)
- W2 (the old review stages T9–T12) performed and closed 2026-11-24; W4 (the cargo token) revoked
- Workspace letters: C50 committed (48afb6e) and H42's wasmrt answer committed (b668926) in the workspace repo,
  not pushed

## Review
- Run for: `820669f..HEAD` (owner, 2026-11-24: "review"); the re-review came back EMPTY in every class
- Fixed after it, NOT re-reviewed by the five classes: its minor notes (lock symlink, read-only lock, 0600 temp, a
  taken temp name), the MSRV and toolchain move — verified by tests on both platforms; the release's review covers
  them, so no `Review complete:` line is written
- Open issues: none at or above the floor; recorded notes not acted on are in review-issues.md

## Next
1. The release review for 3.0.0, then the release (the owner's word)
2. The owner's open calls: F2 (opt-level speed vs size), the remaining efficiency items, merging decode with validation
3. `interop.md` (187 KB; co-owned with wazmrt): agree one split; the §3.7 limits rows after wazmrt answers C50

## Waiting on owner
- the workspace repo's push; the calls in Next 2

## Read next
- open-work.md: the open list
- review-issues.md (gitignored): the review log
