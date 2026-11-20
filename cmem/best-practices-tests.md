# Best practices 5 — tests

wasmrt's own lessons, section 5 and its later § 5.x entries. Last verified: 2026-11-20. Split out on 2026-11-20 (memory guide, letter H38); the
sections below are moved verbatim.

## 5. Tests

### 5.1 Assert where a check STOPS working, not only where it starts

`decode_body` requires a terminating `end` but does **not** model nesting, so `block … end` with the
function's own `end` missing still passes it. A test pins that boundary, so the limitation is visible in
the tests instead of being discovered by someone trusting the error's name.

### 5.2 Every existing test asserted that the module RUNS — so defects that run were invisible

All three emitter defects produced modules that ran. Assertions about behaviour cannot catch a module
that is subtly *not the module you wrote*. That is why T10a specifies a **round-trip property test**
(assemble → decode → compare against what the parser recorded) rather than more behavioural tests.

### 5.3 Our own fixtures were malformed modules, and nothing could say so

Four hand-built vectors put the export section after code; one declared a function section with no code
section. They had always been malformed. **A permissive checker lets bad fixtures accumulate, and they
then encode the wrong rule** — so tightening a checker will break your own tests first, and that is a
finding, not an obstacle.

### 5.4 Key a test on the flag that carries the meaning, not on an incidental symptom

The const-expr sweep must key on a segment's **mode**: a *passive* segment has no offset expression,
while an *active* one with none is malformed. Filtering on `is_empty()` conflates them and excuses the
second. The test is written so the sloppy version fails.

### 5.4a An invalid-module test must be invalid for exactly ONE reason

`tests/value-type-encodings.wast` asserted a `select (result (ref $s))` over `(ref null $s)` operands
INVALID. Mutating the validator to type every concrete result as nullable — which should make that module
valid — **failed nothing**, because the function's own result was also `(ref $s)`: the module stayed invalid
for a second, untouched reason. The assertion was true and tested nothing.
**Apply:** in an `assert_invalid`, make everything except the construct under test maximally permissive
(nullable results, supertypes, `unreachable` operands), then mutation-verify — a surviving mutation on an
invalid-module test usually means the module is invalid twice.

### 5.4b Two independent implementations agreeing is a HYPOTHESIS until one command compares them

`security-model.md` §3a predicted that the two runtimes' `.wat` digests might diverge, because the
digest is of the **assembled** bytes and the assemblers are independent — and it said to make that a
TEST rather than an assumption. Run over 535 files, **529 differed**. The cause was then diagnosed in
one more command: wazmrt's digest equals ours with custom sections stripped, so we emit a `name`
section and they do not.

The mirror of §3.8b: there, two components that learned a convention from *each other* agreed and were
both wrong. Here, two implementations of the same spec disagreed, and only a differential check could
see it — neither side is wrong alone, and neither could find it alone.
**Apply:** when a security or interop property depends on two implementations producing the same
bytes, compare the bytes in CI, over a corpus, not on one hand-picked file. The tiny file agreed; the
529 real ones did not.

### 5.4c A test that needs a SPECIFIC failure must change the OUTCOME, not just the message

