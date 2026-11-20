# Best Practices — the lessons this port actually paid for

Every rule here was **bought with a defect**. Each carries the evidence, because a rule without its
scar is advice, and advice does not survive a deadline. Written 2026-08-08, after the T9 passes made
the same few mistakes visible enough to name.

Read this before starting a task. It is not a style guide — it is a list of the ways this codebase has
been wrong, which is a much better predictor of how it will be wrong next.

**Numbering (workspace policy, 2026-10-24):** a section number is stable and never reused; a new rule
takes the next free number in its topic. §1–§8 below are the numbered sections; the rules added
since 2026-08-20 are appended after them in date order, under their own numbers. Five appended rules
had collided with earlier numbers and were renumbered on 2026-10-24 (each says so under its heading):
§1.7 → **§1.13**, §3.11 → **§3.15** (and §3.11a → §3.15a), §3.12 → **§3.16**, §4.4 → **§4.14**,
§4.5 → **§4.15**. The workspace's ★ rules are copied at the end.

**Index of the appended rules:** §3.8b three components that agree are not three witnesses · §5.6b a
reason that names the wrong cause · §5.7 a leniency with no wrong-value consequence · §3.15 the same
word on two surfaces · §5.8 scoping is a measurement · §4.14 a doc comment is not a check · §3.16 an
unknown spelling can be re-read · §4.15 a clean file has no row · §1.13 the denominator is a
measurement · §8.4 verifying an option's premise · §3.8c a rationale expires · §5.9 your own gate is a
gate · §1.9 a second authority on a grammar · §3.13 read-and-discard is not validation · §3.8d the
outside reader is a gate · §8.1b line endings · §1.10 a grammar production has more than one site ·
§3.14 a field recorded for one consumer · §1.11 sweep the axis · §1.12 a differential fuzz · §4.11 a
contract row verified on parsing · §4.13 one module per feature misses the core · §4.12 a gate that
finds its input by path · §5.10 fix a weak scorer, not the tests you wrote.

**Split by subject on 2026-11-20 (memory guide, letter H38), sections moved verbatim; numbers unchanged.**
Each appended § now sits with its subject. This file: §1 and §1.x, then §2's pointer below.

- [best-practices-distrust.md](best-practices-distrust.md): §2, what to distrust
- [best-practices-defects.md](best-practices-defects.md): §3 and §3.x; [best-practices-surfaces.md](best-practices-surfaces.md): §3.15
- [best-practices-borrowed.md](best-practices-borrowed.md): §3A (and [§3A.2](best-practices-borrowed-2.md)), borrowed from wazmrt
- [best-practices-gates.md](best-practices-gates.md): §4 and §4.x; [best-practices-tests.md](best-practices-tests.md): §5 and §5.x
- [best-practices-method.md](best-practices-method.md): §6–§8 and §8.x
- [best-practices-shared.md](best-practices-shared.md): the workspace's ★ rules, copied unchanged under their stamp

---

## 1. Measurement

### 1.1 A logged cost is a hypothesis about a CAUSE, not a measurement

**Wrong four times.** (a) `ref.null $t` was credited with "161 skipped assertions in `br_table.wast`" —
the fix was real but moved *other* files; `br_table` was failing three fixes earlier and needed **four**
independent fixes. (b) T9a#11 and #12 were logged as separate items with different symptoms; they were
**one theme in two halves**. (c) T9a#6 read "GC subtyping depth not modelled"; the measured top item was
**21 invalid modules being accepted**, because there was no declared-subtype validation *at all*.
(d) T9a#5 was logged at 6 and delivered **88** — a different failure of estimation again, and the one
§1.3 below is about.

**Apply:** re-measure before starting any punch-list item. A cost figure assigned by reading a file for
"the first construct that looks unsupported" is invention. Do not bank predicted value.

### 1.1a A SCOPE note is a hypothesis about a cause too — and it is the one nobody re-measures

T9g listed "`annotations` **51** — a proposal wasmrt does not target" under *scope confirmations
(NOT bugs — record, do not "fix")*. True of the file. False of **44 of its 51 assertions**, which
were generic §6.2/§6.3 lexer rules applying to every `.wat` wasmrt reads.

Disproving it took four one-line files and about a minute — none of them containing an annotation:

```
(module (func $a\x01b))    accepted; \x01 is not an idchar
(module (func $a\xffb))    accepted; source text must be valid UTF-8
(module (data "\x01"))     accepted; stringchar requires c >= U+20
(module (func) ;;\x01 )    accepted — and CORRECTLY: linechar allows it
```

The proof it was generic is `id.wast`, which has nothing to do with annotations and went from 5
failures to **zero** on the same fix.

A cost figure gets re-measured because §1.1 says so. A *scope* note reads as settled — it is filed
under "not a bug", so nobody returns to it. That makes it the more dangerous of the two.

