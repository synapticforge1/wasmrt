# Best practices 3A.2 — the second borrowing round

Section 3A.2: the method wazmrt accumulated after 2026-08-14. Last verified: 2026-11-20. Split out on 2026-11-20 (memory guide, letter H38); the
sections below are moved verbatim.

### 3A.2 Second borrow round (2026-08-19) — the method wazmrt accumulated since 2026-08-14

🔒 **Same scope note as §3A.** These are process rules, read from a competitor's `best-practices.md`
under the owner's standing authorization to borrow *method*. Nothing here is evidence about wasmrt's
design, and nothing here reopens the oracle. Each is filed against the wasmrt task it bears on, because
a lesson with no task attached is the kind nobody re-reads.

#### For T11 — measurement, which is now the axis the contest is decided on

⚠️⚠️ **A benchmark whose FLOOR is larger than its signal measures the floor.** wazmrt's end-to-end CLI
harness put it 2.4× ahead of wasmtime; with process spawn excluded the two engines differ by **20–55×**.
A ~30 ms spawn floor did not add noise to a sub-millisecond quantity — it **hid the entire effect**, and
flattened a real module-size dependence into "nothing moves". **Measure the floor first and report it
beside every number**: `--version`, which does no wasm work at all, cost 30 ms vs 76 ms, so ~46 ms of a
~50 ms "engine win" existed before either engine started. → T9f already named T11's first job as *"a
benchmark that can resolve 5%"*; this says the harness must be **in-process**, and must state its own
floor.

**A RATIO is load-dependent while the DIFFERENCE is not.** The same benchmark gave 5.3× on a quiet box
and 2.4× on a loaded one while the absolute gap stayed ~29–48 ms — a fixed per-process cost shared by
both entrants inflates both sides and compresses the ratio. Quote the difference, or quote the ratio
with the load conditions attached.

⚠️ **A gate's number must be reproducible in the CONFIGURATION it was recorded in — and "configuration"
includes WHERE.** One unchanged wazmrt commit measured four different static-archive sizes, varying only
with the source-tree path and the cache path, because an unpadded archive embeds object/source paths;
the `.exe` and `.dll` absorbed the same difference inside PE alignment and looked perfectly stable. A
clean HEAD read **+152 bytes over its ceiling** and nearly bought a ceiling raise for bytes no change had
caused. ⚠️⚠️ **This is a direct hazard for T11's promoted footnote** — the artifact `rsxtk` links is the
**rlib**, which is exactly that kind of archive (metadata plus embedded paths). Measure it from a fixed
path, and **re-measure the parent commit in the same configuration** before charging a sub-KB delta to a
change. *(Third hole in this family, after "a size gate reads yesterday's artifact" in §3A.)*

**A recorded prediction that the measurement REFUTES is worth more than one quietly deleted.** Keep the
struck text in place beside the number that killed it.

**A FIX task changes the code; a COMPARE task measures it against something else — do not keep them in
one queue.** A compare task can never be "done": rivals ship new versions and corpora grow, so its
residuals regenerate by construction, and it is scheduled when a NUMBER is wanted rather than when a gap
is found. ⚠️ It is also the only kind of task that pulls **external dependencies** into a project whose
stated invariant is zero of them. **T11 holds both kinds**: the optimization review is a fix task; the
same-machine comparison against wasm3 / WAMR / wazmrt is a compare task. Sort work by what it CHANGES
before sorting it by priority.

#### For T10 / T10a — the emitter audit, and what its planned gate cannot see

