<!-- Part of the wasmrt ⇄ wazmrt swappability contract (interop.md is its entry point and holds the CONTRACT VERSION).
     Split from the one file on 2026-11-25 by moving each section verbatim (owner: "perform the work on W3"). -->
# interop — §6 Change log, v41 to v24

## 6. Change log

- **41** ⏳
  - date: 2026-10-26
  - change: **Record-only. (1) §3.1 `.wat` pins and workspace I8: a `(@custom "name" …)` annotation IS the `name`
    section, and none is generated beside it — now on both runtimes.** wazmrt matched wasm-tools 1.259 (both sections,
    `5f82c94bf`, 2026-09-21); wasm-tools 1.262 emits only the hand-written one, and wasmrt adopted that 2026-10-23 (the
    v29 row's cell). So a `.wat` carrying the annotation pinned differently on the two runtimes, and the 603/603 parity
    could not show it: no corpus file has one. Fixed in wazmrt `852ff84`. Measured by the pen holder with
    `probes/four-assemblers.ts` on wasm-tools 1.262, wazmrt, wasmrt `2ee6628` (built into a scratch target, §1a) and
    binaryang 2.2.0: the two `h8-fixtures` plus five variants (anchored `before code` / `before first`, two annotations,
    with `@name`, and `"names"`, which is not it), all equal to wasm-tools on both runtimes; `wazmrt pin` = `wasmrt pin`
    on the fixture. **(2) Every version through v40 is MIRRORED**: the two copies' SHA-256 were equal on 2026-10-26
    (wasmrt `2ee6628`). The ⏳ marks on v18–v40 above record each row's state when it was written, not a pending mirror.
- **40** ⏳
  - date: 2026-10-24
  - change: **A CORRECTION to v39, found by wasmrt while mirroring it** (reported under regime A, not edited there). v39
    said wazmrt "already met" D2's `encodingRules`; it did not meet one. **A table initializer (`0x40 0x00 tt e`) needs
    function-references**, and wazmrt accepted `(table 1 funcref (ref.null func))` under every configuration, where
    wasmrt 1.0.0, wasm-tools 1.262 and binaryang 2.2.0 refuse it with function-references off. The 0 in the D2 matrix
    was the corpus: no S1 module had a table initializer. ✅ **wazmrt FIXED** (the gate, and the initializer's expression
    now walked like any const-expr), with `tests/behaviour/table-init.wat` joining S1 at 4.0.1's behaviour FIRST so the
    gate saw the break: S1 −30, MAJOR. Re-run on 49 modules: **2,401 / 0 differ** against binaryang 2.2.0 and against
    wasmrt 1.0.0. 🎓 *A matrix that reads 0 has proved agreement over its corpus, not over the rule.* ⏳ **PENDING
    MIRROR.**
- **39** ⏳
  - date: 2026-10-24
  - change: 🔒 **§2.2 `--features`: the VALUE-TYPE rule is binaryang D2 2.2.0's `typeRules`** (binaryang § 44, answering
    wazmrt's D2-matrix letter; owner: "wasm-tools' rule"). wazmrt reads the rules from its definitions copy (pinned to
    2.2.0). Three corrections from its old hand rule: the GC types and `exnref` need reference-types too, and gc stands
    in for function-references only for a concrete `(ref $t)`. Re-measured against binaryang 2.2.0: 2,352 / 0 differ (22
    before). Accepting less: S1 −20, MAJOR (wazmrt `4.0.0`). ✅ **AGREED on both**: wasmrt made the same change
    (`cee7bd1`), and its `1.0.0` against wazmrt `4.0.0` gives D2 matrix 2,352 / 0 differ and an identical CLI corpus.
    The ladder line also records wasmrt's `1.0.0` release. ⏳ **PENDING MIRROR.**
- **38** ⏳
  - date: 2026-10-24
  - change: **Record-only: §2.2 `--features` is AGREED, and the ladder line is corrected.** wasmrt made v37's change
    (`4162c52`, `daec1d6`, mirroring v36 + v37 in `5315faf`). The pen holder re-ran the row on both binaries: D2 matrix
    2,352 / 0 differ; CLI corpus identical. The "where wasmrt is against that ladder" line said T13 was "not started";
    re-checked, T13 is met in wasmrt's source (64,603 / 0 / 0, its S2 on `6df2108`), T9e / T9i are done, and wasmrt is
    still `0.9.0`. No row changes meaning. ⏳ **PENDING MIRROR.**
