# interop.md — the **wasmrt ⇄ wazmrt swappability contract**

**CONTRACT VERSION: 41 — wazmrt LEADS (owner, 2026-08-19).** **v41 (2026-10-26): record-only — §3.1 `.wat` pins: a
`(@custom "name" …)` is the only `name` section on BOTH runtimes now (wazmrt `852ff84`, I8 on wasm-tools 1.262); and
every version through v40 is MIRRORED (the two copies' SHA-256 equal, wasmrt `2ee6628`) — the ⏳ marks on v18–v40 record
each row's state when written** ⏳ PENDING MIRROR. **v40 (2026-10-24): a correction to v39 — wazmrt did NOT meet D2's
table-initializer encoding rule (found by wasmrt); fixed, 2,401 / 0 differ on both** ⏳ PENDING MIRROR. 🔒 **v39
(2026-10-24): value types follow binaryang D2 2.2.0's `typeRules` (wasm-tools' rule) — AGREED on both (wazmrt 4.0.0,
wasmrt 1.0.0: 2,352 / 0 differ)** ⏳ PENDING MIRROR. **v38 (2026-10-24): record-only — `--features` AGREED on both
(re-run: 2,352 / 0 differ); the ladder line corrected (wasmrt's T13 is met in its source)** ⏳ PENDING MIRROR. 🔒 **v37
(2026-10-24): §2.2 `--features` — wazmrt implements binaryang D2's names AND meanings (per-instruction gating = D1's
column; D2 presets; wasm-tools-only names deprecated); wasmrt migrates once, to this** ⏳ PENDING MIRROR. **v36
(2026-10-24): record-only — §5 #13 MET on both sides (wasmrt `cfeee31`, re-verified by running both)** ⏳ PENDING MIRROR.
🔒 **v35 (2026-10-24): §2.2m's stale wasmrt cells REFRESHED by running both — all agree but two, now owner decisions: a
WASI guest sees ONLY `--env`, well-formed, last KEY wins (§5 #13, wazmrt fixed, wasmrt changes), and a `--pins` DB that
cannot be read is an ERROR (§5 #14, wazmrt fixed, shipped as a patch)** ⏳ PENDING MIRROR. **v34 (2026-10-24):
record-only — wasmrt's second history rewrite; the four quoted wasmrt ids replaced, one of them a v31 typo** ⏳ PENDING
MIRROR. 🔒 **v33 (2026-10-23): (1) RELEASE LOCKSTEP ENDED (owner: "we are officially out of lock step now due to
differences"), §1e; the contract rows and the mirror stay. (2) v32 covers MEANINGS as well as names (owner: "aligning
with binaryang means its meanings also"). (3) wasmrt's two annexes §2.2f / §2.2m are FOLDED, and the copies were
byte-identical at the fold** ⏳ PENDING MIRROR. 🔒 **v32 (2026-10-23): the owner REVERSES v30's direction: `--features`
aligns with binaryang's D2 vocabulary, not wasm-tools'** (§2.2's row; record-only until binaryang's FL1 settles the
spellings) ⏳ PENDING MIRROR. 🆕 **v31 (2026-10-23): wasmrt's commit ids are its post-rewrite ids** (workspace letter
H21; no row's meaning changes) ⏳ PENDING MIRROR. 🆕 **v30 (2026-09-21): `--features` takes wasm-tools' whole vocabulary
with wasm-tools' meanings, proven identical by one shared measurement matrix** (§2.2). 🚨 **v29 (2026-09-21): `.wat` pin
portability is BROKEN on purpose** — wazmrt `1.0.2` fixed letter H13's three encoder divergences from wasm-tools, and
pins now agree with wasmrt on 64/528 until wasmrt makes the same fixes (§3.1). 🆕 **v28 (2026-09-21): §5 #12 CLOSED by
amending §2.4a to match the code** (exact wazmrt flag names after the first guest word are an error; only `--` hands off
unconditionally), **and wazmrt `1.0.2` ships before wasmrt reaches `1.0.1`** (§1e revised). 🆕 **v27 (2026-09-21) CLOSES
§5 #10 by giving the `--dir` host half a GRAMMAR** — a relative path must say `./` or `../`, which makes a leading
`<letter>:` a drive by grammar instead of by resemblance, so the heuristic v14 forbade is deleted rather than exchanged.
🚨 **It also fixes a defect the row never suspected: the drive rule had no platform branch and was shipping to Linux and
macOS.** ⚠️ **wazmrt is now the stricter side of a CLI row for the first time — so this one needs a mirror in the other
direction.** The wasmrt half is **UNMEASURED**; the check is written into the §2.2 row. wazmrt is finishing its
hardening stage and **its copy is the latest**; wasmrt mirrors from it and **does not originate version numbers** until
wasmrt reaches the same stage. ✅ **THE 2026-09-19 OWNER DECISIONS ARE FOLDED IN AND NUMBERED HERE** — **§2.4a as v11**,
**§2.5 as v12**, wasmrt's **§2.3m annex as v13** (the §2.3 Z1 row, and row 3 promoted to ✅ AGREED), 🔒 **the owner's
NO-"LOOKS LIKE" clarification as v14 (§2.4a-i)**, and 🔒 **the owner's same-day NARROWING of §2.4a as v15** (after the
module path a single-dash token is the guest's). ⚠️ **v14 puts §2.2's `--dir` drive-letter fallback in tension and needs
an owner ruling (§5 #10).** 🆕 **v16 adds §2.4b: a flag with a REQUIRED position, written where it cannot apply, is an
error** — and wazmrt has **shipped** it. 🆕 **v17–v20 fold in wasmrt's T9e + T9i (2026-09-19):** **v17** Z4, `.wat` pin
digests are not portable and the cause is the `name` section · **v18** the pin DB path is DECIDED (§3.3), closing §5 #1
· **v19** §3.7a is CLOSED, verified by running both, closing §5 #5 · **v20** §2.1/§2.2 convergence — wasmrt's column is
green and wazmrt's halves are what remain. ⚠️⚠️ **v20 also carries a NEW wazmrt defect this pass found by running:
`--dir .:/` — the example wazmrt's own `--help` prints — DOES NOT WORK**, and the cause is the drive-letter heuristic
already flagged at §5 #10. 🚨 **v15 exists because §1c happened again while this very pass was running** — both sessions
edited their own copies within the same hour; see the v15 change-log row. 📎 **The annexes themselves (§2.1m, §2.3m)
stay where they are** — they are the measured *evidence*, and folding never means deleting the measurement that bought
the row. 🆕 **v22 (2026-09-20) CLOSES Z4: `.wat` pin digests are PORTABLE** — 954 of 954 comparable files agree, up from
2. ⚠️ **The v17 annex named ONE cause and there were THREE**; the other two (an over-eager data-count section, and
implicit import types interned after every tag's) were reachable only by the gate, because the file the byte-for-byte
diagnosis ran on could not contain either. 🚨 **v22 also carries a NEW wazmrt defect the run found — B-d: `(type N)`
naming an undeclared type binds an import to a signature the text never wrote, rc 0**, where wasmrt refuses. 🆕 **v23
(same day) FIXES B-d, and cross-runtime parity is now TOTAL: the two pin listings are 1,467 lines each, `.wat` 954 of
954 and `.wasm` 513 of 513, with nothing in one and not the other.** 🆕 **v24 lands §2.1's four SUBCOMMAND SPELLINGS —
`run`/`wasi`/`wat`/`wast`, additively — which EMPTIES the 2026-09-19 outstanding list; `pin` on wasmrt's side is what is
left in §2.1.** ⏳ **wasmrt's copy is therefore at 10 and BEHIND — PENDING MIRROR**, which §1a says the owner directs and
wasmrt makes in its own tree · opened 2026-08-19 (owner) · 🆕 **v25 records two wazmrt defects that broke BINARY interop
in both directions** — a block type emitted as an internal enum tag, and the `any`/`extern` conversion opcodes swapped
at four agreeing sites — found by assembling the SPEC corpus with both toolchains; the real-world `.wat` parity claim is
unchanged at 954/954, which is exactly why that corpus could not find them. · last change 2026-09-20 (v25) · **this file
must be kept IDENTICAL
in both repos**, each side editing ONLY its own copy (§1a) (`wasmrt/cmem/interop.md` and `wazmrt/cmem/interop.md`).

> *"I think this may require a common memory md file in both projects to confer with each other on from
> this point further so that both projects are on the same end track."* — owner, 2026-08-19

This is the **only** document either project may treat as binding on the other. Everything else in
either `cmem/` is that project's own memory, and 🔒 **the oracle is still retired**: neither runtime is
authoritative over the other's design, and reading a competitor's implementation for guidance remains
off-limits. What lives here is a **contract about observable behaviour**, agreed by the owner, that both
must satisfy so a deployment can swap one binary for the other.


## The parts of this contract (split 2026-11-25)

🔒 **Split from one 187 KB file by moving each section VERBATIM** (owner, 2026-11-25: *"perform the work on W3.
wazmrt will follow suit"*): no row, status or wording changed, so the CONTRACT VERSION is unchanged. A reference to
"interop.md §N" means the section, in the part listed here. Later the same day (owner: *"fix item 2"*) every table
with a row over 200 characters became a list — each row a bullet led by its first cell, each other cell a sub-bullet
labelled with its column header, a `<br>` a line break — and every other line over 200 was wrapped at a space, so each
part holds the memory guide's line limit; no word changed. ⏳ **PENDING MIRROR** of both in wazmrt's copy (§1).

| sections | file |
| --- | --- |
| header, §0 Scope, §1 The change protocol (1a, 1b) | this file |
| §1c to §1e: two sessions, the cadence, the release lockstep | [interop-protocol-cadence.md](interop-protocol-cadence.md) |
| §2 The CLI contract — §2.1 Run modes | [interop-cli-modes.md](interop-cli-modes.md) |
| §2.2 Flags, with the §2.2f and §2.2m annexes | [interop-cli-flags.md](interop-cli-flags.md) |
| §2.3 Exit codes and §2.4 flag-parsing rules | [interop-cli-errors.md](interop-cli-errors.md) |
| §2.5 A validity claim must match the verdict | [interop-cli-output.md](interop-cli-output.md) |
| §3 The security-check contract — §3.1 to §3.7 | [interop-security.md](interop-security.md) |
| §3.7a The execution bound | [interop-execution-bound.md](interop-execution-bound.md) |
| §4 The differential checks and §5 the owner decisions | [interop-checks-decisions.md](interop-checks-decisions.md) |
| §6 Change log, v41 to v24 | [interop-changelog-1.md](interop-changelog-1.md) |
| §6 Change log, v23 to v11 (continued) | [interop-changelog-2.md](interop-changelog-2.md) |
| §6 Change log, v10 to v1 (continued) | [interop-changelog-3.md](interop-changelog-3.md) |

---

## 0. Scope — what "swappable" means

🔒 **Defined by the owner, 2026-08-19:** *"If our CLI options are the same they are swappable. If our
security checks are the same they are also swappable."*

**IN scope — must match:**

1. **CLI options** — run modes, flag names, argument shapes, defaults, exit codes.
2. **Security checks** — the pin/verification mechanism and its on-disk artifacts, the WASI sandbox
   rights model, and the resource ceilings.

**OUT of scope — deliberately NOT aligned:**

- **The C ABI.** `wasmrt_*` and `wazmrt_*` symbol prefixes are a recorded deliberate decision in both
  projects. An **operator** swaps the binary and the pin DB; an **embedder** links one or the other and
  is not expected to relink blind.
- **Internal design** — data models, IR, allocation strategy, crate/module layout.
- **Performance and size.** These are what the two are *competing on*; aligning them would defeat the
  purpose. A contract row must never be justified by "the other one is faster".
- **Conformance internals** — each project's own test harness, scoring and baselines.
- **Output text** — wording, layout and summaries, **with the ONE exception the owner made on
  2026-09-19: §2.5.** A validity claim a human reads must match the verdict. That is a
  correctness property, not a matter of style, so it is in scope. Everything else a command prints
  remains out of scope.

---

## 1. The change protocol — read this before editing

🤝 **The one-word order is "coordinate" (owner, 2026-08-19), and it is a BINDING TRIGGER in both
projects' `INDEX.md`.** Saying it means: run the procedure below and in that trigger — read this file
first, byte-compare the two copies, verify rows by **running** both rather than reading either, record
status + date + evidence, and bump the CONTRACT VERSION **in your own copy**. ⚠️ **It also binds in the
inverse direction, which is the half that gets skipped: coordinate BEFORE shipping a change to a
contract surface** — any CLI option, any security check, any resource ceiling, any exit code — **not
after**.

#### 🗓️ The coordination CADENCE and who holds the pen (owner, 2026-08-19)

> *"The wazmrt project is toward the end of the hardening phase. Theirs is the latest version. We will
> coordinate with them until this project also reaches that stage. Then both projects will cross
> coordinate at the end of each additional stage."*

**Two regimes, and which one applies depends on whether the projects are level.**

| regime | when | who originates | wasmrt's job |
| --- | --- | --- | --- |
| **A — wazmrt LEADS** | now, and until wasmrt finishes **hardening** (T9 → `1.0.1`) | **wazmrt only** | **mirror from them**, contribute findings as an **annex**, never originate a version number |
| **B — CROSS-COORDINATE** | once both have finished hardening | either, symmetrically | coordinate **at the end of each stage**, not continuously |

⚠️ **Regime A is not deference about design — it is about the PEN.** wazmrt is ahead by stage, so it
holds the contract's version sequence. wasmrt still measures, still objects, and still reports
divergences; it simply does not bump the number. **A finding is contributed as an annex and folded in
by whoever holds the pen** — which is how §2.1m's five measured findings are carried today.

⚠️⚠️ **Regime B is a GATE AT A STAGE BOUNDARY, not a background activity.** The stages are the `1.0.x`
ladder — clear-out, hardening, bug hunt, optimization, security review. **Coordinate at the end of
each**, so the contract is reconciled against code that has stopped moving. Coordinating mid-stage is
what produced **three mid-edit collisions in a single session on 2026-08-19**, each one two agents
writing the same file at the same moment.

🎓 **The lesson that cadence encodes, and it is the one this file kept re-learning the hard way: a
CONTRACT VERSION is a PIN, not a LOCK.** It makes drift *detectable*; it does nothing to prevent a
simultaneous write. **The fix is not a better marker — it is not writing at the same time.** One pen
while the projects are uneven, and a scheduled boundary once they are level.

**Where wasmrt is against that ladder** (re-checked 2026-10-24, v38; this line said "`1.0.0` … is not
started" until then): **T13, the conformance clear-out, is MET in its source** — measured by running
wasmrt's own S2 on its `6df2108`: 288 files, 64,603 passed / 0 failed / 0 skipped (its record dates
it to 2026-09-19). **T9e (`pin`) and T9i (the iteration bound) are done** (2026-09-19, §2.1z). 🆕 **wasmrt
RELEASED `1.0.0`, the T13 release, on 2026-10-24** (`9871fd4`; v39). Regime A stands until the
owner changes it.

### 1a. 🔒🔒 THE EDITING BOUNDARY — **ABSOLUTE** (owner, 2026-08-19)

> *"Let's place a note to not edit the other's md file unless specifically directed by me. This is just
> a coordination effort. Each project needs to edit their own files. This is important for tracking and
> integrity."* — owner

🚫 **NEITHER PROJECT WRITES ANYTHING INTO THE OTHER'S TREE. NOT THEIR `cmem/`, NOT THEIR SOURCE, NOT
THEIR TESTS — AND NOT THEIR COPY OF THIS FILE.** The only exception is an **explicit, specific
direction from the owner**, given for that edit. There is no standing permission, and `coordinate` does
**not** grant one — ⚠️ **`coordinate` is an order to CONFER, never a licence to WRITE.**

**This supersedes the earlier rule that made this file the one thing either side could write into the
other's tree.** It was wrong, and it was wrong in a way that had already caused damage twice in one
day: a blind copy destroyed a section of in-flight work, and the reconciliation destroyed another
(change-log rows 3b and 4). 🎓 **The reason is integrity of the record, not politeness — each repo's
history must show only what that repo's own agent did.** A commit in wasmrt authored by whoever was
working in wazmrt makes the history a bad witness, and *the history is the thing both projects fall
back on when a claim is disputed.*

### So how does a change reach both copies?

**By the owner, not by an agent.** The proposing side does all of this **in its own copy only**:

1. Write the change, bump the **CONTRACT VERSION**, and add a change-log row.
2. Mark the affected rows and the change-log entry **⏳ PENDING MIRROR** — meaning *agreed on this
   side, not yet carried across.*
3. **Tell the owner explicitly** that the sibling's copy is behind, and at which version.
4. The owner directs the other project to mirror it — and **that project makes the edit in its own
   tree**, which is what keeps its history honest.

⚠️ **A VERSION MISMATCH IS THEREFORE NORMAL NOW, AND IT MEANS SOMETHING PRECISE.** §1's drift rule
still holds — *a mismatch means the contract is unknown* — but the resolution is **never** "copy over
it". It is: **read both, report the delta and its direction to the owner, and wait to be directed.**
The mismatch is the coordination signal working, not a fault to be cleaned up unilaterally.

⚠️ **Reading the sibling's tree remains fine and is required by `coordinate`** — read their `cmem/`,
their in-flight uncommitted work, their source; run their binary. 🔒 **Read freely, write never.**
*(This does not reopen the retired oracle: reading their code for DESIGN GUIDANCE is still off-limits.
Reading it to check a CONTRACT ROW is what this file is for.)*

🔒 **THE RETIRED ORACLE'S SCOPE, SETTLED BY THE OWNER 2026-09-20 — it covers `wasmrt` AND NOTHING
ELSE.** `reference-projects.md` had a *"What to mine it for"* column and the sentence *"we study them
freely"*; this file said *"reading a competitor's implementation for guidance remains off-limits"*.
Both were current and binding-sounding and they could not both be followed. **The narrow reading is
the one that governs:** §1's subject is the sibling, so

- **`wasmrt`** (the sibling)
  - reading their source for DESIGN GUIDANCE: 🚫 **off-limits by default** — each time needs an owner-directed scoped
    exception, logged. Two have been granted: Track B-e, and the `@custom` review
- **the other eight** in `reference-projects.md`
  - reading their source for DESIGN GUIDANCE: ✅ **allowed** — that file's "mine it for" column stands, and adoption
    stays gated by the Adoption Checklist + a Component Ledger entry in `third_party/LICENSES.md`

⚠️ **What is NOT restricted for either, and never was: behavioural MEASUREMENT.** Running another
implementation and comparing its output, bytes or exit codes is the method this project relies on most
— the whole custom-annotations design was measured off wasm-tools that way. *Measuring what a binary
DOES is not reading how it does it.*


1. **Neither project edits this file unilaterally.** A change is *proposed* in one repo — **in that
   repo's own copy only** — with a **CONTRACT VERSION** bump, and must be agreed and mirrored before
   either ships behaviour that depends on it. ⚠️ **The proposing agent does NOT carry it across**; the
   owner directs the other project, which makes the edit in its own tree (see the editing boundary
   above). *Superseded the original wording, which told one agent to "land the identical file in both
   repos" — that instruction is what produced two destructive overwrites on 2026-08-19.*
2. **Every row carries a status and a date.** ✅ AGREED (with the evidence that verified it) ·
   ⚠️ DIVERGENT (with the agreed resolution) · ⬜ UNVERIFIED (nobody has checked; **do not quote it**).
3. **Every accepted divergence carries a REOPEN CONDITION.** *An entry that loses its condition has
   become an excuse* — and a condition that is never re-tested is an excuse more slowly, so **re-test it
   whenever the entry is priced.**
4. **A row is verified by RUNNING both, not by reading either.** *When a claim will leave this repo,
   verify it against the artifact, not against something that talks about the artifact.*

⚠️⚠️ **THE DRIFT HAZARD, NAMED UP FRONT.** This file exists **twice**, and *a list written out a second
time is a list that will drift* — the projects have already been bitten by exactly this shape (a feature
list spelled three times; a header advertising a switch that was not there). Two repos cannot share one
file, so the pin is the **CONTRACT VERSION** plus rule 1. **The gate:** when both trees are present, a
check compares the two copies byte-for-byte and fails on any difference. Until that check exists, treat
a version mismatch between the copies as **the contract being unknown**, not as "close enough".


### 1b. What `coordinate` obliges, in order — ✅ **§0.5 RESTORED HERE (wazmrt, 2026-08-19)**

🚩 **This discharges the flag in change-log row 3b.** wasmrt's `cp` destroyed wazmrt's in-flight §0.5
before it reached either copy, and wazmrt's session context was the only place it survived. ⚠️ **It is
NOT restored as a verbatim §0.5, and that is deliberate:** three of its four parts have since been
re-expressed *better* — the order's definition in §1 above, and the editing boundary in §1a, which the
owner has since made **absolute** and which is therefore stronger than the version §0.5 was
introducing. **Re-pasting the section would leave two definitions of one order in one file, which is
precisely the "a list written out a second time is a list that will drift" failure this file exists to
prevent.** What follows is the part that was genuinely lost: the ordered checklist, and the clause
about invoking the order late.

1. **Byte-compare the two copies of this file** (§4 check 1). A mismatch means **the contract is
   unknown** — but see §1a: resolve it by **reporting**, never by writing to the other tree.
2. **Read the sibling's in-flight work** — its `cmem/roadmap.md`, `cmem/INDEX.md` and **uncommitted**
   changes — for anything touching §2 (CLI options) or §3 (security checks). ⚠️ **The sibling may
   already have written a task that cites a contract row THAT DOES NOT EXIST YET; that is a cue to
   write the row, not a discrepancy to report.** *(Not hypothetical: wasmrt's T9i cited "§3.7/§3.7a,
   CONTRACT VERSION 2" while this file was still at version 1 and had no such row.)*
3. **Diff what this project has shipped or is about to ship against every in-scope row**, and
   ⚠️ **verify by RUNNING both binaries on the SAME BYTES** (rule 4) — never by reading either
   implementation.
4. **Record the change in your OWN copy**, bump the CONTRACT VERSION, mark it ⏳ PENDING MIRROR, and
   **tell the owner the sibling is behind and at which version** (§1a).
5. **Report divergences with a reopen/close condition**, and record **where each side tracks the
   work**, so the two task lists can find each other.

⚠️ **`coordinate` is also the right response to discovering you have ALREADY diverged.** The order was
created the day wazmrt shipped an execution bound while this file still said neither project had one.
**Invoking it late is far better than not invoking it** — the drift is cheap to create and expensive to
find, and the correction is recorded rather than tidied away.

