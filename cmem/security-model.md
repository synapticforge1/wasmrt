# Security Model

🔒 **THIS FILE IS THE AUTHORITATIVE SOURCE (2026-08-11).** It previously deferred to
`../../wazmrt/cmem/security-model.md`; that pointer is **retired** along with the oracle
([design-decisions.md](design-decisions.md)) — wazmrt is a competitor now, and its security posture is
neither binding on wasmrt nor a safe thing to inherit unread. Port detail remains in
`docs/port/05-wasi-cli-pin.md` + `docs/port/06-build-docs-licensing.md`.

Two orthogonal properties, both required: **Authority** (what a running guest may touch — BUILT) and
**Authenticity** (is this the code I approved — **`pin` BUILT 2026-09-19, T9e, shipped in 1.0.0**: a
SHA-256 allow-list the CLI checks on every executing path before validation, fail-closed; signatures
are still design-only). *(Until 2026-09-19 this line said `pin` was a stub; sections below written
before then say so too, and are dated.)*

⚠️ **The record below already shows why inheriting was the wrong posture:** on 2026-08-10 wasmrt gated
symlink *creation* correctly and wazmrt had **no `path_symlink` right at all**, so its `--ro-dir` never
stripped it — a guest could plant links in a read-only preopen. Replicating "the authoritative source"
faithfully would have replicated the hole. **T12x** exists to diff the two runtimes' security tables
*as independent implementations*, which is the useful form of the comparison.

## 🔎 A dedicated adversarial review is scheduled: **T12 (`1.0.4`)** — owner, 2026-08-06

This file records the security **design** — what the model is and why. **T12 is where it gets attacked
on purpose**: a review-and-recommend phase over the *final* code (hence after the bug hunt and the
optimization pass), framed around three distinct adversaries — a hostile **guest**, a malformed
**input** to the tooling that may never execute, and a careless or hostile **embedder** misusing the C
ABI. Full scope in [roadmap.md](archive/roadmap-to-2.0.2.md) (T12a–f).

**Two findings are already on its list, both from the release profile rather than from any code:**

- **`panic = "abort"` makes every reachable panic a host-process kill.** For a library whose purpose is
  to contain untrusted code, a panic reachable from hostile input is a denial of service against the
  embedder — no unwind, no error, no recovery. The spec suite already caught one (`v128.const i64x2`
  hit an `unreachable!()` and aborted the run); the rule from that fix stands: **a library must reject
  a module, never abort the embedder.**
- No `overflow-checks` in release — arithmetic **wraps in release and panics in debug**. Both are
  bad on hostile input, in opposite directions: debug gives the abort above, release gives a *wrong
  value* that may then be used as an index, length or offset.

Neither is a vulnerability on its own; both are surfaces, and T12 decides what to do about them.

## ✅ wasmrt gates symlink CREATION correctly — the oracle did not (2026-08-10)

The owner's requirement: *"we do not want the wasm runner creating symlinks at runtime; links should
exist before the run; and a bad actor must not swap one mid-run."* Where each part stands:

| requirement | wasmrt |
| --- | --- |
| a guest cannot plant an **escaping** link | ✅ absolute and lexically-climbing targets refused **at creation** (`NOTCAPABLE`), independently of the follow-time check |
| symlink creation is a **write** right | ✅ `PATH_SYMLINK` is in `WRITE_MASK`, so **`--ro-dir` strips it** |
| pre-existing in-sandbox links still work | ✅ followed normally; the escape check is on the target, not on links as such |
| no mid-run swap by a third party | ⚠️ **the known TOCTOU residual** — see below |

⚠️ **The oracle had a hole here and wasmrt did not.** wazmrt had **no `path_symlink` right at all**
(bit 24 missing), so `--ro-dir` never stripped it and its handler demanded `path_open` — a guest could
plant links in a read-only preopen. Fixed 2026-08-10 in `wazmrt@4a6d745`. Recorded here because the
**asymmetry** is the reusable finding, not the bug: see roadmap **T12x**, diff the two runtimes'
security tables against each other.

✅ **DECIDED + SHIPPED (owner, 2026-08-10): symlink creation is DENIED BY DEFAULT.** *"Symlink creation
during runtime for the purpose of running processes shall be illegal; creating symlinks for a program
install situation should be legal."* So `--dir` now grants `READ_WRITE = ALL & !PATH_SYMLINK`, and
`--allow-symlink` opts back in for installer-shaped work. Same in the oracle (`wazmrt@1a88b84`).

