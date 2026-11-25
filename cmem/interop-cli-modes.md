<!-- Part of the wasmrt ⇄ wazmrt swappability contract (interop.md is its entry point and holds the CONTRACT VERSION).
     Split from the one file on 2026-11-25 by moving each section verbatim (owner: "perform the work on W3"). -->
# interop — §2 The CLI contract — §2.1 Run modes

## 2. The CLI contract

🔒 **SETTLED 2026-08-19 (owner) — RESTORED 2026-08-19 after a concurrent-edit collision dropped it.**
**The two executables keep their own names — `wasmrt` and `wazmrt` — and that is the ONLY permitted
difference. Everything after the program name must be in sync.**

> *"The program will each be named separately wasmrt/wazmrt. That does not change. It is the CLI options
> that need to be in sync."*

**So there is nothing to decide about who adopts whose spelling — both adopt both.** The working test of
this whole section: **take any invocation, change only the program name, and it must do the same thing
under the other runtime.** That is what makes the tables below a specification rather than a survey, and
it is why §2.1's run modes are in scope alongside §2.2's flags — a command line is not portable if only
its flags are.

### 2.1 Run modes

wazmrt dispatches on the file extension and on whether an export was named; wasmrt uses explicit
subcommands. **The agreed target is ADDITIVE: each accepts the other's spelling, and neither loses the
form it already ships.**

- summarize + validate, no execution
  - wazmrt spelling: `wazmrt <module>`
  - wasmrt spelling: `wasmrt <file>`
  - status: ✅ **AGREED on behaviour + exit code (both `rc=0`, neither executes) — ⚠️ MEASURED 2026-08-19, the OUTPUT
    TEXT differs.** *(The row read "already identical", which was written from reading and is false as stated.)*
- call an exported function
  - wazmrt spelling: `wazmrt <module> <export> [args…]` **and `run <module> <export> …`**
  - wasmrt spelling: `wasmrt run <file> <fn> [args…]` **and the bare form**
  - status: ✅ **AGREED — both spellings on both sides.** wasmrt's F1 closed 2026-09-19; wazmrt took `run` 2026-09-20
    (v24). 🔒 `run` does not fall back to WASI
- run a WASI `_start` command
  - wazmrt spelling: `wazmrt <module> [flags] [-- argv]` **and `wasi [flags] <module> …`**
  - wasmrt spelling: `wasmrt wasi [flags] <file> […]` **and the bare form**
  - status: ✅ **AGREED 2026-09-20 (v24).** ⚠️ Under `wasi` the flags may precede the module on BOTH runtimes; `wasi`
    does not fall back to a summary
- run a `.wast` spec script
  - wazmrt spelling: `wazmrt <script.wast>` **and `wast <file|dir>… [-v]`**
  - wasmrt spelling: `wasmrt wast <file|dir>… [-v]` **and the bare form**
  - status: ✅ **AGREED 2026-09-20 (v24).** 🔒 wazmrt gates every script, multi-target included — the path executes
- assemble `.wat` → `.wasm`
  - wazmrt spelling: `wazmrt wat <file.wat> [-o out]`
  - wasmrt spelling: `wasmrt wat <file.wat> [-o out]`
  - status: ✅ **AGREED — wazmrt grew it 2026-09-20 (v24).** Without `-o` both assemble and report the size, writing
    nothing
- pin a module for the DB
  - wazmrt spelling: `wazmrt pin <file|dir> [--db <path>]`
  - wasmrt spelling: `wasmrt pin <file|dir> [--db <path>]`
  - status: ✅ **AGREED — measured 2026-10-24 (v35).** The same digest for the same file, written to `--db`, and each
    runtime's DB then admits the module under `--verify enforce`. *(The cell read "absent — a stub" until v35; it was
    stale from 2026-09-19.)* Corpus-wide parity is §3.1's `.wat`/`.wasm` pin rows
- keypair / signing tools
  - wazmrt spelling: `wazmrt keygen`, `wazmrt sign`
  - wasmrt spelling: *(design-only)*
  - status: ⬜ **deferred** — reopen when either ships signatures
- `-h`/`--help`, `-v`/`--version`
  - wazmrt spelling: **first argument only**
  - wasmrt spelling: **first argument only**
  - status: ✅ **AGREED**