🚨🚨 **A ROUND TRIP PROVES AGREEMENT WITH YOURSELF.** wazmrt gave its non-null abstract reference types
synthetic valtype bytes "in an otherwise-unused range", and its emitter wrote them out raw — so
`(ref i31)` assembled to the single byte `0x62`, where the spec form is `0x64 heaptype`. Every module it
produced was invalid to every other runtime **for nine months**, and its entire conformance corpus was
blind by construction: the decoder accepted both spellings, so its own output round-tripped and
everyone else's input read fine. **The corpus run before and after the fix is byte-identical.**
⚠️⚠️ **T10a's gate is a round-trip property test, and this is precisely the class a round trip cannot
see.** Add an external arm — hand the assembled bytes to wasmtime, or assert the bytes directly.
**When a bug is only visible to a third party, the test has to BE a third party.** The design half is
worth having too: **reserve internal tags OUTSIDE the format's space, or convert at the boundary —
"currently unused" is a statement about today's spec** (by 2026 `0x62` had become the
custom-descriptors `Exact` prefix, so wasmtime rejected the output with *"unexpected exact type"*).
*wasmrt holds the DECODE half of this invariant since T2 — internal tags `0xD7`–`0xFA`, raw ones
rejected. What T10a has to check is the EMIT half.*

**A trailing-element grammar must be CHECKED FOR LENGTH, not indexed from the end.** Three separate
wazmrt parsers took `l[l.len - 1]` and silently ignored everything between, and all three failed in the
same direction — **a module that VALIDATES with weaker typing than its source asked for**. Grep `wat.rs`
for the Rust spellings (`.last()`, `[len - 1]`) at T10; three instances in one session is a pattern.

**A BLANKET REFUSAL CAN HIDE A MISSING RULE — enumerate what it is catching before deleting it.**
wazmrt's wholesale `delegate` refusal was also the only thing rejecting a bare `(func (delegate 0))`,
which its assembler happily emits and the spec calls malformed; removing the refusal without adding the
enclosing-frame rule would have converted a spec malformation into an accept-invalid. ⚠️ **wasmrt
rejects `delegate` the same way today** (a recorded divergence, `known-issues.md`) — so this is the
checklist for the day that decision changes. Related: **a test that asserts a REFUSAL is a test of a
DECISION and expires with it — rewrite it in place rather than deleting it**, because the reasoning in
a refusal test is usually the best available summary of what the replacement rules must cover.

**THREE SPELLINGS OF ONE LIST WILL DRIFT — derive it, or pin NAMES AND VALUES, not lengths.** wazmrt
shipped a header advertising `TAIL_CALL = 14` while its C-ABI enum's validity check hardcoded `<= 13`:
the setter returned false and did nothing, while its all-features call disabled the feature anyway.
**The header advertised a switch that was not there.** 🆕 **Checked against wasmrt the same day, and the
gap is real** — logged in `known-issues.md`: the proposal list is spelled three times and **nothing
compares them**.

**SCORE THE SAME ERROR THE SAME WAY ON EVERY PATH.** A classification rule that one call site does not
consult is a rule with an exception nobody wrote down — 14 of a reported 104 "failures" were that one
inconsistency.

#### For triage — how to read what is left (172 failures, 1,024 skips)

✅ **DONE 2026-08-19, and the borrowed rule paid twice.** The skip census is now **permanent**
(`Summary::skips`), not a throwaway probe — see §5.6 and `testing.md`. It showed 91% of the skips were
cascades and reduced 1,024 of them to **seven items**.

⚠️ **When a skip has no recorded reason, INSTRUMENT it — do not reason about it.** A throwaway probe
(source line plus error name at every skip site, run over the corpus, then reverted) produced wazmrt's
whole breakdown in one pass — **and overturned the scoping written from reading the files: two of the
four cases classified as SCORING bugs were decoder and assembler gaps that rejected VALID modules.**
A wrong diagnosis that agrees with the evidence you *chose to look at* is the expensive kind.

**A SKIP TOTAL IS DOMINATED BY CASCADES — ask how many MODULES are behind it before ranking the work.**
144 skips looked like five separate problems; 109 were one untargeted proposal and only ~34 were direct
— ten modules that fail to assemble, and 99 `assert_return`s cascading behind them. This is §1.3 read in
the other direction: the same cascade that makes a small fix worth hundreds of passes makes a skip total
a poor size estimate. Measure the causes, not the column.

**A "0 FAILED / 0 SKIPPED" CORPUS IS NOT "EVERYTHING RAN" — read the file-error count.** A file that
dies in the lexer contributes to none of the three usual columns, so the score can look perfect with a
whole file unexecuted. **Quote all four numbers.** *(wasmrt has paid this once already in a different
shape — the `.wat` gate that ran assemble only, §1.5a.)*