The reasoning is worth keeping: **composing modules over shared linear memory is the STORE's job** —
imported memories are genuinely shared since T9a#4 — so nothing in a normal run needs the filesystem to
grow new links. Denying creation removes a guest-controlled primitive a **second process** could later
repoint, which is exactly what makes the accepted TOCTOU residual survivable.

⚠️ **Enforced at COMPILE TIME**, not by a test: every operand is a constant, so `const _: () =
assert!(…)` makes a violation fail the **build** — including for any crate depending on this one.
Mutation-verified: restoring `PATH_SYMLINK` to the default grant produces
*"evaluation panicked: assertion failed"*. ⚠️ The policy governs **creation**; following a pre-existing
link needs `PATH_OPEN`, which both grants keep, and that too is asserted — otherwise this change would
silently become "break every guest that reads through a link the operator placed".

## 🔒 Validation is a SECURITY boundary, and every entry point must cross it (2026-08-10)

**Validation is what establishes the invariants the interpreter assumes** — stack heights, operand
types, index ranges. §4.5.1 defines instantiation only for a *valid* module, so running an unvalidated
one is outside the spec, and every defensive check downstream is being asked to hold a line validation
was supposed to have held already.

⚠️ **`wasmrt run` did not validate.** It decoded and executed, so an ill-typed module ran and printed a
plausible answer with exit 0 — while `wasmrt wasi`, one function away, refused the same bytes. The
oracle was worse: **both** of wazmrt's execute paths *and* its C ABI `wasm_module_new` skipped it. Fixed
in both repos 2026-08-10.

**Current state — the property, checked at every entry point** (which is the method, not the
afterthought; see roadmap **T12z**):

| entry point | validates before executing? |
| --- | --- |
| `wasmrt <file>` (summarize — never executes) | ✅ reports a verdict |
| `wasmrt run` | ✅ *(was ❌)* |
| `wasmrt wasi` | ✅ |
| C ABI `wasmrt_module_new` | ✅ |
| Rust `Instance::new` / `Store::instantiate` | ⚠️ **documented precondition, by design** |

**Why the Rust API is the deliberate exception.** It mirrors wasmtime's compile/instantiate split and
keeps validation off the path for callers who already did it. That is safe *in practice* because every
**shipped** entry point validates, so reaching an unvalidated instantiation requires an embedder to skip
`validate::validate` on purpose. 🚦 **Whether a `Module` should be able to exist unvalidated at all is
recorded as an open question for T12** (`design-decisions.md`): making it unrepresentable means a
validated-`Module` type — a breaking API change, and a real cost, for a case no shipped surface reaches.

**Severity bound, stated honestly.** `forbid(unsafe_code)` means the worst case here is a wrong answer or
a panic, never memory corruption — a type-confusion probe (an `i32` into a `funcref` table, then
`call_indirect`) trapped cleanly. wazmrt has no such bound: Zig's ReleaseFast/ReleaseSmall remove the
safety checks, and its own source records this class reaching *a segfault from a 31-byte module*. **The
same missing check is a different severity in the two languages**, which is worth remembering whenever a
finding is carried across the port boundary.

## Two new authority controls at T8 / v0.9.0 (2026-08-06) — reachable from C

Both are **new capability wazmrt does not have**, and both are enforced where they cannot be bypassed:

- **Proposal gating** (`Features`, `wasmrt_config_set_feature`) — an embedder can refuse SIMD, GC,
  threads, memory64 and 10 more, shrinking the language a guest may use and with it the interpreter
  surface an attacker can reach. **Enforced at VALIDATION, never at execution**: a module naming a
  disabled proposal is simply *invalid*, so nothing half-checked ever reaches the interpreter. Types are
  gated as well as opcodes — a `(local v128)` or a `(struct …)` type is refused even with no instruction
  in sight, which is the hole a naive opcode-only gate would leave.
  - **The honesty rule that keeps this a real control:** a flag exists only for a proposal wasmrt
    actually implements. **There is no `tail_call` flag**, because those opcodes are unimplemented — a
    toggle for them would gate nothing while *reading to an operator as a security control*, which is
    strictly worse than its absence.
  - Incoherent sets (`gc` without `function_references`) are **rejected, not repaired**: silently
    enabling a dependency would accept modules the embedder meant to refuse.