- **37** ⏳
  - date: 2026-10-24
  - change: 🔒 **§2.2 `--features`: wazmrt IMPLEMENTS v32/v33 — binaryang D2's names AND meanings** (owner, 2026-10-24:
    "yes go ahead" to the opcode-guide plan; binaryang's FL1 and opcode work are done). Gating per instruction = D1's
    `feature` column, held by a test over all 582; D2's `cli` names and presets; `requires` recorded, not enforced (so
    `call_ref` with gc on and function-references off is now REFUSED, closing §2.2m's note); the six wasm-tools-only
    names deprecated aliases with a warning; C ABI values 20–24 inert, never renumbered. Spec conformance unchanged; S1
    says MAJOR (`wasm3` without threads, `lime1` without the overlong encoding). ⏳ **PENDING MIRROR — and wasmrt's
    matching migration** (not v30's wasm-tools vocabulary, which v32 reversed).
- **36** ⏳
  - date: 2026-10-24
  - change: **Record-only: §5 #13 is MET on both sides.** wasmrt mirrored v35 (byte-identical, checked with `cmp`) and
    made #13's change in `cfeee31`: a WASI guest sees only `--env`, and an empty KEY is refused. The pen holder built
    that commit into a scratch target (§1a) and ran the `10 + count` probe on both binaries: identical on all six cases.
    The §2.2 `--env` row is now ✅ AGREED. No row changes meaning. ⏳ **PENDING MIRROR.**
- **35** ⏳
  - date: 2026-10-24
  - change: **§2.2m's STALE wasmrt CELLS REFRESHED, by running both binaries** (wazmrt 2.0.0 + this version's fix;
    wasmrt built from its committed `37f0187` into a scratch target, §1a). §2.1 `pin` and §2.2 `--max-memory`,
    `--max-table-elems`, `--max-iterations`, `--`, `--verify`, `--no-verify`/`--yes` and `--features`' position: **all ✅
    AGREED**, each cell rewritten from the measurement. 🔒 **Two divergences found on the way, both decided by the owner
    the same day:** **§5 #13** — a WASI guest sees ONLY the `--env` variables, each `KEY=VALUE` with a non-empty KEY, a
    repeated KEY replacing; wasmrt inherited the whole host environment (111 variables) and **must change**; wazmrt
    passed malformed entries verbatim and duplicated a repeated KEY, and is **FIXED** (`putEnv`, exe +0). **§5 #14** — a
    `--pins` DB that cannot be read is an ERROR in every mode; wazmrt read a missing file as "no DB" and ran unverified
    in silence, and is **FIXED** (`verifyGate`, a test that fails on the old code, exe +512 attributed by building).
    Owner: wazmrt ships it as a **patch** (a security fix). ⏳ **PENDING MIRROR** — and wasmrt's `--env` change.
- **34** ⏳
  - date: 2026-10-24
  - change: **wasmrt rewrote its history a SECOND time (drive letters and other machine text; 141 of 230 commits changed
    id), so v31's four ids are old again.** Replaced, with the original id still kept once in brackets (the two maps
    chain: `history-map-2026-10-23.md`, then `-10-24.md`): `c9c447f3` → `aa2769b8`, `ff99f6f1` → `01d0dc42`, `da17c367`
    → `76e77ec7`, and `4e3de996` → `97b610c9`. ⚠️ **The fourth was reported as unchanged; it was not.** v31 wrote it as
    `4e3de996`, a typo for `4e3de995` (full `4e3de99579cc`), so it matched nothing in either map and looked unchanged.
    Every new id resolved in wasmrt's tree before it was written here. v31's row keeps the ids it wrote, as the record.
    Record-only: no contract row changes meaning. ⏳ **PENDING MIRROR** — wasmrt's copy needs the same four ids,
    including the corrected fourth. 🔒 v31's rule gains a check: a quoted id is resolved with `git log -1 <id>` in the
    sibling's tree, not only found in its map.
