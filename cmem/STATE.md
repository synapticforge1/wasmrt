# STATE: wasmrt

Updated: 2026-11-24, at the end of the session (the 3.0.0 work committed, not pushed)

## Version
- Released: 2.0.2 on 2026-11-20 (UTC); tag `v2.0.2`, crates.io; first published by CI
- Working branch: `main`, ahead of `origin/main`; the next release is a MAJOR, 3.0.0 (unreleased: CHANGELOG
  `[Unreleased]`)

## Now
- 3.0.0's content committed: wasmtime's implementation limits (the measured-needed set, owner 2026-11-24), every
  decode refusal in wasmtime's words and offsets (I11–I14), the efficiency review's fixes (calls 3.1× faster, memory
  roughly halved), the CLI's safe writes and pin lock
- W2 (the old review stages T9–T12) performed and closed 2026-11-24; W4 (the cargo token) revoked
- Workspace letter C50 (to wazmrt: features, limits, wording) written, uncommitted in the workspace repo

## Review
- Run for: W2's five-class review, the efficiency review first; COMPLETE 2026-11-24 on win-x64 and linux-x64
- The below-floor notes it recorded were then fixed at the owner's direction ("fix the below threshold items, then
  commit") and verified by tests on both platforms, NOT re-reviewed by the five classes — the release's review covers them
- Open issues: none at or above the floor (review-issues.md)

## Next
1. The release review for 3.0.0, then the release (the owner's word)
2. The owner's open calls: F2 (opt-level speed vs size), the remaining efficiency items, merging decode with validation
3. `interop.md` (187 KB; co-owned with wazmrt): agree one split; the §3.7 limits rows after wazmrt answers C50

## Waiting on owner
- push; the workspace commit of C50; the calls in Next 2

## Read next
- open-work.md: the open list
- review-issues.md (gitignored): the review log
