# Versioning — the version ladder

How wasmrt's versions were numbered: the port-progress ladder, then the gate. Last verified: 2026-11-20. Split out on 2026-11-20 (memory guide, letter H38); the
sections below are moved verbatim.

## Versioning = port-progress ladder (owner decision)

The destination is fixed and known: **a complete runtime, small and fast enough to be chosen.** The
version number measures how far wasmrt has climbed toward it and reflects what genuinely runs and passes
its gate — never inflated to signal the effort's maturity (that story is told by `ROADMAP.md`'s use-case
matrix + a fast cadence).

*Through T9 the destination was phrased as "the completed, frozen `wazmrt` oracle". **Retired 2026-08-11
(owner)** — see the 1.0 entry below.*

- `0.x` — in progress; each release lands one gated stage.
- `1.0.0` — 🆕 **RE-CUT 2026-08-19 (owner): the CONFORMANCE CLEAR-OUT.** The spec corpus driven to
  **zero failures, zero skips, zero unrun files**, an **empty baseline**, and **zero deliberate spec
  deviations**. This is a specific deliverable, not a summary of the phases before it — and it brings the
  proposals the corpus contains into scope (custom-descriptors/`exact`, table64, wide-arithmetic,
  custom-page-sizes, custom-annotations, memory64-imports, legacy `delegate`). WASI p2/p3 and the
  component model stay out. Task **T13** in `archive/roadmap-to-2.0.2.md`.
- After `1.0.0` — **`2.0.0`** (owner, 2026-10-24: the `exact`-type correction is major by the
  gate), then the four review phases, in this order: T9 hardening, T10 bug hunt + code hygiene, T11
  optimization review, T12 security review, **each numbered by the gate** *(they were pre-assigned
  `1.0.1`–`1.0.4` until 2026-10-24)*. ⚠️ **The API stability promise starts at `1.0.0`**, so the C ABI and `wasmrt-core`
  surfaces freeze when the clear-out ships — a proposal added at 1.0.0 may add a `wasmrt_feature_t`
  value, which is additive and keeps `abi_version() == 1`; anything that is not additive must land
  BEFORE 1.0.0 or wait for 2.0.
- *(Superseded: `1.0.0` previously meant "complete on wasmrt's own terms — every in-scope proposal
  implemented, conformance at its achievable ceiling, C ABI stable, size/speed measured and defended".
  That reading made 1.0 a judgement call; the clear-out makes it a number.)* 🔒 **The wazmrt oracle was retired as the 1.0 criterion on
  2026-08-11 (owner)** — the two runtimes now compete independently for inclusion in wasmtk and the
  universalWasmLoader-\* runtimes, so parity with a competitor is neither the goal nor a meaningful gate.
- Pre-1.0 the public API (both `wasmrt-core` and `wasmrt.h`) is **unstable** — breaking changes bump the
  minor (`0.y`), which is the SemVer compatibility unit below 1.0. Expect frequent `0.y` bumps until T8.

🔒 **THE NUMBER IS SemVer 2.0.0, AND A GATE SETS ITS FLOOR (workspace letter H6, adopted 2026-10-24).**
`bun scripts/bump.ts patch|minor|major` is the only way the version moves. It computes the FLOOR since
the last release from three diffs and refuses a bump below it, printing what set it:

- **diff: surface** — tool: `bun scripts/surface.ts` (`surface/released.txt` → the tree) · shows: the Rust `pub` API
  of `wasmrt-core` and `wasmrt-capi` (`cargo public-api -s`), `wasmrt.h` (prototypes without parameter names,
  typedefs, struct bodies, `#define`s, enum members WITH ordinals), and `--help`'s usage shapes and flag spellings
- **diff: semver** — tool: `cargo semver-checks --baseline-rev <last tag>` · shows: Rust breaks a line diff calls
  additions: a variant added to an exhaustive enum, a field added to a constructible struct, a lost auto trait
- **diff: behaviour** — tool: `bun scripts/carry-forward.ts <last tag> WORKTREE` (S1, step 1c) · shows: a module the release ACCEPTED that the tree refuses