**A REFUSAL IS NOT A HOLE — rank security work by what a gap PERMITS, not by the size of the failing
number.** A module the runtime *rejects* cannot do harm, so implementing the proposal behind those
assertions **adds** attack surface rather than removing it. A conformance total counts disagreements,
not exposure; they are different axes and a big number on one says nothing about the other. → T12
scoping.

**A well-argued entry in a baseline is still an entry** — and the better the explanation, the longer it
sits unexamined, because nothing prompts you to revisit the ones you already justified.

#### For T12 — the security review

⚠️ **AN ENFORCEMENT ARM THAT RUNS *BESIDE* THE THING IT CONSTRAINS ENFORCES ONLY WHAT ITS CALLER
REMEMBERED TO ASK FOR.** wazmrt's feature gate sat next to `validate`, so its C ABI gated with the
embedder's feature set and then validated with **all** features — the set decided which proposals were
ADMISSIBLE while the all-features rules decided what they MEANT, and one instruction was typed by a
relaxed proposal rule with that proposal switched off. No gating test could see it, because the
instruction exists either way and was never refused. **When two calls must agree, make them one call —
"kept in step" is a property of the last person to edit.** 🆕 **A new row for T12z's invariant table.**
*(wasmrt's C ABI does call `validate_with_features(&md, &e.features)` — `crates/wasmrt-capi/src/lib.rs`
:693 and :725 — so it appears to hold at that site; T12z's whole method is to enumerate EVERY entry
point rather than spot-check one.)*

**A PROPOSAL THAT SHIPS WITHOUT A GATE IS NOT "ENABLED BY DEFAULT" — IT IS UNREFUSABLE**, and a
per-proposal checklist cannot ask this question about itself; it lives one level up. Put *"does it have
a gate, and is that gate tested?"* in every proposal's deliverables, and when scoping a track that
claims a gate exists, **grep for the gate**. *(T9f did this right — the flag exists only now that the
feature does. The lesson is to keep that structural rather than remembered.)*

**A front end that grows its FIRST DECISION needs its first test target in the same commit** — and if it
parses untrusted input, it belongs in the **memory-safety gate**, not only in `test`. wazmrt's
`--features` parser sized a buffer from a TYPE (`count * 2`) and never bounded the index: every item had
to be a valid proposal name to be stored, which is exactly what made it read as safe, but nothing stops
a caller *repeating* one. **"Every element is validated" is not "the count is bounded."** ⚠️ The rewrite
that removed the array also removed 512 bytes — the fix for a memory-safety bug came out smaller than
the bug.

**AN AMBIGUOUS INPUT SHAPE IS REFUSED, NOT RESOLVED** — choosing a reading would be a precedence rule
nobody reviewed. And the mirror: **an unrecognised item is an ERROR, never a skip**, or the user believes
they restricted something they did not.

#### For tests — and for mutation verification specifically

⚠️ **An inversion that catches NOTHING has three causes, and they need three different responses:**

1. **The arm is genuinely redundant** → *delete it.* **A redundant guard carrying a false justification
   is worse than no guard: it teaches the next reader the wrong rule.**
2. **The arm has a MIRROR that catches the case instead** → *keep both, and say so.* Delete either on
   the strength of a green suite and the module is accepted the moment its mirror is touched.
3. **The arm defends a path the tests cannot reach** → *keep it and write down why* — e.g. the
   unvalidated run path, where a hand-built module can pair any value with any descriptor.

⚠️ **The failure mode is treating all three as case 1. "No test caught it" is a question, not a verdict**
— the same shape as *finding a real defect at a layer is not evidence it causes your symptom* below.

