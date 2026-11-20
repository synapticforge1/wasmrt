# Best practices 3 — where the defects actually are

wasmrt's own lessons, section 3 and its later § 3.x entries. Last verified: 2026-11-20. Split out on 2026-11-20 (memory guide, letter H38); the
sections below are moved verbatim.

## 3. Where the defects actually are

### 3.1 Silent-wrong-output is the worst class, and it is where every serious defect has been

**A module that is rejected announces itself; one that runs and answers wrongly does not.** The list:
dropped table initializers; element-segment form 4 rewriting a segment's type; `br_table`'s missing
label vector; `(data "a""b")` concatenating; `Op::MemorySize` reading another instance's memory; a
repeated section silently replacing the first; a cross-store `InstanceId` sharing the wrong memory; the
assembler emitting open types as final and flattening rec groups; **the start function never running**;
**`from_utf8_lossy` in the lexer silently renaming malformed identifiers** so two distinct ones collided.

**Apply:** when hunting, weight this class above everything else. Ask "what would a wrong answer look
like?" before "what would an error look like?"

### 3.1a A feature can be fully decoded, validated and PRINTED, and still never execute

`Module::start` was parsed by the assembler, checked by the validator, reported by `wasmrt <file>` —
and no code path ever called it. §4.5.5 requires it to run as the last step of instantiation. Every
stage that *inspects* a feature passed, so every stage that could have noticed was satisfied.

The cost was 10 assertions sitting failed for five releases in files literally named `start.wast` and
`start0.wast`. The triage habit had been to read failures for a *diagnosis* — what does the message
say — and these said nothing useful, so they stayed on the pile.

**Apply:** before diagnosing a file's failures, spend one minute on the cruder question: **does the
feature this file is named for work end to end?** Write the five-line module, run it, look at the
answer. Presence in the decoder, the validator and the printer is not evidence that anything runs it —
grep for the field's *reader*, not its writer.

### 3.2 The emitter reconstructs a form from a SUBSET of the parser's facts

Three times: element-segment reftype (form 4 has no reftype field → `funcref` hardcoded), **finality**
(the wrapper was keyed on the supertype's presence alone, so `(sub (struct …))` emitted a *bare*
comptype, which means `final`), and **rec-group extent** (`0x4e` emitted nowhere, so every `(rec …)`
became singletons). Each produced a *valid* module — just not the module the text described.

Generalised: **information was present and discarded because nothing needed it yet.** The same shape
appeared on the decode side — an import's typeidx was resolved to a `FuncType` and the index thrown
away, which later made cross-module identity undecidable.

**Apply:** for every field the parser records, ask whether the emitter reads it. An unread field is a
dropped fact waiting to become semantic. This is T10a.

### 3.3 Comparing STRUCTURE can never answer a question about IDENTITY

Two functions can both be the empty `(func)` and still be **different types**, because rec-group
membership is part of identity. Any params/results comparison links them. Only the type *index*,
resolved to a canonical id, carries identity.

**Apply:** when a check compares shapes, ask whether the real rule is about *identity*. If so the shape
comparison is not approximate — it is answering a different question.

### 3.4 An asymmetry between layers is a bug, not a style difference

The C ABI tagged its value handles with the issuing store from T8; core's `InstanceId` did not. **Core
held the weaker of the two guarantees, and that asymmetry *was* the defect.** When one layer defends
against something, ask why the other does not.

**Second instance, 2026-08-08 — and it was in two runtimes at once.** `wasmrt wasi` validated before
executing; `wasmrt run` did not, so it would execute an ill-typed module and print a plausible answer.
The same split existed in `wazmrt`: its summarize and `.wast` paths validated, while **both** of its
execute paths and its C ABI's `wasm_module_new` did not. In both projects the paths that *actually run
code* were the ones not checking it — the exact inversion of what matters.