Anything removed, changed, retyped or "accepting less" (even when correct) → **major**; only additions →
**minor**; nothing → **patch**. **Pre-1.0 (rule 6), a minor may carry a major floor**, but the README's
`### ⚠️ Breaking Changes` table must have a `_next release_` row, or the bump is refused. A bump resets
the lower components. **The surface files obey two rules:** `surface/current.txt` must equal the
sources (`bun scripts/surface.ts --check`), and an intended change is re-baselined with `--update` **in
its own commit, with the reason, never in the bump commit** (rule 5); after the release commit is
tagged, `bun scripts/surface.ts --release-from vX.Y.Z` records it as `surface/released.txt`, again its
own commit. Tools: `cargo-public-api` 0.52.0 and `cargo-semver-checks` 0.51.0 (installed with
`cargo binstall`), on the nightly toolchain. ⚠️ rustdoc output moves with the nightly, so each surface
file records its tools; when they differ, `bump.ts` regenerates the released surface from the tag
itself rather than trust the file.

✅ **Inverted 2026-10-24.** The C/CLI readers on 17 mutations: a removed prototype, a retyped parameter,
a struct field added, two enum members swapped, `WASMRT_ABI_VERSION` 1 → 2, a renamed or removed flag
and a changed usage shape each give MAJOR; an added prototype, an appended enum member and an added
flag give minor; a renamed parameter (also inside a callback type), re-indentation, a changed comment
and a reworded description give nothing. End to end: an unrecorded header change fails `--check` and
the bump; `bump patch` from 0.9.0 is refused (floor MAJOR: 54 surface lines removed or changed, 8
semver lints, 6 accepted → refused); `bump minor` is refused without the Breaking Changes row and
allowed with it (0.9.0 → 0.10.0); `--verify-tag` refuses a tag the manifest does not carry and a
re-tag of the last release; an argument that is not a bump kind is refused (exit 2).

⚠️ **What the gate cannot see, said plainly:**
- **Exit codes and parseable output** beyond `--help`'s syntax: the `interop.md` contract rows carry
  those, and the CLI tests pin them.
- **Rule 3's "previous tag's tests against the new source"**: 🆕 **wired 2026-11-12** —
  `scripts/prev-tag-tests.ts` (the last release's `crates/*/tests/` and `tests/` over this tree; run by
  `bump.ts` for a patch or a minor, and by every `gate.ts`, which skips it when the version is a major
  past that release). Unit tests live inside `src/` and are not carried. The behaviour equivalent
  (step 1c, S1–S3) stays. *(Until 2026-11-12 this line said "not wired".)* **Consumers' suites**:
  rsxtk is the named consumer and does not link wasmrt yet.
- **Behaviour the S1 corpus does not contain** (§4.13): S3 over wasmtk's corpus is the wide net.

*(Retired 2026-10-24 by H6: the cadence rule that "the patch component stays a single digit" — a
`0.y.z` line ran `z = 0…9` and the release after `0.y.9` was `0.(y+1).0`. Under SemVer the number says
what changed, not how many slices a line has held, so `0.y.10` is legal and a gate decides the
component. The rule is why the 0.6 line closed at v0.6.9 and the next release was 0.7.0.)*

**Stage → version map** (the ladder lives in `ROADMAP.md`; the port tasks in `archive/roadmap-to-2.0.2.md`) — *shifted by
one from 0.8 onward when the 0.6 line filled up; T6 and the T4 completion then shipped together in 0.7.0*:
0.1 T0 scaffold · 0.2 T1 types+reader · 0.3 T2 opcode · 0.4 T3 decode · 0.5 T4 validate (core) ·
0.6.x T5 interp (patch per feature slice, 0.6.0–0.6.9) · **0.7 T6 text toolchain + T4 completion (the deferred SIMD/atomics/GC/EH typing arms)** ·
0.8 T7 wasi+cli · 0.9 T8 C-ABI · 🆕 **1.0.0 T13 conformance clear-out** · **2.0.0 the `exact`-type correction** ·
then T9 hardening · T10 bug hunt + code hygiene · T11 optimization review · T12 security review, numbered by the
gate.

🆕 **RE-CUT 2026-08-19 (owner).** The `0.10`–`0.13` rungs are gone: T9–T12 became the `1.0.x` line and a
new task, **T13 — the conformance clear-out — takes `1.0.0` and runs FIRST**. ⚠️ **T-numbers are
identifiers, not an order** (they are cited across every `cmem/` file), so the order is **T13 → T9 → T10
→ T11 → T12** while the names stay put. ⚠️ **Under SemVer (above) these numbers are a PLAN, not a
promise**: if a stage's diff sets a minor or major floor, the gate overrides the ladder and the map
shifts. (The next release from 0.9.0 has a MAJOR floor, which `1.0.0` satisfies.)

*(T10, T11 and T12 added by the owner 2026-08-06.)*

