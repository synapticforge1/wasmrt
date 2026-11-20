# Best practices 4 — checks and gates

wasmrt's own lessons, section 4 and its later § 4.x entries. Last verified: 2026-11-20. Split out on 2026-11-20 (memory guide, letter H38); the
sections below are moved verbatim.

## 4. Checks and gates

### 4.1 A gate that cannot fail is decoration

`if ( cd "$WAZ" && zig build test ) 2>&1 | tail -20; then` tests the exit status of `tail`, which always
succeeds. The oracle monitor reported `tests: GREEN` regardless of what the build did — and it
underwrote every parity claim in the port. **Verify that a gate fails when it should**, by breaking the
thing it guards.

### 4.1a A comparison gate's "agree" must count only what it COMPARED

`scripts/custom-sections-diff.ts` (2026-09-19) scored a file both tools refused as agreement — reasonable
for a corpus with known-bad files, and fatal for a probe: **two of my own probes were malformed, both
tools refused them, and the gate reported "7/7 agree" having compared no bytes at all**. The headline
now reads *"N compared byte-for-byte and agree, M refused by both, K differ"*. 🎓 An outcome that does
not exercise the property is not a pass, whatever the ratio says — the same shape as a skip folded into
a pass (§5.5).

### 4.2 Mutation-verify any check that matters

Delete the check, confirm the test fails, restore. Done for: the C-ABI store-tag check, `Op::MemorySize`
routing, the sandbox `..` guard, and the cross-store `InstanceId` check. A test that passes both with
and without the code it covers is not a test.

### 4.2a Confirm the MUTATION applied before believing the mutation test

Mutation-verifying the T9a#8 emitter sweep, a `perl -pi -e` substitution silently failed to match, the
test passed, and the obvious reading was "the sweep is decoration" — the §4.1 finding, apparently
confirmed. It was not: re-doing the mutation with `sed` and **grepping to confirm the line was gone**
made the test fail and name all four affected ops exactly.

A no-op mutation and a worthless check produce **the same observation**: an edit, and a green test.

**Apply:** after mutating, `grep` for the thing you removed and assert it is gone. Only then read the
test result. And note which direction this error runs — it manufactures false *"my check is useless"*
verdicts, which cost a good check rather than shipping a bad one, but the wasted work is real and the
temptation is to delete the check.

### 4.2b A gate you PORT is a gate you must re-prove can fail

Porting the four gates to TypeScript (2026-09-19) meant every check this project trusts was
rewritten in an afternoon. "It prints the same thing today" proves only that both agree on inputs
that pass — which is the half that cannot catch a regression. `conformance-diff`'s own header
records two holes that entered exactly this way.

So each port was driven to FAIL: the conformance gate on all three regression shapes (lost passes,
more failures, a clean file that starts failing) plus an honest improvement, with byte-identical
output AND exit status; the custom-sections gate over the full 535-file corpus, then against a
**fake assembler that strips custom sections**, which it must report as a difference.

**Apply:** a rewrite, a refactor or a port of a check is not done when it agrees on green inputs.
Feed it the failure it exists to catch, and compare the OLD and NEW verdicts on that input.

### 4.3 A guard placed one call-level away from the iteration it guards is NO check

The type-use clause-order rule was first written in `parse_sig` and moved **one** assertion out of
forty, because `parse_block_type` calls `parse_sig` **one clause at a time** — so the order state was
built and destroyed per clause and could never observe a sequence. The code read as correct. Only the
measurement said otherwise.

### 4.4 A check that is harmless "because that case cannot occur" becomes a bug the moment it can

The T8 third-order lesson. Fixing dropped table initializers made non-nullable element types expressible
for the first time, which exposed that the active-element check compared *families* with nullability
normalised away.

### 4.5 A blanket skip is not a neutral placeholder — it insures the code it covers

`assert_unlinkable` was an unconditional skip, justified by a reason obsolete since T7b. While it sat
there, **nothing had ever checked that a badly-typed import is refused** — and imports turned out to
have no link-time type checking at all. **Apply:** any assertion category declined wholesale must carry
a note saying what would be measured if it stopped being declined.

