// SPDX-License-Identifier: MIT
// The limit VALUES below are from wasmparser 0.263 `src/limits.rs`, Copyright 2017 Mozilla Foundation, used under
// the MIT licence wasmparser offers ("Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT"). Modified by wasmrt:
// renamed without the `MAX_WASM_` prefix, given wasmrt's types, a subset kept, and checked by wasmrt's own
// decoder. See NOTICE, third_party/LICENSES.md and third_party/wasmparser/LICENSE-MIT.

//! 🔒 **The implementation limits wasmrt enforces** — wasmtime's values, MEASURED one by one before being kept
//! (owner, 2026-11-24: "accept the measured limits that keep the program as robust as needed and as small as
//! possible"; the choice "Needed + borderline", and type size "Adopt the limit"). Each is checked where wasmtime
//! checks it, with its words and offset (`module.rs`, `opcode.rs`); a count EQUAL to its limit is accepted.
//!
//! Kept: every limit without which a module claims memory far beyond its own size — measured with the limit
//! removed (locals: a 33-byte module claimed 1.5 GB; functions 260×; body size 286×; types, params, tables ≈100×;
//! element segments 79×; tags 66×; data segments 63×; globals 42×; exports 33×; items per segment, struct fields,
//! catches, imports 18–26×) — and the effective type size (a 0.8 MB module of imports claimed 840 MB).
//!
//! Not kept, measured as not needed by wasmrt: the name length (2×), the memory count (a memory's cost is its
//! pages), the subtype depth (a cast walks the chain: time per cast, flat memory), wasmparser's 20-bit type index
//! (its internal packing; wasmrt's own 27-bit guard is what prevents type confusion), the supertype, typed-select
//! and `br_table` counts (the bytes left bound them). Never adopted: `array.new_fixed`'s JS-API 10,000. wasmrt's
//! own `MAX_CTRL_DEPTH` (validate.rs) is kept: without it 1M nested blocks claimed 610 MB–1.35 GB.
//! (The measurements are the maintainer's records; the CHANGELOG and README summarise them.)

pub const TYPES: usize = 1_000_000;
pub const FUNCTIONS: usize = 1_000_000;
pub const IMPORTS: usize = 1_000_000;
pub const EXPORTS: usize = 1_000_000;
pub const GLOBALS: usize = 1_000_000;
pub const ELEMENT_SEGMENTS: usize = 100_000;
pub const DATA_SEGMENTS: usize = 100_000;
pub const FUNCTION_SIZE: usize = 7_654_321;
/// Params plus declared locals of one function.
pub const LOCALS: u64 = 50_000;
pub const PARAMS: usize = 1_000;
pub const RETURNS: usize = 1_000;
/// Elements in ONE element segment (not a table's size).
pub const TABLE_ENTRIES: usize = 10_000_000;
pub const TABLES: usize = 100_000;
pub const TAGS: usize = 1_000_000;
pub const STRUCT_FIELDS: usize = 10_000;
pub const CATCHES: usize = 10_000;
/// The imports' and exports' summed type sizes must stay below this (`module::add_type_size`).
pub const TYPE_SIZE: u32 = 1_000_000;