⚠️⚠️ **ALIGNING THE RUN MODES CHANGES WHAT A BARE PATH DOES, AND IT IS A SECURITY-POSTURE CHANGE.**
wazmrt's `will_execute` predicate is *"an export was named **or** the module exports `_start`"*, so
`wazmrt prog.wasm` **runs** a WASI command — while `wasmrt prog.wasm` today **summarizes** it. Adopting
the predicate means the most casual invocation there is starts **executing** code where it previously
only inspected it. 🔒 **The verification gate must land before, or with, that change — never after.**


#### ✅ 2.1z — **wasmrt's COLUMN IS GREEN (T9e, 2026-09-19); wazmrt's halves are what remain** · v20

✅ **Verified by running wasmrt's committed code** (built from `97b610c9` (was `51254b9cf`) into the pen-holder's own
scratch target dir, so nothing was written to wasmrt's tree — §1a):

| capability | verified |
| --- | --- |
| `wasmrt <module> <export> [args…]` | ✅ `valid.wasm add 2 3` → **`5`**, rc 0 |
| `wasmrt <script.wast>` by extension | ✅ `1 passed, 0 failed, 0 skipped`, rc 0 |
| `wasmrt pin <file>` | ✅ prints the digest line, rc 0 |
| `--dir` with **both** separators | ✅ rc 0 for `.:/` and `.::/` |
| `--features` both vocabularies | ✅ `bulk_memory` **and** `bulk-memory-operations` both accepted |

🎯 **F1 IS CLOSED.** `wasmrt valid.wasm add 2 3` now returns **5**. Earlier in this same session the
pen-holder measured it printing a summary and exiting 0 with the export silently ignored; T9e fixed it,
and Z1 with it. *The finding and its fix are hours apart, which is the cadence working.*

⏳ **Outstanding on wazmrt's side — measured, not assumed:**

- **the subcommand spellings**
  - item: `run`, `wasi`, `wast`, `wat`
  - wazmrt today: ✅ **CLOSED 2026-09-20, v24** (`b35940cb`) — all four accepted, additively, every bare form unchanged.
    The cell is the measurement that bought the row
- **`::`**
  - item: the preferred separator
  - wazmrt today: ⚠️ unsupported — **and `.:/` is broken too, §2.2z**
- **the hyphenated feature vocabulary**
  - item: `bulk-memory-operations`
  - wazmrt today: ⚠️ `error: --features: unknown proposal` — wazmrt accepts only `bulk_memory`
- **Z1 / Z2 / Z3**
  - item: §2.3, §2.4a, §2.5
  - wazmrt today: ✅ **CLOSED 2026-09-19, v21** (`f780ad27`) — the cells above are the measurement that bought the rows
    and stay as written
- **Z4**
  - item: the `name` section
  - wazmrt today: ✅ **CLOSED 2026-09-20, v22** (`1bfdc6f5`) — **954 of 954 comparable `.wat` digests agree**, up from 2.
    See §3.1m

✅ **ALL SIX ROWS MEASURED ON 2026-09-19 ARE NOW CLOSED.** The `::` and feature-vocabulary rows and
Z1–Z3 closed with v21; Z4 with v22; B-d with v23; the subcommand spellings with **v24**. ⚠️ Closed
means *measured closed*, not *finished forever* — §2.1's table is the live one, and the next
`coordinate` re-runs it rather than trusting this line.

⚠️ **RECORDED DIVERGENCE, and the pen-holder is NOT making it a contract row: `multi_table`.** wazmrt
models it as a proposal layered on `reference_types`; wasmrt does not model it separately (its
`reference-types` carries it), and **recognises the name, warns, and continues** — so wazmrt command
lines still run. Measured: `wazmrt --features all,-multi_table` → rc 0, restriction applied;
`wasmrt --features all,-multi_table` → rc 0 with *"`multi_table` is not a separate proposal"*.
🎯 **Why it stays an observation:** §0 puts *internal design* out of scope, and which proposals an engine
models separately is exactly that. ⚠️ **What IS in scope is the observable consequence, so it is stated
here rather than left implicit: the same `--features` line does not gate the same thing on both
runtimes.** A deployment that relies on `-multi_table` to exclude a capability gets that exclusion on
wazmrt and **a warning and no exclusion** on wasmrt. 🔒 **REOPEN as a contract row the moment either
side ships a module that one accepts and the other refuses on this basis** — that is the day it stops
being a modelling difference and becomes a swappability break.

#### 🔬 2.1m — FIRST MEASURED RUN of §4 check 5 (wasmrt session, 2026-08-19)