**Apply:** a scope note names a **file** or a **proposal**; a defect has a **cause**. Before writing a
cluster off, spend the minute it takes to reproduce it *outside* the thing you scoped out. If it
reproduces, the scope note is about the tests, not about the bug.

### 1.1b A COMMENT OUTLIVES WHAT IT DESCRIBES — and the closer it sits, the longer it survives

Three in one day, each contradicted by code within a few lines or by a number in the same repo:

* `wasmrt.h` said tail calls were *"deliberately"* not implemented — **three lines above the
  `WASMRT_FEATURE_TAIL_CALL` it had exported since they landed** five weeks earlier. It read as a
  policy, so nobody re-checked it; it was simply stale.
* `known-issues.md` carried a ⚠️⚠️ **OPEN** heading for the `try_table` catch-label defect that had
  been fixed on day 2 — the entry two rows above it says *"both now fixed and pinned by tests"*.
* `README.md` told the public tail calls were "the one scope item not yet implemented".

⚠️ **The pattern: prose that states a DECISION ages worst**, because a reader treats "deliberately"
or "OPEN" as something someone chose, not something someone measured, and re-measuring a decision
feels like second-guessing a person. That is exactly §1.1a's scope-note trap, one level up.

**Apply:** when a feature lands, grep the repo for its name — header prose, README, `known-issues`
headings — not just the code. A claim in a header ships to every embedder. And when closing an
entry, close its HEADING: a "✅ fixed" buried in the body under an "OPEN" title is still an open
item to everyone who skims.

### 1.2 Survey the measurement, don't just read the entry

The roadmap said the remaining text-parser work was "`func.wast` 21". Surveying the worst in-scope files
showed **`block`/`if`/`loop` at 13 failures each with an identical breakdown** — the signature of one
shared cause, and nearly twice the logged size. Identical numbers across sibling files are a tell.

### 1.3 A cost counted in FAILURES understates any defect that stops a module BUILDING

**T9a#5 was logged at 6 and delivered 88.** The discrepancy was structural, not an estimating error:
`ConstantExpressionRequired` on a global initializer fails the whole *module*, and every later assertion in
that file then has no target and is **skipped**. `i31.wast` read 0 passed / 6 failed / **66 skipped** — the 6
was the visible cost, the 66 the actual one. Three GC files carried 126 skips between them.

**Apply:** read the **skip** column, not just the failure column. A defect in a module-level position — a
global initializer, a type definition, a section — is worth its file's skips.

### 1.4 Diff the OUTPUT counts, not exit codes

A pass/fail count that moved is evidence; an exit code is not. This is binding across the project.

### 1.4a A rule that works around a LYING exit status is a reminder; fixing the status is a fix

§1.4 exists because `wasmrt <file>` exited 0 whatever validation said, so a shell loop keyed on `$?`
counted every module as valid. The rule was written, recorded — **and then broken again by the
session that wrote it**: the 2026-09-19 `.wat` corpus loop keyed on that same status and reported
"531 validated" as a measurement when it was an inference. Re-measured by reading the verdict text,
the figure happened to hold. It was still not measured.

✅ **What actually closed it** was making the status true (2026-09-19): summarize exits 1 on an
invalid module, `wast` exits 1 on a failed assertion or an unreadable script, and no arguments is a
usage error. `wasmrt wast <dir>` is now usable as a CI gate, which it never was.

**Apply:** when a tool's status is wrong, the fix is the tool, not a note telling future readers to
avoid it — a note has to be remembered by everyone, forever, including the person who wrote it an
hour ago. 🎓 *A test runner's exit status must say whether the tests passed.* Until it does, no
amount of documentation makes it safe to build on.

### 1.5 Know what your measurement tool omits

The `.wast` runner prints a per-file line only when `verbose || failed > 0`. So a file reaching **zero
failures disappears** from a non-verbose run, and a diff keyed on those lines reads that as the file
losing all its passes — a false alarm it raised in earnest (`br_on_cast_fail` looked like −6 passes; it
was +2). **Run `wasmrt wast <dir> -v` on both sides when diffing per-file.**

The direction of that flaw was *false alarm*, never *false all-clear*. Work out which direction your
tooling can lie in; one of them is survivable and the other is not.

### 1.5a A gate that runs one stage of a pipeline is evidence about that stage ONLY

The `.wat` corpus gate ran `wasmrt wat <file> -o out` and counted exit codes: **533/534**. It had been
quoted for months as evidence that the text toolchain was sound. It was not — it was evidence that the
**parser** accepted 533 files. Meanwhile the bytes the *emitter* produced for `call_ref` were
**undecodable**, and the gate could not see it, because it never decoded anything.

