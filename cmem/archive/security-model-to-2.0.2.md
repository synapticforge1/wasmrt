## ✅ DECIDED 2026-08-19 (owner) — gate load-once, and build `pin` to wazmrt's APPLICATION

**The owner accepted the recommendation** (gate load-once; re-scope `pin` to a default-`off` mechanism
rather than delete it) **and added the binding constraint: "the idea is to be SWAPPABLE with the wazmrt
project."** So `pin` is not merely *similar in spirit* — the on-disk artifacts and the policy semantics
must be **interchangeable**, and that raises the bar from "same design" to "same behaviour on the same
files".

🔒 **Provenance: this is the "wasmtime's SHAPE, our code" rule applied to wazmrt** — read the
architecture, write our own Rust. **No code, symbols or structures are transcribed**, the Component
Ledger stays empty, and the divergences below are the compliance test: a design that could not be
re-derived under wasmrt's constraints (zero deps, `forbid(unsafe_code)`, `no_std`-friendly core) was
being copied rather than understood.

### The split — and it maps onto wasmrt's crate boundary unchanged

wazmrt puts the **pure logic** in `src/pin.zig` (libc-free, usable from `wasm32-freestanding`) and keeps
**file I/O, the DB location, policy resolution and the consent prompt** in `src/main.zig`. That is
exactly wasmrt's `wasmrt-core` (no_std-friendly) / `wasmrt` (CLI) boundary, so
`crates/wasmrt-core/src/pin.rs` gets the logic and `crates/wasmrt/src/main.rs` gets the wiring.

### 1. The core module — `wasmrt-core/src/pin.rs`

| item | shape |
| --- | --- |
| `Digest` | `[u8; 32]`, `hex_len = 64` |
| `hash(&[u8]) -> Digest` | SHA-256 of **exactly these bytes** — the in-memory buffer about to run |
| `to_hex` / `hash_hex` / `parse_hex(&str) -> Option<Digest>` | lowercase hex out, case-insensitive in, `None` unless exactly 64 hex chars |
| `Mode` | `Off < Warn < Enforce` |
| `stricter(a, b)` | the stricter of two — so a dev flag can only **raise** |
| `mode_from_db(text) -> Option<Mode>` | reads a `# mode: <m>` directive; `None` if absent |
| `Action` | `Run` / `Deny` / `Prompt` |
| `decide(explicit, pinned, opt_out, tty, armed) -> Action` | pure; the whole precedence matrix, unit-testable with no I/O |
| `Db { entries: Vec<Digest> }` | `parse(text) -> Result<Db, ParseError>`, `contains(&Digest) -> bool` |

**The `decide` precedence, verbatim in behaviour:**

