# wasmrt-capi

The C ABI of [wasmrt](https://github.com/synapticforge1/wasmrt) — the `wasmrt.h` surface, built as a
`staticlib` and a `cdylib` over [`wasmrt-core`](https://crates.io/crates/wasmrt-core).

Compile a module, link host functions, instantiate, call exports, and read or write guest memory
from C. You can restrict which WebAssembly proposals a guest may use and cap the memory, table
size, call depth, GC objects and exception boxes it may consume.

Handles are **checked**: a value handle carries the identity of the store that issued it, so one
from another store — or from a store that is gone — is refused rather than followed. All
raw-pointer work is confined to a single module, so the rest of the crate is ordinary safe Rust.

The header ships at `include/wasmrt.h`.

## Linking the static library

A Rust static library does not carry its system dependencies, so name them when you link. The
exact list depends on the Rust toolchain that built the library; ask it with
`cargo rustc -p wasmrt-capi --release --crate-type staticlib -- --print native-static-libs`. On
Windows (gnullvm/mingw) with current toolchains that is:

```sh
cc app.c libwasmrt_capi.a -lkernel32 -lntdll -luserenv -lws2_32 -ldbghelp -lsynchronization
```

The `cdylib` (`wasmrt_capi.dll`, `libwasmrt_capi.so`) needs none of this.

`SPDX-License-Identifier: MIT OR Apache-2.0`