Re-running the same corpus as **assemble → decode → validate** immediately showed the real state, and
turned a punch-list entry logged as "1 wasmtk file, undiagnosed" into a 76-assertion fix.

**"The tool returned Ok" is a claim about the half of the tool that runs before it returns.**

**Apply:** for any pipeline (assemble → decode → validate → run), a gate must traverse **every** stage
whose output the next stage consumes. When you inherit a gate, ask what it actually executes, not what
it is named. `wat -o /dev/null` and `wat -o out && decode out` differ by one defect class, and it is
the class this project keeps finding (see §3.2).

### 1.6 Benchmarks: same-session A/B/A, and say when it is noise

Run-to-run spread is several percent and a single session drifted **~10%**. Report "unchanged within
noise" when that is what the numbers say — do not pick the favourable run. Cold-start numbers are
meaningless without the module size beside them.

### 1.7 The PLUMBING for a cold feature can cost the hot path — measure the plumbing, not the feature

T9a#7 (trap backtraces) is pure diagnostics: it does nothing until something traps. But making the
trapping position *observable* meant getting `pc` out of `run`, and the obvious spelling —
`pc: &mut usize` threaded through the loop — **measured 3.6% slower** on the steady-state benchmark
(2160 ms vs 2083 ms, A/B/A). The deref does not survive the opaque calls in the loop body. Wrapping
the loop in a one-shot closure keeps `pc` a plain local that LLVM holds in a register, while still
leaving it readable after any exit: **2087 ms against a 2083–2095 baseline band** — free.

The trap is that the *feature* is obviously cold, so the change reads as obviously free, and nobody
benchmarks it. A permanent 3.6% tax on a stated success axis would have been paid invisibly.

