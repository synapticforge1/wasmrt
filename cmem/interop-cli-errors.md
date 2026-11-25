<!-- Part of the wasmrt ⇄ wazmrt swappability contract (interop.md is its entry point and holds the CONTRACT VERSION).
     Split from the one file on 2026-11-25 by moving each section verbatim (owner: "perform the work on W3"). -->
# interop — §2.3 Exit codes and §2.4 flag-parsing rules

### 2.3 Exit codes

- a WASI guest's `proc_exit(n)` becomes the process exit status (`n & 0xff`)
  - status: ✅ **AGREED** — verified in both, 2026-08-19
- success → 0, host-side failure (bad args, unreadable file, invalid module, refused by policy) → non-zero
  - status: ✅ **AGREED**
- **specific non-zero codes per failure kind**
  - status: ✅ **AGREED (v13, 2026-09-19) — every host-side failure and every guest TRAP → `1` on both; `proc_exit(n)` →
    `n & 0xff`.** Measured twice by running both binaries: wasmrt's 18-row matrix (§2.3m) and the pen-holder's own
    12-case re-run on the same bytes before folding — unreadable file, bad magic, unassemblable `.wat`, invalid module
    (summarize **and** call-an-export), wrong arity, unparseable argument literal, missing arguments, no arguments, and
    a trap: **`1` on both, in every one.** 🎓 **The row closes with no per-kind table, because neither implementation
    distinguishes kinds** — the portable contract is the success/failure split plus `proc_exit`, and writing a table of
    codes nobody emits would have been a list that drifts. Closes §5 decision #4. ⚠️ **REOPEN** the moment either side
    introduces a second non-zero code — that is the day scripts stop being portable across the swap.
- 🆕 **naming an export the module does not have is a failure** — non-zero, with a message naming it; never a silent
  fall-back to summarizing (Z1, §2.3m)
  - status: ✅ **FOLDED IN AS CONTRACT VERSION 13 by the pen-holder (wazmrt, regime A), 2026-09-19.** 🔒 Owner decision,
    recorded by wasmrt; owner: *"pass all three issues to the wazmrt team"*. ⚠️⚠️ **THE ROW BINDS BOTH SIDES, and on the
    day it was folded in NEITHER was fully clean** — recorded that way deliberately, because a row written as "they must
    adopt" is a row its author stops testing. It is a case of row 2 (a bad argument), stated separately because wazmrt
    breaks it: `wazmrt m.wasm nosuch` prints the summary and exits **0**. wasmrt's `run` already complies (rc 1, *"no
    exported function `nosuch`"*). ⚠️ **wasmrt's bare-path form still has F1** (`wasmrt m.wasm f` summarizes, rc 0).
    That is the same class on wasmrt's side, and it stays open under §2.1.

#### 🔬 2.3m — §2.3 MEASURED by running both binaries (wasmrt session, 2026-09-19) — 📎 ANNEX, ✅ **ACCEPTED AND FOLDED
IN as v13** (wazmrt, pen-holder, 2026-09-19); kept in place as the measured evidence

*A wasmrt contribution under regime A: **not a version**, rows above deliberately left as the pen-holder wrote
them — ✅ **and the pen-holder has since folded them in as v13**, after re-running all of it (§2.5h-a). Triggered by the
owner's `coordinate` on the one item wasmrt had logged as needing it: "`wasmrt <file>`
exits 0 on an invalid module".*

