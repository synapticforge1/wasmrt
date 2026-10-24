# Overview

`wasmrt` is an **idiomatic-Rust WebAssembly runtime** — **blazingly fast** on cold-start + boundary,
**smallest possible binary**, and **itself compilable to `wasm32`** so it can be embedded inside another
wasm host — written to **replace wasmtime** as the native engine beneath the owner's
`universalWasmLoader-*` projects (see [loaders.md](loaders.md)). It began as a port of the Zig runtime
**`wazmrt`** (sibling repo `../wazmrt`).

## 🔒 What wasmrt is for now (owner, 2026-08-11) — the oracle is retired

**wasmrt no longer refers back to the `wazmrt` repo.** The two runtimes are **independent entrants**
competing for inclusion in **wasmtk** and the **universalWasmLoader-\*** runtimes, decided on **the
smallest and fastest binary**. **`rsxtk` takes wasmrt by default** through the native Rust interface.
wazmrt is running its own size program for the same contest, so its head is a *competitor's* design.

**Correctness anchors externally**: the official spec testsuite (64,603 assertions over 288 files,
all passing, measured 2026-10-24),
**wasmtime's observable behaviour** (already matched byte-for-byte on invalid-module diagnostics), and
the wasmtk WASI corpus. Those were always the harder tests — the oracle was the convenient one, and tail
calls, the one feature it never covered, were always planned this way.

⚠️ **This re-weights everything left.** *Canonical* was the gate while the oracle defined success; **fast
and small are the gate now**, which promotes three T11 items from footnote to critical path — the
unattributed ~5% steady regression, the fact that **the rlib `rsxtk` links has never been measured**, and
the absence of a same-machine comparison against any competing runtime. See [vision.md](vision.md).

*Historical: the oracle was frozen at `wazmrt@dadc727` (2026-07-27) and re-pinned six times under owner
authorization; `scripts/check-wazmrt.sh` watched it for drift and is now deleted, its baseline kept as
`scripts/wazmrt-provenance.txt`. Provenance and attribution are unaffected ([licensing.md](licensing.md)).
The wazmrt deep-read is still in `docs/port/00-synthesis.md` (+ 6 subsystem maps) as engineering
reference.*

## What has shipped, and where the state is

**The current state is in [open-work.md](open-work.md)** (measured, dated), and nowhere else.

Released stage by stage to crates.io ([releasing.md](releasing.md); the public notes are
`CHANGELOG.md`). Each line is the release that landed it; tag `v0.9.0` is commit `bc1f7ca`:

- **v0.1.0 T0** — the three-crate workspace, building on all four surfaces (CLI, staticlib, cdylib,
  freestanding `wasm32`).
- **v0.2.0 T1** — `types` and `reader` (a zero-copy cursor, spec-correct LEB128).
- **v0.3.0 T2** — `opcode`: the shared `Op`/`Imm`/`Instr` table and `decode_body`.
- **v0.4.0 T3** — `module`: full binary decode; `wasmrt <file.wasm>` summarizes.
- **v0.5.0 T4 (core)** — `validate`, the §3 type-checker for the core language.
- **v0.6.0–v0.6.9 T5** — `interp`, one slice per release: integer, float, linear memory, tables and
  reference types, WasmGC, SIMD, multi-memory, threads/atomics, memory64, exception handling.
- **v0.7.0 T6 + T4's remainder** — the text toolchain (`.wat` assembly, `.wast` scripts) and the
  validator for every construct the interpreter runs.
- **v0.8.0 T7** — host imports, module linking, WASI preview 1 with the sandboxed filesystem;
  `#![forbid(unsafe_code)]` in core and the CLI.
- **v0.9.0 T8** — the `wasmrt.h` C ABI: checked value handles, proposal gating, resource ceilings,
  the whole surface under Miri.

**Unreleased since v0.9.0:** T9 hardening (the correctness punch-list, tail calls, `pin` and the
execution bound), T13 the conformance clear-out (the corpus at zero failed / skipped / unrun), and
the 2026-10 workspace letters. Per-pass records: [roadmap.md](roadmap.md); defects:
[known-issues.md](known-issues.md).

*Until 2026-10-24 this section was a status narrative dated 2026-08-11, several of whose claims had
since been overtaken (the GC array bulk ops, table64, `pin`, an owner decision that was made):
`git show cfeee31:cmem/overview.md`.*


## Repo / crate layout (planned 2026-07-17; as built)

- **`wasmrt-core`** — the runtime library, `#![no_std]`-friendly and `wasm32`-freestanding-clean (no
  libc). Its modules were laid out to mirror wazmrt's `src/` while wazmrt was the oracle (retired
  2026-08-11; nothing diffs against it now): `types` (ValType `u32` newtype), `reader`,
  `module` (decode), `opcode` (the shared IR table), `validate`, `interp`, `sexpr`, `wat`, `wast`,
  `wasi`, `pin`, `lib`.
- **`wasmrt-capi`** — `crate-type = ["staticlib", "cdylib"]`; the public **`wasmrt.h`** C ABI
  (`#[no_mangle] extern "C"`) over core. Ships `wasmrt.h`.
- **`wasmrt`** — the CLI binary.
- **Dual-target contract** (from wazmrt): native CLI + static lib + cdylib + a freestanding-`wasm32`
  build of the runtime, plus the gates (a c-smoke equivalent under Miri, a wasi-gate compiling real
  guests, a cold-vs-steady bench). See [architecture.md](architecture.md).

## Mental model

- **Pipeline:** decode → validate → instantiate → execute (a **switch interpreter over a pre-decoded
  IR** — Option A, deliberately not a JIT), with a WAT/WAST text toolchain and WASI preview 1.
- **Boundary-faithful, idiomatic internals.** The observable behavior + the `wasmrt.h` contract are
  fixed; the Rust internals use ownership/enums/`Result`, not a Zig transliteration.
- **Own `wasmrt.h`.** The public C API is wasmrt's own lean surface (not the wasm-c-api, not wasmtime's
  symbols); the loaders do the Component-Model Canonical ABI marshalling on top. See [loaders.md](loaders.md).