**Apply:** benchmark any change that touches a hot loop's *locals or signature*, however cold the
feature motivating it. And when a design rests on a size or layout claim ("this field is free, it
fits in existing padding"), **pin it with a `size_of` test** so the day the claim stops holding is a
build failure, not a silent regression.

### 1.8 When the input space is SMALL, ENUMERATE it — do not read the table

Two 🟡 entries described value-type decoding in function bodies, each written carefully from the code. A
sweep of **every** one-byte encoding (`0x40..=0x7f`, 64 values) in both positions (block type, typed
`select`), against wasm-tools at two feature settings, took one script and found **three** defects: the two
logged (20 invalid encodings accepted) and one neither entry mentioned — **3 valid block types refused**,
because the table had never listed the hierarchy bottoms. It also showed one entry's premise ("wasm-tools
accepts `0x68`") held only under `--features all`.

Reading a table tells you what it contains; only enumerating the domain tells you what it is MISSING.
**Apply:** when an encoding space is small enough to list (opcode bytes, value-type bytes, flag
combinations), sweep all of it against the outside reader and diff — before fixing, so the fix is scoped by
the measurement rather than by the entry. Record the referee's FEATURE SETTING with every verdict (§2.3a).

---

## §1.13 — **WHEN THE CORPUS CAN MOVE, THE DENOMINATOR IS A MEASUREMENT** (2026-09-17)

*(Numbered §1.7 until 2026-10-24, when it was renumbered because §1.7 also named an earlier rule; workspace letter H2.)*

Day 3 opened by re-running the suite rather than quoting day 2's **63,807 / 112 / 584 over 284 files**.
It read **63,963 / 112 / 604 over 288** — wasmtk had synced the vendored testsuite to upstream on
2026-08-20 at 18:34, hours after those numbers were written: **+4 files, +156 passes, +20 skips.**

⚠️⚠️ **The failure total was 112 on both sides, by coincidence** — custom-descriptors +1,
custom-page-sizes −2, a new `custom/` directory +1. An engineer who checked only the headline would have
concluded the corpus had not changed, and every later delta would have been measured against a mix of two
corpora.

🎓 Three consequences worth keeping:
* **An unchanged total is not evidence that nothing changed.** Only the per-file join can say that, which
  is the same reason the gate is per-file.
* **A vendored corpus is an input under someone else's control.** Re-measure it at the start of a session,
  and record the file count beside the assertion counts — 288 vs 284 was the visible half.
* **New corpus files can arrive with no track covering them.** The `custom/` directory brought 20 skips
  of unhandled `assert_*_custom` commands that no T13 track had scoped, because it did not exist when
  they were scoped.

## §1.9 — **A SECOND AUTHORITY ON A GRAMMAR FAILS ON WHATEVER WAS ADDED AFTER IT WAS WRITTEN** (2026-09-19)

`module.rs` carried `skip_const_expr`: forty lines whose only job was to walk an initializer
expression to its `end` without mistaking an operand byte for the terminator. To do that it had to
know every constant instruction's immediate shape — so it was a **second copy of the instruction
grammar**, written from the subset of instructions that existed the day it was written.

It cost two defects, and both were the **reject-valid** direction, which is the direction this
project has otherwise been lucky to avoid:

* `struct.new_desc` / `struct.new_default_desc` (custom-descriptors, `0xFB 0x20`/`0x21`) were not in
  its match, so their type index stayed in the byte stream and was read as an opcode.
* `ref.null`'s heap type was read with a bare `read_var_s33`, which cannot see the `exact` prefix
  (`0x62 typeidx`) — the **fourth** private copy of the heap-type grammar.

⚠️ **Both were invisible for small type indices.** A stranded index byte of `0x00` decodes as
`unreachable`, consumes nothing, and the walk still lands on the real `end` — the right answer for
the wrong reason. The first probe of each used type index 0 and **agreed with wasm-tools**. Only at
index **11** does the stranded byte become `0x0B`, which *is* `end`: the expression terminates early,
the section comes up short, and a valid module is refused with `section size mismatch`.

🎓 **A probe that happens to pick the benign input reports "no defect" in exactly the same words as a
correct implementation.** When a bug is "a byte is left in the stream", the input has to make that
byte *mean* something — pick the operand value that collides with a terminator, not the first one
that comes to mind.

The fix is structural, not a patch: const expressions are now walked by `opcode::decode_expr`, the
same function that decodes function bodies, and `skip_const_expr` is deleted. An instruction cannot
be legal in a body and unknown in an initializer any more, because there is only one reader. Same
shape as `read_value_type_from` (§1.8) and `parse_type_use` before it — **the durable fix for "two
copies disagree" is one copy, never a third.**

---

## §1.10 — **A GRAMMAR PRODUCTION HAS MORE THAN ONE SITE; THE FAILING TEST NAMES ONE** (2026-09-20)

§5.5.12's element-segment type field and §5.3.9's table-type element field are the same production:
**reftype**. The first was read as a *valtype*, the spec suite complained, and it was fixed — with a
test and a comment quoting the rule. The second was read as a valtype for the whole life of the
project, because nothing complained: the text format cannot spell `(table 1 i64)`, so no `.wast` file
and no corpus `.wat` can reach it. It decoded, validated and RAN, handing the guest the engine's
null sentinel as an integer — and wasmrt's own assembler emitted such modules.

🔒 The practice: when a fix lands on a grammar production, **grep for every call of the reader it
replaced** and decide each one on the grammar, not on whether a test is failing there. Six
`read_val_type` call sites; one was wrong. The sweep costs one command.

🎓 Its twin: the text-format side had **four** copies of the same position (table field, inline-`elem`
table field, element segment, import field). Three were fixed from reading; the fourth was found by
the regression test written for the first three. **Write the test as a table of spellings, not as one
case** — the fourth site is the one you did not know about.

## §1.11 — **SWEEP THE AXIS, NOT THE ARM** (2026-09-20)

Three of this review's findings came from two mechanical sweeps, and none of them from reading the
arm that was wrong:

* **the 64-bit axis** — 24 table/memory instructions × the i64 spelling (both engines must ACCEPT)
  and the i32 spelling (both must REFUSE). One arm differed: `return_call_indirect`. The same 18
  cases re-run at RUN time against wasmtime, addressing past `2^32`, showed six more.
* **the proposal axis** — all 18 proposals, each disabled, against a module that uses it, judged by
  wasm-tools with the same proposal disabled. One hole: table64.

A sweep has a property a reading does not: **the control arm**. Every row asserts the *positive*
case too, so a probe that fails for an unrelated reason cannot read as a working gate — which is
exactly how a `(table 1 funcref (ref.func $f))` fixture nearly certified a gate it never exercised.

🔒 And a sweep is a table of *spellings*: the instruction list is enumerable, the proposal list is
enumerable, the 256 opcodes are enumerable (§3.13), the 64 one-byte value types are enumerable
(§1.8). Prefer an enumeration you can generate over a list you can write down.

## §1.12 — **A DIFFERENTIAL FUZZ REACHES WHAT THE SUITE STRUCTURALLY CANNOT** (2026-09-20)

`wasm-tools smith` generates a module that is valid **by construction**; anything wasmrt refuses is a
refuse-valid defect, and it needs no oracle beyond the exit status. 1,325 generated modules found the
constant-expression cap in the first 25. A single mutated byte, kept only when wasm-tools then says
INVALID, is the other direction: 5,300 mutations found one accept-invalid — the `i64` table — which
is the one class the spec suite can never reach, because the suite is written in the text format and
the text format cannot spell it.

⚠️ **Set the outside reader's feature list to OURS.** The first run reported seven refuse-valid
"defects" that were `-f all` enabling proposals wasmrt does not implement (compact-imports).
A differential result is only a result when both sides were asked the same question.