🔒 **For a SOUNDNESS rule, write the WRONG ANSWER down.** A score cannot tell you a rule is enforced,
only that the files you looked at got better: wazmrt landed correct exactness arms in both subtyping
paths, measured 0 regressions and 7 improvements, and `ref.test (ref (exact $super))` still answered
**1** for a subtype, because four cast sub-opcodes read their target through a path that dropped the
prefix. **Three soundness defects on that branch passed the entire corpus and were found only by
constructing the case.** The test to write is not *"does the feature work"* but *"does the thing that
must NOT match, not match"* — plus its neighbours, so a blanket refusal cannot pass for the right
answer. **A green suite is evidence about the tests, not about the code.**

**Type the block at the DISTINGUISHING type, and balance the stack EXACTLY**, when the property under
test is which branch fires or which operand is consumed. A block typed at the top type accepts either
branch shape, so a direction bug passes every execution test; a stack-polymorphic `return` swallows a
leftover operand, so a missing pop type-checks cleanly.

**A test that fails because its EXAMPLE was implemented is stale, not broken.** Three outcomes are
genuinely different — the code is wrong, the property is wrong, or **the example drifted** — and the
third is the one that looks like the first. Keep the property, re-pick the example, and **pin the
inverse case beside it** so the pair can only pass if the distinction is actually being drawn.

#### For scoping, and for this memory itself

🚨 **BEFORE SCOPING A TRACK, GREP FOR THE THING YOU ARE ABOUT TO BUILD.** wazmrt scoped a ~5-item
security track that was **~70% already built** — per-proposal gating had shipped six days earlier, and
**the same file contradicted itself two sections up**, where its own change table marks the step done.
🎓 **This is the exact inverse of recording work as DONE that was not, and the root cause is identical:
a status line written from an ARGUMENT rather than from the code.** Both directions cost real time and
both are prevented by the same five-second habit.

⚠️ **"BY DESIGN" AND "OUT OF SCOPE" AGE BADLY BY DEFINITION.** They are statements about SCOPE on one
date, so every line expires the moment the scope moves — and nothing about them fails a build, which is
why they are the entries least likely to be checked and most likely to read as current. wazmrt's
by-design list named three untargeted proposals and two of the three shipped within a week. **Re-read
scope invariants whenever a track closes. And a CORRECTION is a dated claim too** — a note marking a
list stale was itself stale within the hour.

⚠️ **A REOPEN CONDITION IS NOT SELF-CHECKING — re-test it when you price the entry.** wazmrt's standing
delta carried the condition *"an oracle appears"*, which was **false the day it was written**: the tool
that implements exactly that behaviour lives one sibling directory away. **"We cannot" and "we have
chosen not to" are different claims, and only one of them ages.**

⚠️⚠️ **"UPDATE THE PROJECT MEMORY" MEANS AUDIT FOR STALE LIVE CLAIMS, NOT EDIT THE FILES YOU HAPPENED TO
TOUCH.** A wazmrt session that revised six `cmem` files left six stale claims standing — including the
headline score heading, the single line most likely to be quoted, in a file that had just been edited
twice. Two numbers were stale in **both directions and disagreed with each other**. **The audit that
works is a grep for the OLD VALUES, then classifying every hit as live (fix) or dated history (leave,
and mark it superseded if it claims to be current). When two files disagree, do not pick the newer one —
MEASURE.** Watch for the words *"final"* and *"the number to quote"*, which both appeared on figures
superseded within days. 🆕 **Applied to wasmrt on 2026-08-19 and it paid on the first grep**: the roadmap's
own status block and `overview.md` were still quoting the pre-tail-call suite, and every recorded `.wat`
corpus figure (533/534, 534/534, 533/533) is against a denominator that **no longer exists** — the tree
holds **532** `.wat` files today. See `testing.md`. This rule is now part of the binding trigger in
`INDEX.md`.

**When a claim will LEAVE this repo — a commit message, a cross-project report, a number in a README —
verify it against the ARTIFACT, not against something that talks about the artifact.** Three
read-not-verify errors in one wazmrt session: a CLI's `valid wasm v1` header read as a verdict, a
benchmark's missing `--` read as a competitor's defect, and a doc comment's SUBJECT read as a field
name — the last of which arrived here as advice naming a `Pools.type_canon` that does not exist
(`known-issues.md`). **Advice with a wrong mechanism is worse than no advice, because the recipient has
to disprove it.** ⚠️ This binds symmetrically: wasmrt sends reports back the other way.