### 4.6 Which direction to err in is a property of the CONSEQUENCE, not a house style

Two undecidable comparisons, opposite calls, both measured:
- **Cross-store function-import matching** → err toward **refusing**. Accepting binds a call to a
  mismatched signature: a silent wrong call.
- **Declared subtyping** → err toward **accepting**. Refusing turned away 6 valid modules; accepting
  only preserved behaviour that already existed.

Decide from what happens when you are wrong, then measure both ways if you can.

### 4.6a Tightening what the grammar PERMITS is the same error as accepting what it forbids

Four probes of the lexer's character handling all looked like defects; **three were**. The fourth — a
control byte inside a `;;` comment — is legal, because `linechar ::= c:char (if c ≠ U+0A)` admits
anything but a newline. Fixing "all four" would have rejected valid `.wat`, and the only thing that
separated them was reading the production rather than pattern-matching on "control character = bad".

The corresponding gate: when tightening a *parser*, the measurement that matters is not the suite but
the **corpus of things that must still parse** — the 534-file `.wat` corpus, checked on both sides, and
**round-tripped through decode**, not merely assembled (§1.5a). A tightening that improves the suite and
drops a corpus file has not made the parser more correct.

**Apply:** for each rule you are about to add, quote the production it comes from. A rule you cannot
cite is a guess, and half the guesses here were wrong. Then pin the *negative* case with a test — this
pass has one asserting a control byte in a comment stays accepted, so a later "cleanup" cannot quietly
extend the rule to where it does not belong.

### 4.7 Prefer a hard `Err(Unsupported*)` over silent-wrong

Standing since T4. An unhandled input that emits a stub or a placeholder is the worst category in the
"look for code issues" trigger. Deferred features reject **loudly**.

### 4.8 A library must reject a module, never abort the embedder

`v128.const i64x2` fell into an `unreachable!()` and aborted the whole conformance run. Under
`panic = "abort"` in the release profile, **any reachable panic is a host-process kill**. Decode and
validate must be *total* on hostile input: prefer a sentinel the next stage will reject over a panic, and
prefer an error over both.

---

### 4.10 Parsing a flag proves it was ACCEPTED — only the path that honours it proves it was APPLIED

Three defects in one review (2026-09-19), all in the same hours-old code, all on the VERIFICATION
flags: `wast s.wast --verify enforce` parsed the flag and dropped it; the bare-path `.wast` form
rebuilt an argv and re-parsed it, discarding everything before the path; and `--` was consumed
without being remembered, so the word after it was still matched against export names. Every one
exited **0**.

⚠️ **A security flag that is accepted and dropped is worse than one that is rejected.** A rejected
flag sends the operator to the manual; a dropped one leaves them with evidence — a clean exit — that
the policy applied. The shape to look for: a value parsed in one function and consumed in another,
with a path between them that rebuilds, re-parses or reconstructs the arguments.

**Apply:** for every flag, test the SPELLINGS, not the flag — before the path and after it, in each
run mode that accepts it, and through the bare-path form as well as the subcommand. Assert the
EFFECT (a refusal, a changed exit status, a different argv), never that the flag was accepted.
🎓 The day's own tests passed throughout, because each exercised the one spelling its feature was
built with.

### 4.1b A guard that is COMPUTED and never CONSULTED is not a guard

`Walk::final_is_symlink` was set on every walk, carried in the struct, documented in the type — and
read by **nothing but a test**. `path_open` then handed the unresolved path to the OS, which follows
a final symlink whatever the guest asked for, and a link inside a preopen pointing anywhere on the
host opened its target. A **sandbox escape**, sitting behind a field written specifically to prevent
it (2026-09-19; `known-issues.md`).

It is §4.1 one step earlier: a gate that cannot fail is decoration, and this one could not even run.
The field read as a guard to every reviewer — including the one who wrote the code — because the
name and the doc comment described the check, and only the call graph says whether it happens.

**Apply:** a computed safety value must have a consumer in the same commit, and the cheap way to
check is to grep the field name and look at what is NOT a test. `cargo`'s dead-code warning does not
fire on a `pub` field of a `pub` struct, so the compiler will not tell you.