- **33** ⏳
  - date: 2026-10-23
  - change: 🔒 **Three changes.**
    **(1) RELEASE LOCKSTEP ENDED** (owner: *"we are officially out of lock step now due to differences"*). §1e is marked
    ended and kept as the record. The contract rows and the §1a mirror rule stay; only the joint-release rule goes.
    **(2) v32 covers MEANINGS too** (owner: *"aligning with binaryang means its meanings also"*), answering wasmrt's
    §2.2m question: gating per instruction follows D1's `feature` column, and the rules follow D2.
    **(3) wasmrt's §2.2f and §2.2m annexes FOLDED verbatim**, at the place wasmrt put them. Both copies were
    byte-identical at the fold (v32 + both annexes), before this version's edits.
    From §2.2m's notes for the pen holder, **re-measured on wazmrt 1.0.4**:
    • `(table i64 …)` under `all,-memory64` was still ADMITTED where wasm-tools refuses: a real gating defect in wazmrt.
    ✅ **FIXED the same day** (owner: "fix the 64-bit table issue now"). A 64-bit table now needs `memory64`, as in
    wasm-tools. It is kind 4 (accepting less), so wazmrt's next release is a major unless the owner calls otherwise
    (`known-issues.md`).
    • `call_ref` under `all,-function-references` with GC on is still admitted. A semantics question that the D2
    migration settles.
    • The table initializer with function-references and GC off is now REFUSED: fixed.
    • The wasm-tools 1.262 oracle drift is moot, because the row is moving to D2.
    ⏳ **Still for the pen holder:** the stale wasmrt cells §2.2m lists (§2.1 `pin`, and §2.2 `--env` / `--max-*` / `--`
    / `--pins` / `--verify` / `--no-verify` / `--features` marked "absent"), to refresh after re-running them.
    ⏳ **PENDING MIRROR.**
- **32** ⏳
  - date: 2026-10-23
  - change: 🔒 **OWNER: "we need to align with binaryang not wasm-tools."** v30 made `--features` take wasm-tools' whole
    vocabulary with its meanings. The owner reverses that direction. **binaryang's D2** (the workspace's shared feature
    list, `../../cmem/divergences.md` § "The shared definitions") becomes the canonical vocabulary, and the
    wasm-tools-only names (`floats`, `gc-types`, `legacy-exceptions`, `bulk-memory-opt`, `call-indirect-overlong`,
    `mutable-global`) stay as **deprecated aliases for one minor release**, then go in a major. The C ABI's
    `wazmrt_feature_t` APPENDS and renumbers nothing. **Record-only today**: wazmrt's behaviour is unchanged, and the
    §2.2 row is rewritten when binaryang's FL1 settles D2's `cli` spellings, so both runtimes migrate once. ⚠️ **wasmrt
    (at v10): do NOT implement v30's wasm-tools vocabulary in the meantime.** ⏳ **PENDING MIRROR.**
- **31** ⏳
  - date: 2026-10-23
  - change: **wasmrt rewrote its history (workspace letter H19, drive paths only), so the wasmrt commit ids this file
    quoted are OLD.** Each is replaced by its new id with the old one kept once in brackets, so older records still
    resolve: `c9c447f3` (was `7ce0dcd2`, §5 #6 and its change-log rows), `ff99f6f1` (was `ab13ba975`), `4e3de996` (was
    `51254b9cf`), `da17c367` (was `3c49845dd`). Every pair read from `wasmrt/cmem/history-map-2026-10-23.md` (letter
    H21). Record-only: no contract row changes meaning. ⏳ **PENDING MIRROR** — wasmrt's copy needs the same ids. 🔒
    Standing rule: a sibling's commit id is looked up in that sibling's history map before it is quoted.
