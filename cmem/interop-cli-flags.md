<!-- Part of the wasmrt ⇄ wazmrt swappability contract (interop.md is its entry point and holds the CONTRACT VERSION).
     Split from the one file on 2026-11-25 by moving each section verbatim (owner: "perform the work on W3"). -->
# interop — §2.2 Flags, with the §2.2f and §2.2m annexes

### 2.2 Flags

| flag | wazmrt | wasmrt | status |
| --- | --- | --- | --- |
| `--dir <host>[<sep>guest]` | ✅ **BOTH `:` and `::`**, and 🆕 **the host half has a GRAMMAR** (2026-09-21, v27): `./p` `../p` `.` `..` `/p`, plus `<letter>:/p`, `<letter>:\p` and `\\srv\share` **on Windows only**. A bare relative path (`data`) and a drive-relative one (`C:`, `C:Users`) are SYNTAX errors, rc 1, before the filesystem is touched | ✅ **BOTH `:` and `::`** (2026-09-19), never mistaking a drive letter | ⏳ **DIVERGED — wazmrt has narrowed and wasmrt has not.** ⚠️ The ambiguous case is **gone on wazmrt rather than documented**: `x:/` is drive `X:` because `x` alone is no longer a legal host path at all. ⚠️ **UNMEASURED on wasmrt: their column records no host-path grammar, so `--dir data:/m` is expected to run there and is rc 1 here** — which would make this the first CLI row where wazmrt is the stricter side. **The check, not the conclusion:** run `--dir data:/m`, `--dir C:`, `--dir C:Users` on wasmrt from a directory containing `./data` and compare rc. Mirror per §1a, owner-directed |
| `--ro-dir` | same separator issue | same | ⚠️⚠️ as above |
| **flag POSITION** relative to the module path | flags come **AFTER** the path — 🆕🔒 **and a wazmrt flag written where only the guest sees it is an ERROR, `rc 1`** (v26, owner 2026-09-20; it WARNED from zH7, 2026-08-19 until then); nothing after an explicit `--` is examined, which is now the whole escape hatch. ⚠️ **See §5 #12** — this contradicts §2.4a's *"guest positions are never examined"* and `prog.wasm install --yes` now fails | flags come **BEFORE** the path | ⚠⚠ **DIVERGENT AND LIVE — MEASURED 2026-08-19 (F3).** wasmrt silently passes a trailing `--dir` to the GUEST, so the sandbox is never granted and nothing warns. |
| `--allow-symlink` | ✅ | ✅ | ✅ **AGREED** (both added 2026-08-10) |
| `--env KEY=VALUE` | ✅ — 🔒 **the rule (v35, owner 2026-10-24, §5 #13): the guest sees ONLY the `--env` variables, nothing from the host; an entry must be `KEY=VALUE` with a non-empty KEY, else rc 1; a repeated KEY replaces the earlier entry in place (last wins), never a second entry.** ✅ **wazmrt FIXED to it the same day** (`putEnv`; measured before: `--env A` and `--env =x` reached the guest verbatim, and `--env A=1 --env A=2` gave it two `A` entries) | ❌ **the guest INHERITS the whole host environment** and `--env` adds to it: measured 2026-10-24, **111** variables with no `--env` (the host's) where wazmrt's guest sees **0**. Deliberate, with a test asserting it (`cli_review_regressions.rs`, `env_flags_add_to_the_inherited_environment_rather_than_replacing_it`). `--env A` is rc 1 ✅ and a repeated KEY replaces ✅; ❌ `--env =x` is accepted | ✅ **AGREED (v36, 2026-10-24): wasmrt FIXED it** (`cfeee31`). Re-run by the pen holder on both binaries, wasmrt built from that commit into a scratch target: no `--env` → 0 variables, `A=1 A=2` → 1, `A=1 B=2` → 2, `A=` → 1, `A` and `=x` → rc 1, **identical on all six**. *(v35 read: "DIVERGENT — wasmrt must stop inheriting, and refuse an empty KEY".)* 🔒 The reason is the sandbox rule: a guest reaches only what is granted, and a shell's environment carries tokens. ⚠️ wasmrt's inherit test asserts the opposite and must be INVERTED, not deleted. *(A probe that exits with the bare variable count cannot tell "1 variable" from "refused, rc 1": exit with count + 10.)* |
| `--max-memory <size>` | ✅ | ✅ (measured 2026-10-24) | ✅ **AGREED (v35).** `1M` refuses a 2 MiB memory and `4M` admits it, rc 1 / rc 0 on both; an unparseable size (`lots`) is rc 1 on both |
| `--max-table-elems <count>` | ✅ | ✅ (measured 2026-10-24) | ✅ **AGREED (v35).** `10` refuses a 100-entry table and `1000` admits it, on both |
| `--features <list>` | 🔒🆕 **v39 (2026-10-24): the VALUE-TYPE rule is D2 2.2.0's `typeRules`** (wasm-tools 1.262's rule; owner: "wasm-tools' rule"). **wazmrt reads it from its definitions copy.** Every rule group needs ANY one of its features on:<br>• `funcref` / `externref` need reference-types; as a table's or element segment's type, `funcref` needs nothing.<br>• `(ref func)` / `(ref extern)` need reference-types AND function-references.<br>• `(ref null? $t)` needs reference-types AND (function-references OR gc).<br>• `exnref` and its forms need reference-types AND exceptions.<br>• The GC types (`any` `eq` `i31` struct array, the bottoms) need reference-types AND gc.<br>The encodings follow D2's `encodingRules`. *(v39 said "which wazmrt already met"; **v40 corrects it**: a table initializer was not gated, fixed 2026-10-24.)* Measured: wazmrt vs binaryang 2.2.0 over S1's corpus × 49 configs, **2,352 / 0 differ**; before the change it was 22 (all wazmrt accepting). Accepting less, so S1 −20 and the floor is **MAJOR** (wazmrt **4.0.0**). ✅ **AGREED on both:** wasmrt adopted the same rule (`cee7bd1`, owner-directed). Re-run by the pen holder on wasmrt **1.0.0** (`d0cb616`) against wazmrt 4.0.0: the D2 matrix is **2,352 / 0 differ** (`d2-matrix.ts --runtime`), and the CLI corpus is identical. — ✅ **AGREED (v38, 2026-10-24): wasmrt made the v37 change** (`4162c52` + `daec1d6`) and the pen holder RE-RAN the row on both binaries, wasmrt built from `daec1d6` into a scratch target (§1a). Over `tests/behaviour` × D2's presets, `-all,<f>`, `all,-<f>` and `-all`, there were **2,352 judgements, 0 differ** (`cmem/probes/d2-matrix.ts --runtime`). The CLI corpus (`tests/cli`, 56 command lines, `--features` position included) was **identical**. ⏳ The TYPE rules both runtimes share await binaryang's answer to the matrix letter (sent 2026-10-24). — 🔒🆕 **v37 (2026-10-24): IMPLEMENTED in wazmrt — D2's names AND meanings** (binaryang D2 2.1.0 / D1 1.0.1, `docs/opcode-guide.md`): **(1)** every instruction is gated by its own D1 `feature` and nothing else (a test holds all 582 to it; 141 differed before, every one a wasm-tools layer); **(2)** the names are D2's `cli` (`mutable-globals`, `saturating-float-to-int`, …; `annotations` and `code-metadata` accepted, switching nothing); **(3)** the presets are D2's `wasm1` `wasm2` `wasm3` `all` (⚠️ D2's `wasm3` has NO `threads`), with `mvp`, `lime1` and `-all` kept; **(4)** D2 `requires` is recorded, not enforced — and **gc no longer admits the INSTRUCTION `call_ref` with function-references off** (it still admits a typed reference, as the guide says); **(5)** the wasm-tools-only names are DEPRECATED aliases with a warning: `floats` → nothing (1.0 core), `bulk-memory-opt` → bulk-memory, `legacy-exceptions` → exceptions, `call-indirect-overlong` → reference-types, `gc-types` → gc, `mutable-global` → mutable-globals; the C ABI's values 20–24 stay valid and inert. Measured with the gate: spec conformance unchanged (288 files, 0 regressed); S1 `beh` +62 −2 (`wasm3` no longer accepts `threads.wat`; `lime1` no longer the overlong `call_indirect`), so the floor is **MAJOR**; no `run` line moved. ⏳ **wasmrt migrates once, to this.** The text below is the history. 🔒 **v32 (2026-10-23): the VOCABULARY below is REVERSED by the owner, "we need to align with binaryang not wasm-tools"**: binaryang's D2 names become canonical, and the wasm-tools-only names stay as deprecated aliases for one minor release. 🔒 **v33: names AND meanings** (owner, 2026-10-23: "aligning with binaryang means its meanings also"): which feature gates which instruction follows D1's `feature` column, and the preset and dependency rules follow D2, not wasm-tools' measured ones. This answers wasmrt's §2.2m question. This row is rewritten when binaryang's FL1 settles D2's spellings. ⚠️ **wasmrt: do not implement v30's wasm-tools vocabulary in the meantime.** 🆕 **And it PRECEDES the module path, the only wazmrt flag that does; written after it is now an ERROR** (§2.4b, v16). 🆕🔒 **v30 (2026-09-21): wasm-tools' WHOLE vocabulary with wasm-tools' MEANINGS** — every name wasm-tools 1.259 accepts (component-model included; unimplemented proposals switch nothing), the presets `-all` `mvp` `wasm1` `wasm2` `wasm3` `lime1`, the group names (`bulk-memory` also switches `bulk-memory-opt`; `reference-types` also `call-indirect-overlong`), and **no configuration is refused** — only modules. Proven by `cmem/probes/feature-matrix.ts`: the same matrix run on both tools is **identical** | ✅ at the CLI, before the path (measured 2026-10-24, v35): `--features mvp` refuses a SIMD module and `all` admits it, rc 1 / rc 0 on both; written after the path it is rc 1 on both, so **§2.4b's position rule is met**. The VOCABULARY is v32's pending migration (§2.2m: 54 of 85 matrix lines differ, by v32's direction) | ⏳ **position AGREED; vocabulary and meanings migrate ONCE, to D2, at FL1** (v32/v33). *(Until v35 this cell read "absent at the CLI", stale since 2026-09-21, and asked wasmrt to match v30, which v32 reversed.)* |
| `--max-iterations <count>` | ✅ (2026-08-19) | ✅ (T9i, 2026-09-19) | ✅ **AGREED — §3.7a, v19**; re-measured 2026-10-24 (v35): `1000` stops `(loop (br 0))`, rc 1 on both, wasmrt naming the ceiling. *(The cell read "absent" until v35.)* |
| `--` ends host flags, rest is guest argv | ✅ — 🆕 **and it is now the ONLY way to hand a wazmrt-flag spelling to the guest** (v26; see the position row below) | ✅ (measured 2026-10-24) | ✅ **AGREED (v35).** `m.wasm -- --yes x` gives the guest argc 3 on both; `m.wasm install --yes` is rc 1 on both (v26/v28) |
| `--pins <path>` | ✅ — 🔒 **a DB named by `--pins` that cannot be read is an ERROR, `FileNotFound` included, in every mode** (v35, owner 2026-10-24: §5 #14). ✅ **FIXED in wazmrt the same day**; before it a missing file meant "no DB", and the module ran unverified in silence unless `--verify enforce` | ✅ refuses, rc 1, *"cannot read pin DB"*, in every mode (measured 2026-10-24) | ✅ **AGREED (v35)** — wasmrt's behaviour was the right one, and wazmrt took it. The DEFAULT paths keep "missing = unmanaged" (§3.3), because there nobody asked for a DB |
| `--verify off\|warn\|enforce` | ✅ | ✅ (measured 2026-10-24) | ✅ **AGREED (v35).** A typo (`enforc`) is rc 1 on both; a pinned module runs under `enforce`; an unpinned one is refused under `enforce`, and under `warn` with no TTY to confirm, on both |
| `--no-verify`, `--yes` | ✅ | ✅ (measured 2026-10-24) | ✅ **AGREED (v35).** Under `warn` the unpinned module runs, with a warning, on both; under `enforce` `--yes` does not override, rc 1 on both |

⚠️ **THE `--dir` SEPARATOR IS A SWAPPABILITY BREAK THAT IS LIVE TODAY**, and it has nothing to do with
verification. `--dir .:/` is a working wazmrt invocation; on wasmrt the single colon is not the
separator. Each side has a real reason: a single `:` is ambiguous with a Windows drive letter
(`--dir C:\data:/data`), which is why wasmrt chose `::`.

🔻 **CORRECTED 2026-08-19 (F4), and the correction is folded in here by the pen-holder rather than left
in the annex** — because a refuted claim that stays in the table is what the next reader quotes. This
paragraph asserted *"it does not error; it preopens the wrong thing"* and **that was wrong**. Measured:
`wasmrt wasi --dir <host>:/s <module>` → `rc=1`, `wasmrt: cannot preopen <host>:/s: errno 29`. **It
fails LOUDLY.** The divergence is real and still needs the both-accept-both fix below, but its
consequence is a **clean failure**, not a silent mis-preopen — so it is downgraded from ⚠️⚠️ to ⚠️.
🎓 *The claim had been carried since v1 and was written from READING the code.* It is the **third**
read-not-verify error across the two projects in two days, and it is precisely why §1 rule 4 says a row
is verified by RUNNING both.

**AGREED RESOLUTION: both accept both.** Prefer `::`; fall back to a single `:` when the spec contains
no `::` **and** the split is not a drive letter. Converging on one spelling would break existing
invocations of the other, which is the opposite of swappable.

⚠⚠ **THIS ROW IS IN TENSION WITH v14 (§2.4a-i) AS OF 2026-09-19, AND IS FLAGGED RATHER THAN CHANGED.**
*"the split is not a drive letter"* is a **resemblance rule about a flag's VALUE** — the parser looks
at `C:\data:/data` and decides which colon the user meant. The owner's v14 instruction (*"no 'looks
like' built in"*) is written about options; this is the same mechanism one level down, and
🎓 **it is the single place in this contract where a heuristic is not just tolerated but AGREED.**
⚠️ **It is left standing until the owner rules — §5 #10.** Repealing an agreed row by implication is
exactly the unilateral move §1 forbids, and the alternatives are not free either: requiring `::`
everywhere breaks existing wazmrt invocations, and erroring on every ambiguous `:` breaks
`--dir .:/`, which is the form the docs use.

#### ⚠️⚠️ 2.2z — **`--dir .:/` DOES NOT WORK ON wazmrt, and it is the example wazmrt's own `--help` prints** (found by the pen-holder, 2026-09-19, v20)

**Measured, then confirmed in the source.** `wazmrt prog.wasm --dir .:/` →
`error: --dir '.:/': FileNotFound`. The spec was never split; the whole string was taken as the host
path. `--dir .::/` fails too (`--dir '.:'`). **wazmrt accepts NEITHER documented separator form.**

**The cause, from `src/main.zig`:** the split takes the **last** `:` **only when its index is > 1** —

```zig
if (std.mem.lastIndexOfScalar(u8, spec, ':')) |i|
    if (i > 1) .{ spec[0..i], spec[i + 1 ..] } else .{ spec, spec }
```

`i > 1` is the **Windows drive-letter guard**: it stops `C:\tmp` being split into `C` + `\tmp`. But in
`.:/` the colon is at index **1**, so a one-character *relative* host path is indistinguishable from a
drive letter and is silently not split. `--dir ./:/` works, because the colon moves to index 2.

| invocation | wazmrt | wasmrt |
| --- | --- | --- |
| `--dir .` | ✅ rc 0 | ✅ rc 0 |
| `--dir .:/` **(wazmrt's own help example)** | ⚠️⚠️ **rc 1, FileNotFound** | ✅ rc 0 |
| `--dir .::/` | ⚠️⚠️ **rc 1, FileNotFound** | ✅ rc 0 |
| `--dir ./:/` | ✅ rc 0 | ✅ rc 0 |

🎓 **THREE THINGS THIS IS, and they are worth separating.**
1. **A live defect**, not a divergence: wazmrt's documented invocation fails against wazmrt.
2. **A refuted contract claim.** §2.2 has said since v1 that *"`--dir .:/` is a working wazmrt
   invocation"*, and it was **written from reading, never run** — the *fourth* read-not-verify error
   across the two projects, and the second one found in this file's own text.
3. 🔒 **§5 #10 made concrete.** This IS the "looks like a drive letter" heuristic the owner's v14
   no-"looks like" rule put in tension, and here it **gives a wrong answer on ordinary input**. The
   decision is still the owner's — but it is no longer a hypothetical cost. ⚠️ **A fix that only adds
   `::` would leave this defect standing**, since `.:/` fails for a reason that has nothing to do with
   which separator is preferred.

⏳ **wazmrt's half is now two things, not one:** accept `::`, **and** stop mis-guarding a one-character
relative host path. Tracked at Track B → B-b.

### 📎 2.2f — wasmrt ANNEX (2026-09-20, unnumbered — regime A): **a flag row verified on PARSING is not verified**

Found by a validator review, not by a coordination pass, which is why it is here: the `--features` row
in §2.2 reads ✅ **DONE · both vocabularies resolve, same seeding, same layering refusals, must come
BEFORE the module path**. Every word of that is measured and true, and the flag was still **applied by
one of the three wasmrt paths that judge a module**.

| command | wazmrt (measured 2026-09-20) | wasmrt, before | wasmrt, after |
| --- | --- | --- | --- |
| `<rt> --features mvp simd.wasm` (summarize) | refuses: *uses the 'simd' proposal, which --features excludes* | `validation OK` | refuses, naming `simd` |
| `<rt> --features mvp simd.wasm f` (call an export) | refuses | **ran it and printed `7`** | refuses |
| `<rt> wasi --features mvp simd.wasm` | refuses | refuses | refuses |

**The break was wasmrt's**, and it was live: the same command line ran on one runtime and was refused by
the other, which is exactly what §2's working test forbids (*change only the program name and the
invocation must do the same thing*). Fixed in wasmrt — `call_export` and `print_summary` now judge under
`flags.features`, like `run_wasi_loaded` always did — and pinned by
`crates/wasmrt/tests/cli_features_are_applied.rs`, one test per path, mutation-verified.

🔒 **No contract change is proposed.** The row's *content* was right; what failed was its verification.
The rule this adds is for §4's checks, and it applies to every flag row in §2.2: **verify by asserting
on what the command DID — the verdict, the exit status, the output — in every position AND on every
path the flag claims to govern.** §4.10's "test the spellings, not the flag" plus "and test the PATHS".
⏳ For wazmrt's session: worth re-running §2.2's other rows the same way (`--dir`, `--max-*`,
`--verify`, `--env`), since a flag that is parsed and dropped looks identical to one that works.

### 📎 2.2m — wasmrt ANNEX (2026-10-23, unnumbered — regime A): **the v11–v31 MIRROR, verified by running both**

*Owner-directed mirror (2026-10-23: "the contract range wasmrt must adopt, now v11–v31", then v32
the same evening).* wasmrt's copy was at **v10**. It is now wazmrt's **v32, verbatim** (mirrored from
wazmrt's committed `cmem/interop.md`), plus two wasmrt annexes not yet folded:
§2.2f (2026-09-20) and this one. No version number is originated here (regime A). The rows were then
**verified by running both binaries on the same command lines**: wazmrt `1.0.3`
(`zig-out/bin/wazmrt.exe`, built 2026-09-21) and wasmrt at the mirror commit.

| row | wasmrt BEFORE the mirror | now | evidence |
| --- | --- | --- | --- |
| **v27** `--dir` host grammar | ❌ **in breach**: `data`, `data:/m`, `data::/m`, `C:` and `data/../data` were accepted (rc 0); `C:Users` and `~/x` failed only at the filesystem | ✅ **identical to wazmrt on 26 cases**, wording included; Windows-only drive and UNC forms | `crates/wasmrt/tests/cli_contract_dir_and_guest_position.rs`, inverted |
| **v26 / v28** exact host-flag name in a guest position | ❌ **in breach**: all 11 names passed to the guest (rc 0), with a warning for 3 | ✅ identical on 30 cases: the 11 names are rc 1; the `=value` forms, `--features`, `--help`, `--version`, `-h` and `-v` pass | same file, inverted |
| **§2.4b** `--features=<list>` | ❌ **a swappability break the row's own table implies**: `wazmrt --features=mvp m.wasm` ran, and wasmrt refused it as an unknown flag | ✅ applied before the path; after it, rc 1 naming the position. The ONLY `=` spelling either runtime takes (measured over 12 flags) | same file, inverted |
| v11 unknown flag · v15 single dash · v16 position | ✅ already identical (19-row probe) | ✅ | — |
| **v30** `--features` = wasm-tools' vocabulary and meanings | ❌ **NOT MET**: `cmem/probes/feature-matrix.ts` differs from wazmrt's output on **54 of 85 lines**. No `wasm1`/`wasm2`/`wasm3`/`lime1`/`-all`, no `floats`/`gc-types`/`call-indirect-overlong`…, and wasmrt refuses CONFIGURATIONS (`all,-simd` → "relaxed-simd requires simd") | ⏸️ **NOT implemented, by v32's direction** ("wasmrt: do NOT implement v30's wasm-tools vocabulary in the meantime"). wasmrt migrates ONCE, to binaryang's D2 vocabulary, when FL1 settles the spellings. ⚠️ Two v30 points are about MEANINGS rather than names (no configuration refused; module-level dependencies). 🔒 **Owner, 2026-10-23: "use v32"**: wasmrt follows v32 as written, so neither is implemented until the row is rewritten at FL1, and wasmrt still refuses `all,-simd` as a configuration until then | the matrix, run three ways. wasmrt also measured, from wasm-tools 1.262, each instruction's required feature set (492 instructions) and the bulk-memory / reference-types group splits; kept for the D2 migration |
| **v29** `.wat` pins | ❌ broken on purpose by wazmrt `1.0.2`'s H13 fixes: 64/528 agreed | ✅ **RESTORED 2026-10-23**: wasmrt made H13's three encoder fixes (locals in runs, exports in source order, implicit types interned in source order), plus I8 (an `@custom "name"` annotation is the only `name` section). Then **`wasmrt pin` = `wazmrt pin` on 603/603 `.wat` and 584/584 `.wasm` over wasmtk's corpus**, nothing on one side only, and **wasmrt's module bodies = `wasm-tools parse` on 603/603** | `scripts/body-parity.ts` (new gate); both runtimes' `pin <dir>`, compared file by file |

⚠️ **Oracle drift, for the pen-holder.** v30's matrix is proven "identical" against wasm-tools
**1.259**. wasm-tools **1.262** float-gates three relaxed-SIMD ops (`f32x4.relaxed_madd`,
`i32x4.relaxed_trunc_f32x4_s`, `f64x2.relaxed_min` refused under `all,-floats`) where 1.259 did not,
so wazmrt now differs from 1.262 on exactly those 4 matrix lines. wasmrt will target the row **as
written** (1.259's meanings, i.e. wazmrt's output) until the row says otherwise.

⚠️ **Stale wasmrt cells in §2.1/§2.2, for the pen-holder to refresh.** Several cells still describe
wasmrt before 2026-09-19 and contradict §2.1z ("wasmrt's column is green"): §2.1's `pin` row
("absent — a stub"), and §2.2's `--env`, `--max-memory`, `--max-table-elems`, `--max-iterations`,
`--`, `--pins`, `--verify`, `--no-verify`/`--yes` ("absent") and `--features` ("absent at the CLI").
All of them exist and were exercised by the probes above.
✅ **REFRESHED by the pen holder in v35 (2026-10-24), each re-run on both binaries** (wazmrt
2.0.0 + the v35 fix; wasmrt built from its committed `37f0187` into a scratch target, §1a). Every
cell agreed except two, both now owner decisions: §5 #13 (`--env` inheritance; wasmrt changes) and
§5 #14 (a missing `--pins` DB; wazmrt changed).

⚠️ **Observations on wazmrt's 2026-09-21 build** (letter H8; measured, not diagnosed; re-measure on a
current build): under `--features all,-memory64` a `(table i64 …)` module is ADMITTED; under
`all,-function-references` (GC on) `call_ref` is ADMITTED where wasm-tools refuses; and the table
initializer form is admitted with function-references AND GC off. **Each would breach v30** if the
current build still does it.

