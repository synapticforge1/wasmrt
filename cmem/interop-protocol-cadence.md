<!-- Part of the wasmrt ⇄ wazmrt swappability contract (interop.md is its entry point and holds the CONTRACT VERSION).
     Split from the one file on 2026-11-25 by moving each section verbatim (owner: "perform the work on W3"). -->
# interop — §1c to §1e: two sessions, the cadence, the release lockstep

### 1c. 🚦 TWO SESSIONS ON ONE FILE IS A KNOWN FAILURE MODE (raised by wasmrt, 2026-08-19)

**wasmrt's diagnosis, and it is exactly right:** *"a version is a pin, not a lock — it makes drift
detectable, it does nothing to prevent a simultaneous write."* Both collisions on 2026-08-19 happened
because two sessions were editing this contract at the same moment; the CONTRACT VERSION told us
afterwards, which is not the same as preventing it.

**§1a removes the cross-tree half of that risk by construction** — neither side can now write into the
other's copy at all, so a simultaneous write can no longer destroy the other project's work. ⚠️ **What
it does NOT remove is two sessions editing the SAME copy** (two agents in one repo), where last-write
still wins and nothing detects it.

🚦 **Recommended to the owner, as wasmrt proposed: run coordination in ONE session at a time.** The
cheap discipline that makes the residual risk near-zero: when a `coordinate` pass is in flight in one
repo, do not run one in the other until it has reported.
---

### 1d. 🗓️ COORDINATION CADENCE — at the END of each track (owner, 2026-08-19)

🔒 **Decided by the owner.** Cross-project coordination runs **at the end of each track**, not
continuously and not mid-track.

- **during a track**
  - what happens: build and gate normally; **do not** open a coordination pass. If the work touches an in-scope surface
    (§0), note it and carry it to the end-of-track pass
- **end of a track**
  - what happens: run `coordinate` in full (§1b): compare copies, read the sibling's in-flight work, diff every in-scope
    row, **verify by running both on the same bytes**, record in your own copy, report to the owner
- **then**
  - what happens: **pause and wait for the sibling to reach the same point.** The project that is ahead holds

**Why end-of-track and not continuous:** a track is the unit that produces a *finished, gated* change,
and §1 rule 4 says a row is verified by **running both** — which needs something built and green to run.
Coordinating mid-track compares one settled implementation against one that is still moving, which
produces rows that have to be re-verified anyway.

⚠️ **This does NOT weaken the "coordinate BEFORE shipping a contract surface" rule in §1.** The two fit
together: *decide* a contract-surface change before building it, then *verify and record* it at the end
of the track. **zH3 violated the first half** — it was built while §3.7 still said neither project had a
bound — and the end-of-track pass is what caught it. **Both halves are needed; neither replaces the
other.**

🎯 **Current application (2026-08-19):** wazmrt finishes **Track H**, then **holds**. wasmrt coordinates
up to that same point. Cross-coordination resumes when both are at a track boundary. ⚠️ **While wazmrt
holds, its `1.0.1` is not "late" — waiting is the plan**, and a version that sits still because the
sibling is catching up is the cadence working, not a stall.

### 1e. 🔒 RELEASE LOCKSTEP — it ENGAGES WHEN wasmrt REACHES `1.0.1` (owner, 2026-09-21)

🗄️ **ENDED 2026-10-23, v33 (owner: *"we are officially out of lock step now due to differences"*).**
The two runtimes now differ BY DESIGN: wazmrt aligns `--features` with binaryang's D2, names and
meanings (v32), and the gate and the checklist are each repo's own. So neither runtime waits on
the other to release, and wazmrt's checklist gate 11 is retired. ⚠️ **What did NOT end:** the
contract rows (§2, §3) remain the shared reference for the CLI and security checks, and the
mirror rule (§1a: each side edits only its own copy, versions flow from the pen holder) stands.
The text below is kept as the record of what was agreed.

🔒 **Owner: *"wasmrt is catching up to this project and is about to release 1.0.0; when it hits 1.0.1 it
will be in lockstep."*** The trigger is **wasmrt's** version reaching `1.0.1`. From then on the two
runtimes release together.

🔒 **Owner, same day, later: wazmrt `1.0.2` SHIPS BEFORE wasmrt reaches `1.0.1`.**

| when | state |
| --- | --- |
| **now** | wazmrt **`1.0.1`**, Track B complete. wasmrt is **about to release `1.0.0`** |
| **wazmrt `1.0.2`** | ships on its own, under the ordinary checklist — lockstep is not engaged yet |
| **wasmrt `1.0.0`** | wasmrt's own milestone |
| **wasmrt `1.0.1`** | 🤝 **LOCKSTEP ENGAGES** |
| **after** | neither project releases until the **coordination pass** (§1b) has run and the **contract mirror is current**, meaning this file is identical in both trees |

⚠️ **CORRECTED THE SAME DAY — an inference is not a decision.** The first draft of this section said
the version numbers would be *equal* at engagement and *stay* equal. From that it concluded that a
wazmrt `1.0.2` would "move the target" and gave Track B a "second reason to hold". **The owner never
said the numbers must match.** The trigger is wasmrt reaching `1.0.1`, and the 1.0.2 decision makes
the difference explicit: at engagement wazmrt is expected to be *ahead* by one patch. 🎓 *A phrase
like "in lockstep" invites a precise reading the speaker did not make; record the trigger as said,
and ask before deriving a constraint from it.* ⬜ **Whether the numbers CONVERGE after engagement**
(does wasmrt skip to wazmrt's number, or do both move by their own patch increments?) is **not
decided** and nothing below depends on it yet.

📌 **This supersedes the wording in workspace letter H1**, which says *"lockstep at `1.0.0+`"*. The
owner's 2026-09-21 statement is the precise one: the engagement point is **`1.0.1`**, not `1.0.0` —
wasmrt passes through `1.0.0` without lockstep applying. ⚠️ **The letter is not wrong so much as
rounded**, and the difference is one whole release of wasmrt's during which neither side is held.

