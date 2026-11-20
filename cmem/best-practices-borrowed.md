# Best practices 3A — lessons borrowed from wazmrt

Section 3A: what wasmrt took from wazmrt's lessons, with the owner's leave. Last verified: 2026-11-20. Split out on 2026-11-20 (memory guide, letter H38); the
sections below are moved verbatim.

## 3A. Borrowed lessons — from wazmrt's `best-practices.md` (owner-authorized read, 2026-08-14)

🔒 **Scope of this exception.** The oracle is retired for *correctness answers and design* (§
`design-decisions.md`): wazmrt is a competitor and its implementation choices are not evidence about
wasmrt's. **Reading its accumulated METHOD is a different act** and the owner authorized it explicitly.
These are process lessons, adopted because they are true independent of either codebase — not because
wazmrt holds them. Nothing here reopens the oracle.

**Several arrived as independent confirmation**, which is worth more than novelty: *"our assembler is not
an oracle for our decoder"* (wazmrt: four occurrences in two days; wasmrt: four, §3.7 + T10a) and
*"a new test that has never failed has not been shown to test anything"* (wasmrt's §4.2a, which adds the
harder half — **confirm the mutation applied**, since a no-op mutation and a worthless check produce the
same observation).

What is genuinely **new to wasmrt**, and all of it bears on T11:

- ⚠️ **"A goal with no gate is a preference."** *"Smallest binary" was a stated goal for a month with
  nothing measuring it, and the artifacts doubled.* wasmrt has size **measurements** and **no size gate
  at all** — and size is now the axis the inclusion contest is decided on (`vision.md`).
- ⚠️⚠️ **"A gate only gates the commits that RUN it."** wazmrt *built* a size gate that works correctly
  and still accrued +22 KB exe / +24 KB lib / +19 KB dll of undetected drift, because commits did not
  invoke it. **A gate needs a trigger, not just an existence.** Applied here the same day: the two
  cross-module reproducers were green and nothing ran them — now `regression_wast.rs` does, under
  `cargo test`.
- ⚠️ **"A size gate reads whatever is on disk, including yesterday's artifact."** *A number that matches
  the ceiling to the byte is evidence of a stale file, not of a change that cost nothing.* Directly
  threatens T11's measurements: **build every artifact you are about to report**, in the same run.
- **"Attribute an overshoot before paying for it."** Measure the parent commit in a worktree rather than
  assuming the growth is yours — the answer came back both ways on different releases, and both answers
  were only worth having because the measurement was made. ⚠️ **This is the missing method for the
  unattributed ~5% steady-state regression**, which two hypotheses failed to explain: bisect it against
  the parent commits rather than reasoning about likely causes.
- ⚠️⚠️ **"Two consumers agreeing is not corroboration when they share the mistake — and there can be
  THREE."** A `try_table` catch label was resolved one frame too deep by the assembler, the validator
  **and** the interpreter, identically, so every round trip was self-consistent and the whole corpus was
  green. **No test could have found it; only the spec rule did.** *Count the implementations of a rule
  before trusting that they check each other* — and note this is the exact hazard §3.9 above just
  realized, from the other direction.
- **"An encoding chosen to make EXECUTION agree can erase the distinction VALIDATION runs on."** Ask what
  an encoding throws away, not only what it preserves. → a named item for **T10a**'s shorthand review.
- **"A tag added to one of two readers works in half the positions."** When a type gains an encoding,
  grep for **every** reader of that encoding.
- **"Never green-wash our own gaps."** An unimplemented form is not evidence a module is invalid.
  *(wasmrt already does this — the runner separates "nothing defines this import" from "wasmrt cannot
  back this kind" — but it is worth keeping stated, because it is the failure mode that makes a
  conformance number a lie.)*

