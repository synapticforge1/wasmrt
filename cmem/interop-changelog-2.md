<!-- Part of the wasmrt ⇄ wazmrt swappability contract (interop.md is its entry point and holds the CONTRACT VERSION).
     Split from the one file on 2026-11-25 by moving each section verbatim (owner: "perform the work on W3"). -->
# interop — §6 Change log, v23 to v11 (continued)

- **23** ⏳
  - date: 2026-09-20
  - change: ✅ **B-d IS FIXED and the two pin listings are now IDENTICAL IN LENGTH — 1,467 lines each** (`35d8aa4b`).
    `(type N)` naming a type the module has not declared yet is checked against the **finished** type space instead of
    an empty one, so `bindgen_fixtures/fnany_50.wat` and `hostfn_50.wat` are refused here exactly as wasmrt refuses
    them, with a dedicated `InlineTypeUseMismatch` rather than a generic *"bad module field"*. 📊 **Cross-runtime parity
    is therefore total: `.wat` 954 of 954, `.wasm` 513 of 513, nothing in one listing and not the other.** 🔑 The cause
    was time-of-check, not a missing check: the text format's type index space is the declared `(type …)` defs *plus*
    every implicitly interned signature, appended as they are met, so a check run where the typeuse is parsed can be
    looking at an empty space — it skipped itself and deferred to a downstream verdict the emitter then prevented from
    ever arriving. ⚠️ **The fix is "ask later", NOT "refuse a forward reference"**: a forward `(type N)` whose inline
    signature *agrees* with what lands at N is legal and wasm-tools assembles it, so that case is pinned by its own
    assertion — a blanket refusal would have passed every failing case and broken the legal one. 🔒 **The out-of-range
    hand-off is kept and is now truthful** — wasm-tools assembles `(func (type 5))` in a module with no types and
    **both** runtimes refuse those bytes at decode, verified by running both. ⬜ **Still open on wazmrt: the four
    subcommand spellings (§2.1)** — Track B-c4, and it is the last row of the 2026-09-19 measurement.
- **22** ⏳
  - date: 2026-09-20
  - change: ✅ **Z4 IS CLOSED — `.wat` pin digests are PORTABLE** (`1bfdc6f5`, §3.1m-r). Re-measured with the same
    command on the same tree, the sibling rebuilt from its committed `01d0dc42` (was `ab13ba975`) into a scratch target:
    **954 of 954 comparable `.wat` files agree, up from 2; 0 differ.** 🔑 **The v17 annex named ONE cause and there were
    THREE**, and the other two were reachable only by the gate — `mathlib.wat`, the file the byte-for-byte diagnosis was
    run on, has neither an unused data segment nor a tag, so neither could appear in it. 🎓 *A single-file confirmation
    proves the cause it finds and says nothing about the ones it cannot reach.* **(1)** the `name` section was never
    emitted — twelve subsections now are, with the shape **read off a wasm-tools-assembled module** rather than
    recalled, and label entries keyed by the block's **ordinal in the body** (counting unnamed blocks), never by stack
    depth; **(2)** the data-count section was emitted for **every** module with a data section — legal, and 3 bytes no
    other assembler writes — now emitted exactly when a body names a segment, per §5.5.16; **(3)** an imported
    function's implicit type was interned **after** every tag's, because tags intern during the field loop and imports
    interned in a pass after it — now interned at the import, in source order alongside the tags, with defined functions
    still a later pass, which is what wasm-tools does. ⚠️ **§3.1's operator note inverts: `.wat` pins no longer have to
    be made per runtime.** 🚨 **AND A NEW wazmrt DEFECT THE RUN FOUND (B-d), which is why the count is 954 and not
    956:** `(type N)` naming an undeclared type in an import's typeuse is refused by wasmrt and **silently mis-bound by
    wazmrt** — `__host_print`, written `(param i32 i32)`, is emitted as `(param i32 i32 i32 i32) (result i32)`, rc 0.
    `checkInlineTypeUse` skips itself when the index is not interned *yet* and defers to a downstream verdict the
    emitter then prevents. **A §2.5-class failure and wazmrt's to fix.** ⬜ **Still open on wazmrt: the four subcommand
    spellings (§2.1)** — Track B-c4.
