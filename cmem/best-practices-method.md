# Best practices 6–8 — robustness, references, working method

wasmrt's own lessons, sections 6–8 and § 8.x. Last verified: 2026-11-20. Split out on 2026-11-20 (memory guide, letter H38); the
sections below are moved verbatim.

## 6. Robustness on untrusted input

### 6.1 Anything keyed by an attacker-controlled count must be O(n log n), not O(n²)

Rec-group interning uses a `BTreeMap`, not a scan over previously-seen keys: group counts come from the
module, so a scan is a denial of service **on the decoder**. `alloc`'s `BTreeMap` needs no dependency and
no hasher.

### 6.2 Decode must be total

Canonicalisation encodes an out-of-range forward reference as a distinct **sentinel** rather than
erroring, so the decoder never fails or panics there and the bad index stays the validator's to report.
Totality on hostile input is worth an odd-looking branch.

### 6.3 Say what you did not do

`NOSYS`, not a silent success, for `fd_allocate`, `fd_filestat_set_times`, `path_filestat_set_times` and
the socket calls. A guest that needs them must learn we did not do them.

---

## 7. Reference projects

### 7.1 "wasmtime's SHAPE, our code"

Adopt the architecture; write the implementation. No code, no symbols, no headers, no data structures
transcribed. Three applications: the `wasmrt.h` surface (T8), the shared store (T7b), the engine-level
type registry (T9h). **The Component Ledger stays empty** — the "evaluate a reference project" trigger
requires an entry for *copying or porting* code, and reading an architecture is free.

**The compliance test:** each borrow visibly **diverges** where wasmrt's constraints differ — checked
value handles instead of refcounted objects, the `code`/`pools` split for disjoint borrows, zero
dependencies, `forbid(unsafe_code)`. A design that cannot be re-derived under those constraints was
being copied rather than understood.

---

## 8. Working method

### 8.1 Do not `git checkout <file>` to remove a temporary edit

It discards *all* uncommitted work in that file. Doing this to drop a debug probe destroyed a completed
canonicalisation implementation, which then had to be rewritten. Delete the added block, or stash.

### 8.1a Do not run `perl -pi -e` with a replacement containing `$` or `@`

In a Perl replacement, `$'` is the **postmatch variable** — everything after the match. A one-line
substitution meant to add an enum variant documented as ``` `id ::= '$' idchar+` ``` instead spliced
the entire remainder of the file into the middle of the enum, ~100 junk lines. Rust is full of `$`
(macros, and any prose about `.wat` identifiers), so this is not a rare shape.

**Apply:** use the `Edit` tool for any replacement text containing `$`, `@`, or a backslash. **`@` bites
as often as `$`** and did so three more times in one session: `@as(u64, 0)` became `(u64, 0)` in a Zig
test, and two commit hashes written `wazmrt@4a6d745` lost the `@4`/`@1` and shipped as `wazmrta6d745`.
Each was caught by a build error or a re-read — but a mangled hash in a doc is exactly the kind of thing
that is not caught. When a
bulk edit *is* right, prefer a pattern with none of them. And if this does go wrong, **repair — do not
`git checkout`** (§8.1): the corruption was a contiguous, identifiable span, and splicing it out
preserved the rest of the pass.

### 8.2 Report faithfully, including the direction of an error

When a measurement moves the wrong way, say so and say by how much. When a number is inside the noise,
say "unchanged", not "improved". When an earlier note is superseded by a better measurement — the
"residual: 1 assertion" that turned out to be ~40 — record the correction where the old number lived.


### 8.3 🏁 "BAKE OFF" vs. "ISSUE" — a NOTATION rule, because the two are different kinds of work

🔒 **Owner, 2026-08-19: make the distinction visible in the notation.** The two look alike in a task
list and behave nothing alike, and mixing them makes the fix queue look permanently non-empty.

| | **ISSUE** — a fix task | **BAKE-OFF** — a compare task |
| --- | --- | --- |
| what it does | **changes the code** | **measures it against something else** |
| notation | `[ ]` → `[x]`, an entry in `known-issues.md` | 🏁 **never a checkbox**; a dated row in a measurements table |
| when it is scheduled | when a **gap** is found | when a **number** is wanted |
| what "done" means | ✅ **closed** — the defect is gone | ⚠️ **there is no done.** It is *measured on a date*, and the measurement decays |
| how it is reported | fixed / open / won't-fix, with a reason | **value + date + configuration**, never a checkmark |
| external dependencies | must not need any | ⚠️ **the only kind that legitimately pulls rivals, other trees and foreign harnesses in** |

**The rules that follow from it:**

1. ⚠️ **NEVER put a compare task in the fix queue.** *A compare task can never be finished* — rivals
   ship new versions, corpora grow, and the machine changes underneath, so its residuals regenerate by
   construction. Parked in a fix list it reads as permanent unfinished work and quietly devalues every
   real `[ ]` beside it.
2. **Never mark one ✅ DONE.** Write *"measured 2026-08-19: X"*. A bake-off row without a **date and a
   configuration** is worse than no row, because a stale number reads as current — and this project has
   already been bitten by a size figure that matched a ceiling to the byte because it was reading
   yesterday's artifact.