- **30** ⏳
  - date: 2026-09-21
  - change: 🔒 **OWNER: EVERY wasm-tools FEATURE NAME, WITH wasm-tools' SEMANTICS — "the broadest compatibility",
    component-model names included, legacy exceptions built in.** §2.2's `--features` row. 🔬 **Every rule MEASURED, not
    read**: `cmem/probes/feature-matrix.ts` validates one minimal module per feature under every preset, every single
    name, the minimal pairs, the group names and per-instruction cases — and **the identical matrix run against wazmrt
    now matches wasm-tools on every row**. Findings that changed the design: `mvp` ≠ `wasm1` (wasm-tools' `--help` says
    otherwise); `externref` needs `gc-types`; typed references need `reference-types` too; relaxed-SIMD ops are NOT
    float-gated; `bulk-memory`/`reference-types` are group names in both directions; **wasm-tools never refuses a
    CONFIGURATION**, so wazmrt's "incoherent config" refusal is retired and each dependency is enforced on the MODULE
    instead. 🚨 **Three wazmrt defects found on the way**: a plain `funcref` TABLE was refused under `--features mvp`
    (shipped in 1.0.2 — every C program with a function pointer); function LOCALS were never feature-checked (`(local
    v128)` ran under `mvp`); `opcode.freeBody` leaked `try_table`'s catch list. C ABI: `WAZMRT_FEATURE_*` 19–24 added;
    `wazmrt_config_all_features(false)` keeps floats ON, so it still means "WebAssembly 1.0". ⏳ **PENDING MIRROR** — and
    §2.2's wasmrt `--features` cell ("absent") is contradicted by measurement.