- **21** ⏳
  - date: 2026-09-19
  - change: ✅ **wazmrt ADOPTS: Z1, Z2, Z3, the `--dir` fix, the pin DB order + warning, and wasm-tools' feature
    vocabulary** (`f780ad27`, `3fb36c7a`). Z1 fails with rc 1 naming the export; Z2 says `unknown flag` in every host
    position with no path-guessing, and leaves guest positions alone; Z3's header is neutral. §2.2's `--dir` is fixed
    per the owner's §5 #10 ruling — a drive letter is **exactly one ASCII letter at the start**, so `.:/` splits and
    `C:\tmp` does not, and `::` is accepted. §3.3's lookup is shared-path → own-path → **warn when the sibling's DB
    exists and ours does not**, as a pure function with all eight combinations tested. §2.2's `--features` resolves
    wasm-tools' whole vocabulary. 🚨 **AND A SECURITY DEFECT FOUND WHILE DOING IT, recorded because it is a
    contract-surface failure: `--allow-symlink` was missing from the shared flag list, so `wazmrt start.wasm
    --allow-symlink --verify enforce` RAN AN UNVERIFIED MODULE, rc 0**, where the same line without it correctly
    refuses. The flag region ended at it and every later host flag went unseen — `--max-iterations` dropped too. 🎓 *The
    "one list, because a second copy would drift" comment sat directly above that list; the list was in one place and
    the parser was reading a different vocabulary.* ⬜ **Still open on wazmrt: Z4 (§3.1m) and the subcommand spellings
    (§2.1)** — Track B-c2 and B-c4.
