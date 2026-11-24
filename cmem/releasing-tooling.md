# Releasing — the tooling

How the release scripts and the workflow work, and how they got their shape. Last verified: 2026-11-20. Split out on 2026-11-20 (memory guide, letter H38); the
sections below are moved verbatim.

## Tooling

- 🆕 **2026-11-19 — CI only publishes (workspace letter H37 (e)).** `checks` lost the toolchain
  install, `cargo-public-api` / `cargo-semver-checks` and the gate; it keeps the credential-free
  clone, the version read, Bun (pinned by sha256) and `github-release.ts state`. `tag`, `release`
  and `publish` are unchanged; `publish` still installs the pinned nightly to package. Rehearsal of
  the changed workflow (best-practices 7.22): ✅ the first `none` push (owner: "push", 2026-11-19),
  commit `80891c6`, run 44642273945: `checks` green in all four steps, `tag` / `release` / `publish` skipped. The
  bullet below describes the 2026-11-12 shape.

- 🆕 **`.github/workflows/release.yml` — the owner's order, in CI (2026-11-12; workspace letter H33,
  decisions D1 and D2).** It runs on every push of `main` (no longer on a tag), with top-level
  `permissions: {}` and **no `uses:`** at all. `checks` (`contents: read`, a credential-free clone) asks
  `github-release.ts state` whether this push is a release (`new`: the version has no tag; `rerun`: its
  tag is on this commit; `none`: elsewhere), installs the toolchain and runs **`bun scripts/gate.ts`**
  (`--release` unless `none`) — the same list `release.ts` runs locally. Only for a release: `tag`
  (`contents: write`, no checkout) makes CI's annotated tag; `release` (`contents: write`, no checkout)
  makes the page from it; `publish` (`id-token: write`, `contents: read`) runs `scripts/crates-io.ts`:
  `has` → `token` (GitHub OIDC → a short-lived crates.io token) → `publish` (core, capi, CLI, each
  skipped if listed; `--no-verify`, nothing built) → `revoke` (always) → `readback` (all three, not
  yanked, FATAL). **Pins (U9):** Rust `nightly-2026-11-04`, refused unless `rustc -V` names
  `708c94ef0` (the nightly 2.0.1 was built on; CI's pin only — the local `rust-toolchain.toml` still
  floats, a T11 question); `cargo-public-api` 0.52.0 and `cargo-semver-checks` 0.51.0 `--locked`; Bun
  1.4.4 by sha256 (checked against Bun's `SHASUMS256.txt` 2026-11-12). Concurrency: one group per
  commit, never cancelled. **Measured `cargo public-api` follows `RUSTUP_TOOLCHAIN`** (2026-11-12: it
  built with the 2026-10-21 nightly when told to), so `surface.ts` now names the ACTIVE toolchain
  (`rustc -V`, identical locally to the old `rustup run nightly`).
  - 🔒 **Branch scope (owner, 2026-11-12, on review finding N1: "we will keep the current setup"):**
    the trusted publisher names the repository and `release.yml`, not a branch or an environment;
    what limits publishing to `main` is the workflow's `main`-only trigger and who can push.
  - 🔑 **Owner setting — SET (owner, 2026-11-12: "trusted publisher is already set"):** on crates.io, a **trusted publisher** on
    EACH of `wasmrt-core`, `wasmrt-capi` and `wasmrt` — repository `synapticforge1/wasmrt`, workflow
    `release.yml`, no environment. Then the workstation's `cargo login` token can be revoked. Without
    it, `publish` fails at `token` with "is a trusted publisher … configured" AFTER the tag and page:
    set it, then "Re-run failed jobs" (no new version needed).
  - **Rehearsed 2026-11-12 (best-practices 7.22), in a scratch clone behind a scratch bare origin:**
    the whole gate (12 steps; 606 / 0 / 1 tests) green; `bump.ts patch` refused a dirty tree, then
    floor PATCH ×3, v2.0.1's tests 70 / 0, the `bump to v2.0.2` commit (two files); `release.ts
    --dry-run` passed every guard and `gate.ts --release` (15 steps), pushed nothing; refusals shown
    for an extra commit, an untracked file, a CR (the gate stops at `eol`) and a missing entry.
    `cargo publish --workspace --dry-run` at an UNPUBLISHED 2.0.2 packages all three (per-crate
    `-p wasmrt-capi --dry-run` cannot: it resolves core from crates.io — hence the workspace form in
    `checks` and the per-crate form, as 2.0.1 ran it, in `publish`). The scripts against the REAL
    APIs, read-only: crates.io `has`/`readback` on 2.0.1 (listed, served) and 2.0.2 (missing ×3);
    GitHub `state` new / rerun / none, `tag` and `page --dry-run` on v2.0.1 (found, nothing written).
    The workflow's own shell (version, toolchain check, tag peel) 7 / 7 with negatives. **Not
    rehearsable here:** the OIDC exchange (needs a runner and the owner's setting) and the Linux
    `checks` run — the first push of this change measures the latter with `state=none`, before any
    release depends on it.
  - 🔁 **Review round 1 (2026-11-12) changed this flow** — `known-issues.md` R1–R15: `state` checks
    what a tag claims (R4), crates are matched by provenance (R5), the review clause is fixed (R3),
    per-version concurrency (R11), time limits (R14). Self-tests then 44 / 44 / 37 (today's: `testing.md`, top); the numbers just
    below are the first version's.
  - **Self-tests (each inverted by mutants, 2026-11-12):** `check-github-release.ts` 34 checks (+ `state`
    and `tag`; 8 mutants caught), `check-crates-io.ts` 36 (mock registry + OIDC + a fake cargo; 11
    mutants — one survived first, the exchange's status check, until a case gave an error status a
    token), `check-release-record.ts` 22 (9 mutants — two survived first, the version prefix and the
    later-section guard, until cases aimed at them). `prev-tag-tests.ts` inverted by a committed mutant
    (guest exit codes ignored → RED, 6 failures) with HEAD's copy of the catching test deleted, proving
    the TAG's tests ran; control green 70 / 0.
- **The release page (2026-11-09; workspace letters H30 and H32): no `gh`.** Until then the page was
  made by `gh release create --verify-tag`. Now `scripts/github-release.ts` (Bun, `fetch`, REST API)
  makes it, keeping H32's order: (0) the CHANGELOG has a non-empty `## [X.Y.Z]` section, checked before
  any request; (1) the tag exists on GitHub and peels, with annotated tags followed, to `GITHUB_SHA`
  (`POST /releases` would otherwise CREATE a missing tag); (2) a page already there means done, with no
  write, so a re-run is safe; (3) POST, then read the page back (the tag, not a draft) and peel the tag
  again. Each request has a 30 s limit, body included. The page is the same as before: the CHANGELOG
  heading as the title and the section as the body. No generated notes, and no
  `generate_release_notes`, which is the one place wasmrt departs from H32's recipe: the CHANGELOG is
  the release note. *(Jobs until 2026-11-12: `compatibility-gate` then `github-release`, on a tag push;
  now the page is `github-release.ts page` in the `release` job above, keyed on `VERSION`.)* **The
  self-test** (as of 2026-11-09; 34 checks since 2026-11-12) is `bun scripts/check-github-release.ts`: a
  `node:http` mock API, 17 checks. Missing, other-commit or annotated-other tags are refused with no POST; a
  CHANGELOG with no section or an empty one is refused with no request at all; the cases also cover an
  existing page, a lightweight and an annotated create (with the POST body checked), POST 422, a
  read-back draft, a tag moved after the POST, a dry run, no token, a non-`vX.Y.Z` tag, an unknown
  argument and a stalled API. **Inverted 2026-11-09** by six one-line mutants, each caught only by its
  own case or cases. They removed the sha check, the existing-page stop, the time limit, the
  empty-section refusal, the draft read-back check and the re-peel. **Real GitHub, read-only
  `--dry-run`, 2026-11-09:** `v2.0.0` at `1715139` peels and finds its page (exit 0, no write); the same
  tag given `v1.0.0`'s commit is refused. ✅ **Measured on GitHub Actions by 2.0.1** (run 42724412211):
  the page's `author.login` is `github-actions[bot]` (§ Status). Owner, 2026-11-09: only new tags get pages; nothing is backfilled.
- 🏢 **The org move does not touch publishing (workspace letter H20, recorded 2026-10-23).** H20 exists
  because a registry's trusted-publishing (OIDC) policy is locked to the GitHub owner and repository
  **IDs**, and the move to `synapticforge1` changed the owner ID (nuget.org refused loader-dotnet's
  next publish). Through 2.0.1 wasmrt published with the owner's **API token**, with no OIDC policy,
  so nothing is pinned to the old ID. **CI publishing through crates.io trusted publishing is adopted
  (2026-11-12): create the trusted publisher under `synapticforge1/wasmrt`, never the old owner.**
  crates.io shows the corrected `repository` field (`synapticforge1/wasmrt`, fixed 2026-10-23) from
  the next publish.
- *(Retired 2026-11-12: the `cargo-release` / `release-plz` suggestions of 2026-07-27 — the release
  is now `bump.ts` + `release.ts` + the workflow above.)*

