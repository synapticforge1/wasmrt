<!-- Part of the wasmrt ⇄ wazmrt swappability contract (interop.md is its entry point and holds the CONTRACT VERSION).
     Split from the one file on 2026-11-25 by moving each section verbatim (owner: "perform the work on W3"). -->
# interop — §3.7a The execution bound

### 3.7a The execution bound — ✅ **CLOSED 2026-09-19 (v19): BOTH runtimes implement it, verified by running both. The UNIT matters more than the number**

🔒 **Owner decision, 2026-08-19** (this resolves §5 decision #3): *"We do not want an infinite loop on
purpose or by accident by the user. We need an internal check mechanism if this occurs and an error
message to the user with a break on occurrence."*

⚠️ **PROCESS NOTE, RECORDED RATHER THAN TIDIED AWAY: wazmrt shipped this BEFORE the contract carried
it, which §1 rule 1 forbids** (*"a change is proposed in one repo and lands in both … before either
ships behaviour that depends on it"*). The behaviour was built in wazmrt's Track zH3 while this row
still read *"neither has one"*. Nothing about the design is retracted — the owner asked for it — but
the ordering was wrong, and this row is the correction, not the announcement.

**Verified by RUNNING both on the SAME BYTES** (§1 rule 4), 2026-08-19 — one `.wasm` assembled by
wasmrt's own `wasmrt wat`, containing `(loop (br 0))` and `(func $f (return_call $f))`:

| runtime | `spin` (loop) | `tailspin` (tail call) |
| --- | --- | --- |
| **wazmrt** | traps `IterationLimitExceeded`, exit 1 | traps `IterationLimitExceeded`, exit 1 |
| **wasmrt** | ⚠️ **hung** (killed at 10 s) | ⚠️ **hung** (killed at 10 s) |

**So a module that returns an error under one runtime hangs the host under the other. That is the
swappability break §5 decision #3 predicted, and it is live today.**

✅ **CLOSED 2026-09-19 — wasmrt landed the bound in T9i, and the pen-holder VERIFIED IT BY RUNNING
BOTH rather than accepting the report** (§1 rule 4). One `.wasm` containing `(loop (br 0))` and
`(func $f (return_call $f))`, both runtimes, same bytes, `--max-iterations 1000000`:

| | `spin` (back-edge) | `tailspin` (tail call) |
| --- | --- | --- |
| **wazmrt** | ✅ `trap: IterationLimitExceeded`, rc 1 | ✅ `trap: IterationLimitExceeded`, rc 1 |
| **wasmrt** | ✅ `trap: iteration limit exceeded`, rc 1 | ✅ `trap: iteration limit exceeded`, rc 1 |

**Both message rows are met on both sides** — each names the ceiling that was hit and how to raise it,
and neither claims to have detected an infinite loop. **The differential table that opened this section
— wazmrt trapping, wasmrt hanging — is now green in every cell.** §5 decision #5 closes.

🔬 **wasmrt re-measured the default on its own corpus rather than adopting the number on trust**, which
is exactly what this section asked for: green at `1<<20`; at `1<<19` `return_call.wast` and
`return_call_ref.wast` fail; at `1<<18` `return_call_indirect` joins them; 36 failures at `1<<14`.
✅ **Same shape as wazmrt's descent** — the heaviest legitimate workload is the million-hop chain in both
— so the two engines agree about where the floor is, and `1<<30` is ~1000x the measured peak on both.
🎓 *Two independent measurements landing on the same shape is what makes `1<<30` a measured default
rather than a shared guess.*

⚠️ **THE C ABI TAKES `0` AS "LEAVE THE DEFAULT", NOT "UNLIMITED" — and the asymmetry with the CLI is
deliberate on wasmrt's side.** A library embedder must not remove the bound by passing zero, which is
what every other ceiling setter already means; a person at their own terminal may, via
`--max-iterations 0`. 📌 **RECOMMENDED for wazmrt where it exposes the bound through its own C API** —
this is an ABI-surface convention rather than a CLI row, and §0 keeps the C ABI out of scope, so it is
recorded as a **strong recommendation, not a binding row**. ⚠️ **If wazmrt chooses the other
convention, that is permitted and must be DOCUMENTED**, because an embedder porting between the two C
APIs would otherwise disarm a ceiling by writing the same zero.

🎓 **A LESSON FROM VERIFYING THIS, and it sharpens §4 checks 6 and 7.** The pen-holder's first run put
`--max-iterations` **after the export name** — a guest position — so it never applied; the run then
exited **rc 1** anyway, from an argument-count error. ⚠️⚠️ **An `rc != 0` assertion would have recorded
that as the bound working.** zH7's warning is the only reason it was caught. **So a differential check on
the bound must assert the TRAP, not merely a non-zero exit** — and must place the flag in a host
position, which differs between the two CLIs. *The check that only reads the exit code passes for the
wrong reason, which is worse than failing.*

#### The agreed design — what wasmrt must implement to close it

| item | agreed value | why it is in the contract |
| --- | --- | --- |
| **the unit — ONE ITERATION** | **one loop back-edge, OR one tail-call hop** | 🎯 **THIS IS THE ROW THAT MATTERS.** Two runtimes with "a limit of `1<<30`" that COUNT DIFFERENT THINGS are not swappable: a module finishing just under the ceiling on one traps on the other. Aligning the number while leaving the unit unstated would look like agreement and behave like divergence. **Counting instructions instead of back-edges is a contract breach even at the same number.** |
| **default** | **`1 << 30`** (1,073,741,824) | measured, not chosen — see below |
| **scope of the budget** | **per top-level invocation**, refilled on entry | so a long-running host loop calling many short guest functions is never starved |
| **re-entry** | a host callback calling back in **inherits the remainder**; it does NOT refill | a guest that can refill its budget by bouncing through a host function does not have a budget |
| **what happens** | a **trap** — an ordinary trap on the runtime's normal trap path | not an abort, not a process exit |
| **CLI flag** | `--max-iterations <count>`, in the **leading run of host flags** (§2.4) | position is part of the flag contract, not a detail |
| **`0` at the CLI** | **unlimited** | |
| **the message** | must state the **ceiling that was hit** and **how to raise it** | |
| **what it must NOT claim** | it bounds non-termination; it does **not** detect an infinite loop | a legitimately long-running module trips the same trap, and its owner needs to be told to raise the ceiling — not told a falsehood about their program |
| **a count, NOT a clock** | binding | a wall-clock deadline makes the same module trap on a slow machine and pass on a fast one — the two runtimes would then disagree *by machine*, which is unswappable by construction. It also cannot be enforced without a thread and a clock, which the freestanding target does not have. |

⚠️ **Why the tail-call tick is called out separately: a back-edge counter alone looks complete and is
not.** A local `return_call` reuses the interpreter's native frame *by design*, so it makes no backward
branch and grows no call depth — the call-depth ceiling cannot see it either. `(func $f (return_call
$f))` runs forever under a back-edge-only design. **Both runtimes recurse natively for `call` and both
implement tail calls, so this applies to both.** ⚠️ It is also the tick whose absence is invisible to an
obvious test: delete it and the loop test still passes.

**The default is measured, and the method transfers** — run the spec corpus at descending budgets until
it breaks. wazmrt's result (284 files): green at `1<<20`; at `1<<18` **only** `return_call`,
`return_call_indirect`, `return_call_ref` fail; at `1<<14`, 36 failures across 8 files. The heaviest
legitimate workload in the suite is `return_call.wast`'s **million-hop chain**, which fits under `1<<20`
with under 5% to spare — so `1<<30` is ~1000x the measured peak. ⚠️ **wasmrt should re-run this against
its own corpus rather than adopting the number on trust**; if its peak differs materially, that is a
finding about one of the two engines and belongs in §4 as an observation.

⚠️ **Keep the new error OUT of the "is this a spec trap?" predicate** in the `.wast` runner (wazmrt:
`isRuntimeTrap`). An engine resource cap must not satisfy an `assert_trap` meant for real trapping
behaviour — and excluding it has a second payoff: **the conformance corpus becomes a live gate on the
ceiling**, failing loudly when the budget is set too low instead of banking the timeout as the expected
trap. That is what made the measurement above possible.

**REOPEN / CLOSE CONDITION:** this row becomes ✅ AGREED when wasmrt ships the bound with the same unit
and default, and the differential table above is re-run with both trapping. **Until then a deployment
that swaps wasmrt in loses the protection silently** — there is no error, the workload simply never
returns. *(Same failure shape as the pin-DB path risk in §3.3: a swap that disarms without saying so.)*

#### Where each side tracks the work

| project | item | state |
| --- | --- | --- |
| **wazmrt** | Track **zH3** (hardening, ships as `1.0.1`) | ✅ **built 2026-08-19** — `--max-iterations`, `IterationLimitExceeded`, 4 tests covering both shapes + the no-false-positive and refill directions; corpus descent measured; cost exe +1,024 B / lib +512 B / **dll +0** |
| **wasmrt** | **T9i** (ships as `1.0.1`) | ✅ decided, `[ ]` not yet built — owner: *"3 has already been decided in the wazmrt project, just follow their lead"* |

✅ **The two designs were written independently and agree** — `u64::MAX` filled at refill for
"unlimited", the two `0` conventions, the trap excluded from the `.wast` runner's spec-trap predicate,
the refill/re-entry rule, and the message wording. That agreement is *evidence the contract is
specific enough to build from*, which is the only thing this file is for.

⚠️ **wasmrt's plan caught a real gap on wazmrt's side, which is this file working as intended.** T9i
requires **A/B/A throughput benchmarking** around the change, because wasmrt has a recorded case
(T9a#7) of threading state through the same interpreter loop costing **3.6%**. wazmrt had measured only
SIZE (+1,024 B exe, +512 B lib, **+0 dll**).

✅ **wazmrt has since run it, and the cost is real: ~3% on a tight loop.** A/B/A on the steady bench
(`sum(1e6)` ×50, ReleaseFast), removing and restoring both tick sites: **34.29 → 33.45 → 34.62
ns/loop-iter** (233 → 239 → 231 Mops/s). A-to-A spread is ~1%, so the ~3% A-vs-B gap is above this
box's noise but close enough to it that **B is a single sample and deserves a repeat**. The tick sits
in the hottest loop in the program and the bench is dominated by back-edges, so this is close to a
worst case rather than a typical one.

📌 **Recorded for wasmrt's planning, NOT as a contract row — §0 puts performance explicitly out of
scope**, and no row may be justified by what the other one measured. **Expect a few percent; it is not
a defect.** ⚠️ **But one performance response WOULD be a contract change:** amortizing the tick to
every *N*th back-edge alters the **granularity of the unit**, so the same ceiling would stop meaning
the same thing on both sides. Neither project may do that unilaterally.

---