3. ⚠️⚠️ **A bake-off is the ONLY task type that may reach outside the repo**, which makes it the one to
   watch in a project whose invariant is **zero third-party dependencies**. Its harness, its rivals and
   its corpora all live *outside* the shipped artifact, and nothing it needs may leak into one.
4. **Sort work by what it CHANGES before sorting it by priority.** That is the whole rule in one line.
5. **A comparison is evidence, never a target.** ⚠️ A contract row, an invariant or a design choice must
   never be justified by *"the other one is faster/smaller"* — that is what `interop.md` §0 puts
   performance and size out of scope for. **A bake-off tells you where you stand; it does not tell you
   what to build.**

**Applied here:** **T11** holds both kinds and they are now labelled as such — the optimization review
is an ISSUE-shaped fix task that ends, while the **same-machine comparison against wasm3 / WAMR /
wazmrt is a 🏁 BAKE-OFF** that is scheduled when a number is wanted and never closes. The competitor's
published head-to-head figures (`vision.md`) are a 🏁 row too: dated, configuration-bound, **and not
adoptable as ours**.

*(Borrowed method — wazmrt reclassified its own bake-off out of its work queue on 2026-08-18 for exactly
this reason, and the reclassification is what made its remaining fix list read honestly.)*

---

## §8.4 — **VERIFYING THE PREMISE OF AN OPTION IS NOT VERIFYING THE OPTION** (2026-09-17)

The era-pinned `proposals/threads/` assertions were decided on 2026-08-20: **refresh the vendored
snapshot**, chosen over an explained baseline entry and over deleting the file, and chosen *after* the
premise was checked against data already on disk — the core `imports.wast` in the same checkout has 0
"multiple memories" assertions, the threads snapshot has 6. That check was real and the conclusion "the
snapshot is behind" is true.

**It is also not the claim the option needed.** "Behind CORE" is not "a newer snapshot exists". The sync
to upstream `65a43d2e` **did not touch `proposals/threads/` at all** — upstream's own threads snapshot
carries the same stale assertions — so there is nothing to refresh to, and the decision is a **no-op**.

🎓 **Check the premise the ACTION depends on, not the premise the diagnosis depends on.** The diagnosis
("the test is old, the engine is right") was correct and remains correct. The action assumed a second
fact — that someone upstream had already fixed it — and nobody tested that, because the first check felt
like it had settled the matter. ⚠️ **A decision recorded as 🔒 DECIDED is exactly the kind that stops
being re-measured**, which is §5.8's scope-note trap wearing a decision's clothes.

## §8.1b — ~~**LINE ENDINGS ARE NOT UNIFORM WITHIN THIS REPO**~~ → **SETTLED BY A RULE (2026-09-20)**

🔒 **Superseded as a coping rule, kept as the evidence.** Line endings are now **LF everywhere, which
is git's own canonical form** — `gitattributes(5)` normalizes to LF in the index on checkin and only
*may* render CRLF on checkout. `.gitattributes` carries `* text=auto eol=lf`,
`crates/wasmrt-core/tests/line_endings.rs` fails any `cargo test` run on a CR in a text file, and
`scripts/eol-gate.ts` adds `--fix` plus an index scan. Scripts match on `\n` and write `\n`; the
"handle both" branch below is no longer needed and should not be re-added. Detail and the
measurement: `design-decisions.md`, "TOOLING RULES" §3.

🎓 **The general form of this, worth more than the endings themselves:** the fix that ends a class of
defect is usually **a rule plus a trigger**, not more care. "Handle both endings" is care — it must
be remembered at every call site, by everyone, forever. "The repository holds exactly one ending, and
a test fails if it does not" is a rule, and it is checked by something that does not get tired.
⚠️ Note which half of the old entry SURVIVED: every scripted edit still asserts its own application,
because that one guards against a different failure — the pattern being wrong for any reason at all.

🎓 **Why it was worth a rule rather than more care.** The split was never a decision: the index held
**LF for all 111 text files**, and the working tree's 12 CRLF files were simply the ones git had
last checked out on a host whose *system* gitconfig sets `core.autocrlf=true`. So the endings of a
given file changed with history, not with content — the worst shape for a pattern-matching edit,
because it is invisible and non-reproducible. ⚠️ **The second half of the old rule survives intact:
every scripted edit still asserts its own application**, since a no-op edit followed by a passing
test remains indistinguishable from a real one.

*The original entry, and what it cost:*

Three scripted edits in one session silently matched nothing: `crates/wasmrt-core/src/module.rs` is
**CRLF** and `crates/wasmrt-core/src/wat.rs` is **LF**, and a pattern containing `\n` matches only
the second. A fourth failed differently — `sed 's/…&mut r)/…/'` died on "invalid back reference".

Each time, the edit reported success and the rebuild "passed". ⚠️ **A no-op edit followed by a
passing test is indistinguishable from a correct edit followed by a passing test** — which is
§5.4c/§8.1a's lesson arriving through a new door. Two of these were *mutation* tests, where a silent
no-op means the mutation never happened and the gate never proved anything.

🔒 The practice that caught all four: **every scripted edit asserts its own application** — the
replacement throws `MUTATION DID NOT APPLY` when the text did not change, and prints the byte delta
when it did. Cheap, and it converts a silent wrong result into a loud stop.

