# Working rules — wasmrt's standing rules

The rules every session follows, in the present tense. Last verified: 2026-11-20. History of how a rule
changed: [design-decisions.md](design-decisions.md); the tooling rules: [tooling-rules.md](tooling-rules.md).

## Session start (owner, 2026-10-26; letters H41, H42)

> **At session start, and before each new work item, read `../workspace/cmem/workspace-correspondence.md`**
> (one line per open item) and open `../workspace/cmem/letters/<ID>.md` for every item addressed to
> wasmrt or touching what you will change (🔒 owner, 2026-10-26; letters H41, H42). Answer by
> appending ONE bullet under the item's `## Answers` — the one write a project makes outside its repo;
> only the item's creator closes it. Nothing is written into this repo from outside (owner, 2026-09-20).

## Owner commands: "commit", "push", "release" (owner, 2026-11-10)

🔒 Written into every project by the workspace session on the owner's direction (2026-11-10:
"please write that into each project"; workspace `cmem/working-rules.md` Tooling rule 12, letter
H34). When the owner says:

- **"commit"** — first run "update the project memory files" (re-derive this repo's `cmem/` from
  its current state), then commit to the branch being worked on. Nothing is pushed.
- **"push"** — perform "commit", then merge the branch into `main`, then push `main` (and the
  working branch) to GitHub (`origin`) and read it back with `git ls-remote`.
- **"release"** — perform "push", then the release process: the workspace's
  `cmem/release-process.md` §§ 5–8 — the review set and every gate run LOCALLY first (H37; CI no
  longer tests), then CI verifies the version and pushes the tag, then the GitHub
  Release page from the tag, then the publish to the registry — recorded in `cmem/release.md`
  § "Release History" (newest first, a summary of what changed). The level (patch / minor /
  major) is the owner's: ask if it was not given.

Each command includes the one before it, and none goes further than its own word (a "commit"
never pushes, a "push" never releases). This repo's own gate and merge rules apply at each step.

