// feature-rows.ts — one minimal module per proposal wasmrt gates, shared by the gates that need it.
//
// `scripts/feature-gate-sweep.ts` judges each row with its proposal DISABLED (both engines must
// refuse); `scripts/behaviour-corpus.ts` puts every row into the S1 behaviour corpus (letter H23).
// One list, so the two cannot drift apart.
//
// `ours` is wasmrt's spelling of the proposal, `wt` is wasm-tools'. The module must USE the
// proposal and nothing else that the same flag switch would remove.
export type Row = { id: string; ours: string; wt: string; wat: string };

export const ROWS: Row[] = [
  ["sign-extension", "sign-extension-ops", "sign-extension",
    `(func $f (result i32) i32.const 1 i32.extend8_s)`],
  ["saturating-float-to-int", "nontrapping-float-to-int-conversions", "saturating-float-to-int",
    `(func $f (result i32) f32.const 1 i32.trunc_sat_f32_s)`],
  ["multi-value", "multi-value", "multi-value",
    `(func $f (result i32 i32) i32.const 1 i32.const 2)`],
  ["reference-types", "reference-types", "reference-types", `(table 1 externref)`],
  ["bulk-memory", "bulk-memory-operations", "bulk-memory",
    `(memory 1) (func $f i32.const 0 i32.const 0 i32.const 0 memory.fill)`],
  ["extended-const", "extended-const", "extended-const",
    `(global i32 (i32.add (i32.const 1) (i32.const 2)))`],
  ["simd", "simd", "simd", `(func $f (result v128) v128.const i32x4 1 2 3 4)`],
  ["relaxed-simd", "relaxed-simd", "relaxed-simd",
    `(func $f (result v128) v128.const i32x4 0 0 0 0 v128.const i32x4 0 0 0 0 i8x16.relaxed_swizzle)`],
  ["threads/atomic-op", "threads", "threads",
    `(memory 1) (func $f (result i32) i32.const 0 i32.atomic.load)`],
  ["threads/shared-memory", "threads", "threads", `(memory 1 1 shared)`],
  ["multi-memory", "multi-memory", "multi-memory", `(memory 1) (memory 1)`],
  ["memory64/memory", "memory64", "memory64", `(memory i64 1)`],
  // ⚠️ table64 is the memory64 proposal's other half, and was ungated until 2026-09-20.
  ["memory64/table64", "memory64", "memory64", `(table i64 1 funcref)`],
  ["function-references/call_ref", "function-references", "function-references",
    `(type $t (func)) (func $f (param $r (ref $t)) local.get $r call_ref $t)`],
  // ⚠️ the table-with-initializer form — nothing else in this module needs the proposal.
  ["function-references/table-init", "function-references", "function-references",
    `(table 1 funcref (ref.null func))`],
  ["gc/struct", "gc", "gc",
    `(type $s (struct (field i32))) (func $f (result (ref $s)) i32.const 1 struct.new $s)`],
  ["gc/i31", "gc", "gc", `(func $f (result i31ref) i32.const 1 ref.i31)`],
  ["exceptions", "exception-handling", "exceptions", `(tag $e) (func $f throw $e)`],
  ["tail-call", "tail-call", "tail-call", `(func $g) (func $f return_call $g)`],
  ["wide-arithmetic", "wide-arithmetic", "wide-arithmetic",
    `(func $f (result i64 i64) i64.const 1 i64.const 2 i64.const 3 i64.const 4 i64.add128)`],
  ["custom-page-sizes", "custom-page-sizes", "custom-page-sizes", `(memory 1 (pagesize 1))`],
  ["custom-descriptors", "custom-descriptors", "custom-descriptors",
    `(rec (type $a (descriptor $b) (struct)) (type $b (describes $a) (struct)))
     (func $f (param $r (ref null (exact $a))))`],
].map(([id, ours, wt, wat]) => ({ id, ours, wt, wat }));
