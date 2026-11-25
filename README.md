# wasmrt

A fast, small, idiomatic-**Rust** WebAssembly runtime.

wasmrt began as a Rust port of the Zig runtime [`wazmrt`](https://github.com/synapticforge1/wazmrt).
Since 2026-08-11 the two are **independent runtimes** that stay command-line compatible, so either can
replace the other. wasmrt's correctness is anchored on the official WebAssembly spec testsuite, on
wasmtime's observable behaviour, and on a corpus of real WASI programs.

> **Status: `3.0.0`.** `1.0.0` was the conformance clear-out; `2.0.0` corrects one validation rule (an
> `exact` reference type needs reference-types) and holds wasmrt to binaryang's shared feature
> rules; `3.0.0` refuses what wasmtime refuses (its implementation limits), in its words and at its
> offsets, decodes and validates in one pass as wasmtime does, and is faster and smaller in memory.
> wasmrt can **assemble**, **decode**, **type-check**, and **run**
> WebAssembly — `wasmrt run fac.wasm fac 10` → `3628800`, `wasmrt wat mod.wat -o mod.wasm`. Execution
> covers integer + floating-point compute, linear memory (incl. **multi-memory** and **memory64**),
> tables / `call_indirect` / reference types, **WasmGC**, **SIMD** (the full `v128` set, incl. relaxed),
> **atomics**, and **exception handling** — and the type-checker covers all of it, so
> `wasmrt <file>` gives a real verdict on any module wasmrt can run. Every command that takes a
> module accepts either form — `wasmrt run fac.wat fac 10` assembles the text first, then runs it.
>
> It reads and writes the **text format** and runs the **official spec testsuite**: on the current
> source, `wasmrt wast <dir>` passes **all 64,603 assertions in the suite's 288 files, with none
> failed, skipped or unrun** (measured 2026-10-24). That is the `1.0.0` gate; `0.9.0` passed 98.8%
> of the assertions it ran, against the smaller suite of the time.
>
> It is **embeddable from C** via [`wasmrt.h`](crates/wasmrt-capi/include/wasmrt.h) — compile,
> link host functions, instantiate, call exports, and read or write guest memory. You can restrict
> which WebAssembly proposals a guest may use and cap the memory, call depth and GC objects it may
> consume. Handles are checked, so one from the wrong store is refused rather than followed.
>
> It also runs **real WASI programs** — `wasmrt wasi prog.wasm`, or just `wasmrt prog.wasm` — with
> stdio, args, environ (only what `--env` passes), clocks, `random_get` and a **sandboxed filesystem**. A guest reaches only what
> you preopen: `--dir <host>[:<guest>]`, or `--ro-dir` for read-only (which propagates to the whole
> subtree). With no `--dir`, every path call returns `BADF` — there is no implicit working directory.
> `--max-memory`, `--max-table-elems` and `--max-iterations` cap what it may consume, and
> `--features <list>` restricts which proposals it may use.
>
> **A runaway guest is stopped rather than hanging the host**: one loop back-edge or one tail-call hop
> is one iteration, and a top-level call gets `1<<30` of them by default (`--max-iterations`, `0` to
> disable). It bounds non-termination — it does not claim to detect an infinite loop.
>
> **Modules can be pinned.** `wasmrt pin <file>` prints a SHA-256 line for a root-owned allow-list; with
> one installed, wasmrt verifies the bytes it is about to run — before validating them, on every path
> that executes, `.wast` scripts included — and refuses anything unpinned. `--verify off|warn|enforce`
> only ever raises strictness, and under a root-owned `enforce` no command-line flag can lower it. With
> no allow-list installed nothing is verified and nothing costs anything.
>
> The engine is **`#![forbid(unsafe_code)]`**: `wasmrt-core` and the CLI contain no `unsafe` at all, and
> the compiler enforces it. The C ABI cannot be — a foreign boundary is unsafe by definition — so every
> raw pointer it touches goes through one small audited module, and the whole surface runs under
> **Miri**. See **[ROADMAP.md](ROADMAP.md)** for the live use-case matrix (what actually works today)
> and **[CHANGELOG.md](CHANGELOG.md)** for release notes.

## Goals

- **Canonical** — run the same WebAssembly `wasmtime` can (full browser-standard feature set + memory64;
  WASI preview 1), including tail calls. The official spec testsuite runs **64,598 assertions over 288
  files with zero failures and zero skips**.
- **Fast** — win cold-start and native-FFI workloads (an interpreter over a pre-decoded IR, not a JIT).
- **Small** — minimize every artifact; the runtime even compiles to `wasm32` to embed inside another
  wasm host.

**Measured, not claimed** (`cargo run --release -p wasmrt-core --example bench`; x86_64, release):

| | |
| --- | --- |
| Cold start (decode + validate + instantiate + call, 48 KB module) | **4.5 ms** |
| Steady-state dispatch (tight `loop`/`br_if`) | **~237 Mops/s** |
| CLI binary · C-ABI `cdylib` | **621 KiB** · **494 KiB** |
| Runtime compiled to `wasm32`, engine only | **158 KiB** (**138 KiB** after `wasm-opt -Oz`) |

Sustained hot loops go to a JIT — that trade is deliberate. A comparison against other small runtimes
(wasm3, WAMR) has **not** been run yet, so no claim is made about it.

## Crates

| Crate | What it is | Install |
| --- | --- | --- |
| `wasmrt` | the command-line runtime | `cargo install wasmrt` |
| `wasmrt-core` | the runtime as a Rust library (`no_std`-friendly) | `wasmrt-core = "2.0"` |
| `wasmrt-capi` | the C ABI ([`wasmrt.h`](crates/wasmrt-capi/include/wasmrt.h)) as a `cdylib` / `staticlib` | build from source |

## Embedding from C

`cargo build -p wasmrt-capi --release` produces a `staticlib` and a `cdylib`; the header is
[`crates/wasmrt-capi/include/wasmrt.h`](crates/wasmrt-capi/include/wasmrt.h).

```c
wasmrt_engine_t *engine = wasmrt_engine_new();
wasmrt_store_t  *store  = wasmrt_store_new(engine);
wasmrt_linker_t *linker = wasmrt_linker_new(engine);

wasmrt_module_t *module = NULL;
wasmrt_error_t  *err = wasmrt_module_new(engine, bytes, len, &module);   /* NULL == success */

wasmrt_instance_t inst;  wasmrt_trap_t *trap = NULL;
wasmrt_linker_instantiate(linker, store, module, &inst, &trap);

wasmrt_func_t add;
wasmrt_instance_get_func(store, inst, "add", &add);
wasmrt_val_t args[2] = {{WASMRT_I32, {.i32 = 40}}, {WASMRT_I32, {.i32 = 2}}};
wasmrt_val_t result;
wasmrt_func_call(store, add, args, 2, &result, 1, &trap);                /* result.of.i32 == 42 */
```

Three things worth knowing before you write against it:

- **A trap is not an error.** A host-side error (bad handle, wrong arity) comes back as a
  `wasmrt_error_t *`; a *guest* trap arrives through the `trap_out` parameter. A call can return `NULL`
  and still have trapped — check both.
- **Handles are checked, not trusted.** `wasmrt_func_t` and friends are small copyable values you never
  free. Each knows which store issued it, so one used with the wrong store is refused rather than
  quietly naming a different function.
- **`wasmrt_memory_data()` is invalidated** by anything that can grow memory or re-enter the guest.
  Re-fetch it after each call, or use the bounds-checked `wasmrt_memory_read`/`_write` instead.

## Building from source

```sh
cargo build --workspace          # native: CLI + static lib + cdylib
cargo test  --workspace
cargo build -p wasmrt-core --no-default-features --target wasm32-unknown-unknown  # freestanding

scripts/c-gate.ts                # compile + run the C-ABI gates against the shipped header
scripts/miri-gate.ts             # the C ABI under Miri (needs: rustup component add miri)
```

On Windows, use the `x86_64-pc-windows-gnu` toolchain host (MinGW-w64 + UCRT, no MSVC); the
release binaries need only DLLs Windows provides. `rust-toolchain.toml` pins the nightly CI uses.

## Versioning

wasmrt follows **[SemVer 2.0.0](https://semver.org/spec/v2.0.0.html)**, and the bump is a gate result,
not a judgement: `bun scripts/bump.ts patch|minor|major` diffs the public surface (the Rust API of
`wasmrt-core` and `wasmrt-capi`, `wasmrt.h`, and the CLI's flags and usage shapes) and the behaviour
(which modules are accepted) against the last release, and refuses a bump below what the diff
requires. Accepting fewer modules is a breaking change even when the new answer is the correct one.
Before `1.0.0` a breaking change takes a minor bump, and is listed below either way. `1.0.0` is the
conformance clear-out: the official spec testsuite with zero failures, zero skips and nothing unrun.

### ⚠️ Breaking Changes

| Version | What changed | How to migrate |
| --- | --- | --- |
| 3.0.0 | **Rust API (`wasmrt-core`):** `opcode::Instr` has `imm_at` and `imm_len` (where its immediates start, and their length), `opcode::CallIndirect` has `table_at`, `opcode::MemArg` has `memory_flag`; `validate::ValidateError` has `ZeroByteExpected` and `MemopReservedFlags`; `types::DecodeError` speaks wasmtime's words: it gains a variant per wasmtime message wasmrt's errors used to share (`IllegalOpcode`, `UnknownSubopcode`, `InvalidLeadingByte`, `BadRefType`, `BadHeapType`, `OutsideBlock`, `UnknownExported`, `TrailingBytes`, `SectionContent`, `FunctionWithoutCode`, `CodeWithoutFunction`, `DataCountWithoutData`, `ExprFramesRemain`, `SimdIndexOutOfBounds`, `InvalidCastFlags`, `MultipleSupertypes`, `SupertypeNotBefore`, `NotAFuncType`, `UnknownType`, and for the limits `LimitExceeded`, `SizeOutOfBounds`, `DataCountTooLarge`, `TooManyElements`, `TypeSizeTooLarge`); `BadType`, `UnsupportedOpcode` and `UnknownExternKind` are gone, and `MalformedFlag`, `LebOverflow`, `InvalidSectionId` and `UnsupportedVersion` now carry what they refused. New: `module::last_decode_offset()` | give the new fields in a struct literal; match the new variants, and the data four of them carry |
| 3.0.0 | **Implementation limits (wasmtime's values, the measured-needed ones):** a module past one is refused at decode — 1,000,000 functions, imports, exports, globals, tags or types; 100,000 tables, element or data segments; 50,000 locals per function (params included; the validator already refused more, now the decoder does, at the entry that crosses); 1,000 params or results; 7,654,321-byte bodies; 10,000,000 elements per segment; an effective type size of imports and exports below 1,000,000; and the rest listed in the CHANGELOG. A count equal to its limit is accepted | keep a module within the limits, as wasmtime requires |
| 3.0.0 | **Validation, with a proposal disabled (as wasm-tools):** without multi-memory, `memory.size` / `memory.grow` need the single byte `0x00` as their memory index (an overlong `80 00` was accepted) and a memarg may not carry the memory-index flag (it was accepted); without reference-types, an overlong `return_call_indirect` table index is now ACCEPTED (binaryang D2 and wasm-tools gate only `call_indirect`'s). With every proposal on, the default, nothing changes | enable the proposal, or encode the index as `0x00` |
| 3.0.0 | **Minimum Rust version 1.100** (was 1.85), the current stable release when 3.0.0 was cut (both targets build with it; the tests run on the pinned nightly) | build with Rust 1.100 or later |
| 3.0.0 | **CLI, `pin` and `wat -o`:** each writes a whole new file beside the target (`.wasmrt-tmp-…`) and renames it over (`wat -o` still writes a device such as `/dev/null` in place; `pin --db` refuses one), so the target's directory must be writable, another hard link keeps the old contents, a read-only target and a dangling symlink are refused, and a killed `wat -o` can leave its temporary file; `pin --db` holds an OS file lock on `<db>.lock` (kept beside the DB; a filesystem without file locks is refused) and refuses a DB it cannot read, one that is not a regular file, and one in a directory that does not exist (it was created); `pin <dir>` skips names with control characters or line separators and does not follow symlinked directories | create the DB's directory first; keep the DB in a writable directory; delete a stray `.wasmrt-tmp-…` left by a killed run |
| 3.0.0 | **Diagnostics:** a refusal of one immediate byte reports that byte's offset and wasmtime's words (`invalid module at offset 604 (function 6): zero byte expected`, where it said `offset 598 … uses the disabled proposal`), and a decode failure now carries its offset (`decode failed at offset 10: …`), on the CLI and in the C ABI's error strings; a module with more than one fault is refused for the one wasmtime names first (a body is decoded and validated in one pass, so an ill-typed instruction before a malformed one is reported as the type error); a validation refusal inside a function is worded as wasmtime words it (`type mismatch: expected i32 but nothing on stack`, where it said `StackUnderflow`) | a tool that parses wasmrt's messages: read the new forms |
| 2.0.0 | **Validation:** an `exact` reference type, `(ref null (exact $t))`, now needs reference-types (and function-references or gc) as well as custom-descriptors, as D2's type rules and wasm-tools say; 1.0.0 accepted it with reference-types off. With every proposal on, the default, nothing changes | enable reference-types: `--features …,reference-types` |
| 1.0.0 | **CLI:** a `--dir` / `--ro-dir` host path must say it is relative (`./data`, `../data`, `.`) or be absolute; a bare `data` or `C:` is an error | write `./data` |
| 1.0.0 | **`--features`** takes binaryang D2's names and presets (`wasm1` `wasm2` `wasm3` `all`, plus `mvp` `lime1` `-all`); `mvp` and a bare list start from nothing, so exporting a mutable global needs `mutable-globals` (or `wasm1`); every reference type needs reference-types (the GC and exception types their own proposal as well), and a non-null `(ref func)` / `(ref extern)` needs function-references (gc admits only `(ref $t)`), as in wasm-tools; an overlong `call_indirect` index needs reference-types. No feature set is refused | use a preset (`--features wasm2`) or add `mutable-globals`; the wasm-tools spellings still work, with a warning |
| 1.0.0 | **Rust API / C ABI:** `Feature::MutableGlobals` and `Features::mutable_globals`, `opcode::CallIndirect::overlong`; `WASMRT_FEATURE_MUTABLE_GLOBALS = 18`; `wasmrt_engine_new_with_config` no longer refuses a feature set | add the new arm / field; nothing to change in C |
| 1.0.0 | **Traps:** `call_indirect` past the table's end now reports "undefined element", and an out-of-range float→int truncation "integer overflow" (as the spec says). **Rust API:** `interp::Trap` gains `UndefinedTableElement` | a `match` on `Trap` needs the new arm; code that matched the old message text should match the new one |
| 1.0.0 | **WASI:** a guest sees ONLY the `--env` variables; it no longer inherits the host's environment. `--env =x` (an empty name) is an error | pass each variable the guest needs: `--env HOME=/home/me --env LANG=C.UTF-8` |
| 1.0.0 | **CLI:** a host flag after the guest's first argument is an error (`prog.wasm install --yes`) | `prog.wasm install -- --yes` gives the guest its own flag |
| 1.0.0 | **Validation:** with a proposal disabled, a table with an initializer needs function-references, and `nullexternref` / `nullfuncref` need GC (as in wasm-tools). With every proposal on, the default, nothing changes | enable the proposal: `--features …,function-references` or `…,gc` |
| 1.0.0 | **Pins:** `wasmrt wat` now writes `wasm-tools parse`'s bytes, so a `.wat` file's pin digest changes (`.wasm` digests do not) | re-run `wasmrt pin` over pinned `.wat` files |
| 1.0.0 | **Rust API (`wasmrt-core`):** `interp::PAGE_SIZE` removed (pages have a per-memory size); `opcode::Op` is `#[repr(u16)]` with renumbered internal tags; `module::Code::body` (the raw bytes) replaced by `Code::ir` (the decoded instructions); `interp::InstanceId` carries its store and is no longer a tuple struct; new enum variants in `opcode::Imm`, `DecodeError` and `wat::Error` | match on the new variants; take a page size from the memory's type. The C ABI (`wasmrt.h`) only added: `abi_version()` is still 1 |

## Privacy

wasmrt collects nothing and makes no network requests: no telemetry, no update checks. The CLI
writes only the files you name (`wat … -o <file>`, `pin … --db <file>`) and what a guest writes
inside a directory you pass with `--dir` — plus, while it writes a file, a short-lived
`.wasmrt-tmp-…` file beside it, and a `<db>.lock` file kept beside a pin DB. A pin DB records each
module's path as you gave it: pin with relative paths to keep a shared DB free of local directory
names. It reads the pin database from its fixed paths
(`%ProgramData%\…\pins` on Windows, `/etc/…/pins` elsewhere) or the file you name with `--pins`,
reading the `ProgramData` variable on Windows to find it, and nothing else from the environment. A guest sees only the variables you pass
with `--env`.

## License

`SPDX-License-Identifier: MIT OR Apache-2.0`

Dual-licensed under either of [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option.
wasmrt has **no third-party dependencies**, and its engine incorporates no third-party code. Two
components are recorded, both **data**: WebAssembly instruction-table data derived from
[wabt](https://github.com/WebAssembly/wabt) (Apache-2.0), by way of the owner's binaryang project —
since 2026-10-24 wasmrt's opcode gating and its SIMD and atomic mnemonic tables are generated from it;
and, since 3.0.0, wasmparser's implementation-limit values and error wording (MIT), so that wasmrt
refuses what wasmtime refuses, in its words — used under MIT whichever licence you take wasmrt under.
See [`NOTICE`](NOTICE) and [`third_party/LICENSES.md`](third_party/LICENSES.md).