**The review words** (🔒 owner, 2026-11-17; letter H37, replacing H35's three): **"review"** runs
all five required classes — basic, hardening, licensing, security, privacy — in one fix-and-verify
loop; **"basic review"**, **"hardening review"**, **"licensing review"**, **"security review"**,
**"privacy review"** run that class alone; **"efficiency review"** is optional and runs first. The
process: workspace `../workspace/cmem/review-process.md`; wasmrt's slots in
[review-process.md](review-process.md). None commits, pushes or releases. 🔒 **"release" needs a
complete "review" first** — `release.ts` refuses unless `review-issues.md` says
`Review complete: <commit>` and nothing reviewed has changed since (`review-gate.ts`); the flow:
[releasing.md](releasing.md).

## Triggers (binding on every agent)

### "Update the project memory"

1. Fold the decisions, findings and state into the matching topic files; refresh their line in the
   table below; absolute dates; update entries rather than duplicate.
2. ⚠️ **AUDIT for stale LIVE claims, not just the files you touched**: grep the OLD values, classify
   each hit as live (fix) or dated (leave; mark it superseded if it claims to be current). When two
   files disagree, **measure**; do not pick the newer. Re-read "by design" / "out of scope" lines when
   a track closes.
3. Sync `README.md` only where the change is user-relevant.
4. 🔒 Scan the diff and the message for anything private (`design-decisions.md`, "PRIVACY"), then
   **commit and push** (`origin` = github.com/synapticforge1/wasmrt).

### 🤝 "Coordinate" (owner, 2026-08-19) — wasmrt ⇄ wazmrt through [interop.md](interop.md)

**Regime A is in force: wazmrt holds the pen**; wasmrt mirrors its copy, measures, objects, and
contributes findings as an UNNUMBERED annex. **Regime B** (each side numbers its changes; the two
reconcile at the END of each `1.0.x` stage) begins when wasmrt reaches `1.0.1`. A version is a PIN,
not a LOCK. Release lockstep ended at v33; the rows and the mirror rule did not.

1. Read `interop.md` first: the only file either project may treat as binding on the other.
2. **Byte-compare the two copies.** A difference means the contract is unknown until reconciled; an
   unadopted proposal is a normal in-flight state, but never binding.
3. **Verify a row by RUNNING both runtimes, never by reading either.** An ⬜ UNVERIFIED row is not
   quoted as agreed.
4. 🔒 Scope: the CLI options and the security checks only. Reading the sibling to verify a row is
   expected; reading it to adopt a design is not; performance and size are out (that is the contest).
5. **Record what you found in THIS copy, with date and evidence.** Under regime A as an annex (the
   pen holder numbers it on fold-in); under regime B with a version bump and a change-log row.
6. A disagreement is an OBSERVATION until its cause is traced; neither runtime is the oracle.
7. 🔒🔒 **Commit and push only this repo. Never write into the sibling's tree**, its `interop.md`
   included, unless the owner directs it that time; propose instead, and let its session commit it.

⚠️ **The inverse binds too: coordinate BEFORE shipping a change to a contract surface** — any CLI
option, any security check (pin, WASI rights, `--dir`/`--ro-dir`, the guest environment), any resource
ceiling, any exit code. A change shipped without it is how the two stop being swappable, silently.

### "Evaluate a reference project"

Before adapting code from any reference project ([reference-projects.md](reference-projects.md)),
complete an Adoption Checklist in `third_party/LICENSES.md`, add a Component Ledger entry, and update
`reference-projects.md`. Looking is free; porting always needs the ledger entry.

### "Look for code issues"

Audit tested AND untested paths: stale workarounds; dead code (grep-verified: the C ABI reaches
symbols too); bugs; and **fall-throughs (worst)**, a placeholder where an error belongs. Report
`file:line` + severity, fix the safe ones, and **diff the OUTPUT counts, not exit codes**.

### "Reflect a shipped stage"

At every release: the per-release checklist in [releasing.md](releasing.md), docs and memory
committed BEFORE the publish handoff.

## Rules that bite in the first five minutes (full text: below and [tooling-rules.md](tooling-rules.md))

- 🔒 **PROVE, DO NOT ASSUME** (owner, 2026-09-19): every claim that leaves the session — a report, a
  commit message, a `cmem/` entry, a test's expected value — is measured first, or said to be
  unmeasured.
- 🔒🔒 **Never write into a sibling's tree** (its source, its `cmem/`, its `interop.md`) unless the
  owner directs it that time. Reading is free.
- 🔒 **Nothing is pushed, published or tagged unless the owner says so.**
- 🔒 **PRIVACY — this repo is public.** No secrets, no machine-specific detail (a user profile, a
  project-tree location, even a bare drive letter saying where something lives); one maintainer email,
  in `Cargo.toml` `authors` and as the commit author/committer only (owner, 2026-10-26); machine facts in the gitignored `cmem/local/`. Scan the staged diff
  AND the message before every commit.
- 🔒 **Tooling:** committed scripts are TypeScript run by **Bun** (`node:` builtins only; no Deno APIs,
  no Python); a one-time script may be shell and is deleted after use; **never a heredoc** — write the
  file, then run it; prefer the `Edit` tool, and check every scripted edit applied.
- 🔒 **Line endings are LF everywhere** (`.gitattributes`; `cargo test` fails on a CR).
- ⚠️ cargo's target directory is not `./target` on every host: ask `cargo metadata`
  (`scripts/target-dir.ts`). Run `cargo test` from either shell; all tests pass from both.
- 🔑 **History was rewritten on 2026-10-23 and 2026-10-24**: an old commit id is looked up in
  `cmem/archive/history-map-2026-10-23.md`, then `cmem/archive/history-map-2026-10-24.md`.

## 🔒 PROVE, DO NOT ASSUME (owner, 2026-09-19)

> *"new rule. do not guess or assume, prove or validate before acting."*

**Binding on every claim that leaves this session** — a report, a commit message, a `cmem/` entry, a
contract row, a test's expected value. If it has not been measured, run it; if it cannot be run, say
which it is. The rule was written after three misses in one day, and the shape of each is worth
keeping because none of them felt like a guess at the time:

- **what was asserted: "Bun is written in Zig"** — what it actually was: true at a training cutoff, **false since
  2026-05-14** — and then defended with `process.versions` and a string count, which measure the TOOLCHAIN, not the
  language (§2.5)
- what was asserted: `walk(link, follow)` returns `NOTCAPABLE` — what it actually was: it returns **`NOENT`** —
  an absolute symlink target is re-rooted at the preopen, so the guessed errno went into a test that then failed
- **what was asserted: "the probe returns in under 10s" as a proxy for "it did not allocate 4 GiB"** — what it
  actually was: measured **0.111s** alone, but the assertion **failed under the parallel harness** — it measured the
  machine, not the code (§5.4f)

🎓 **The rule is cheap to follow and the violations are expensive**: each of the three cost more time
to unpick than the measurement would have taken — one command each. The three shapes to watch:
**a fact from training** (verify against the source's own record), **a value inside a test** (run the
code and read the answer before asserting it), and **a proxy for the property you actually mean**
(assert the property, or measure it directly and record the number).

## 🔒 PRIVACY — nothing machine-specific, secret or personal is public (owner, 2026-10-22 / 23 / 24)

*Recorded 2026-10-24 for workspace letter H22; the canonical text is the workspace's
`working-rules.md` § Records. This repo is PUBLIC (GitHub `"visibility": "public"`, checked
2026-10-24), so every committed file, every commit message, every published crate and every issue
is public. Only the gitignored `cmem/local/` is private.*

**The path test is "is it MACHINE-SPECIFIC?", not "is it absolute?"** (owner, 2026-10-23):

* **Not public:** anything that records the owner's own machine layout — a user profile
  (`<drive>:\Users\<name>\…`), the drive and folder the project tree sits in, other drives, scoop or
  AppData installs, scratchpad or session ids. 🆕 **A bare drive LETTER counts** when it says where
  something lives on this machine ("the build drive is `X:`"), and so do the volume's health query
  and the names of tools installed on it (owner, 2026-10-24: the second history rewrite removed
  exactly these).
* **Fine:** repo- or sibling-relative paths (`../wasmtk/…`), environment variables, placeholders, and
  a CONVENTION path that names nothing about one machine and works on any comparable host
  (`/etc/wasmtk/pins`, `C:\ProgramData\wasmtk\pins`, a fixed cache directory). Grammar examples in
  code and docs (`C:/p`, `x:/`, `\\srv\share`) are fine too.
* **A scan hit is a CANDIDATE**, judged by that test: do not scrub convention paths.

**The rest of the same rule:**

* **No secrets** (tokens, keys, passwords). A leaked secret is rotated, not just deleted.
* **Email — the one exception is the maintainer contact address** (🔒 owner, 2026-10-26, workspace
  letter H28; was a wasmrt-only waiver 2026-10-23 / 24, now the workspace rule). It may appear in
  exactly three places: the manifest field the registry reads (`Cargo.toml` `[workspace.package]
  authors`), the git commit author/committer address (noreply is fine too), and ONE committed
  `cmem/` note that names the maintainer contact. wasmrt uses the first two and keeps no such note;
  nowhere else, and never repeated through `cmem/`.
* **Machine facts** (drives, filesystems, paths, installed tools) go in `cmem/local/environment.md`.
* **Scan before every commit, and before every push of memory**: the staged diff AND the message,
  for drive letters used as locations, user names, tool or agent names, emails and paths. **Scan
  binaries too** (workspace, 2026-10-26: committed `.wasm` in two siblings carried drive paths in
  DWARF through every `git grep -I` scan): run the pattern with `git grep -a` as well. ⚠️ When
  you edit a long existing line, re-read all of it: re-committing old text is adding it (how the
  2026-10-24 finding happened).
* **History counts.** A detail already pushed is removed from history too, by an owner-approved
  rewrite (`archive/history-map-2026-10-23.md`, `archive/history-map-2026-10-24.md`). GitHub can still serve old
  commits by id until its garbage collection; a full purge is a GitHub Support request.


## Scratch space and caches (owner, 2026-11-19; letter H43; workspace Tooling rule 15)

The rule in full: `../workspace/cmem/tooling-rules.md` rule 15. For wasmrt:

- Throwaway files go in the session's own scratchpad only, never in a tracked file's path list. Budget 200 MB;
  announce anything larger first (a WSL review clone is ~900 MB once built) and remove it when the step ends.
- Delete each item when it is cleared: a one-time script after its run, a reproducer or clone when its finding
  is verified, a reviewer's folder (always under the main scratchpad) at triage. Nothing lives only there.
- "commit" ends with an empty scratchpad: delete what was written there before the memory update.
- Caches outside the repo (the cargo target dir, the WSL Rust install, test temp folders) are listed with their
  limits in the gitignored `cmem/local/environment.md`; rust-analyzer's temp copies go when the editor closes.
- Never sweep another session's folder or another project's cache.

## Session end (memory guide, letter H38)

1. Rewrite `cmem/STATE.md`. 2. Move items closed this session to `cmem/archive/`. 3. Record decisions in
`design-decisions.md`, rules here. 4. Empty the scratchpad. 5. Run `bun scripts/check-cmem.ts` and fix what it reports.

## Memory-guide limits: the recorded exceptions (letter H38)

- `interop.md` (187 KB, 115 lines over 200): held as it is. It is a byte-identical mirror of wazmrt's copy
  (regime A: wazmrt holds the pen), so it is split or wrapped only there; who owns the file is the owner's
  call (the guide: "name one owner"). wazmrt holds its copy the same way.
- `best-practices-shared.md` line 114 (201 characters): the workspace's ★ rules, copied unchanged under
  their stamp (owner, 2026-11-19: keep the ★ copy as it is).
- Every other live note holds the limits: `bun scripts/check-cmem.ts` reports only these.
