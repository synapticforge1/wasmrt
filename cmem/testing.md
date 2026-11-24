# Testing

**Definition of done = conformance to the WebAssembly specification on both targets** (native + wasm),
plus the size and speed numbers that decide inclusion. Detail:
`docs/port/06-build-docs-licensing.md`; the test tree layout is in `tests/README.md`.

## The gate today — measured 2026-11-23 (review I6)

- `bun scripts/gate.ts`: **22 steps** (`gate: 22 steps`, 2026-11-20 at `db6f63b`); `--release` adds 4 (the floor,
  the CHANGELOG section, the `release.md` entry, the review gate). Workspace tests 608 / 0 / 1 on win-x64.
- Self-tests: privacy gate 33, review gate 30, bump 14, previous-tests cleanup 9, release record 40, release page 55,
  crates.io 53, versions 23; `licence-copies.ts` checks 5 files in each of 3 crates. Counts in the dated sections
  below are those days' figures, not current ones.

## 🆕 2026-11-19 — the gate runs LOCALLY only; CI tests nothing (workspace letter H37 (e))

🔒 "Every gate, the test suites included, runs locally and is not repeated on GitHub — CI only
publishes" (owner, 2026-11-17). `bun scripts/gate.ts` is run by hand and by `release.ts`; CI's
`checks` job now only reads the version and asks `github-release.ts state`. **New steps:**
`privacy-gate.ts --commits <last tag>..HEAD` (tree, untracked files, commit messages; masked
output), its self-test `check-privacy-gate.ts` (33), and `check-review-gate.ts` (25); `--release` now
checks `release-record.ts notes` + `entry` (the Tested on lines; self-test 40) and `review-gate.ts`
(the review's result) instead of H35's two review paragraphs. The CI annotation code is gone with
CI's run. Linux is no longer exercised by CI: `platforms.md`. Step and test counts in the 2026-11-12
section below are that day's. *Gate run on the adoption tree: see `archive/open-work-to-2026-11-23.md` § State.*

## 🔒 Conformance anchors (owner, 2026-08-11 — the oracle is retired)

**wazmrt is no longer a test anchor.** The two runtimes compete independently for inclusion in wasmtk and
the universalWasmLoader-\* runtimes, so parity with one is not evidence about the other. What answers
"is this correct?", in order of authority:

1. **The official WebAssembly spec testsuite** — 64,603 adjudicated assertions over 288 files
   (2026-10-24, all passed; the corpus moves, so re-run before quoting), vendored
   at `../wasmtk/tests/module/wasm_wast/testsuite-main`. This is the anchor: it is the specification,
   executable. `wasmrt wast <dir>` runs it.
2. **wasmtime's observable behaviour**, for questions the suite does not adjudicate — error wording,
   diagnostic offsets, API shape. ⚠️ **Run the real binary; do not answer from memory about it.** That
   rule was paid for: "what does wasmtime's `Module::new` do" invited a recalled answer, and three lines
   through wasmtime 47 settled it in seconds *and* produced two byte offsets to assert against
   (`best-practices.md`).
3. **The wasmtk WASI corpus** — real compiled guests, which is the only thing that exercises the WASI
   surface end to end.
4. **wasmrt's own tests** — 606 of them (2026-10-24; the current count: the newest `release.md` entry), for the
   internal invariants none of the above can reach
   (handle tagging, store isolation, encoding invariants, the `size_of` pins).

✅ **Tail calls** (`return_call`/`return_call_indirect`) were conformed exactly this way and **landed 2026-08-14** — they were the one
wasmrt-target feature the oracle never covered. That is now simply how everything is done.

*Historical: through T9 the strategy was a split — golden-vector parity Rust↔wazmrt for everything the
frozen oracle implemented, spec-suite-and-wasmtime for tail calls, re-checked whenever
`scripts/check-wazmrt.sh` reported drift. That script is deleted.* ⚠️ **Two punch-list items were false
leads produced by that arrangement** ("the oracle runs this, so our type-checker is wrong" — it was
running an entry point that skipped validation, `best-practices.md` §2.3a). Retiring the oracle removes
the class; do not reintroduce it by reasoning about what wazmrt would do.

## Where the spec testsuite lives (owner, 2026-08-03)

The official WebAssembly spec testsuite is **already vendored locally** — no clone needed:

```
../wasmtk/tests/module/wasm_wast/testsuite-main/
```

**257 core `.wast` files** plus `proposals/` (custom-descriptors 14, threads 4, custom-page-sizes 4,
wide-arithmetic 1) and `legacy/` (4 — the legacy EH encoding: `throw`, `rethrow`, `try_catch`,
`try_delegate`). Mirrored on GitHub at <https://github.com/synapticforge1/wasmtk/tree/main/tests>. The wider
`wasmtk/tests` tree also holds the **WASI corpus** used at T7 and 534 `.wat` files.

This is the **T6 conformance gate**: the `.wast` runner walks these and must reach wazmrt's ~60k-assertion
pass profile. Note `legacy/try_delegate.wast` is expected to fail its `delegate` cases — wasmrt rejects
`delegate` deliberately, matching the frozen oracle (see `known-issues.md`); record it as a known
divergence rather than chasing it.

## Test layers (mirror wazmrt, ported)

- **Unit tests** — port wazmrt's test corpus module-by-module (decode/validate/interp/text/wasi/pin).
  At the freeze wazmrt prints **489/493 pass (4 skip)** — ~216 distinct tests, roughly doubled because
  the `cabi` target re-runs the core tests (see wazmrt `testing.md` "Reading the test count"). Start with
  the LEB accept/reject vectors and the ValType-packing bit ops (pure, high-value).
- **C-ABI behavior — ✅ BUILT at T8 (2026-08-06).** `tests/c_smoke.c`: compile → instantiate (with a host
  import) → call → read/write memory → global → trap → teardown, plus a foreign-handle rejection. Run
  via `scripts/c-gate.ts`.
- **C-ABI link completeness — ✅ BUILT at T8. `tests/abi_symbols.c`, 74/74 symbols.** Same runner.
- **C-ABI memory safety — ✅ BUILT at T8.** `scripts/miri-gate.ts` runs the whole capi surface under
  **Miri**, including the randomized `lifecycle_fuzz` (wazmrt #22). A normal allocator can't catch a
  double-free/UAF; the detecting allocator is the oracle. Less risk than wazmrt here because wasmrt's
  capi uses **checked value handles**, not a refcount object model — the fuzz still guards
  instance/memory lifetimes, and additionally proves a handle outliving its store is *refused*.
  (ASAN was not needed once Miri was clean; revisit only if a platform Miri cannot model matters.)
- **Conformance gates:**
  - **spec testsuite** — `wasmrt <file.wast>` runs the official corpus (positive + `assert_invalid`/
    `assert_malformed`/`assert_trap`/`assert_unlinkable`). The corpus lives outside the repo (wazmrt keeps
    it on removable media at `wasmtk/tests/module/wasm_wast/testsuite-main`).
  - **wasi-gate** — compile real Zig/C/Rust `wasm32-wasi` guests (`examples/`) and run them through the
    wasmrt CLI asserting exact stdout. A regression fails the build. "A gate that can't fail is
    decoration" — verify it fails on a wrong expected string.

## Method discipline (carry from wazmrt)

- **Diff the OUTPUT (N passed / N failed), not exit codes** — a build that exits 0 while silently
  dropping passes is a regression.
- Benchmark against a **same-session baseline** (`git stash` A/B/A); never compare Mops/s across days
  (~8% run-to-run spread). See `bench/README.md`.
- Each feature slice adds unit tests + a hand-written `.wast` (or corpus gate) + verified zero
  regressions across all build surfaces (`cargo test` / native / wasm, + c-smoke where relevant).
- Track binary **size** per artifact as a first-class metric (criterion (c)).
