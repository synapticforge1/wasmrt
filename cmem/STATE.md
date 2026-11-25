# STATE: wasmrt

Updated: 2026-11-25, at the end of the session (the C ABI store guard committed, not pushed)

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
- One-pass load (owner, 2026-11-24: "merge the decoding with validation"): `module::parse` / `Parsed::validate` /
  `decode_validated` decode each body an instruction at a time, validating as they read, as wasmtime; the CLI, C
  ABI and .wast runner use it. Validation refusals in wasmtime's words (`validate::last_failure_message`). On 4,000
  corruptions: wasmtime's offset 3,056 -> 3,165, its words too 2,964 -> 3,156
- C ABI store guard (2026-11-25): a host callback calling back into its own store (or deleting it) is refused —
  "the store is in use" — where it was undefined behaviour (Miri-proved); the store's contents are in a RefCell
- W2 (the old review stages T9–T12) performed and closed 2026-11-24; W4 (the cargo token) revoked
- Workspace letters: C50 committed (48afb6e) and H42's wasmrt answer committed (b668926) in the workspace repo,
  not pushed

## Review
- Run for: `820669f..9d71704` (owner, 2026-11-24: "review"); the re-review came back EMPTY in every class
- Fixed after it, NOT re-reviewed by the five classes: its minor notes (lock symlink, read-only lock, 0600 temp, a
  taken temp name), the MSRV and toolchain move — verified by tests on both platforms
- Run for: the one-pass load and the wording (0358c4f..HEAD; owner: "yes"): five classes, B1 B2 H1 L1 fixed, the
  re-review EMPTY in every class, the full suite green on win-x64 and linux-x64
- Run for: the C ABI store guard (owner, 2026-11-25: "review"): five classes EMPTY, header notes fixed and
  re-reviewed EMPTY, the full suite green on both platforms
- The `Review complete:` line stays at 820669f: the items above that were tested but not reviewed are in the tree,
  so the 3.0.0 release review covers the whole range
- Open issues: none at or above the floor; recorded notes not acted on are in review-issues.md

## Next
1. The release review for 3.0.0, then the release (the owner's word)
2. The owner's open calls: F2 (opt-level speed vs size), the remaining efficiency items; the 234 offset differences
   left (end-of-file offsets, module-level refusals without an offset)
3. `interop.md` (187 KB; co-owned with wazmrt): agree one split; the §3.7 limits rows after wazmrt answers C50

## Waiting on owner
- the workspace repo's push; the calls in Next 2

## Read next
- open-work.md: the open list
- review-issues.md (gitignored): the review log