**Method:** `wasmrt 0.9.0 (abi 1)` release build vs `wazmrt 1.0.0 (abi 2)`, same box, same module
(a two-line `.wat` exporting `add`). ⚠️ **Exit codes were re-measured after the first attempt read
`$?` through a pipe and reported `head`'s status instead of the binary's** — *know what your
measurement tool omits* (`best-practices.md` §1.5).

**F1 — ⚠️⚠️ The two "call an export" gaps fail in OPPOSITE directions, and wasmrt's is the dangerous
one.**

| invocation | wasmrt | wazmrt |
| --- | --- | --- |
| `<prog> add.wat add 2 3` *(positional)* | **`rc=0`, prints the module SUMMARY — the export and both arguments are silently ignored, and it exits SUCCESS** | ✅ `rc=0`, prints `5` |
| `<prog> run add.wat add 2 3` *(subcommand)* | ✅ `rc=0`, prints `5` | ❌ `rc=1`, `error: cannot read 'run': FileNotFound` |

**Same missing capability; opposite consequence.** A wazmrt-shaped command run under wasmrt **does not
fail — it succeeds at the wrong thing**, which is the silent-wrong-output class this project ranks
worst. The mirror case is loud: wazmrt returns `rc=1` and says why. 🎓 *Which direction to err in is a
property of the consequence, not a house style* — so **wasmrt's half of this row is the higher
priority of the two**, even though the tables above give them equal weight.

**F2 — the "summarize" row was marked ✅ AGREED and the output text is not identical.**
`wasmrt` prints `<path>: WebAssembly module (version 1)` plus a multi-line section breakdown;
`wazmrt` prints `<path>: valid wasm v1, 4 section(s)`. **Behaviour and exit code do agree** (both
`rc=0`, neither executes). §0 puts run modes, flag names, argument shapes, defaults and exit codes in
scope — **not output text** — so this is **out of scope and recorded anyway**, because the row claimed
"already identical" and that sentence was written from reading, not running.

**F3 — 🆕 FLAG POSITION differs, and the contract does not have a row for it.** The flag tables list
names and argument shapes but never say *where the flags go*:

| invocation | result |
| --- | --- |
| `wazmrt <module> --dir <spec>` *(its documented order)* | ✅ `rc=0` |
| `wazmrt --dir <spec> <module>` *(wasmrt's order)* | ❌ `rc=1`, `error: cannot read '--dir': FileNotFound` |
| `wasmrt wasi --dir <spec> <module>` *(its order)* | ✅ preopen parsed |
| `wasmrt wasi <module> --dir <spec>` *(wazmrt's order)* | ⚠️⚠️ **no error — `--dir <spec>` is passed to the GUEST as argv, so the sandbox is never granted** |

⚠️⚠️ **The last row is a second silent failure, and it is a security one.** wazmrt's flags follow the
module path; wasmrt's precede it. A wazmrt user's muscle memory under wasmrt produces a run with **no
preopen at all** and **no warning** — the guest simply gets `BADF` on every path call, which looks like
a guest bug rather than a missing grant. **Position is part of an argument shape and belongs in §2.2 as
its own row.**

**F4 — 🔻 A CORRECTION: the single-colon `--dir` claim in §2.2 was wrong, and it was wrong because it
was written from READING the code.** The text asserted *"it does not error; it preopens the wrong
thing."* **Measured:** `wasmrt wasi --dir <host>:/s <module>` → `rc=1`,
`wasmrt: cannot preopen <host>:/s: errno 29`. **It fails loudly.** The separator divergence is real and
still needs the both-accept-both fix, but its consequence is a **clean failure**, not a silent
mis-preopen. *(Third read-not-verify error recorded across the two projects in two days — this one is
wasmrt's, and it had been carried in this contract as a ⚠️⚠️ since v1.)*

**F5 — `-v` output shape differs**: wasmrt prints one line (`wasmrt 0.9.0 (abi 1)`), wazmrt prints two
(adding `signature trust anchor: none …`). Out of scope as text; recorded because a script that parses
`--version` sees a different shape. *(The ABI numbers differ — 1 vs 2 — which is §0-out-of-scope by
design.)*

**What check 5 has NOT covered yet:** the `.wast` row, `--ro-dir`, `--allow-symlink`, `--env`, the
ceiling flags, `--` as an end-of-flags marker, and the whole of §2.3's per-failure exit codes. Those
rows stay ⬜ **UNVERIFIED** and **may not be quoted as agreed.**