**A DIFFERENTIAL CHECK WITH NO PRIVILEGED ORACLE FINDS THINGS A GOLDEN FILE CANNOT.** Requiring every
runtime to *agree* — rather than trusting one as the answer — found a one-byte disagreement on its first
run, across five implementations including V8, against wasmtime 47.0.3. ⚠️ And the discipline continues
past the finding: **the cause was not traced, so it is recorded as an observation, not a diagnosis.**
→ this is the shape T12x should take now that the oracle is retired: not "diff against the oracle" but
"require agreement, and record disagreements as observations".

#### For the development machine — a build blocker, misdiagnosed FOUR times

*(Machine specifics — which drive, which volume, which tools — are private, in the gitignored
`cmem/local/environment.md`.)*

⚠️⚠️ **FINDING A REAL DEFECT AT A LAYER IS NOT EVIDENCE THAT IT CAUSES YOUR SYMPTOM.** wazmrt's build
failure on an exFAT volume was blamed on failing hardware (a burst of disk-error log entries —
**all from a week earlier; the timestamps were never read**), then on antivirus (refuted: the agent
blamed was not the one running), then on a genuine volume fault that the OS's own health check found.
**Fixing that fault worked, and the build failed exactly as before.** Each of the three found
something real and stopped there, *because a confirmed defect feels like an answer*.

**What finally worked was varying ONE THING AT A TIME** rather than reasoning about which layer looked
guiltiest — and the cause is the **cache LOCATION**: a build cache on a volume with no hard links or
reparse points (exFAT) survives exactly one build and is then poisoned. ⚠️ **A workaround that works
exactly once is a clue about FREQUENCY, not a failed fix — ask what makes the second attempt
different.** Two further rules from the same incident: **identify the LAYER (physical disk → volume → OS
→ application) before naming a cause**, since each has its own cheap health query; and **search `cmem`
for the environment before diagnosing the environment**, because both repos had already recorded the
volume's filesystem and two wrong causes shipped in four commit messages for want of a five-second grep.
→ For wasmrt this predicts the same shape for a cargo `target/` on such a volume; the fix is a cargo
target directory on an NTFS path, and it belongs with the recorded hard-link warnings.

#### Third borrow round (2026-08-19, `coordinate`) — one rule, and both projects had just proved it

⚠⚠ **A CHANGE’S OWN NEW SURFACE IS THE ONE PLACE THE AUDIT THAT PRODUCED IT WILL NOT LOOK.** wazmrt
found that a host flag written after a guest argument is **silently donated to the guest and never
applied** — and demonstrated it with `--max-iterations`, **a flag its own track had added hours
earlier**. The audit that introduced the surface did not re-audit it.

🎓 **This project produced an independent instance the same day, which is why it is being written down
rather than merely borrowed.** Implementing the six GC array bulk ops meant adding six new internal `Op`
tags — and three of them (`0xcd..0xcf`) landed **outside** the decoder’s internal-tag guard, so a raw
`0xcd` byte would have decoded as `array.copy`. **That is the tag-space hazard recorded in §3A.2 the
same morning, re-created within hours, in the surface the change itself created.** Neither the existing
tests nor the corpus would have caught it; the guard was extended only because the rule was fresh.

**The habit that follows:** when a change adds a *kind of thing* — a flag, an opcode tag, an error
variant, a config field — **re-run the audit that governs that kind of thing against the new members,
before the change lands.** The check already exists; what is missing is applying it to what you just
wrote. *(Both instances: wazmrt H7 / interop v10; wasmrt’s `0xcd..0xcf` guard, `known-issues.md`.)*

🔻 **And the pen-holder’s duty this round taught, worth keeping:** *a refuted claim left in the table is
what the next reader quotes.* An annex records a finding; **the table is what gets believed** — so
folding a correction into the row it refutes is the job, not an optional tidy-up. wazmrt folded wasmrt’s
F4 into `interop.md` §2.2 for exactly that reason.

---