**Method.** Both copies of this file byte-compared first: **IDENTICAL at v10** (neither changed since
2026-08-19). Binaries: `wasmrt 0.9.0 (abi 1)` at `76e77ec7` (was `3c49845dd`), and `wazmrt 1.0.1 (abi 2)` from
`zig-out/bin`, built 2026-08-19 13:02. Its only later source commit is zH7 (13:05), and the binary
**already carries zH7** (verified: `wazmrt m.wasm x --dir .` prints zH7's warning). Nothing was built or
written in the wazmrt tree. Fixtures come from `wasm-tools parse`, which does not validate, so an ill-typed
module really reaches each validator. `rc` is read from the process, not through a pipe (§2.1m's lesson).

**Row 2 ("host-side failure → non-zero", ✅ AGREED) — wasmrt was in breach three times; wazmrt in none:**

| | invocation | wasmrt before | wazmrt | wasmrt after |
| --- | --- | --- | --- | --- |
| **W1** | summarize an INVALID module (`.wasm` or `.wat`) | **0** | 1 | 1 |
| **W2** | no arguments at all | **0** (printed the version) | 1 (usage) | 1 (usage) |
| **W3** | `.wast` with a FAILED assertion / an UNPARSEABLE script / an UNREADABLE file | **0 / 0 / 0** | 1 / 1 / 1 | 1 / 1 / 1 |

✅ **Fixed on wasmrt's side**, pinned by `crates/wasmrt/tests/cli_exit_codes.rs`, which is mutation-verified.
This needs **no contract change**: it moves wasmrt ONTO a row both copies already carry. After the fix, an
18-row matrix agrees on success vs failure in every row. It covers summarize, call-an-export and WASI
`_start`, across valid, invalid, malformed, missing, trapping and `.wat` inputs. 🎓 *W1 is also why §2.1's
summarize row read "AGREED on exit code": it was measured on a VALID module only.* Skips in a `.wast` run do
**not** fail it on wasmrt: they are reported separately.

**Row 3 ("specific non-zero codes per failure kind", ⬜) — MEASURED, and the two already agree.**
Every host-side failure kind we exercised returns exactly **1** on both runtimes: unreadable file, bad
magic, unassemblable `.wat`, invalid module on every path, wrong arity, unparseable argument literal,
missing arguments, and usage. So does a guest **trap**. `proc_exit(n)` returns `n` on both (row 1).
📎 **Proposed for the pen-holder:** promote row 3 to *"✅ AGREED: every host-side failure and every trap
→ 1; `proc_exit(n)` → `n & 0xff`"*. That also closes **§5 decision #4** without a per-kind table. A script
cannot tell a trap from a refusal by code alone on either runtime, and nothing measured suggests it needs to.

**Observations for wazmrt.** Neither runtime is the oracle, so these are recorded, not diagnosed, and
fixing them is wazmrt's call in wazmrt's tree:

* **Z1 — the MIRROR of F1.** `wazmrt valid.wasm nosuch`, naming an export the module does not have,
  prints the summary and exits **0**. The name is silently ignored. wasmrt's `run` exits 1 with *"no
  exported function `nosuch`"*. Same class as F1 (an argument dropped, the run reported as success),
  on the other side.
* **Z2 — unknown flags have no row, and the two diverge.** `wazmrt m.wasm --bogus` exits **0** (the flag
  goes to the guest). wasmrt refuses an unknown option in either position: rc 1, *"use `--` to pass it
  to the guest"*. ⚠️ **Not a simple fix on either side.** wazmrt's flags-after-path form cannot tell a
  mistyped host flag from a guest argument without `--`, and §2.4 already records why that is dangerous
  (`… install --yes`). ✅ **DECIDED by the owner the same day → §2.4a**, which resolves the tension by
  *position* and, after the path, by *dash count* (v15): an unknown `--flag` errors, a `-flag` is the guest's.
* **Z3 — output text, out of scope (§0), recorded anyway.** wazmrt's summary header reads *"valid wasm
  v1, N section(s)"* for a module whose last line reports `validation: FAILED`. The exit code is right
  (1); the first line a human reads is not.

**§2.1m's "not covered yet" list, updated:** §2.3's per-failure exit codes and the `.wast` row's exit
behaviour are now covered. wazmrt also accepts `.wat` on its summarize and call paths (measured), so the
§2.1 "assemble" row concerns only the `wat` subcommand.

### 2.4 Flag-parsing rules that are part of the contract

- **`-h`/`--help` and `-v`/`--version` are recognised as the FIRST argument only**, so a `--help` inside
  a guest's argv is never the host's. ✅ AGREED.
- ⚠️ **Verification flags are recognised only in the LEADING RUN of host flags.** Scanning "everything
  before `--`" is **not** sufficient: the common WASI form has no `--` at all
  (`… prog.wasm install --yes`), so the guest's own arguments get searched and a `--yes` meant for the
  guest **silently disables verification**. wazmrt paid for this; wasmrt must not re-buy it.

### 2.4a Unknown flags — **an error, `unknown flag`** · 🔒 **OWNER DECISION 2026-09-19** · ✅ **CONTRACT VERSION 11 — FOLDED IN AND NUMBERED by the pen-holder (wazmrt, regime A), 2026-09-19**

> Owner, 2026-09-19: *"I do want an 'unknown flag' rule in the contract that throws an 'unknown flag' error."*

**The rule.** A flag-shaped argument (one beginning with `-`, other than `-` alone and the `--` marker)
that appears in a **host-flag position** and is not a flag that command recognises **stops the run
before anything executes**:

* stderr contains the words **`unknown flag`** and names the argument;
* the exit status is **1** (§2.3).

**Host-flag positions** (checked):
1. the **first argument**, apart from `-h`/`--help`/`-v`/`--version` (§2.4);
2. **anything before the module path**;
3. the **leading run of flags immediately after the module path**, which is wazmrt's flag position —
   🆕 **for a `--flag` only** (v15). Both runtimes accept flags there under §2.2;
4. **every argument** of a command that has no guest argv: summarize, `.wast`, and `wat`.

**Guest positions** (the guest's argv — 🔒 **AMENDED by the owner 2026-09-21, v28, closing §5 #12**):
* everything after an explicit **`--`** — **never examined**, passed verbatim. This is the one
  unconditional hand-off, and the spelling for a guest argument that is also a wazmrt flag name;
* everything after the **first non-flag argument** that follows the module path. That is the export
  name and its arguments (so `-1` stays a value), or a WASI program's argv. 🔒 **Examined for EXACT
  wazmrt host-flag names only**, and an exact match is an **error, rc 1** (§2.4b, §5 #11); anything
  else passes verbatim. So **`prog.wasm install --yes` is an error, and `prog.wasm install -- --yes`
  is how a guest receives its own `--yes`.** ⚠️ **EXACT names, never resemblance**: `--yess`,
  `--Yes` and `--dirs` are the guest's, untouched. v14's "no looks like" governs this examination
  too. 🎓 *The old text said "never examined" and had not been literally true since zH7 began
  warning on these tokens (2026-08-19); #11 changed the verdict, not the examination, and that is
  what exposed it. The amendment makes the text describe the code, not the reverse.*
* 🆕 **a SINGLE-DASH token in position 3** — the run immediately after the module path, in a mode that
  has guest argv. It is the guest's and needs no `--`: `prog.wasm -la` runs. **(v15)**

🆕 **Why position 3 splits by dash count** (owner, 2026-09-19, narrowing the rule the same day it was
written): **every host flag that can appear after the module path is double-dash** — `--dir`,
`--ro-dir`, `--env`, `--max-*`, `--pins`, `--verify`, `--no-verify`, `--yes`, `--features`,
`--allow-symlink`. The single-dash names (`-h`, `-v`) are first-argument-only (§2.4), and the
subcommand flags (`wast -v`, `wat -o`) belong to modes with **no guest argv**. So a single-dash token
there **cannot be a host flag**, there is nothing to disambiguate, and demanding `--` would only make
`prog.wasm -la` longer. A `--flag` in that position genuinely could be either, so an unknown one errors.

⚠️ **What that costs, recorded rather than smoothed over.** A mistyped host flag with one dash —
`-dir /tmp` for `--dir /tmp` — reaches the guest silently, so the preopen is never granted and nothing
says so. 🔒 **The owner considered a "looks like a host flag" warning for exactly this case and refused
it** — *"I do not want the 'looks like' part. If it is not a proper cli option throw the error"* (as
recorded in wasmrt's copy), and to this session the same day: *"We should have no 'looks like' built in
so that it interprets a cli."* A token is judged by its POSITION and by whether the command knows it,
**never by resembling a flag name**. 🎓 **A near-miss list is itself a thing that would drift between
the two runtimes** — which is this file's oldest lesson applied to a helpfulness feature.

⚠️ **The other consequence, which stands:** a guest's own `--help` directly after the path is an
unknown flag — `prog.wasm -- --help` is the spelling. That is the rule doing its job, since `--dirr`
must not slip past silently. The CLI help says so on wasmrt.

**zH7 is unchanged and complementary.** A **known** host flag stranded in a guest position still only
*warns* (it may be the guest's own); an **unknown** `--flag` in a host position *errors*.

- first argument / before the path (**either dash form**)
  - wazmrt (measured 2026-09-19, 1.0.1): rc 1, but reported as *"cannot read '--bogus': FileNotFound"*
  - wasmrt: ✅ `unknown flag`
  - status: ⚠⚠ **wazmrt: NOT merely the wording — a v14 breach.** The parser decided the flag *looked like* a path.
    Right code, and a message that sends the user to the filesystem to debug a typo'd flag
- leading run after the path, **`--flag`**
  - wazmrt (measured 2026-09-19, 1.0.1): **rc 0 — handed to the guest**
  - wasmrt: ✅ `unknown flag`
  - status: ⚠⚠ **wazmrt must adopt**
- leading run after the path, **`-flag`**, in a mode that **HAS guest argv** (`_start` present) (v15)
  - wazmrt (measured 2026-09-19, 1.0.1): rc 0 — the guest's
  - wasmrt: rc 0 — the guest's
  - status: ✅ **AGREED — both measured correct 2026-09-19** (`wazmrt start.wasm -la`, `wasmrt wasi start.wasm -la`). 🎓
    The narrowing *removed* work from wazmrt: its existing behaviour here was right, and pre-narrowing v11 would have
    made us break it
- ⚠️ leading run after the path, **`-flag`**, in a mode with **NO guest argv** (summarize, `.wast`, `wat`)
  - wazmrt (measured 2026-09-19, 1.0.1): **rc 0 — ignored** (`wazmrt valid.wasm -la`)
  - wasmrt: ✅ rc 1, `unknown flag`
  - status: ⚠⚠ **wazmrt must adopt — the v15 carve-out does NOT reach here.** Position 4 is *every* argument, both dash
    forms; the dash-count split is scoped to **modes that have guest argv**, because that is the only place there is a
    guest to hand it to
- `.wast` script flags
  - wazmrt (measured 2026-09-19, 1.0.1): **rc 0 — ignored**
  - wasmrt: ✅ `unknown flag`
  - status: ⚠️⚠️ **wazmrt must adopt**
- guest positions (after `--`, after the first guest arg)
  - wazmrt (measured 2026-09-19, 1.0.1): untouched
  - wasmrt: untouched
  - status: ✅ **AGREED**

wasmrt is pinned by `crates/wasmrt/tests/cli_unknown_flag.rs` (mutation-verified). Before the rule,
**both** runtimes silently ignored an unknown flag in at least one host position.

#### 2.4a-i 🔒🔒 **NO "LOOKS LIKE" — an argument is a RECOGNISED option or it is an ERROR** · **OWNER DECISION 2026-09-19** · ✅ **CONTRACT VERSION 14**

> Owner, 2026-09-19: *"improper cli options should throw an error. We should have no 'looks like' built
> in so that it interprets a cli. If it is a valid cli option run it, if not throw and error."*

🎯 **This is the GENERAL rule that §2.4a is one instance of, and it is stronger than §2.4a alone.**
§2.4a says an unrecognised flag in a host position errors. **v14 says the host parser may not
RESEMBLANCE-MATCH anything, ever.** Within a host-flag position an argument is compared against the set
of options that command accepts: **exact match → run it; anything else → `unknown flag`, rc 1.** There
is no third branch, and in particular these are all now **forbidden**:

- **guessing a flag is a PATH**
  - what it looks like in practice: ⚠️ wazmrt today: `wazmrt --bogus m.wasm` → *"cannot read '--bogus': FileNotFound"*
  - why it is forbidden: the exit code is right and **the message sends the user to look at the filesystem for a typo in
    their flag.** This is the purest case of the rule: the parser decided what the argument *resembled*
- **fuzzy / "did you mean"** matching
  - what it looks like in practice: `--dirr` → silently treated as `--dir`, or corrected
  - why it is forbidden: a near-miss that RUNS is the silent-wrong-output class with a helpful face on it. ⚠️ **Printing
    a suggestion is not the same as acting on one** — the error may name near spellings, it may not adopt one
- **prefix / abbreviation** matching
  - what it looks like in practice: `--max` accepted for `--max-memory`
  - why it is forbidden: today's unambiguous abbreviation becomes ambiguous the moment a flag is added, so it silently
    changes meaning across versions
- **"probably the guest's"** inference in a **host** position
  - what it looks like in practice: ignoring an unknown flag after the path because it might be argv
  - why it is forbidden: this is Z2 exactly, and it is what §2.4a already killed
- **inferring a flag from its VALUE's shape**
  - what it looks like in practice: treating `-1` as a flag, or a flag as a value, based on what it resembles
  - why it is forbidden: §2.4a settles this **by position**, and position is grammar — see below
- **a "did you mean a host flag?" warning** on a near-miss
  - what it looks like in practice: warning that `-dir /tmp` looks like `--dir /tmp` before passing it to the guest
  - why it is forbidden: 🔒 **the owner considered exactly this case and REFUSED it** (v15). It is the most tempting
    form of the rule to break, because the thing it would catch is real

⚠⚠ **WHAT v14 DOES *NOT* TOUCH, and the distinction is the load-bearing one: GRAMMAR IS NOT
RESEMBLANCE.** The host/guest boundary in §2.4a is fixed by the **shape of the command line** — an
explicit `--`, the first non-flag argument after the module path, and 🆕 **the DASH COUNT of a token in
position 3** (v15) — **not by judging what an argument looks like.** 🎯 **Dash count is the clearest
case of the distinction:** *"a single dash after the path is the guest's"* is a fact about the shape of
the line that holds for every possible token; *"`-dir` looks like `--dir`"* is a guess about one. The
first is decidable and stable, the second is a list that drifts. A WASI guest's argv is not "a cli option wazmrt failed to recognise"; it is **not
addressed to wazmrt at all**, and the grammar says so before any matching happens. 🔒 **This is not a
loophole in v14, it is the reason v14 is implementable:** a rule that made every argument on the line
either a valid host option or an error would make `prog.wasm install --yes` impossible to write, and
§2.4 records what that costs — a guest's own `--yes` **silently disabling verification**, a trap this
project has already paid for once.

⚠️ **TWO THINGS v14 PUTS IN TENSION, BOTH FLAGGED FOR THE OWNER RATHER THAN DECIDED HERE:**

1. ⚠⚠ **§2.2's agreed `--dir` separator fallback is itself a "looks like" rule** — *"fall back to a
   single `:` when the spec contains no `::` **and the split is not a drive letter**"*. Deciding
   whether `C:` is a drive letter or a host path is **exactly** the resemblance-matching v14 forbids,
   and it is not a flag NAME but a flag VALUE. **§5 #10.** *(It was agreed before v14 existed; it is
   raised, not overridden — the pen-holder does not get to repeal an agreed row by implication.)*
2. **zH7's WARN.** A *known* host flag stranded in a **guest** position warns rather than errors,
   because it may genuinely be the guest's. Under v14 that is grammar, not resemblance, so it stands as
   written — but it is the nearest neighbour to the rule and the owner may want it to error. **§5 #11.**

**Status — MEASURED 2026-09-19 by running both, on flag NAMES:**

| probe | wazmrt 1.0.1 | wasmrt 0.9.0 |
| --- | --- | --- |
| **prefix / abbreviation** — `--max-mem` for `--max-memory`, `--vers` for `--version`, `--outp` for `--output` | — | ✅ `unknown flag`, rc 1 — **not accepted** |
| **near-miss spelling** — `--dirr` | — | ✅ `unknown flag`, rc 1 — **named, not adopted** |
| **flag-shaped argument in a host position** — `--bogus`, `-Dbogus` | ⚠⚠ *"cannot read '-Dbogus': FileNotFound"* — **guessed it was a path, in both probes** | ✅ `unknown flag`, rc 1 |

✅ **wasmrt COMPLIES on flag names** — four probes, no abbreviation and no fuzzy adoption; it names the
argument and stops. ⚠⚠ **wazmrt is in breach** (the path-guess, reproduced on a second spelling, plus
all of §2.4a). ⬜ **Neither side's flag-VALUE parsing has been swept for resemblance rules** — that is
a different surface from the names measured here, and §2.2's drive-letter fallback is a known instance
of it sitting in this contract as **AGREED** (§5 #10). Tracked for wazmrt at Track B-b.

### 2.4b 🆕 A flag with a REQUIRED POSITION, written where it cannot apply, is an **ERROR** · 🔒 **OWNER DECISION 2026-09-19** · ✅ **CONTRACT VERSION 16**

> Owner, 2026-09-19: *"If the `--features <list>` has to go before the module, we need to identify
> that in the invocation and help sections for sure, and we need an error thrown when it is in the
> wrong location."*

**The rule.** Where a command accepts a flag **only** in one position, that flag appearing in a
**different host-flag position** stops the run: stderr names the flag **and the position it requires**,
and the exit status is **1**. It is never ignored, and never merely warned about. ⚠️ **Guest positions
stay untouched** (§2.4a as narrowed by v15) — after `--`, or after the first non-flag argument, the
token is the guest's.

🎯 **It also binds the HELP, which is half of what the owner asked for.** A flag with a required
position must state that position in the usage/invocation section, not only in its own entry further
down. *A constraint documented only where the reader already knows to look is not documented.*

**Today the only such flag is wazmrt's `--features`,** which must precede the module path. 🔒 The
reason it cannot simply be accepted in both places is recorded at its parse site and is a real one: in
run mode the export name must be `args[2]`, so a trailing flag region would silently change which mode
`wazmrt prog.wasm --dir .:/ add 2 3` selects for a module exporting both `add` and `_start`. Nor may it
be read from the trailing region at all — a guest's own `--features mvp` must never narrow the
language wazmrt accepts, the same reasoning that keeps `--no-verify` out of there.

| | wazmrt **before** (1.0.1 as shipped) | wazmrt **after** (this change) | wasmrt |
| --- | --- | --- | --- |
| `--features` before the path | ✅ applies | ✅ applies | ✅ applies (measured 2026-10-24, v35) |
| `m.wasm --features mvp` | ⚠️⚠️ **rc 0 — ran under the FULL feature set, in SILENCE** | ✅ rc 1, names the required position | ✅ rc 1, *"`--features` must come BEFORE the module path"* (v35) |
| `m.wasm --features=mvp` | ⚠️⚠️ **rc 0 — same** | ✅ rc 1 | — |
| `m.wasm --dir . --features mvp` | ⚠️⚠️ **rc 0 — same** | ✅ rc 1 | — |
| `m.wasm -- --features mvp` | rc 0 — the guest's | ✅ rc 0 — unchanged | — |
| `m.wasm guestarg --features mvp` | not warned by zH7 | ✅ unchanged (guest position) | — |

⚠️⚠️ **THE DEFECT THIS FOUND IS WORSE THAN THE MISSING ERROR, and it is why this is a contract row
rather than a help-text fix.** `--features` is the one wazmrt flag whose entire job is to **REFUSE**
modules — a smaller trusted computing base. Written after the path it was **silently dropped**, so a
user who asked for `mvp` got every proposal enabled, with **no error, no warning, and a successful exit
status**. 🎓 **That is the fail-OPEN direction on a security control**, the same shape as zH2's ignored
GC ceiling and as §2.4's `install --yes` trap. **zH7 did not catch it**: zH7 warns for names in
`flagRegion`'s lists, and `--features` is deliberately absent from them, so it fell between the two
mechanisms that exist to prevent exactly this. 🎓 *A rule that names the things it guards will not
guard the thing it does not name.*

✅ **Shipped in wazmrt** — `misplacedFeaturesFlag` in `src/main.zig`, pinned by two tests (one for the
rule, one proving its walk matches `flagRegion`'s), **inversion-proven**: stubbing the detector to
`return null` fails the first test, and the suite is green restored (767 tests, 4 skipped for the known
exFAT symlink cases). ⚠️ **wasmrt is not in breach** — it has no `--features` at the CLI at all (§2.2
already records that as *"wasmrt must expose"*). **This row binds it when it adds one.**

