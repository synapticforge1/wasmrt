<!-- Part of the wasmrt ⇄ wazmrt swappability contract (interop.md is its entry point and holds the CONTRACT VERSION).
     Split from the one file on 2026-11-25 by moving each section verbatim (owner: "perform the work on W3"). -->
# interop — §3 The security-check contract — §3.1 to §3.7

## 3. The security-check contract

### 3.1 What gets hashed — the TOCTOU rule

- hash the **in-memory bytes about to execute**; never re-read by path
  - status: ✅ **AGREED** — `bytes-hashed == bytes-run` by construction
- a `.wat` input hashes the **assembled** bytes, not the source text
  - status: ✅ **AGREED** as a rule. ⏳ 🚨 **PORTABILITY BROKEN ON PURPOSE by wazmrt `1.0.2` (2026-09-21, v29), PENDING
    wasmrt's matching fix.** Workspace letter H13 found both runtimes' bodies diverging from wasm-tools in three ways
    (I12 local runs, I13 export order, I14 type interning order) — hidden because the runtimes matched EACH OTHER.
    wazmrt fixed all three (`9aee871d1`: 528/528 bodies equal wasm-tools'), so **measured against wasmrt's build of
    2026-09-20: `.wat` pins agree on 64 of 528 and differ on 464** (`cmem/probes/pin-parity.ts`), where they agreed on
    528. The 464 are exactly the files the fix changed. `.wasm` pins are untouched. ⚠️ **Parity returns when wasmrt
    makes the same three fixes** — the letter asks it to, and the check is `probes/body-parity.ts` against wasm-tools,
    not against wazmrt. 🔒 Owner: shipped in `1.0.2` anyway, *"since the consumers are not involved yet"*.
    *(Superseded:)* ✅ **PORTABLE since 2026-09-20 (Z4 closed, v22).** 954 of 954 comparable `.wat` files in the `wasmtk`
    tree now hash identically under both runtimes, up from 2; `.wasm` was and stays 513/513. **See §3.1m for the
    2026-09-19 divergence and §3.1m-r for the close.** ✅ **And since v23 the two listings are the same length — 1,467
    lines each, nothing in one and not the other** (B-d fixed, §3.1m-r).
- a `.wast` script hashes the **script bytes** — every module it can run is contained in them
  - status: ✅ **AGREED**
- the file is read **once**; no path is reopened after load
  - status: ✅ **AGREED** in behaviour · ⚠️ **wasmrt is making it a compiler-checked type** (`Loaded { bytes, digest }`),
    wazmrt passes a slice — an implementation difference, not a contract difference

⚠️⚠️ **`.wast` MUST BE GATED.** A script instantiates and invokes the modules it contains — including
`(module binary "…")` raw payloads. wazmrt shipped this bypass: `wazmrt payload.wast` ran unpinned,
unsigned wasm **even under a root-owned `# mode: enforce`**. **Any wasm can be wrapped in a `.wast`, and
the attacker chooses the extension, so the bypass needs no privilege.**

#### 🔬 3.1m — `.wat` DIGESTS DIVERGE, and the cause is the `name` section · 📎 wasmrt annex, ✅ **ACCEPTED AND FOLDED IN as v17** (wazmrt, pen-holder, 2026-09-19)

**§3a decision 2 said to make the `.wat` agreement a TEST rather than an assumption. Run, it fails.**
Both runtimes' `pin` hashes the assembled bytes, so the digests compare directly — one command per file.

| corpus | wasmrt's run (535 files) | 🔬 **the pen-holder's own re-run (959 files, whole `wasmtk` tree)** |
| --- | --- | --- |
| agree | **2** | **2** |
| differ | **529** | **952** |
| one/both refuse | 4 | 5 |

✅ **THE DIAGNOSIS IS CONFIRMED BYTE-FOR-BYTE, not taken on trust.** On `wasmtk/src/wasm/mathlib.wat`:

| artifact | SHA-256 |
| --- | --- |
| wasmrt's assembled output | `8fc0e0c4…` — **equals `wasmrt pin`** |
| the same, `wasm-tools strip --all` | `821a3b51…` — **equals `wazmrt pin`, exactly** |

`wasm-tools objdump` shows the difference is **one section**: `custom "name"`, 2020 bytes. Types,
functions, globals, exports and code are byte-identical, at identical offsets. **wasmrt emits a `name`
section built from the text's identifiers (as wasm-tools and wasmtime do); wazmrt emits none.**

🎯 **The mechanism is confirmed by the exceptions, which is the strongest evidence in the run.** The
**only two files out of 959 whose digests agree are the only two containing zero `$identifiers`** — no
identifiers, so wasmrt has no names to emit, so no `name` section, so the digests match. *The rule and
its exceptions have the same single cause.*

🔒 **Consequence for an operator: only `.wasm` pins are portable.** A `.wat` pinned under one runtime is
**refused** under the other. That fails **CLOSED** — a denial, never a silent run — so it is an
operational break, not a security hole. ⚠️ Until Z4 lands, an installer that pins `.wat` must pin **per
runtime**, and that limitation belongs in the deployment docs rather than being discovered.

📬 **Z4 is wazmrt's to fix, and the ask is the right one:** emit the `name` section from the identifiers
the text carries. 🔒 It also matches the owner's standing direction **not to discard information the
source carries** — the `.wat` text *has* the names, and dropping them is a lossy assemble.
⚠️ **Note what Z4 is NOT:** it is not "match wasmrt's bytes". It is "stop throwing the names away". The
digests converging is the *test* that it worked, not the goal. **Tracked at Track B → B-b.**

##### ✅ 3.1m-r — Z4 IS CLOSED · **CONTRACT VERSION 22** (wazmrt, 2026-09-20, `1bfdc6f5`)

**Re-measured with the same command on the same tree, the sibling rebuilt from its committed
`01d0dc42` (was `ab13ba975`) into a scratch target dir (nothing written to its tree, §1a):**

| | `.wat` agree | differ | `.wasm` agree |
| --- | --- | --- | --- |
| 2026-09-19 | 2 | 952 | 513 |
| **2026-09-20** | **954** | **0** | 513 |

🔑 **The annex above named ONE cause and there were THREE. The other two could only be found by the
gate, not by the diagnosis** — and the diagnosis was not wrong, it was complete for the file it was
run on. `mathlib.wat` has no unused data segment and no tag, so neither of the other two causes could
show up in it. *A single-file byte-for-byte confirmation proves the cause it finds and says nothing
about the ones it cannot reach.*

| # | cause | fixed by |
| --- | --- | --- |
| 1 | no `name` section | emit it, twelve subsections, shape read off a wasm-tools-assembled module |
| 2 | data-count section emitted for **every** module with a data section | emit it exactly when a body names a segment, per §5.5.16 — which is what wasm-tools does |
| 3 | an imported function's implicit type interned **after** every tag's | intern at the import, in source order alongside the tags; defined functions stay a later pass |

⚠️ **The operator consequence in §3.1m is now the other way round and the docs must follow: `.wat`
pins ARE portable between the two runtimes** for every file both assemble. ⏳ **PENDING MIRROR** —
wasmrt's copy is behind; the owner directs that edit (§1a).

🚨 **AND A NEW wazmrt DEFECT THE RUN FOUND, which is why the count is 954 and not 956.** Two corpus
files (`bindgen_fixtures/fnany_50.wat`, `hostfn_50.wat`) write `(type 0)` / `(type 1)` in an import's
typeuse while declaring no types at all. **wasmrt refuses them** (*"inline function type doesn't match
type reference"*). **wazmrt assembles, validates and runs them — with the imports bound to signatures
the text never wrote**: `__host_print`, written `(param i32 i32)`, comes out as
`(param i32 i32 i32 i32) (result i32)`. `rc 0`, no warning. 🔑 The cause is time-of-check:
`checkInlineTypeUse` skips itself when the referenced index is not interned *yet*, deferring to a
"downstream verdict" that never arrives because the emitter later manufactures a type at that index.
**This is a §2.5-class failure (a truthful validity claim) and it is wazmrt's.** Tracked as **B-d**.

✅ **B-d IS FIXED — CONTRACT VERSION 23, same day** (`35d8aa4b`). Every typeuse carrying both forms is
recorded and answered once the type space is complete; both files are refused here as wasmrt refuses
them. 📊 **The two listings are now identical in length, 1,467 lines each — `.wat` 954/954, `.wasm`
513/513, nothing in one and not the other.** ⚠️ The fix is *ask later*, not *refuse a forward
reference*: a forward `(type N)` whose inline signature agrees with what lands at N is legal and
wasm-tools assembles it. 🔒 The out-of-range hand-off is kept — `(func (type 5))` with no types
assembles on both and is refused by both at decode.

### 3.2 When the gate runs

| rule | status |
| --- | --- |
| the gate runs on a `will_execute` predicate; a pure **summarize/inspect** path is never gated | ✅ **AGREED** |
| the gate runs **BEFORE validation** — authorization first, so an unauthorized module is refused as *unauthorized* rather than parsed and reported on | ✅ **AGREED** |

### 3.3 The pin DB — a SHARED ON-DISK ARTIFACT

- **location**
  - agreed value: ✅ **DECIDED (owner, 2026-09-19) — v18. THE SHARED DEPLOYMENT PATH:** `/etc/wasmtk/pins` ·
    `C:\ProgramData\wasmtk\pins`, named for the deployment both runtimes ship inside, **with each runtime's own path
    kept as a FALLBACK**, and — 🔒 **the part that carries the safety** — **a loud warning when a runtime finds no DB
    where its sibling would have found one**, instead of quietly computing `armed = false`. ✅ Implemented in wasmrt
    (T9e), as a pure function with a mutation-verified test. ⏳ **wazmrt to adopt the same order and the same warning** —
    Track B-b. Today wazmrt reads `C:\ProgramData\wazmrt\pins` only
- ownership
  - agreed value: **root-owned, read-only to the user, plaintext.** Integrity from **ownership, not secrecy**
- format
  - agreed value: one lowercase-hex SHA-256 per line; blank lines and `#` lines ignored; whitespace-separated text after
    the hash is a human label and is ignored
- addressing
  - agreed value: **content-addressed — no paths in the DB**, so moving or renaming an approved file does not re-open a
    hole
- policy directive
  - agreed value: `# mode: off|warn|enforce` — the policy inherits the DB file's **ownership**
- pinning time
  - agreed value: at **install** time, with privilege — a verified install, **not** TOFU
- no encryption
  - agreed value: a category error: encryption gives confidentiality; what is needed is integrity
- no machine-binding
  - agreed value: the attacker **is** the user

✅ **RESOLVED 2026-09-19 by the owner — v18, and this closes §5 decision #1, the row this file has
called its most dangerous since v1.** Shared path, per-runtime fallback, and the anti-silent-disarm
warning. wasmrt reads `/etc/wasmtk/pins`, then `/etc/wasmrt/pins`, and **if neither exists while
`/etc/wazmrt/pins` does, it says so** rather than treating the deployment as unarmed.

🎯 **The warning is the load-bearing half, and it is worth being explicit about why.** A shared path
alone would still fail silently the moment a deployment is part-migrated: the binary swaps, the DB is
at the sibling's old path, nothing is found, and `armed = false` is a *perfectly ordinary* state with no
error attached to it. **The failure mode is not "no DB" — it is "no DB, and no reason to think that is
wrong."** Detecting the sibling's DB is the only cheap signal that distinguishes *"this host has no pin
policy"* from *"this host has one and I am not reading it."*

⏳ **wazmrt's half, and it is not just a path constant:** the lookup order, and the warning, and a test
that the warning fires. ⚠️ **Adopting only the shared path would be the dangerous partial fix** — it
closes the case where both runtimes are new and leaves the migration window, which is the window an
operator is actually in while swapping binaries.

*The row as it stood:* ⚠️⚠️ **THE PATH IS THE MOST DANGEROUS UNRESOLVED ROW IN THIS FILE.** If each runtime reads its own path,
**swapping the binary finds no DB, computes `armed = false`, and silently runs everything** — a security
downgrade with **no error message**, which is the worst defect class either project tracks.

**RECOMMENDED (owner decision pending): one shared path named for the deployment** —
`/etc/wasmtk/pins` and `C:\ProgramData\wasmtk\pins`, since `wasmtk` is what both are being included in.
Each may keep its own legacy path as a fallback. 🔒 **Whatever is chosen, a swap must not be able to
disarm silently:** if a runtime finds no DB where its sibling would have found one, that is worth saying
out loud rather than treating as "unarmed".

### 3.4 The `decide()` matrix — this must match exactly

Inputs: `explicit` (the DB's `# mode:`, or none) · `pinned` · `opt_out` (`--no-verify`/`--yes`) ·
`tty` · `armed`.

| # | condition | action |
| --- | --- | --- |
| 1 | `pinned` | **Run** — the DB approved it |
| 2 | `explicit = off` | **Run** |
| 3 | `explicit = enforce` | **Deny — ABSOLUTELY.** `opt_out` and `tty` are ignored: authority comes from the root-owned policy, never from a runtime argument |
| 4 | `explicit = warn`, `opt_out` | **Run** (with a warning printed) |
| 5 | `explicit = warn`, no `opt_out`, `tty` | **Prompt** |
| 6 | `explicit = warn`, no `opt_out`, no `tty` | **Deny** |
| 7 | no `explicit`, **not armed** | **Run** — nothing to verify against |
| 8 | no `explicit`, armed, `opt_out` | **Run** (with a warning printed) |
| 9 | no `explicit`, armed, no `opt_out` | **Deny** |

**Armed** = a root key is embedded **or** a pin DB is present. A bare build with neither runs
everything, so "costs nothing when unarmed" is structural rather than promised.

**`--verify` may only RAISE strictness** above the DB-declared policy, never lower it. **Under a
root-owned `# mode: enforce`, both `--pins` and `--verify` are ignored** — the pin set *and* the policy
come from root.

### 3.5 Fail-closed rules — both bought by defects, both binding

- a present `# mode:` with an **unrecognised value** means **`enforce`**, not "no policy"
  - why: a typo (`# mode: enfroce`), odd capitalisation or a trailing comment must not silently degrade to a state
    `--no-verify` can then override. **A root-intended enforce must never be downgradable by a misspelling.**
- a DB content line whose first token is **not a valid 64-hex digest** is an **error**, not a skipped line
  - why: a truncated or mangled DB must fail **loud**; silently dropping approvals makes a pinned module look "not in
    the list" — which reads as an attack and hides a corrupt file
- `--verify <typo>` is an **error**, not a default
  - why: same reasoning as the `# mode:` rule, at the other input
- an override that *would* have blocked **prints a warning**
  - why: never silently unverified

### 3.6 The WASI sandbox rights model

| property | agreed value | status |
| --- | --- | --- |
| `PATH_SYMLINK` exists as a right | **bit 24** | ✅ **AGREED** (wazmrt had **no such right at all** until 2026-08-10 — the gap that started this table) |
| `PATH_SYMLINK` is in the **write mask** | yes, so `--ro-dir` strips it | ✅ **AGREED** |
| `--dir` grants | `ALL & !PATH_SYMLINK` — **symlink CREATION denied by default** | ✅ **AGREED** (owner, 2026-08-10) |
| `--ro-dir` grants | `ALL & !WRITE_MASK` | ✅ **AGREED** |
| `--allow-symlink` | opts creation back in, for installer-shaped work | ✅ **AGREED** |
| following a **pre-existing** link | allowed — the grant governs **creation**, not traversal | ✅ **AGREED** |
| an escaping link target | refused **at creation**, independently of the follow-time check | ✅ **AGREED** |
| no `--dir` at all | every path call is `BADF`; **there is no implicit cwd** | ✅ **AGREED** |
| the full `oflags`/`fdflags` sets, and which right each `path_*` handler demands | ⬜ **UNVERIFIED** — this is the T12x row-by-row diff, still to be run |

### 3.7 Resource ceilings

| ceiling | default | status |
| --- | --- | --- |
| max linear memory | **`1 << 30`** (1 GiB) | ✅ **AGREED** — verified in both, 2026-08-19 |
| max table elements | **`1 << 27`** (128 M) | ✅ **AGREED** — verified in both, 2026-08-19 |
| max call depth | **512** | ✅ **AGREED** — verified in both, 2026-08-19 |
| an execution bound (non-termination) | **`1 << 30` iterations** per top-level call | ⚠️⚠️ **DIVERGENT AND LIVE — wazmrt shipped it 2026-08-19, wasmrt has nothing. See §3.7a.** |