### 4.9 One ceiling covering TWO paths needs a check on each — one passing test hides the other's absence

The iteration budget (T9i) bounds non-termination. A guest can run forever two ways, and they share
nothing: a **loop back-edge**, and a **tail-call hop** — which reuses the interpreter's frame by
design, so it makes no backward branch and grows no call depth. The call-depth ceiling cannot see it
either.

⚠️ **Each tick is invisible to the other's test.** Mutation-verified both ways: delete the back-edge
tick and `(loop (br 0))` runs forever while the tail-call test still passes; delete the tail-call
tick and `(func $f (return_call $f))` runs forever while the loop test still passes. A single
"runaway guest is stopped" test would have passed with either half missing.

**Apply:** when one limit is meant to cover several mechanisms, enumerate the mechanisms and pin each
separately. The one to look for is the mechanism that is *cheap by design* — a tail call, a reused
buffer, an elided frame — because the thing that makes it efficient is usually the thing that makes
it invisible to the counter.

## §4.14 — **A PROPERTY ASSERTED IN A DOC COMMENT IS NOT A CHECK** (2026-09-17)

*(Numbered §4.4 until 2026-10-24, when it was renumbered because §4.4 also named an earlier rule; workspace letter H2.)*

`features::op_feature` maps an opcode to the proposal that gates it. Its doc comment said:

> **One authority.** Every gate in the validator reads this table, so an instruction cannot be gated in
> one place and forgotten in another — and a new opcode added to `opcode` shows up here as an explicit
> decision rather than silently defaulting to "always allowed", **because the match below is exhaustive
> over `Op`**.

**The match ends in `_ => return None`.** It is not exhaustive and never was, so a new opcode does not
show up as a decision — it silently becomes "WebAssembly 1.0, cannot be gated", which for a proposal
instruction means **UNREFUSABLE**. Track W's four wide-arithmetic ops landed exactly that way: wired
through decoder, assembler, validator and interpreter, and switchable by no flag. Measured afterwards as
**182 ungated ops without the gate arm, 178 with it.**

🎓 **The comment is worse than nothing, because it is the reason nobody looks.** A reviewer who reads
"exhaustive over `Op`" and then adds an op has been told the compiler will catch the omission. `Op` had
248 of 256 discriminants assigned; nobody was going to count.

**What to do instead — pin the property with DATA:**
* Enumerate the thing (`Op::ALL`, generated by the same macro that defines the enum, so it cannot drift).
* Assert the *set* or the *count* of items that fall through. Adding one then either satisfies the
  property or produces a visible, deliberate diff.
* Where the safe direction is asymmetric, say which: an item wrongly *in* the ungated set is
  unrefusable, which is the direction that cannot be noticed afterwards.

⚠️ **The same shape, two hours later, in the same feature.** The proposal list has **three** spellings —
the Rust `Feature` enum, `Features`' struct fields, and `wasmrt_feature_t` + `feature_of` in the C ABI.
`WideArithmetic` reached the first two. Nothing compared them, so it was switchable in-process and **not
through the C ABI** — gated at one entry point of two, which is precisely what X3's "gated at BOTH module
entry points" exists to prevent. T10b had predicted this and the prediction was not yet a test. It is
now: `set`/`has` must round-trip for every member, the count is fixed, and the newest feature must be
LAST because the C integers are frozen.

🔒 **Corollary for `cmem/` itself.** This file, `design-decisions.md` and every `///` block are prose.
None of them can fail a build. When a note claims a property the code enforces, either the enforcement is
findable as a test — name it in the note — or the note is a hypothesis, and §1's rule applies to it like
any other.

## §4.15 — **A CLEAN FILE HAS NO ROW, SO IT CANNOT LOSE A PASS** (2026-09-17)

*(Numbered §4.5 until 2026-10-24, when it was renumbered because §4.5 also named an earlier rule; workspace letter H2.)*

`scripts/conformance-diff.ts` enforces this project's central rule, *no file lost a pass*. Its header
already records two holes closed the hard way (keying on basenames; iterating only baseline rows). **This
is the third, and it is their sibling:** the runner printed a file's row only when it had failures or
skips, so a **clean** file had no recorded pass count at all — and passes it later lost to **skips** were
invisible.