- **29** ⏳
  - date: 2026-09-21
  - change: 🚨 **§3.1 `.wat` PIN PORTABILITY IS BROKEN ON PURPOSE, and the fix that breaks it is the right one.**
    Workspace letter H13: both runtimes' module bodies diverged from **wasm-tools** in three legal-but-different ways —
    **I12** one local group per local, **I13** module-level exports moved after inline ones, **I14** every signature
    interned before any block type. 🎓 *They hid because the Z4 gate compared the runtimes to EACH OTHER: two
    implementations agreeing is not two implementations being right.* wazmrt fixed all three in `1.0.2` (`9aee871d1`,
    inversion-proven, 528/528 bodies equal wasm-tools'). Measured against wasmrt's 2026-09-20 build: `.wat` pins now
    agree on **64/528**, down from 528. ⏳ **PENDING wasmrt's matching fix and this file's mirror.** ⚠️ **Two of the
    letter's diagnoses were off, recorded so wasmrt fixes the CAUSE:** I13 is not "grouped by kind" — deferred `(export
    …)` forms were appended after every inline export; I14 is not a tag — wasm-tools interns function by function
    (`probes/i14-interleave.wat` shows it in two functions). 🔒 Owner: ships as `1.0.2`, *"since the consumers are not
    involved yet"*.
- **28** ⏳
  - date: 2026-09-21
  - change: 🔒 **TWO OWNER DECISIONS.** **(1) §5 #12 CLOSED: §2.4a is AMENDED to match the code.** Guest positions after
    the first non-flag argument are examined for **exact** wazmrt flag names, and a match is an error; only what follows
    `--` is never examined. `prog.wasm install -- --yes` is the spelling. Verified by running: exact `--yes` rc 1;
    `--yess`, `--Yes`, `--dirs` and `-- --yes` rc 0. 🎓 *A rule is amended to describe the code when the code is the
    decision; the "never examined" text had been false since 2026-08-19.* **(2) §1e REVISED: wazmrt `1.0.2` SHIPS BEFORE
    wasmrt reaches `1.0.1`** — the 1.0.1 rendezvous recorded the same morning is superseded; see §1e for what that
    leaves open. ⏳ **PENDING MIRROR.**
- **27** ⏳
  - date: 2026-09-21
  - change: 🔒 **OWNER: THE `--dir` HOST HALF HAS A GRAMMAR, AND §5 #10 IS CLOSED — the heuristic is DELETED, not
    exchanged.** Accepted: `./p` `../p` `.` `..` `/p`, plus `<letter>:/p`, `<letter>:\p`, `\\srv\share` **on Windows
    only**. A **bare relative** path (`data`) and a **drive-relative** one (`C:`, `C:Users`) are syntax errors, reported
    **before the filesystem is touched** — v14's rule is that a malformed argument throws, and a typo coming back as
    `FileNotFound` sends the user to the filesystem to debug a spelling. 🔑 **Why this closes a row that had three
    costed options and no good one:** once `data` is illegal, `<letter>:` can only be a drive, so the resemblance rule
    is unnecessary rather than tolerated. **The owner's framing was "the same semantics TypeScript accepts"; the
    measured answer was a STRICTER SUBSET of it** — Node does not validate paths, it *resolves* them
    (`path.resolve("data")` succeeds), so literal parity would have re-admitted the exact spelling that caused the
    ambiguity. 🚨 **A SECOND DEFECT, found while gating the first and never suspected: `splitPreopen` had NO platform
    branch**, and `x86_64-linux-gnu` + `aarch64-macos` both cross-compile clean — a drive-letter rule was shipping to
    platforms with no drives, where `\` is an ordinary filename byte. The platform is now a **parameter**, not a read of
    `builtin`, so **both matrices are under unit test from either host** (806/810 passing, +2). ⚠️ **What that does NOT
    buy: wazmrt has still never been RUN on POSIX** — no CI exists in this repo at all, and `wasi.zig`'s
    `isAbsoluteTarget` / `escapesRelative` still split on `\` and read `t[1] == ':'` as drive-qualified on every
    platform. Reading says those are fail-CLOSED (they over-refuse legal POSIX names rather than granting access); that
    is a reading, not a measurement, and it is the open item. 🩹 **Also shipped: a Git Bash diagnostic.** MSYS rewrites
    `--dir ./data:/m` to `.\data;M:\` before wazmrt sees a byte (measured against three shells; PowerShell and cmd pass
    argv verbatim), so the corrupted path in the error read as a wazmrt bug. A `;` in a failing spec now adds a note
    naming the cause. **`::` is the only separator MSYS leaves alone**, so `--help` now prints `.::/` — which is also
    wasmrt's preferred spelling, so the fix moved toward the contract rather than away. 📐 Size gate: exe **+2,048**,
    lib +22, dll +0, ceilings raised in the same commit. ⏳ **PENDING MIRROR — and for the first time it runs the other
    way, with wazmrt the stricter side.** ⚠️ wasmrt's actual behaviour here is **UNMEASURED**; the check is in the §2.2
    row.
- **26** ⏳
  - date: 2026-09-20
  - change: 🔒 **FOUR OWNER DECISIONS, AND THE CLI QUESTION IS CLOSED FROM BOTH ENDS.** **§5 #2 CONFIRMED — and wasmrt
    is SYNCING ITS CLI TO wazmrt's**, which finishes the additive plan (wazmrt's half landed in B-c4). **§5 #6
    CONFIRMED** — the `aa2769b8` (was `7ce0dcd2`) attribution record stands; nothing for an agent to do, since wazmrt
    does not write to that tree. **§5 #7 DECIDED: coordination runs ONE SESSION AT A TIME**, with the boundary restated
    by the owner — *"we do not modify the other project unless specifically requested"*, §1a unchanged and now doubly
    stated. **§5 #11 DECIDED: zH7 ERRORS** — ✅ wazmrt shipped it the same day (`misplacedHostFlag`, `rc 1`, byte-neutral
    in ReleaseSmall). 🚨 **AND SHIPPING IT OPENED §5 #12, MEASURED RATHER THAN PREDICTED:** `wazmrt prog.wasm install
    --yes` now errors, which **contradicts §2.4a's "guest positions are never examined"** and the `install --yes` case
    §2.4 records. The old #11 row called that trade and was right. 🎓 §2.4a's "never examined" was **already not
    literally true** — zH7 warned about these same tokens from 2026-08-19; #11 changed the verdict, not the examination,
    and that is what made the contradiction visible. Three ways out are written into §5 #12 with a recommendation. ⚠️
    **§5 #10 IS STILL OPEN** — whether v14's "no looks like" reaches flag VALUES, i.e. `--dir`'s drive-letter fallback.
    It was not part of this round. 🔒 **Separately, and not a contract row: the RETIRED ORACLE's scope is settled** — it
    covers the sibling `wasmrt` only; the eight other reference projects may be studied, and behavioural measurement of
    anything was never restricted.
- **25** ⏳
  - date: 2026-09-20
  - change: 🚨 **TWO wazmrt DEFECTS THAT BROKE BINARY INTEROP IN BOTH DIRECTIONS, found by assembling the SPEC corpus
    with both toolchains and comparing bytes** (`ff856744`, Track B-a). **(1)** A block type that is a **non-null
    abstract ref** was emitted as wazmrt's INTERNAL enum tag — `(ref any)` is `0x64 0x6E` and wazmrt wrote `0x66`, which
    is not a wire encoding of anything. Our decoder read it back happily; **the sibling refused those bytes outright**
    (*"decode failed: unsupported instruction opcode"*), so wazmrt was producing modules no other runtime could load.
    **(2)** `any.convert_extern` and `extern.convert_any` had their **wire bytes swapped** in four places that all
    agreed — encoder table, decoder, doc comments, and `validate.zig`'s own switch on the raw byte. ⚠️ **That one was
    wrong in BOTH directions**: modules wazmrt assembled were refused by every other runtime, and correctly-encoded
    modules from any other toolchain were refused **here**. Fail-closed each way, which is why nothing noticed. 📌
    **Neither is a contract ROW** — §0 keeps internal design out of scope and neither is a CLI or security surface —
    **but both are recorded, because they are exactly the class §3.1 exists to protect: bytes that must mean the same
    thing to both runtimes.** 📊 Spec-corpus byte agreement went 1,807 → **2,121 of 2,141**; the residual 20 are two
    legal shorthand choices, cross-decoded on both runtimes with both encodings and documented at `roadmap.md` → B-a. ✅
    **The real-world `.wat` parity claim is UNCHANGED at 954/954** — none of these constructs occurs there, which is
    precisely why that corpus could not find them. 🛠️ The check is committed as `tools/emitter-diff.mjs`, optional and
    outward-reaching like the Bake Off.
- **24** ⏳
  - date: 2026-09-20
  - change: ✅ **§2.1 — THE SUBCOMMAND SPELLINGS ARE IN, AND THE 2026-09-19 LIST IS NOW EMPTY** (`b35940cb`, Track B-c4).
    `wazmrt run <module> <export> [args…]`, `wasi [flags] <module> [-- argv]`, `wat <file.wat> [-o out]`, `wast
    <file|dir>… [-v]` — all four **additive**, with every bare-path form verified unchanged, so a command line written
    for either runtime now runs on both. 🔑 **`run` and `wasi` are aliases onto the EXISTING paths**, not copies: they
    set a mode and move the argument index, and everything after is parsed by the same code, so the verify gate,
    `--features`, `--max-iterations` and Z1/Z2/Z3 apply identically whichever spelling was used. 🔒 **The named modes do
    NOT fall back** — `run m.wasm nosuch` on a module that also exports `_start` would otherwise run `_start` with
    `nosuch` as guest argv and exit 0, which is §2.3's failure in a new position; the bare form's guard stays narrow
    because there the word really might be argv. 🆕 **`wat` closes §2.1's *"wazmrt must grow it"* row**; measured from
    the sibling rather than assumed, it writes **nothing** without `-o` and only reports the size. ⚠️⚠️ **The one real
    trap, recorded because it is fail-OPEN:** `wasi`'s leading flags are moved behind the path as `lead ++ tail` — `tail
    ++ lead` would place them after an explicit `--`, handing `--dir` to the guest as argv so the run proceeds **with no
    preopen and no message**. It is a named function with its own inversion-proven test, and confirmed end to end. 🧹
    Also fixed: the unknown-flag hint advised *"use `--` to pass it to the guest"* from `.wast`, summarize, `wat` and
    `run`, none of which have guest argv — a §2.5-class untruth in a diagnostic, now per-mode. 📏 exe +9,216, **lib +0,
    dll +0** — none of this is in `root.zig`, so CLI convergence costs the embed artifacts nothing. ⏳ **wasmrt's copy is
    still at 10 — PENDING MIRROR**, and §2.1's `pin` row remains wasmrt's half.