- **Resource ceilings** (`ResourceLimits`) — memory bytes, table elements, call depth, GC objects and
  boxed exceptions are now per-store rather than compile-time, so a host can bound a guest's appetite
  instead of relying on constants it cannot see. Each is a ceiling, not a reservation. The iteration
  budget (loop back-edges + tail-call hops per top-level call) traps, never pauses; each store has its own.
  Call depth restarts at each top-level call; a C callback cannot re-enter its own store (refused,
  2026-11-25 — it was undefined behaviour), so native stack is bounded per store: `architecture.md`.

**Unchanged:** the FS sandbox is still the entire authority story for files, and every property in the
section below holds exactly as before — the C ABI adds no path a guest can take.

## Sandbox / Authority — reproduce EXACTLY, keep the guarantee

- Guest can execute nothing (no `proc_exec`/spawn in WASI p1; `proc_exit` self-terminates); cannot
  reach a non-WASI import (unknown → `NOTSUP` stub, any other module import → trap); the preopen is the
  **entire** FS authority (no `--dir` ⇒ zero files reachable).
- **Rights only ever narrow** — `path_open` intersects the new fd's rights with the parent dir fd's
  inheriting rights, so a `--ro-dir` read-only preopen propagates read-only to the whole subtree by
  construction (no per-syscall write check).
- **The resolver is RESOLVE_BENEATH in userspace** (`walkFull`): a stack of open dir handles (bottom =
  the preopen, never popped), resolving **one component at a time, no-follow, through the held handle**
  (TOCTOU-safe against intermediate-symlink redirection). Symlinks are *followed* but expanded through
  the same loop; `..` can never rise above the preopen (there is no handle above it → up-escape
  impossible); absolute symlink targets **re-base to the preopen root**; a `symlink_max` budget → ELOOP.
  **Security is a property of the construction, not of checking target strings.** Reproduce this — do
  NOT hand a full guest path to a directory API.
- **Mandated adversarial test:** the guest authors the symlink topology; a canary file *outside* the
  preopen is the oracle and must never be read (`examples/wasi_symlink_traversal.zig`).

### ⚠️ Rust divergence — CORRECTED 2026-08-05, and it is a real one

**The earlier claim in this file was wrong and is retracted.** It read: *"Rust's std / `cap-std` /
`openat2(RESOLVE_BENEATH)` can do the atomic no-follow open and close that residual for free."* Grouping
`std` with the other two was the error, and it was load-bearing — the whole T7c-2 plan rested on it.

**Rust's `std` has no dir-relative open.** No `openat`, no `O_PATH` handle to re-open through, on any
platform (verified against the 1.99-nightly sysroot, 2026-08-05). `std` can do a no-follow *stat*
(`symlink_metadata`), which is a different primitive: it tells you what a name pointed at a moment ago,
it does not pin the inode. Inode pinning is the whole of what makes the oracle's walk TOCTOU-safe.

That leaves three project constraints that **cannot all hold at once**:

1. **zero dependency** (owner, 2026-08-04 — rejected `cap-std`/`openat2`);
2. **no `unsafe`** (owner's safety directive — a `libc::openat` decl is `unsafe` by construction);
3. **resolve through held handles, never a full path string**.

**Shipped, pending the owner's call:** 1 and 2 held, 3 relaxed to a **component-accumulated path**
(`wasi/fs.rs::walk`). What this costs is precisely bounded, and is much less than dropping 3 sounds:

- **Unaffected — every escape property still holds by construction**, because they are *lexical* and
  hold on an accumulated path exactly as on a handle stack: `..` cannot pop below the bottom; an
  absolute symlink target re-bases to the preopen root; a symlink's target is expanded through the same
  loop; device/NT-namespace components and embedded NULs are refused (now **up front**, before touching
  the filesystem, so a refusal never depends on filesystem state or leaks whether a prefix exists);
  `SYMLINK_MAX` bounds cycles.
- **Lost — inode pinning only.** A *concurrent writer inside the preopen* could swap a component
  between the walk and the syscall. The guest cannot be that writer (preview 1 here is single-threaded),
  so this needs a second process holding write access to the sandbox — which is the embedder's choice of
  what to preopen.
- **Compensating control:** `verify_beneath` canonicalizes the resolved directory after the walk and
  re-checks it against the canonical preopen root, so a swap that *did* land still cannot yield a path
  outside the sandbox. **It closes the escape, not the race.**

### ✅ DECIDED 2026-08-05 (owner): **accept the residual and document it.** Do not re-litigate.

`cap-std` was rejected again (first runtime dependency, a large tree, against the smallest-binary goal),
and an `unsafe` FFI shim was rejected (it would punch the first hole in `#![forbid(unsafe_code)]`, which
was made mechanical the same day). **wasmrt keeps zero dependencies and zero `unsafe` in the engine.**

**The deployment assumption this creates, stated plainly so an embedder can check it:** wasmrt's sandbox
guarantees a guest cannot *name* anything outside its preopen. It does **not** guarantee that a path
resolved inside the preopen still refers to the same inode by the time the syscall runs. Closing that
gap requires the embedder to ensure **no untrusted second process holds write access to a preopened
directory while a guest is running**. The guest itself cannot create the race (preview 1 is
single-threaded here), so this only matters for multi-tenant or shared-scratch layouts.

Context for the choice: wazmrt itself still carries a narrower **final-component** residual on
`path_open` (`#17/#18/#23`, a Windows Zig-std workaround), so the port is not far behind the oracle — it
trades a narrow residual for a wider one, in exchange for holding both the zero-dep and no-`unsafe`
lines. Revisit only if a consumer's threat model actually includes a hostile co-tenant.

**Mandated adversarial test — DONE and it bites:** `wasi/fs.rs` keeps a canary outside the preopen and
asserts no walk can ever produce a path that reads it, over absolute / relative / chained / symlinked-
directory escapes. It asserts the **outcome** (never reads `SECRET`) rather than a particular errno, so
it survives a change of mechanism. Verified by mutation: deleting the `..` guard makes it fail.

## Authenticity — pin verification (reproduce; signatures still design-only)

> 🔁 *Until 2026-09-19 this was a stub* (slated for T7, then T8, then T9); the mechanism notes below
> were written to describe the oracle's design to reproduce. **It is BUILT** (next section). The
> superseded warning: `git show cfeee31:cmem/security-model.md`.

## ✅ BUILT 2026-09-19 (T9e) — the gate, the DB, `pin`, and the CLI convergence it gated

**Everything the spec below asks for is implemented and pinned by tests.** What shipped, and the two
things that were decided or measured while building it:

- : `wasmrt-core/src/pin.rs` — —: SHA-256 (ours, no dependencies — pinned by the NIST vectors **and
  cross-checked against `sha256sum` on a real file**), `Digest`/hex, the `Off<Warn<Enforce` ladder, `Db::parse`, and
  the pure `decide()` matrix. `no_std`-clean.
- **: load-once** — —: `Loaded { path, bytes, digest }` — the ONLY thing an executing path accepts, so the property is checked by the compiler rather than by discipline.
- **: the gate** — —: before validation, on every executing path **including `wast`**; never on summarize.
  Fail-closed on a mistyped `# mode:`, a malformed DB and a mistyped `--verify`; an override that would have blocked
  warns.
- **: 🔒 the DB path** — —: **DECIDED by the owner 2026-09-19: the shared `/etc/wasmtk/pins` +
  `C:\ProgramData\wasmtk\pins`**, each runtime's own path as a fallback, and a LOUD warning when only the sibling's
  path has a DB — so a swap cannot disarm in silence.
- : `wasmrt pin` — —: prints the lines, appends only with `--db`, hashes the ASSEMBLED bytes for `.wat` — same spelling and behaviour as wazmrt's.
- **: the C ABI** — —: still does not verify, and `wasmrt.h` now SAYS so (§5's "say what you did not do").

⚠️⚠️ **THE `.wat` DIGEST AGREEMENT WAS MADE A TEST, AND IT FAILED — 529 of 535 files differ.**
§3a decision 2 called for exactly this check. The cause is diagnosed, not guessed: wazmrt's digest is
the SHA-256 of wasmrt's own output **with custom sections stripped**, so the module bodies agree and
**wasmrt emits a `name` section where wazmrt does not**. The honest fallback §3a already named is now
the recorded position: **only `.wasm` pins are portable; a `.wat` must be pinned per runtime** until
wazmrt emits the section (handed over as Z4 in `interop.md` §2.5h). It fails CLOSED — a denial, not a
silent run — so it is an operational break rather than a hole. 🎓 *An agreement between two
implementations is a hypothesis until one command compares them.*

*The spec as it was written, which is what got built:*