X1 landed squarely in it. `custom-page-sizes/memory_max.wast` went **2 passed → 0 passed / 6 skipped**
and the gate printed *"no file lost a pass"*. Two files were reported; four were affected. Printing a row
for every file — 288 rows — makes the join total, and the same gate then found all four.

🎓 **A gate can be sound on the rows it has and blind to the rows it does not have.** Ask what the
instrument *omits*, not only what it gets wrong: the two earlier holes were about comparing rows badly,
this one was about a row that was never written. All three had the same symptom — a green verdict.

⚠️ **And it happens in throwaway tooling too, within the same session.** A shell probe table comparing
segment spellings against wasmtime used `wasmrt <file> && echo OK` as its oracle. `wasmrt <file>` prints
`validation FAILED` and **exits 0**, so the table reported four forms as accepted that the engine was
refusing. *A gate you build for yourself, five minutes before trusting it, is still a gate.* Check that
it can fail before reading its output.

## §4.11 — **A CONTRACT ROW VERIFIED ON PARSING IS NOT VERIFIED** (2026-09-20)

`interop.md`'s `--features` row read *DONE · both vocabularies resolve, same seeding, same layering
refusals, must come before the module path*. Every word of that was measured and true. The flag was
nevertheless **applied by one of the three CLI paths that judge a module**: `wasmrt run --features mvp
simd.wasm f` ran the module and printed its answer, while the sibling runtime refused the identical
command line. The row was verified on how the flag PARSES, which is the half that is easy to compare.

🔒 Verify a flag row by asserting on **what the command did** — the verdict, the exit status, the
output — in every position and on every path the flag claims to govern. §4.10 said *test the
spellings*; this adds: **and test the PATHS**.

## §4.13 — **A CORPUS OF ONE MODULE PER FEATURE MISSES THE CORE EVERYONE USES** (2026-10-23)

**The defect that bought it.** The S1 behaviour corpus held one minimal module per PROPOSAL, judged
under 38 configurations. The validator then refused every active function-index ELEMENT SEGMENT with
function-references off: `--features mvp` refused ordinary compiled programs. S1 passed, because no
per-proposal module contains an element segment; nothing about function tables is a proposal. S3,
over wasmtk's real modules, found it at once: 661 accepted → refused, all one cause.

🔒 **A behaviour corpus needs the plain WebAssembly 1.0 shapes real programs are made of** (a function
table, an element segment, `call_indirect`, a mutable global, data), not only the edges each feature
adds. And the wide, real-world net (S3) earns its place by finding what the designed corpus could
not. Run it before trusting the narrow one.

🎓 Proof the fix to the corpus was real: with the defect put back, S1 now reports 57 accepted →
refused on its own.

## §4.12 — **A GATE THAT FINDS ITS INPUT BY PATH CAN TEST A STALE ARTIFACT** (2026-10-23)

**The defect that bought it.** Five gate scripts found the binary they test at
`<repo>/target/release`. cargo on this host builds to a different directory (set in cargo's own
config), and `<repo>/target` still held a September build. The scripts still RAN and still
PASSED, against a five-week-old binary. Worst was `c-gate.ts`: it BUILT a fresh static library,
which went to the real target directory, then LINKED the stale one from `<repo>/target`. The day
the stale directory was deleted, the gate failed for a reason it had been hiding: today's `std`
needs `-lsynchronization` and `-ldbghelp`, which its hand-kept link list lacked. Every C user
linking the current library needs them too, and nothing had said so.

🔒 **A gate must locate its input the way the BUILD does, not where it is usually found.** Ask the
build tool (`cargo metadata` → `target_directory`; `--print native-static-libs` for link
dependencies). A remembered path is a second, silent copy of a fact the tool already knows,
the same drift §1.9 names for grammars.

🎓 **"It passed" says nothing about WHICH artifact passed.** The tell was a timestamp: a "fresh"
release binary dated the previous month. Look at the input's date before believing the verdict.
Deleting a stale cache can turn a quiet pass into a loud failure. Do it on purpose.