`tests/descriptor-casts.wast` asserted `assert_trap … "null descriptor reference"`. It passed with
the null-descriptor check **deleted** — because this runner (like wazmrt's) treats any trap as
satisfying `assert_trap` and never compares the message. The assertion read as specific and was not.

✅ Fixed by building cases whose RESULT differs: a null descriptor with a null value on a nullable
target would otherwise *succeed*, and a `br_on_cast_desc_eq_fail` would otherwise *branch*. Both
mutations are now caught.

🔁 *2026-10-24:* the runner itself now compares the message (§5.10), which found 54 wrong traps
across the spec suite that this rule's per-test workaround could not reach.

**Apply:** know what your harness actually compares. If it ignores the error text, an assertion that
only names the text is decoration (§4.1) — find an input where the wrong behaviour produces a
different value, exit status or control flow, and assert that instead.

### 5.4d A FEATURE FLAG is part of a test's input — a harness that ignores it scores a different question

The core `br_on_cast.wast` asserts a module INVALID; `proposals/custom-descriptors/br_on_cast.wast`
asserts the same module VALID. Both are right: custom-descriptors *relaxes* the rule. The runner ran
every file with every feature enabled, so one of the two was wrong **by construction**, and no amount
of engine work could fix it — the suite was being asked a question the files were not written
against.

✅ Fixed by `wast::features_for_script`: the standardized language, plus the one proposal a
`proposals/<name>/` directory tests, which is what canonical runners do.

**Apply:** when a corpus contains the same construct under different feature sets, the feature set is
an INPUT to every assertion in it. Two files disagreeing is a clue to check the harness before
suspecting either file — and a proposal that *relaxes* an existing rule is the case that produces
this, because it makes previously-invalid modules valid rather than adding new syntax.

### 5.4e A fixture must be able to take the path it is testing

The `--` regression test used one module that both exported `_start` (with a WASI import, to report
its own argc) and exported `status`. It failed on the *unmutated* build: calling an export wires
**no imports at all**, so the module could not be instantiated down the very path the second half of
the test was checking. The fixture was impossible, not the code.

**Apply:** when one test distinguishes two run modes, check that the fixture is valid in BOTH —
different modes wire different things (imports, memory, a start function), and a fixture built for
one can be uninstantiable in the other. A test that fails on correct code is cheap to spot; the
same mistake in the other direction — a fixture that can only take one path, asserted as if it took
both — passes forever.

### 5.4f A wall-clock assertion in a parallel test runner measures the MACHINE

The fix for "`random_get` allocates and fills 4 GiB before bounds-checking the destination" was
pinned with `assert!(elapsed < 10s)` as a proxy for "it did not do the work". It **passed alone and
failed in the suite**: five guest-spawning tests run concurrently, so the clock was reading the
machine's load. Measured directly afterwards, the probe answers FAULT in **0.111s**.

**Apply:** assert the PROPERTY, not a timing proxy for it. When only a proxy exists, measure the
real number once, record it in the comment, and leave the behavioural assertion (here: the errno) as
the test — a flaky gate gets disabled, and then it guards nothing. See also §1.6: benchmarks belong
in a same-session A/B/A, never in an assertion.

### 5.5 Skips are never folded into passes

A construct the build cannot put to the test is not a pass. Skips are counted separately so the
conformance number cannot be inflated by what we do not handle. Equally: distinguish "nothing defines
this" (a real verdict) from "we cannot back this kind" (a gap) — collapsing them is what made
`assert_unlinkable` unimplementable.

### 5.5a 🔒 Read the skip column to RANK; work the FAILURE column to FIX

**Borrowed from wazmrt, and measured here before adopting (owner, 2026-08-19):** *"fixing the failures
first cleared a lot of the skips."*

Probed against our own corpus rather than agreed with, and it holds: of 930 cascade skips, **739 (79%)
sit in files that also carry failures**, and only 191 sit in files with none. `exact-casts.wast` has
**3 failures, 108 skips and zero capability gaps** — all 108 clear when the 3 are fixed.

⚠️ **This is the inverse of §5.6 and both are true, because they answer different questions.** §5.6
says a failure count *undercounts* a defect whose symptom is a skip — so **rank** with the skip column.
This says a failure is a root you can act on while a cascade is not actionable until its root moves —
so **fix** down the failure column. Reading one rule as contradicting the other is how a work-list ends
up ordered by neither.

🔻 **The residue is the part that matters, and it is where the biggest item hides.** After the failure
pass, what remains is *by construction* the skips no failure could reach — here, 160 of the surviving
191 are one item (the externref/anyref bridge) across four files with **zero failures between them**.
**A failures-first order is a sequencing rule, not a claim that the skip column is derivative** — so
the second phase is mandatory, and it is re-measured, never carried over from the first estimate.

### 5.6 🎓 A number the report cannot ATTRIBUTE is not a measurement

**Bought by (2026-08-19):** "1,024 skipped" was printed in every conformance summary for the whole
port, and it was **unscopeable**. Two holes, both in the *instrument*:

1. The runner printed a per-file line only when `failed > 0`. **234 of 1,024 skips lived in files that
   produced no output at all** — `ref_test.wast` (68 skips), `ref_cast.wast` (42), both
   `br_on_cast*.wast` (27 each) had **never once appeared in a conformance report**.
2. A skip was a bare counter at all twenty skip sites, so even a *listed* file could not say why.

Adding a reason to every skip showed that **928 of 1,024 (91%) were cascades** — assertions stranded
behind a module that never built — and that only **96** were real gaps, resolving to **seven items**.
One of them (the externref/anyref bridge) accounted for ~176 assertions across five files.

**The rules, and they generalise past conformance:**

- **A count with no cause cannot be ranked.** Planning off the skip column would have put a 108-skip
  cascade *above* the single root that produces it. Rank by cause, and rank by **assertions unblocked**.
- **A report that lists only the loud category cannot scope the quiet one.** `failed > 0` is a
  perfectly sensible filter for reading failures and a total blind spot for everything else. Ask what
  the report **omits**, not only what it says — the sibling of §3.8.
- **Instrument BEFORE triaging, every time.** T13-0 already established this and was worth 292
  skips→passes; the day it was skipped for the skip column, the same lesson cost the same way again.
- **Give a counter a reason at the site, not a post-hoc classifier.** The reason is free where the
  decision is made and unrecoverable afterwards.

Pinned by `every_skip_records_a_reason`, which asserts both that every skip carries a reason **and
that the reasons distinguish the paths** — a single catch-all string would satisfy a count-only check,
which is §4.1 (a gate that cannot fail is decoration) applied to the fix for this very lesson.

---

## §5.6b — **A REASON THAT NAMES THE WRONG CAUSE IS WORSE THAN NO REASON** (2026-08-20)

*Bought by: `(get "x")` reported as "an earlier module did not build".*

§5.6 says a number the report cannot attribute is not a measurement. The corollary costs more. The
`.wast` runner returned `ActionErr::NoTarget` for the `get` action — reading an exported global —
because it was never wired to `Store::export_global`. `NoTarget` renders as **"an earlier module did
not build"**, so `exports.wast` and `linking.wast` reported 11 skips blamed on a module-build failure
in two files where every module built cleanly.

A bare counter says "something happened here". A wrong reason says "this specific thing happened
here", and the census that reads it will scope the work behind a problem that does not exist. 🎓
**When adding a skip site, ask what the reason will read like to someone who was not there** — and
give a distinct one to a distinct cause, rather than reusing whichever variant is already in scope.

The same pass added the other half: every `assert_return`/`assert_trap` failure now **names the action
that produced it**. `result mismatch (got 0x2, expected 3)` in a 60-assertion file is a bisect;
`assert_return (invoke "imported-mismatch"): result mismatch` is a diagnosis. It found a cross-module
tag-identity defect on the first read.

## §5.7 — **A LENIENCY WITH NO WRONG-VALUE CONSEQUENCE IS STILL A DEVIATION** (2026-08-20)

*Bought by: `anyfunc`, `nullfuncref`, `nofunc`, and legacy `delegate`.*

Four constructs were wrong in a way that could not produce a wrong answer, and all four survived for
exactly that reason:

* `anyfunc` — the pre-standard spelling of `funcref` — was accepted "because MVP-era tools still emit
  it". It is malformed, and wasmtime refuses it.
* `nullfuncref` / `nullexternref` / `nullexnref` were collapsed onto their tops. **Only null inhabits
  either**, so nothing ever ran wrong; they are still distinct types, and `ref.test (ref null nofunc)`
  on a real funcref must answer 0.
* Legacy `delegate` was refused in the assembler, the validator and the interpreter "matching the
  oracle" — an oracle that retired on 2026-08-11.

🎓 **"It cannot produce a wrong value" is an argument about severity, not about correctness.** A
leniency is the engine telling a tool its output is fine when the next runtime will reject it; a
gratuitous strictness is the same message inverted. Both are deliberate deviations, and T13 has none.

⚠️ The `delegate` case adds a rider: **a rationale can outlive the thing it rationalised.** "Matching
the oracle" was written into three separate comments, and none of them was revisited when the oracle
was retired nine days later. When a project-level premise changes, grep for the comments that cite it.

## §5.8 — **SCOPING IS A MEASUREMENT, AND IT FINDS THINGS** (2026-08-20)

*Bought by: `(memory 1 (pagesize 1))`, found while costing the proposal work — not by a test.*

Four proposals were left, all filed as "implementation, not defect repair". Costing them meant probing
what each construct does **today**, one line per proposal. Three answered honestly:
`(ref (exact $t))` → `BadValType`, `struct.new_desc` → `BadForm`, `i64.add128` → `UnimplementedInstr`.
The fourth **ran**.

`(memory 1 (pagesize 1))` assembled, validated and executed — and the emitted bytes were
**byte-identical to `(memory 1)`**. The clause was parsed, accepted and discarded, so a guest asking
for a 1-byte memory silently got 64 KiB and every out-of-bounds access it should have trapped on
succeeded.

🎓 **A track filed as "not started" is a claim about the code, and claims about the code get checked.**
"We do not implement X" and "we refuse X" are different statements, and only the second is safe. The
first is compatible with *accepting X and doing the wrong thing*, which is what was happening.
**Before pricing a feature, run its smallest example** — the answer is either a refusal (safe, and the
cost is real work) or something worse than the missing feature.

⚠️⚠️ **The sharp edge, and it nearly hid this.** The first cross-check against wasmtime **agreed** —
same `memory.size`, same non-trapping load. It agreed because it was handed *wasmrt's emitted bytes*,
which no longer contained the clause. Feeding wasmtime the **source** produced an immediate refusal.
🔒 *When the emitter is the suspect, compare the SOURCE across engines, never the suspect's output.*
§3.8b says an outside reader is what tells a convention from a bug; this is the rider — **give the
outside reader the same input you gave the suspect.**

⚠️ And the discipline that keeps a scope honest in the other direction: the same ten-clause probe
flagged `(sub final (func))` as "dropped" because it emits the bare composite form. It is **not** a
defect — a bare composite type *is* `sub final ϵ`, so the two are one type and the shorter encoding is
correct. Checked before reporting. **A scoping pass that reports its false positives is worth less
than one that checks them**, and one wrong entry in a work-list costs a day.

## §5.9 — **YOUR OWN GATE IS A GATE: CHECK IT CAN FAIL** (2026-09-17)

Two of day 3's findings were invisible until an instrument was fixed, and in both cases the
instrument was ours and trusted:

* The `.wat` corpus loop asked `wasmrt <file> && ...`. **`wasmrt <file>` exits 0 even when validation
  fails**, so the loop could not observe a validation failure at all. It had been reporting 530/532;
  reading the printed verdict instead gives **528/532**, and the two extra failures had been there all
  along.
* The per-file conformance gate could not see a clean file lose passes (§4.15).

🎓 The pattern is not "our tests are weak" — it is that **a gate is a measuring instrument, and an
instrument that cannot register the thing you are looking for returns a confident wrong answer.**
Before trusting a check, make it fail once on purpose. That is the same discipline as the mutation
test, applied to the harness instead of the code.

---

## §5.10 — **A WORKAROUND FOR A WEAK SCORER FIXES THE TESTS YOU WROTE, NOT THE CORPUS YOU DIDN'T** (2026-10-24)

The `.wast` runner accepted any trap for any `assert_trap`. §5.4c found that on 2026-09-19 and
fixed it the cheap way: rebuild OUR tests so the outcome, not the message, carried the meaning. The
5,267 trap assertions in the spec suite stayed scored by the weak rule, and on 2026-10-24, when the
runner was made to compare messages (binaryang's D3 vocabulary), **54 of them were wrong traps**:
`call_indirect` past the table reported as a table access, and out-of-range float→int truncations
reported as invalid conversions. Two unit tests and a repo `.wast` file had asserted the wrong
messages, so the misreading was in the code, the doc comment and the tests at once. → **When a
scorer is too weak, fix the scorer**; a workaround applied to the cases you wrote leaves every
other case scored by the rule you already know is wrong. [wasmrt]