1. `pinned` → **Run** (the DB approved it).
2. An explicit `# mode:` (root-owned, so the policy inherits the DB file's ownership) wins:
   `Off` → Run · **`Enforce` → Deny ABSOLUTELY** (opt-out and tty are ignored — authority comes from
   the root-owned policy, not from a runtime argument) · `Warn` → `opt_out` ? Run : `tty` ? Prompt : Deny.
3. No explicit mode and **not armed** → Run (a bare build has nothing to verify against).
4. Armed → `opt_out` ? Run : **Deny** (default-deny, user-overridable on their own machine).

⚠️ **Two fail-closed rules that are load-bearing, and both were bought by defects over there:**

- **A present `# mode:` with an unrecognised value returns `Enforce`, not `None`.** A typo
  (`# mode: enfroce`), odd capitalisation or an inline trailing comment must not silently degrade to
  "no policy" — which `--no-verify` could then override. **A root-intended enforce must never be
  downgradable by a misspelling.**
- **A content line whose first token is not a valid 64-hex digest is an error, not a skipped line.** A
  truncated or mangled DB must fail **loud**; silently dropping approvals makes a pinned module look
  "not in the list", which reads as an attack and hides a corrupt file.

**DB format (this is a compatibility surface — see §3):** plaintext; one lowercase-hex SHA-256 per
line; blank lines and `#` lines ignored; any whitespace-separated text after the hash is a human label
and is ignored. **Content-addressed on purpose — no paths in the DB**, so moving or renaming an
approved file does not re-open a hole.

#### ⚠️ The one real cost: wasmrt must implement SHA-256 itself

Zig's `std` ships `sha2`; **Rust's does not**, and wasmrt has **zero third-party dependencies** as a
recorded invariant, so `sha2`/`ring` are out. That means ~150 lines of safe Rust in core.

**Why that is acceptable here, stated so it is not mistaken for a general licence to write crypto:**
SHA-256 is a fixed, fully-specified function with public test vectors; there is **no secret and no key**
in this use, so there is nothing for a timing side-channel to leak — the digests compared are digests of
public files. **Pin it with the NIST vectors** (the empty string and `"abc"`) plus a long multi-block
input, and it is `no_std`-clean, which the freestanding target needs anyway.
⚠️ **The same argument does NOT extend to the signature path.** Ed25519 has a secret key and real
side-channel and malleability concerns, and hand-rolling it would be a different decision entirely —
which is why the signature half stays **design-only** here.

### 2. The CLI wiring — `crates/wasmrt/src/main.rs`

- **`verify_gate(loaded, path, flags) -> bool`**, called from every path that **executes**.
- **Gated on a `will_execute` predicate.** `wasmrt <path>` (summarize) never executes and is never
  gated — do not gate inspection.
- 🔒 **The gate runs BEFORE validation.** Authorization first, so an unauthorized module is refused as
  *unauthorized* rather than having its contents parsed, type-checked and reported on. wasmrt's execute
  paths only started validating on 2026-08-10; the pin gate goes in front of that check, not behind it.
- ⚠️⚠️ **`wasmrt wast` MUST be gated, and it is the bypass that was actually shipped over there.** A
  `.wast` script **instantiates and invokes** the modules it contains — including
  `(module binary "…")` raw payloads — so `wazmrt payload.wast` ran unpinned, unsigned wasm **even under
  a root-owned `# mode: enforce`** that its own docs call absolute. **Any wasm can be wrapped in a
  `.wast`, and the attacker chooses the extension, so the bypass needed no privilege.** wasmrt has the
  identical shape: `wasmrt wast <file|dir>` at `main.rs:307`. **Hash the script bytes** — every module
  the script can run is *contained in* those bytes, so authorizing the script authorizes exactly what it
  can execute.
- **`.wat` hashes the ASSEMBLED bytes.** wasmrt gets this free: `read_module_bytes` already assembles
  before returning. The `pin` subcommand must hash the same thing, or a pinned `.wat` never matches.
- ⚠️ **The flag region.** `--no-verify` / `--yes` may only be recognised in the **leading run of wasmrt
  flags**, never inside the guest's argv. Scanning "everything before `--`" is not enough: the common
  WASI form has no `--` at all (`wasmrt wasi prog.wasm install --yes`), so the guest's own arguments
  were searched and a `--yes` meant for the guest **silently disabled verification**. wasmrt's
  `wasmrt wasi <file> [args]` has exactly this shape.
- **DB resolution — the root DB is authoritative.** Read the default DB **first** to learn the policy.
  Only when it does **not** enforce do `--pins` and `--verify` take effect: under a root `enforce`, both
  the pin set and the policy come from root, so redirecting via `--pins` or lowering via `--verify` is
  ignored.
- **`--verify off|warn|enforce`** may only **raise** strictness, and **a typo is an error, not a
  default** — `--verify enfroce` must fail, not silently mean `off`.
- **Armed** = a root key is embedded **or** a pin DB is present. Neither → run everything, so a default
  build behaves exactly as today and the "costs nothing when unarmed" promise is structural.
- **Deny prints the path, the sha256, the DB path and the reason.** An override that *would* have
  blocked prints a warning — **never silent**.
- **`wasmrt pin <file|dir> [--db <path>]`** — hash a module (or walk a tree, one entry per `.wasm`/
  `.wat`) and append `<hex>  <label>` lines. One unreadable file warns and is skipped rather than
  aborting a whole bundle.

### 3. 🔀 SWAPPABILITY — scoped by the owner 2026-08-19

> *"The idea is to be swappable with the wazmrt project." · "If our CLI options are the same they are
> swappable." · "If our security checks are the same they are also swappable."*

**So swappability is defined by two surfaces — the CLI options and the security checks — and both are
now in scope.** It is NOT defined by the C ABI: the `wasmrt_*` / `wazmrt_*` symbol prefixes are a
recorded deliberate decision, so the two stay distinct at link level by design. An operator swaps the
**binary and the pin DB**; an embedder still links one or the other.

#### 3a. The security checks — three conflicts, each with a decision

| # | conflict | consequence if ignored |
| --- | --- | --- |
| 1 | **DB path**: `/etc/wazmrt/pins` + `C:\ProgramData\wazmrt\pins` vs. the same under `wasmrt` | ⚠️⚠️ **Swapping the binary SILENTLY DISARMS verification** — no DB found → `armed = false` → every module runs. A security downgrade with no error: the worst class this project tracks. |
| 2 | **`.wat` digests must agree** — the digest is of the **assembled** bytes, and these are **two independent assemblers** | the same DB validates under one runtime and refuses under the other. ⚠️ Not hypothetical: wasmrt has **four recorded defects** where its emitter produced a different module than the text described, every one found by accident. |
| 3 | **policy semantics** — mode precedence, the fail-closed rules, arming, the flag region | a DB written for one is honoured *differently* by the other, which is worse than not being honoured at all |

**Decisions:**

1. **One shared DB path, named for the deployment rather than for either runtime** —
   `/etc/wasmtk/pins` and `C:\ProgramData\wasmtk\pins`, since `wasmtk` is what both are being included
   in. Each may still read its own legacy path as a fallback. 🔒 **Whichever is chosen, a swap must
   never be able to disarm silently**: if a runtime finds no DB where its sibling would have found one,
   that is worth saying out loud rather than treating as "unarmed".
2. **Make the `.wat` agreement a TEST, not an assumption** — assemble the shared corpus with both
   runtimes and **diff the SHA-256 of the outputs**. This is exactly the differential shape T12x now
   calls for, and the only check that can catch a divergence neither runtime can see alone: *a round
   trip proves agreement with yourself* (`best-practices.md` §3A.2). ⚠️ If the assemblers do not agree
   byte-for-byte, the honest fallback is that **only `.wasm` digests are portable** and a `.wat` must be
   pinned per-runtime — documented rather than discovered.
3. **§1 and §2 of this spec ARE that alignment** — same mode ladder, same absolute `enforce`, same
   fail-closed `# mode:`, same fail-loud DB parse, same arming rule, same flag-region rule.

#### 3b. The CLI options — the live diff, and one break that exists TODAY

> 🗄️ **SUPERSEDED — a 2026-08-19 snapshot, kept as the record of the planning.** Every wasmrt ❌ below
> has since shipped, and the `--dir` separator is settled by contract v27. **The live table is
> `interop.md` §2.2, verified by running both runtimes (v35, 2026-10-24).** One rule there changed
> what a guest can see: 🔒 **a WASI guest sees ONLY the `--env` variables, nothing from the host**
> (v35, §5 #13, owner 2026-10-24: an environment carries secrets).

**Run modes.** wazmrt dispatches on the file extension and on whether an export was named; wasmrt uses
explicit subcommands.

| capability | wazmrt | wasmrt | |
| --- | --- | --- | --- |
| summarize + validate | `wazmrt <module>` | `wasmrt <file>` | ✅ already agree |
| call an export | `wazmrt <module> <export> [args…]` | `wasmrt run <file> <fn> [args…]` | ❌ |
| run a WASI `_start` | `wazmrt <module> [flags] [-- argv]` | `wasmrt wasi [flags] <file> […]` | ❌ |
| run a `.wast` script | `wazmrt <script.wast>` | `wasmrt wast <file\|dir>… [-v]` | ❌ |
| assemble `.wat` → `.wasm` | — | `wasmrt wat <file.wat> [-o out]` | ❌ wasmrt-only |
| pin a module | `wazmrt pin <file\|dir> [--db <path>]` | — | ❌ missing |
| `-h`/`--help`, `-v`/`--version` | first arg only | first arg only | ✅ |

**Flags.**

| flag | wazmrt | wasmrt |
| --- | --- | --- |
| `--dir`, `--ro-dir` | `<host>[:<guest>]` | ⚠️ `<host>[::<guest>]` — **different separator** |
| `--allow-symlink` | ✅ | ✅ |
| `--env KEY=VALUE` | ✅ | ❌ |
| `--max-memory`, `--max-table-elems` | ✅ (1G / 128M defaults) | ❌ at the CLI; the ceilings exist in the C ABI |
| `--features <list>` | ✅ | ❌ at the CLI; the gating exists in the C ABI |
| `--` ends host flags | ✅ | ❌ (preopens must precede the path instead) |
| `--pins`, `--verify`, `--no-verify`, `--yes` | ✅ | ❌ (`pin` is a stub) |

⚠️⚠️ **The `--dir` separator is a swappability break that exists right now, and it has nothing to do
with `pin`.** `--dir .:/` is a working wazmrt invocation; on wasmrt `split_once("::")` finds nothing, so
host **and** guest both become the literal string `.:/` — **it does not error, it preopens the wrong
thing.** Each side has a real reason: a single `:` is ambiguous with a Windows drive letter
(`--dir C:\data:/data`), which is presumably why wasmrt chose `::`. **Recommendation: both accept
both** — prefer `::`, fall back to a single `:` when the spec contains no `::` and the split is not a
drive letter. Converging on one spelling would break existing invocations of the other.

⚠️⚠️ **And an alignment consequence to decide deliberately rather than inherit.** wazmrt's
`will_execute` predicate is *"an export was named, **or** the module exports `_start`"* — so
`wazmrt prog.wasm` **runs** a WASI command, while `wasmrt prog.wasm` today **summarizes** it. Aligning
means a bare path starts **executing** code where it previously only inspected it. That is a real change
of security posture on the most casual invocation there is, and it is exactly the path the pin gate
exists to guard. 🔒 **Land the gate before, or with, that change — never after.**

**Recommended shape for the alignment work: make it ADDITIVE.** wasmrt keeps `run` / `wasi` / `wat` /
`wast` — they are useful, and `wat` has no wazmrt equivalent — **and additionally accepts the positional
forms**, so a command written for either runtime drives both. Symmetric swappability needs wazmrt to
accept the subcommand forms too; that half is wazmrt's to do, and `wat` is the one capability it would
have to grow.

### 4. ✅ The load-once gate — a TYPE, not a comment

The property (one `fs::read`, owned bytes to execution, path never reopened) already holds via
`read_module_bytes` (`crates/wasmrt/src/main.rs:200`), but nothing defends it. **Make the loader return
a `Loaded { bytes, digest }` and have every executing entry point require that type.** Then re-reading
from a path *cannot* produce the value the execute path demands — the property is enforced by the type
system rather than by a grep or a comment, and the digest the gate needs is computed exactly once, at
the single point where the bytes enter the process.

⚠️ **This DIVERGES from wazmrt deliberately** (it passes `bytes: []const u8` and re-derives the digest
inside the gate), and the divergence is the point: Rust can make "these bytes came from one read" a
capability that the compiler checks, which is stronger than the discipline it replaces. **It is also the
half of the owner's original proposal that was genuinely missing** — *a goal with no gate is a
preference* (§4.1).

### 5. Out of scope for this pass, said out loud

- **The C ABI does not verify.** It receives bytes from the embedder and never opens a file, so
  authenticity is the embedder's to answer. **State that in `wasmrt.h`** — an undocumented gap gets
  found twice, once by us and again at T12 (§6.3, *say what you did not do*).
- **The signature path stays design-only** — trust anchor, wasm-custom-section format, revocation, and
  the deny-unsigned default. See the SHA-256 note above for why hand-rolling Ed25519 is a different
  decision from hand-rolling a hash.

## 🔎 The REVIEW behind it (2026-08-19) — ✅ RESOLVED by the spec above — "load once into memory" vs. the verification track (owner's question)

**The owner's proposal:** *"instead of verifying the wasm files, the wazmrt team loads the files into
memory and does not re-access them from the drive after load. This way the file can't be swapped out
mid-run. I think this is better than the verification track."*

**Reviewed rather than adopted, per §2.1/§2.2a — a stated benefit is a hypothesis about someone else's
code, so their code got read.** Three findings, and the first one changes the question.

### 1. ⚠️ The premise does not hold: wazmrt does BOTH, and load-once is what makes verification sound

wazmrt has **pin verification built and armed** — `src/pin.zig` (root-owned SHA-256 allow-list) plus
`src/sign.zig` (Ed25519), and per its own `security-model.md` it **denies unsigned modules by default
when armed** (a root key is embedded *or* a pin DB is present). It is not running load-once *instead of*
verifying. **Load-once is the discipline that makes its `verifyGate` honest**: the gate hashes the
in-memory bytes rather than re-reading the path, so `bytes-hashed == bytes-run` by construction.

**That is the same sentence this file has carried since the mechanism was decided** — see *"TOCTOU
closed by construction"* above, which pre-dates the question. So the owner's mechanism is not an
alternative to the recorded design; **it is the recorded design's load-bearing half.**

### 2. ✅ wasmrt ALREADY HAS the property — it just is not gated

Every CLI path that *executes* a module goes through one loader, `read_module_bytes`
(`crates/wasmrt/src/main.rs:200`), used by summarize (`:104`), `run` (`:424`) and `wasi` (`:532`). It
performs **exactly one `std::fs::read`** into a `Vec<u8>`; `.wat` is assembled from that buffer, and
assemble → decode → validate → instantiate → execute all run on owned memory. **The path is never
reopened, so the file cannot be swapped mid-run.** The C ABI never touches the filesystem at all — the
embedder hands over bytes. The only other `fs::read`s in the binary are `wasmrt wat` (an assembler that
does not execute) and the `.wast` runner (a test harness).

The loader's own doc comment already says why: *"What executes is the assembled bytes, not the file on
disk. That matters for anything that hashes what it runs."*

⚠️ **But it is a comment, not a check** — and *a goal with no gate is a preference* (§4.1). A future
fourth loader, or a streaming/`mmap` "optimization" at T11, could take the property away and nothing
would fail. **Action: make load-once an explicit tested invariant** — one test asserting the executing
paths take `&[u8]` rather than a path, and a `T12z`-style row in the entry-point table. Cheap, and it is
the half of the owner's proposal that is actually missing.

### 3. 🚦 They answer DIFFERENT questions, so this is a scope decision, not a substitution

| property | answered by | attack it stops |
| --- | --- | --- |
| **integrity over time** — the bytes cannot change under me between check and run | **load-once** (already held) | swap the file mid-run; win a race against the loader |
| **authenticity** — these are the bytes I authorized *in the first place* | **pin / signature** (not built) | replace the file **before** the load, with any other valid module |

⚠️ **Load-once alone gives zero protection against the strictly easier attack.** An adversary who can
write the file does not need to win a race — they overwrite it while nothing is running, and a
load-once runtime loads the replacement perfectly and executes it. **Dropping verification in favour of
load-once trades away defence against the easy attack in order to keep defence against the hard one.**

**The honest counter-argument, which is real:** for wasmrt's actual consumers (`rsxtk`, `wasmtk`,
`universalWasmLoader-*`), the module usually ships in the same package as the host binary — and an
attacker who can rewrite the `.wasm` can generally rewrite the host too, against which no runtime check
helps. That is exactly why wazmrt's pin is **inert unless armed**: it costs nothing when no root key and
no DB are present, and the *deployment* decides whether it applies.

### 📌 Recommendation

1. **Keep load-once and GATE it** — it is already true, it is free, and today nothing defends it.
2. **Do not delete the authenticity track; re-scope it.** `pin` stops being a `1.0.1` headline and
   becomes a small, default-`off` mechanism whose cost is zero when unarmed. It is ~a hash, a plaintext
   root-owned DB read, and the `decide()` matrix — all of it already specified above, so the expensive
   part (deciding the mechanism) is done.
3. **If the owner still wants it dropped, record the decision with its threat model** — *"wasmrt does
   not answer authenticity; the embedder must"* — in `wasmrt.h` and the README, not just here.
   ⚠️ An undocumented gap gets found twice: once by us, and again by T12. *Say what you did not do*
   (§6.3).

*(Owner decision pending. Nothing in the code changed for this entry — it is a review.)*

- **Pin verify is BUILT in wazmrt (Phase 5):** SHA-256, plaintext **content-addressed** DB,
  `# mode: off|warn|enforce`, and a pure `decide(policy, pinned, opt_out, tty)` matrix.
- **Decided mechanism (do NOT re-derive):** the pin DB is **root-owned, read-only to the user,
  plaintext** — integrity from **ownership, not secrecy**; pinning is done at install time with
  privilege (**verified install, NOT TOFU**); **no encryption** (category error — gives confidentiality,
  we need integrity); **no machine-binding** (the attacker *is* the user).
- **TOCTOU closed by construction:** hash the **in-memory bytes about to run**, never re-read by path
  (`bytes-hashed == bytes-run`). The opt-out (`--no-verify`/`--yes`) can only *raise* strictness and is
  **refused under `enforce`** (denied before it is consulted); DB parse **fails closed**. Default `off`.
- **Unifying invariant:** integrity is anchored by **ownership or a signature — never by secrecy**.
- **Still design-only (do not block the port):** the signature path — trust anchor (embed the root
  **public** key in the binary), signature format (a wasm custom section signed over every other byte),
  revocation, and the deny-unsigned default. Honest threat model: a root attacker defeats it in software
  → the real answer is *detection* (measured boot / TPM), out of scope for the runtime.
