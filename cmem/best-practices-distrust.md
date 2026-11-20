# Best practices 2 — what to distrust

wasmrt's own lessons, section 2. Last verified: 2026-11-20. Split out on 2026-11-20 (memory guide, letter H38); the
sections below are moved verbatim.

## 2. What to distrust

### 2.1 A stated constraint is worth probing, not agreeing with

The owner stated a sharing constraint that implied three properties. Two held. The third had shipped
**broken that morning** — an `InstanceId` carried no record of its issuing store, so an id from store X
resolved against store Y and a guest silently shared the wrong memory. Agreeing would have left it in.

**Apply:** turn each clause of a stated constraint into a property and test it. Agreement is not
verification.

### 2.2 A pre-implementation design document is a hypothesis — diff it against the code

Four shapes in `docs/port/wasmrt.h.draft` never matched the real core: per-proposal config toggles (core
had no gating, so they would have been silent no-ops), a name-keyed linker (core resolved
*positionally*), a store-attached WASI config (core builds WASI per module), and a promise of backtrace
text (there were none until T9a#7, two stages later).

### 2.2a A stated BENEFIT is a hypothesis about someone ELSE's code — go read theirs

wazmrt chose to implement the **standard wasm-c-api** partly on this recorded payoff: *"wasmtime also
implements wasm-c-api, so ports already on its C API are close to drop-in."* The intended consumer was
always the `universalWasmLoader-*` projects — they are the layer meant to standardise imports across
languages, and the runtime beneath them only ever had to serve them.

**Nobody read the loader's source until wasmrt's T8 survey.** wasmtime ships **two** C surfaces —
the standard `wasm.h` and its own richer `wasmtime.h` — and the loader uses the **`wasmtime_*`**
store/context/linker model, not wasm-c-api at all. The payoff never existed.

And the mismatch was structural, not cosmetic: **wasm-c-api's host callback gets no handle to the
caller's memory**, which is the one thing essentially every loader host import needs. The chosen ABI
could not do the consumer's core job.

**Cost:** `wasm_c_api.zig` — 319 declared functions, the largest file in that project and the only one
that hands raw ownership across a C boundary. Three whole audit findings (#20, #21, #22 — 180 missing
symbols, then a double free, use-after-free, uninitialised refcount and leak) lived in it. wasmrt
replaced the entire surface with ~74 functions and value handles.

**Apply:** when a design rests on "consumer X already does Y", open X's source and grep for Y before
the decision, not after the implementation. A benefit claimed on the consumer's behalf is exactly as
much a hypothesis as a cost figure (§1.1) or a scope note (§1.1a) — and it is the one that quietly
selects an architecture. ⚠️ The tell here was available from day one: the loader header is in a sibling
repo, and reading it takes minutes.

### 2.5 RUNNING the artifact answers BEHAVIOUR, not PROVENANCE

This project's strongest rule is *verify by running, never by reading* (§1, §3A.2). It has a limit,
and 2026-09-19 found it: asked whether Bun is written in Rust, the assistant said Zig (true at its
training cutoff, false since 2026-05-14), and then defended it with the wrong kind of evidence —
`process.versions.zig` from the running binary, and a count of `zig` vs `rustc` strings inside the
executable. Both are real measurements. **Neither measures what was asked**: they describe the
toolchain that BUILT and LINKED the binary, not the language it is written in. The owner's one-line
reply — *"they may still be using zig as a cross platform compiler toolchain for the linker"* — was
the correct reading of the very data being cited.

The project's own history has the same shape from the other direction: `wazmrt <module> <export>`
does not validate, so "the oracle accepts it" measured a different question than the one asked
(§2.3a).

**Apply:** classify the question first. *Behaviour* ("what does it do with these bytes?") is settled
by running it. **Provenance** — what is it written in, who owns it, when did it change, what does the
licence say — is settled by the project's own published record, and a binary's self-report is at best
circumstantial. When a claim will leave this repo, cite the release note, not the artifact.

### 2.3 A decision resting on a false premise must be re-derived, not defended

`security-model.md` recorded that Rust's `std` could do an atomic no-follow open. **It cannot** — there
is no dir-relative open on any platform. The decision built on it had to be re-taken, not patched.

### 2.3a "The oracle accepts it" is only evidence if you know WHICH PATH you invoked

T9a#9 sat on the punch list for two releases as *"the oracle assembles **and runs** them, so this is
our type-checker being wrong, not the input."* Every word of that observation was true. The conclusion
was not.

`wazmrt <module> <export>` **does not validate** — it decodes and runs. `wazmrt <module>` (no export)
summarizes *and validates*. Put the same file through the second path and the oracle reports
`validation: FAILED — TypeMismatch`, agreeing with wasmrt exactly. The module really was ill-typed —
`if (result f64)` with both arms pushing `i32`, which `if.wast`'s `type-then-value-num-vs-num` makes
an `assert_invalid`.

So "it runs" was never evidence of validity; it was evidence that **one particular entry point skips
the check you were asking about**. This is §1.5a again with the oracle in place of our own gate.

**Apply:** when citing a reference implementation, name the subcommand. Before concluding "the oracle
disagrees with us", find its *validating* path and re-run there — and check the reverse direction too:
a runtime that executes an invalid module is over-permissive, not authoritative. A three-line
reduction put through both tools settles it in a minute; this one had gone undiagnosed since T7.

### 2.4 Assume the numeric order of an enum is not the wire order

Section ids: `DataCount` is **12** but must precede `Code` (**10**); `Tag` is **13** but belongs between
`Memory` and `Global`. A `>` on raw ids accepts both in the wrong place and rejects them in the right
one. That is why `SectionId::order()` is a table.

---