**Apply:** enumerate the entry points, in a table, and check the property at every one. The bug is not
usually "nobody does X"; it is "three of the four do X". Prefer one guard on a predicate the paths
already share (`will_execute` in wazmrt's `run()`, which existed to gate pin verification) over N
copies, so a path added later inherits it instead of having to remember.

### 3.5 The two-instance rule

Store-index vs module-index conflation is **invisible with one instance per store**, because the two
indices are equal. Any regression test touching pooled resources (memories, tables, globals, data/elem
segments) MUST instantiate a second module first, or it proves nothing.

### 3.6 Rejection STAGE is part of correctness

Malformed input must be refused by the decoder, ill-typed input by the validator, unlinkable input at
link time. wasmrt was refusing malformed binaries *at validation* — the module was rejected, so nothing
looked broken, but the stage was wrong and the spec suite says so with `assert_malformed`. Fixing the
stage was worth ~100 assertions and closed real over-acceptance alongside it.

### 3.7 The stage that REPORTS a failure is usually not the stage that caused it

T9a#8 was one defect in the **assembler** — four instructions emitted without their immediate. It was
reported, variously, as:

- a **decoder** error (`missing END`) — because the absent operand shifted every following byte;
- `UnknownInstr` naming the **next token**, `$t`, rather than `call_ref`;
- the same `UnknownInstr` in a different file, which got logged as an **unrelated** corpus gap.

So one cause produced three symptoms, filed as two separate punch-list items, and every symptom pointed
away from the assembler. It had been undiagnosed since T6.

The general shape: a component that emits a *stream* fails by shifting everything downstream, so the
first thing to notice is whoever reads the stream next. Off-by-one and missing-field defects in an
encoder are systematically misattributed to its decoder.

**Apply:** when an error names a position or a token, ask what wrote the bytes just before it, not just
what read them. And when two entries on a punch list have the same *message* in different files, treat
them as one hypothesis rather than two items — the identical-numbers tell of §1.2 applies to identical
messages too.

### 3.8 A port/oracle divergence can be a MISSING CAPABILITY, and no gate here compares capabilities

`wasmrt run prog.wat` failed with *"not a WebAssembly binary (bad magic)"* for the whole port. The
oracle accepted `.wat` on its run path from its own first release. The assembler was in the same
executable, one function away, reachable only as a separate `wasmrt wat` step.

Nothing caught it, and nothing **could** have: every gate this project runs compares *answers* on inputs
both runtimes accept — the spec suite, the `.wat` corpus, the WASI corpus, and (while it existed) the
oracle drift monitor. A feature
one runtime simply does not offer produces no differing answer to diff. It is invisible in exactly the
way §3.1's silent-wrong-output is invisible, for the opposite reason: not a wrong answer, but **no
answer at all, on an input nobody in the harness ever hands it**.

Note where it sits relative to §3.1a. There the feature was decoded, validated and printed but never
executed. Here the feature *worked perfectly* — it was simply never wired to the path a user would
reach it from. Both are "the code is present and correct and does nothing", found by asking a question
about the product rather than by running a test.

⚠️⚠️ **It was found by the OWNER asking whether the runtime ran `.wat` files — the second finding in two
days that came from an owner question rather than a test** (§2.3's validation gap was the first).
That is not luck twice; it is a category the harness structurally cannot reach, because a test is
written from the same mental model as the code, and a missing capability is a hole in that model.

**Apply:** periodically enumerate what a *reference* runtime **accepts** — its subcommands, file types and
flags — as a table, and check wasmrt entry by entry. Same shape as the §3.4 remedy (enumerate the entry
points, don't reason about them), applied to the outside of the tool rather than the inside. Cheap, and
it is the only thing that finds this class.

⚠️ **Since 2026-08-11 the reference for this is `wasmtime`, not `wazmrt`** — the oracle is retired and
wazmrt is a competitor (`design-decisions.md`). That does not weaken the check: wasmtime's CLI is the
larger surface, and §2.3's rule applies to it too — **run the binary, do not enumerate from memory.**

**The same question asked of the size axis** finds the open instance of this today: every recorded size
figure (CLI, cdylib, freestanding wasm32) is for an artifact `rsxtk` — the *default* consumer — does not
link. Measuring what is in front of you rather than what the consumer uses is this section's mistake
wearing different clothes.

### 3.9 A shared registry wired into ONE consumer is a bug in the others

wasmrt built a store-wide type registry at T9h and wired it into import matching and `call_indirect`.
Both were correct. **The other two consumers of the same question kept comparing raw indices across
modules** — `ref_matches`' `Any` arm (GC objects) and its `Func` arm (funcrefs) — and both were wrong.

The `Func` arm is the instructive one. It had *already been fixed once* for this exact class: its doc
comment says a funcref's type lives in its owning instance's module. It fetched the index from the right
module and then compared it in the wrong one, and logged that as **"approximate"**. A defect described
in a comment is still a defect; "approximate" was the word doing the concealing.

**Apply:** when a facility exists to answer a question exactly, **enumerate every site that asks that
question** and convert them in one pass. A registry, a canonicalizer, a validator helper — each is a
claim that the question now has one right answer, and every unconverted caller is a place still giving a
different one. ⚠️ Note this is §3.4's rule (enumerate the entry points) pointed at a *capability* rather
than an entry point, and it found **two of four sites wrong**.

⚠️ **The tell is a hedging word in a comment** — "approximate", "best-effort", "close enough",
"good enough for now". Grep for them. Each marks a place where someone knew the answer was wrong and
decided the cost of being right was higher than it turned out to be.

---

### 3.10 A conformance suite checks RESULTS; some features are about RESOURCES

`return_call_ref` shipped for releases as "call the callee, then jump to the end of the body". Every
answer it produced was correct. It recursed natively on every hop, so unbounded mutual recursion —
the entire reason the tail-call proposal exists — still exhausted the stack.

Its conformance file read **40 passed / 7 failed**. Nobody looks at 40/7 and concludes *the feature is
absent*; it reads as "nearly done, a few edge cases". Measured deliberately afterwards, a mutation
restoring the fake still scores **38/6, 72/4, 40/6** across the three tail-call files.

**The reason is structural, not a gap in the suite.** `assert_return` compares a value. A tail call's
defining property is that it does not consume a resource, and no assertion about a *result* can
observe that. The same blindness covers anything whose contract is consumption rather than output:
memory that must not grow, a cache that must not be rebuilt, an allocation that must not happen.

**Apply:** when a feature's *point* is a resource property, write the property test yourself and make
it large enough that only the real implementation survives — 1,000,000 frames, not 100. Then
mutation-verify it against the conformance number and record both: *"the suite still reads 90% under
the mutation"* is the sentence that stops the next person trusting the percentage. ⚠️ This is §3.1's
silent-wrong-output inverted — there the answer was wrong and nothing said so; here the answer is
right and the feature is missing anyway.


### 3.11 WIDENING A FIELD DOES NOT SURFACE ITS CALL SITES — an identity conversion still compiles

**table64 (T13) widened `TableDef.min` from `u32` to `u64`.** Two of the three emit sites were found by
the compiler; **the third was not**, because it read `emit_limits(…, u64::from(t.min), …, false)`. While
the field was `u32` that was a **widening**; the moment it became `u64` it turned into `u64::from(u64)`
— an **identity conversion that type-checks perfectly** — so the site kept compiling with its hardcoded
`is64: false` beside it. The result assembled `(table i64 …)` as a **32-bit table**: a wrong module, not
a rejected one.

⚠️ **The habit: after widening a type, grep for the conversions that used to DO the widening**
(`u64::from`, `try_into`, `as`). They are exactly the sites the type checker can no longer see, and they
are disproportionately the sites doing something *else* wrong too — a conversion wrapper is where a
hardcoded neighbour hides.

🎓 **It cost a second mistake worth naming: a replace-first on a pattern that occurred twice.** The
patch script asserted “patched 2 sites” and was satisfied — but it **counted patches, not occurrences**,
and two of the three lines were byte-identical, so one replacement consumed both checks. *Count what you
expect to FIND before replacing, and assert none remain after* — §4.2a wearing different clothes:
confirming a change applied is not confirming it applied **everywhere**.


### 3.12 A WRONG TYPE WITH A RIGHT ARITY PASSES EVERY SHAPE CHECK

`br_on_non_null`’s validator popped its label’s types **wholesale**, so it demanded `(ref ht)` from a
stack holding `(ref null ht)` — and **rejected the canonical idiom the instruction exists for**.

⚠️ **The stack EFFECT was already correct** (pop all, push all, pop the ref), so every arity and
balance check agreed with it and the arm read as plausible. Only the *type* it asked for was wrong.
**Arity is the property tests and eyeballs check; the type is the one the spec cares about.**

🎓 **And it survived because it erred in the REFUSING direction** — a rejected valid module is a
failing assertion, never a wrong answer, so nothing miscompiled and no user hit a bad result. That is
the same asymmetry §4.6 records from the other side: *which direction to err in is a property of the
consequence*. A refusing bug is cheap to live with and therefore **cheap to not notice**, so the place
to look for one is a conformance file that has sat at a few failures for a long time — not a bug
report.

## §3.8b — **THREE COMPONENTS THAT AGREE ARE NOT THREE WITNESSES** (2026-08-20)

*Bought by: the `try_table` catch label, the non-null-reference valtype encoding.*

wasmrt's assembler emitted `(ref any)` as the single byte `0x66` — `ValType`'s **internal tag** for
that type, in an unused valtype-byte range. Its decoder read `0x66` back as `(ref any)`. Its
validator and interpreter agreed. Every round-trip test passed; the spec suite was 99.7%. And
**wasmtime 47 answers `invalid value type (at offset 0xd)`**: §5.3.5 spells a non-null abstract
reference `0x64` + the head's heap-type byte, and no module wasmrt assembled containing one was
WebAssembly at all.

The same day, the same shape, a different rule: a `try_table` catch label counts from the scope
*enclosing* the try_table. The assembler pushed the try_table's own label first, the validator pushed
its frame first, and the interpreter added `d` instead of `d + 1`. Three components, one convention,
zero disagreement — and every emitted `try_table` was rejected by wasmtime.

🎓 **Agreement between components that learned the convention from each other is not evidence.** A
round trip tests that the two halves are inverses, which they can be while both are wrong. Only a
reader that did not write the bytes can tell a convention from a bug.

⚠️ Why the NULLABLE forms hid it: `funcref` is genuinely `0x70`, `anyref` genuinely `0x6e`. The
internal representation coincided with the wire format for the common half, which is exactly what made
the shortcut look total. **An internal representation that resembles the wire format will eventually
be mistaken for it.**

**What to do about it:** when a format has an outside reader, run the output through it. `wasmtime
compile out.wasm` is one command, it takes no fixtures, and it found two wire divergences in an
afternoon. Both are now pinned by tests that assert the **byte**, not the answer.

## §3.16 — **AN UNKNOWN SPELLING IS NOT AUTOMATICALLY REFUSED — IT CAN BE RE-READ** (2026-09-17)

*(Numbered §3.12 until 2026-10-24, when it was renumbered because §3.12 also named an earlier rule; workspace letter H2.)*

The bare-index segment spellings, `(data 0 (i32.const 0) "x")` and `(elem 0 (i32.const 1) $f)`, are
valid and both parsers read only the parenthesised `(memory 0)` / `(table 0)` form. The two halves failed
**differently**, and the difference is the lesson:

- : `data` — what happened: the `0` fell through to the datastring loop → `BadForm`. **A false rejection** — the safe direction, and still wrong.
- : `elem` — what happened: ⚠️⚠️ **the module ASSEMBLED, and it was a different module.** Nothing consumed the
  `0`, so the offset branch did not fire either: an **active** segment writing one funcref at index 1 became a
  **passive** segment of three items — `ref.func 0`, the offset expression itself, and `ref.func $f`.

It surfaced only because an `i32.const` cannot be a `funcref`, and then as the validator's `TypeMismatch`
— an error naming neither the stage nor the thing that was wrong. **Had the items happened to type-check,
this was a silently wrong module.**

🎓 **The intuition to give up: "we don't parse it, so we reject it."** A parser that does not recognise a
token at a position does not stop — it keeps going and the token lands wherever the next rule looks. That
is §3A.2's "a synthetic tag in a real space eventually means something else", and §3.15a's "a rejection
routed to code that does not recognise it lands in the wrong bucket", arriving from a third direction.

**So a test for a newly-accepted spelling asserts the MEANING, not acceptance.** `assemble()` returning
`Ok` proves nothing about what was built; the regression test here checks the decoded segment's mode is
`Active` and that it holds exactly one item. That is the same rule as §3.8b — hand the bytes to a second
reader — applied to your own decoder.

## §3.8c — **A RATIONALE EXPIRES; THE CODE IT JUSTIFIED DOES NOT** (2026-09-17)

Eight opcodes were decoded *and emitted* as raw bytes `0xc5`–`0xcc` under this comment:

> Saturating float→int truncation. Real wire form is `0xFC 0x00`–`0x07`; **these bytes are also
> accepted as raw single-byte forms, mirroring the wazmrt oracle.**

`0xc5`–`0xcc` are unassigned in the single-byte space. The oracle was retired on **2026-08-11**. The
deviation survived it by five weeks, and it was not a leniency on *input* only — **the assembler wrote
those bytes**, so every module wasmrt assembled containing an `i32.trunc_sat_*` was not WebAssembly
(*"illegal opcode: 0xc5"*, wasmtime 48). LLVM emits these for an ordinary `f32 as i32`.

🎓 **Three failures stacked, and each one alone would have been survivable:**
1. **The rationale expired and nothing swept for its dependants.** When an anchor is dropped, the
   things it justified do not announce themselves — *grep for the anchor's name on the day it retires.*
   `"oracle"` in a comment was the whole search.
2. **The round trip was green** because our decoder accepted what our assembler wrote (§3.8b again —
   the third instance in a week).
3. **The deviation was written down**, which made it look adjudicated. A note saying *why* a rule is
   bent is evidence someone thought about it **once**, at a time that has passed.

🔒 Practical rule: **a comment that justifies a deviation must name the authority it defers to**, so
that when the authority changes the comment becomes searchable. "Mirroring the oracle" did exactly
that — and nobody ran the search.

## §3.13 — **READ-AND-DISCARD IS NOT VALIDATION** (2026-09-19)

Four defects found in one review, all the same shape: a field whose **undefined values were never
rejected**, because the code read the bits it wanted and threw the rest away.

| field | what the code did | what it accepted |
|---|---|---|
| `br_on_cast` castflags | took bits 0–1 for nullability | `0xff` ran as `0x03` |
| `atomic.fence`'s reserved byte | `r.read_byte()?;` | any byte |
| element-segment elemkind | `r.read_byte()?;` | any byte |
| element-segment flags | `read_var_u32`, tested bits 0–2 | flags `8` silently became flags `0` — a **different segment form** |

And a fifth of the same family from the SIMD decoder: `if sub > MAX_SIMD_SUB { reject }`. ⚠️ **A
CEILING IS NOT MEMBERSHIP.** The `0xFD` space is not dense — it has 20 holes below its top, and all
20 decoded into an `Op::Simd` the interpreter would then be handed.

🎓 The general rule: **examining the bits a form needs is not the same as rejecting the bits no form
defines.** A reserved byte is reserved only if something refuses a non-zero one; otherwise it is just
a byte you skipped. Every one of these five was a *silent* acceptance — the module ran, and produced
an answer for bytes that are not WebAssembly.

🔬 **How the holes were found: sweep the space, do not read the table.** Every `0xFD` sub-opcode in
`0x00..=0x113` was handed to wasmrt and to wasm-tools as a one-instruction module, and the 20
disagreements fell out in one run. The same method found the value-type defects the day before
(§1.8). Reading a specification's opcode table to decide what is assigned is how the holes got in.

---

## §3.8d — **THE OUTSIDE READER IS NOW A GATE, NOT A GOOD HABIT** (2026-09-19)

§3.8b says to hand wasmrt's output to an outside reader whenever a format-level change lands, and it
has earned its keep four times (the `(ref any)` internal tag, `try_table`'s catch label, the raw
`0xc5` trunc_sat opcodes, and now this). ⚠️ **Every one of those was found by remembering to do it.**

The fifth was found the same way and it is the reason the habit is now a script: `array.new_data` and
`array.init_data` name a data segment exactly as `memory.init` does, so they require the data-count
section — and **neither** wasmrt's decoder (which enforced the requirement for `memory.init` and
`data.drop` only) **nor** wasmrt's assembler (which set the "emit a data count" flag at those same two
sites) knew it. The two agreed perfectly, the module ran, and `wasm-tools validate` on our own
emitted bytes said `data count section required`. **The list was written before GC existed and
nothing re-read it when GC landed** — the T10a emitter mechanism, seventh instance, and the second
one where the *assembler* emitted a module that is not WebAssembly.

`scripts/wat-corpus.ts` now runs the whole corpus as **assemble → decode+validate → `wasm-tools
validate`**, so all 528 modules wasmrt emits are read by someone who did not learn the conventions
from us. 🔒 **Proved it can fail**: with both fixes reverted, the gate reports
`WASM-TOOLS REFUSED OUR BYTES` (§5.9 — a gate you have not seen fail is a hypothesis). It also
checks the output file **exists** rather than trusting the assembler's exit text, because an
unrecognised assembler failure otherwise reappears as "wasm-tools could not read the file" — a true
statement filed under the wrong heading.

---

## §3.14 — **A FIELD RECORDED FOR ONE CONSUMER IS NOT A RULE THE OTHER CONSUMERS FOLLOW** (2026-09-20)

`Table::is64` was added for **import matching** — a 64-bit table must not satisfy a 32-bit import —
and its doc comment says it "decides what type every `table.get`/`set`/`grow`/`fill` operand has".
That sentence was true of the spec and false of our code: every table arm in the interpreter popped
an `i32` regardless, so a 64-bit index was truncated and `call_indirect` at `2^32` **called slot 0**.

The memory side had `pop_mem(is64)` from the day memory64 landed and was correct at all eleven
instructions. The difference is not care: memory64 arrived as a feature with its own operand rule,
table64 arrived as a *type-level* change and the operand rule was assumed to follow.

🎓 When a type gains a discriminant, the question is not "is it stored?" but **"which code reads it,
and which code should?"** A discriminant with exactly one reader is a lead, not a design.

