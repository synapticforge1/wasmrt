# INDEX: wasmrt

Read STATE.md first. Open another file only when the task matches its line.

- [working-rules.md](working-rules.md): before the first command of a session; owner commands, triggers
- [tooling-rules.md](tooling-rules.md): before writing a script or a scripted edit
- [open-work.md](open-work.md): when choosing the next item or picking one up
- [design-decisions.md](design-decisions.md): when a change touches a recorded decision or an invariant
- [architecture.md](architecture.md): when working in an unfamiliar part of the engine
- [testing.md](testing.md): before running or adding tests or gates
- [security-model.md](security-model.md): when touching WASI, the pin gate or the ceilings
- [interop.md](interop.md): only to "coordinate" with wazmrt (a mirror of wazmrt's copy); it lists its 11 parts
  (`interop-*.md`), each section by number
- [shared-definitions.md](shared-definitions.md): when touching binaryang's D1/D2/D3 or `tables.rs`
- [loaders.md](loaders.md): when changing what the loaders call (`wasmrt.h`)
- [release.md](release.md): only when releasing; every release, newest first
- [releasing.md](releasing.md): the release checklist; [releasing-tooling.md](releasing-tooling.md): its scripts
- [versioning.md](versioning.md): when a version number is in question
- [review-process.md](review-process.md): only during a review; `review-issues.md` is gitignored
- [platforms.md](platforms.md): when a change is platform-specific
- [best-practices.md](best-practices.md): before a task; it routes to the lesson files by subject
- [known-issues.md](known-issues.md): when a defect looks familiar; [divergences.md](divergences.md)
- [overview.md](overview.md), [vision.md](vision.md): what wasmrt is; the size and speed contest
- [licensing.md](licensing.md), [reference-projects.md](reference-projects.md): before borrowing code
- [archive/](archive/): do not read unless the owner asks about past work (old commit ids: history maps)
- `local/`: gitignored machine facts; never given to a reviewer