- **20** ⏳
  - date: 2026-09-19
  - change: ✅ **§2.1/§2.2 — wasmrt's COLUMN IS GREEN (T9e); wazmrt's halves are what remain.** Verified by building
    wasmrt's committed code into the pen-holder's own scratch target (nothing written to their tree, §1a) and running
    it: bare `<module> <export>` returns **5**, `.wast` by extension, `pin <file>`, **both `--dir` separators**, and
    **both feature vocabularies**. 🎯 **F1 IS CLOSED** — measured live earlier in this same session, fixed hours later.
    ⏳ **Outstanding on wazmrt:** the four subcommand spellings (all → `cannot read 'run'`), `::`, the hyphenated feature
    vocabulary (`bulk-memory-operations` → `unknown proposal`), and Z1–Z4. ⚠️⚠️ **NEW DEFECT FOUND BY THIS PASS — §2.2z:
    `--dir .:/` DOES NOT WORK ON wazmrt, and it is the example wazmrt's own `--help` prints.** The split guard is `i >
    1` (a Windows drive-letter guard), so a **one-character relative host path** is indistinguishable from a drive
    letter and is never split; `./:/` works, `.:/` does not. 🎓 **Three things at once:** a live defect, a §2.2 claim
    carried since v1 that was **written from reading and never run** (the fourth such error across the two projects),
    and 🔒 **§5 #10 made concrete** — the "looks like a drive letter" heuristic giving a wrong answer on ordinary input.
    ⚠️ **Adding `::` alone would not fix it.** 📌 **`multi_table` recorded as an OBSERVATION, not a row** — §0 puts
    engine modelling out of scope — but the observable consequence is stated: the same `--features` line does not gate
    the same thing on both. **REOPEN** when one accepts a module the other refuses on that basis.
- **19** ⏳
  - date: 2026-09-19
  - change: ✅ **§3.7a IS CLOSED — wasmrt implements the execution bound (T9i), and this closes §5 decision #5.**
    Re-verified by the pen-holder by RUNNING both on the same bytes at `--max-iterations 1000000`: `(loop (br 0))` and
    `(func $f (return_call $f))` **both trap on both runtimes**, rc 1, each message naming the ceiling and how to raise
    it. The differential table that opened the section — wazmrt trapping, wasmrt hanging — is green in every cell. 🔬
    **wasmrt re-measured the default on its own corpus** rather than adopting it: green at `1<<20`,
    `return_call`/`return_call_ref` failing at `1<<19`, 36 failures at `1<<14` — **the same shape as wazmrt's descent**,
    so `1<<30` is a measured default on both rather than a shared guess. ⚠️ **The C ABI takes `0` as "leave the
    default", not "unlimited"** — an embedder must not disarm a ceiling with a zero, while a person at a terminal may.
    **Recommended, not binding** (§0 keeps the C ABI out of scope); if wazmrt picks the other convention it must be
    **documented**. 🎓 **A lesson that sharpens §4 check 6:** the pen-holder's first run put the flag in a guest
    position, it never applied, and the run exited **1** from an argument-count error — **an `rc != 0` assertion would
    have called that the bound working.** Assert the trap.
- **18** ⏳
  - date: 2026-09-19
  - change: 🔒 **OWNER: THE PIN DB PATH IS DECIDED — §3.3, and §5 decision #1 CLOSES.** `/etc/wasmtk/pins` ·
    `C:\ProgramData\wasmtk\pins`, named for the deployment both runtimes ship inside, **each runtime's own path kept as
    a fallback**, and 🔒 **a loud warning when a runtime finds no DB where its sibling would have found one** instead of
    quietly computing `armed = false`. ✅ wasmrt implements exactly that (T9e) as a pure function with a
    mutation-verified test. 🎓 **This was the most dangerous unresolved row in the file since v1, and what closes it is
    the WARNING, not the path.** A shared path alone still fails silently during a part-migrated deployment — the binary
    swaps, the DB sits at the sibling's old path, and `armed = false` is an ordinary state with no error attached. *The
    failure mode was never "no DB"; it was "no DB, and no reason to think that is wrong."* ⏳ **wazmrt to adopt the order
    AND the warning AND a test that the warning fires** — ⚠️ **adopting only the path is the dangerous partial fix**,
    closing the both-new case and leaving the migration window, which is the window an operator is actually in. Track
    B-b.
- **17** ⏳
  - date: 2026-09-19
  - change: ⚠️⚠️ **Z4 — `.wat` PIN DIGESTS ARE NOT PORTABLE BETWEEN THE TWO RUNTIMES, and it is wazmrt's to fix.** §3a
    said to make the `.wat` agreement a **test** rather than an assumption; run, it fails. wasmrt measured 2 agree / 529
    differ over 535 files; 🔬 **the pen-holder re-ran it over the whole 959-file `wasmtk` tree and got the same shape: 2
    agree, 952 differ.** ✅ **The diagnosis is confirmed byte-for-byte, not taken on trust:** wasmrt's assembled
    `mathlib.wat` hashes to its own pin digest, and the same bytes under `wasm-tools strip --all` hash to **wazmrt's pin
    digest exactly**; `objdump` shows the sole difference is a 2020-byte `custom "name"` section. 🎯 **The exceptions
    prove the mechanism — the only two files of 959 that agree are the only two with zero `$identifiers`**, so there are
    no names to emit and no section to differ by. 🔒 **It fails CLOSED** (a `.wat` pinned under one runtime is *refused*
    under the other), so it is an operational break, not a hole — **but only `.wasm` pins are portable until it is
    fixed**, and an installer pinning `.wat` must pin per runtime. 📬 **The ask: emit the `name` section from the
    identifiers the text carries**, as wasm-tools and wasmtime do — 🔒 which also matches the owner's standing direction
    **not to discard information the source carries**. ⚠️ **Z4 is not "match wasmrt's bytes"; it is "stop throwing the
    names away"** — the digests converging is the test, not the goal. Track B-b.
- **16** ⏳
  - date: 2026-09-19
  - change: 🔒 **OWNER: A FLAG WITH A REQUIRED POSITION, WRITTEN WHERE IT CANNOT APPLY, IS AN ERROR — §2.4b.** *"we need
    an error thrown when it is in the wrong location."* The flag must also state its position in the
    **usage/invocation** section, not only in its own entry — *a constraint documented only where the reader already
    knows to look is not documented.* ⚠️⚠️ **Found a live fail-OPEN defect in wazmrt, which is why this is a contract
    row and not a help-text fix:** `wazmrt m.wasm --features mvp` exited **0** having run under the **FULL feature
    set**, silently. `--features` is the one flag whose entire job is to REFUSE modules, so a user asking for a smaller
    trusted computing base got everything enabled with no error, no warning and a success status. 🎓 **It fell between
    the two mechanisms built to prevent exactly this:** `flagRegion` deliberately excludes `--features` (so a guest's
    own `--features mvp` can never narrow the language), and zH7 warns only for names in those same lists — *a rule that
    names the things it guards will not guard the thing it does not name.* ✅ **Shipped in wazmrt**
    (`misplacedFeaturesFlag`), two tests, inversion-proven, suite green at 767. ✅ **wasmrt is not in breach** — it has
    no CLI `--features` yet; the row binds it when it adds one. 🆕 **§4 gains check 11**, written to assert the **exit
    status** rather than the message, because the fault being guarded is a *successful* run that ignored the flag.
- **15** ⏳
  - date: 2026-09-19
  - change: 🔒 **OWNER NARROWS §2.4a THE SAME DAY IT WAS WRITTEN — after the module path, a SINGLE DASH is the
    guest's.** Position 3 now splits by **dash count**: an unknown **`--flag`** errors; a **`-flag`** is guest argv and
    needs no `--`, so `prog.wasm -la` runs. 🎯 **The reasoning is a closed enumeration, not a preference:** *every* host
    flag legal after the path is double-dash (`--dir`, `--ro-dir`, `--env`, `--max-*`, `--pins`, `--verify`,
    `--no-verify`, `--yes`, `--features`, `--allow-symlink`); the single-dash names `-h`/`-v` are first-argument-only
    (§2.4); and the subcommand flags (`wast -v`, `wat -o`) live in modes with **no guest argv**. So a single-dash token
    there **cannot be a host flag** — nothing to disambiguate. ⚠️ **The cost is recorded, not smoothed over:** a
    mistyped `-dir /tmp` now reaches the guest silently. 🔒 **The owner was offered a "looks like a host flag" warning
    for precisely that case and refused it**, which is the same decision as v14 arriving from the other direction — *a
    near-miss list is itself a thing that would drift between two runtimes.* ✅ **The narrowing REMOVES work from wazmrt
    rather than adding it:** passing `-la` to the guest is what wazmrt already does, and pre-narrowing v11 would have
    had us break it. 🚨 **§1c HAPPENED AGAIN, DURING THIS PASS, AND IT IS THE REASON THIS ROW IS SEPARATE FROM v11.**
    wasmrt's session recorded the narrowing in its copy while this session was folding the **pre-narrowing** text in as
    v11 — two sessions, one hour, each correctly editing only its own copy (§1a held; nothing was destroyed this time).
    🎓 **§1a fixed the destructive half of the collision and did nothing about the wasted half**, which is what §1c
    predicted and what §5 #7 proposes to close. v11 is left standing and amended here rather than rewritten: **their
    copy already records that wazmrt folded in the wide text as v11**, so editing v11 in place would make the two
    histories disagree about what happened.
- **14** ⏳
  - date: 2026-09-19
  - change: 🔒🔒 **OWNER: NO "LOOKS LIKE" — §2.4a-i.** *"improper cli options should throw an error. We should have no
    'looks like' built in so that it interprets a cli. If it is a valid cli option run it, if not throw and error."*
    **The general rule that v11/§2.4a is one instance of.** In a host-flag position an argument is **exact-matched or
    rejected**: no path-guessing, no fuzzy/"did you mean" adoption, no prefix abbreviation, no "probably the guest's"
    inference. 🎯 **Its first casualty is a message, not a behaviour:** wazmrt's `--bogus m.wasm` already exits 1, but
    says *"cannot read '--bogus': FileNotFound"* — **right code, and it sends the user to the filesystem to debug a
    typo'd flag.** v11 had logged that as "the wording"; v14 makes it a breach of a rule. ⚠⚠ **GRAMMAR IS NOT
    RESEMBLANCE, and that distinction is what makes v14 implementable** — the host/guest boundary (`--`, and the first
    non-flag argument after the path) is fixed by the shape of the line, not by judging arguments, so a guest's argv is
    not "an option wazmrt failed to recognise". Without that carve-out `prog.wasm install --yes` could not be written,
    and §2.4 records what that costs. ⚠️ **TWO TENSIONS RAISED, NEITHER DECIDED HERE:** §5 **#10** — §2.2's `--dir`
    drive-letter fallback is itself a resemblance rule, **the one heuristic this contract has AGREED to**, and it is a
    flag *value* rather than a flag *name*; §5 **#11** — whether zH7's warn should become an error. 🎓 *The pen-holder
    does not get to repeal an agreed row by implication, and a new general rule is exactly the moment that temptation
    arrives.*
- **13** ⏳
  - date: 2026-09-19
  - change: 📎→📒 **wasmrt's §2.3m ANNEX FOLDED IN by the pen-holder (wazmrt, regime A).** Two rows change. 🆕 **§2.3
    gains the Z1 row** — naming an export the module does not have is a **failure**, never a silent fall-back to
    summarizing — and it is written as binding on **BOTH** sides, because on the day it was folded in **neither was
    clean**: `wazmrt m.wasm nosuch` → rc 0, and so does `wasmrt m.wasm nosuch` (**F1**, re-verified here, still live;
    wasmrt's compliance is via its `run` subcommand only). ✅ **§2.3 row 3 promoted ⬜ → AGREED**: every host-side failure
    and every trap → `1` on both, `proc_exit(n)` → `n & 0xff`, measured twice — wasmrt's 18-row matrix and the
    pen-holder's own 12-case re-run on the same bytes. **That closes §5 decision #4 with no per-kind table**, because
    neither implementation distinguishes kinds. 🆕 **§4 gains checks 8, 9 and 10**, one per new rule, each written so
    the *vacuous* pass is impossible: check 9 greps the output because the exit code was already right when Z3 was
    found, and check 10 runs every call form because a one-form check would have called wasmrt compliant. 🔎 **The
    re-run also narrowed Z1**: `wazmrt invalid.wasm bad` already exits 1, so the dropped export name is specific to a
    module that **validates** — the run where nothing else went wrong is the one that silently does the wrong thing.
- **12** ⏳
  - date: 2026-09-19
  - change: 🔒 **OWNER DECISION FOLDED IN AND NUMBERED — §2.5, a validity claim in the output must match the verdict
    (Z3).** Owner: *"we also need a contract item for Z3"*. No line a command prints may call a module **valid** unless
    it validated; a summary printed before validation finishes must use neutral wording. ⚠️ **This carves the ONE
    exception into §0's "output text is out of scope"**, and the carve-out is the load-bearing part: *a validity claim
    is not style, it is a verdict a human reads*, and §0 would otherwise have made Z3 unfixable by construction.
    Everything else a command prints stays out of scope. **wasmrt complies** (`invalid.wasm: WebAssembly module (version
    1)`), pinned by `cli_exit_codes.rs::the_summary_never_calls_an_invalid_module_valid`, mutation-verified against
    wazmrt's own header wording. ⚠️ **wazmrt is in breach and its exit code is RIGHT** — `invalid.wasm: valid wasm v1, 5
    section(s)` … `validation: FAILED`, rc 1 — which is precisely why this needed a row: **every gate wazmrt owns was
    already green on it.** Tracked at Track B-b.
- **11** ⏳
  - date: 2026-09-19
  - change: 🔒 **OWNER DECISION FOLDED IN AND NUMBERED — §2.4a, the unknown-flag rule.** Owner: *"I do want an 'unknown
    flag' rule in the contract that throws an 'unknown flag' error."* A flag-shaped argument in a **host-flag position**
    that the command does not recognise stops the run: stderr says **`unknown flag`** and names it, rc **1**. 🎯 **It
    resolves Z2's tension by POSITION, which is the whole design** — host positions (first argument, before the path,
    the leading run after the path, and every argument of a command with no guest argv) **error**; guest positions
    (after `--`, and after the first non-flag argument following the path) are **never examined**, so `prog.wasm install
    --yes` is untouched and §2.4's fail-open trap stays shut. ⚠⚠ **SUPERSEDED IN PART BY v15, the same day:** this row's
    rule put a guest's own `-la` directly after the path into a **host** position (`-- -la` required). **The owner
    narrowed that within the hour** — a single-dash token there is the guest's and runs as written. The row stands as
    the record of what was folded in; **§2.4a's text is the narrowed rule.** **Complementary to zH7, not a replacement**
    — a *known* host flag stranded in a guest position still only **warns** (it may be the guest's own); an *unknown*
    one in a host position **errors**. wasmrt complies in all four host positions (re-verified by running it), pinned by
    `cli_unknown_flag.rs`. ⚠⚠ **wazmrt is in breach in three of four**: rc 0 after the path, rc 0 in `.wast`, and rc 1
    for the wrong reason (*"cannot read '--bogus'"*) before it. Tracked at Track B-b.
- **owner decisions** 🔒
  - date: 2026-09-19
  - change: *(Recorded by wasmrt; NOT a version number. Regime A: the pen-holder numbers them on fold-in.)* **§2.4a
    unknown-flag rule** and **§2.5 truthful validity claims** decided by the owner. **§2.3 gains a Z1 row.** **§0**
    carves §2.5 out of "output text is out of scope". **§2.5h hands Z1–Z3 to wazmrt** (owner: *"pass all three issues to
    the wazmrt team"*). wasmrt already complies with all three, pinned by `cli_unknown_flag.rs` and `cli_exit_codes.rs`.
- **annex** 📎
  - date: 2026-09-19
  - change: *(wasmrt contribution, NOT a version — offered for fold-in.)* 🔬 **§2.3 MEASURED by running both (§2.3m).**
    Copies byte-identical at v10 beforehand. **Row 2: wasmrt was in breach three times** (summarize of an invalid
    module, no arguments, `wast` on failures), all exiting 0 where wazmrt exits 1. **Fixed on wasmrt's side with no
    contract change**, pinned by `cli_exit_codes.rs`; an 18-row matrix now agrees throughout. **Row 3: both already use
    1 for every host failure and every trap** → proposed promotion to ✅ AGREED, which closes §5 #4. **For wazmrt:** Z1,
    an unmatched export name is silently ignored with rc 0 (F1's mirror); Z2, unknown flags have no row and diverge (🚦
    owner/pen-holder); Z3, the header says "valid" for an invalid module (text, out of scope).
- **annex** 📎
  - date: 2026-08-19
  - change: *(wasmrt contribution, NOT a version — wazmrt leads and holds the pen; offered for fold-in.)*
