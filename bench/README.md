# bench/

Interpreter microbenchmark for wasmrt — the Rust port of wazmrt's `bench/bench.zig`.

## ✅ It exists — but it lives at `crates/wasmrt-core/examples/bench.rs`

```sh
cargo run --release -p wasmrt-core --example bench
```

**Why not `bench/bench.rs`:** a cargo target whose `path` points outside its package
directory breaks `cargo package`, and all three crates are published. This directory
keeps the **methodology and the oracle's reference figures**; the code lives in the
package it measures.

### wasmrt's own numbers — first measured 2026-08-07 (T9c)

| Regime | Measurement |
| --- | --- |
| cold — toy module (70 B) | **3.5 µs** |
| cold — real module (48,067 B) | **4.48 ms** ← quote this one |
| steady — `sum(n)` tight `loop`/`br_if` | **~237 Mops/s** (232–240 over 1M/10M/50M) |

Host: `x86_64-pc-windows-gnullvm`, release profile. Against the oracle's figures below
that is **cold parity and ~90% of steady throughput** — measured on a different machine,
so treat it as a sanity check, not a head-to-head.

### 🆕 Same-machine comparison: wasmrt vs wasmtime, Bun and Deno (2026-10-23)

```sh
bun scripts/cross-runtime-bench.ts --wasmrt <path-to-release-wasmrt> --rounds 30 [--json out.json]
```

The first comparison measured **on one machine, in one session, with byte-identical inputs**
(assembled by `wasm-tools`). Raw data: [`results/cross-runtime-2026-10-23.json`](results/cross-runtime-2026-10-23.json).
Versions: wasmrt 0.9.0 (`23b3199`), wasmtime 50.0.0 (`-C cache=n`: plain `.wasm`, compiled each
run), Bun 1.4.4, Deno 2.9.8. Host: i9-13980HX laptop, mains power, Windows; 30 interleaved rounds.
⚠️ The in-process wasmrt bench drifted **7–11% slower** between the start and end of the session,
so a difference smaller than that is noise.

**End to end** — one process per run, median ms. The *floor* is the same runtime doing no wasm work
(`--version`, or an empty script); it is the cost of starting the program at all.

| workload | wasmrt | wasmtime | Bun | Deno |
| --- | ---: | ---: | ---: | ---: |
| floor (no wasm) | **15.3** | 26.3 | 36.7 | 57.0 |
| trivial `f() = 42` | **15.3** | 31.5 | 42.8 | 85.5 |
| `sum(1e6)` (13 M wasm ops) | 68.4 | **31.5** | 44.6 | 85.3 |
| `sum(1e7)` (130 M wasm ops) | 549.3 | **32.4** | 48.3 | 90.5 |
| 48 KB module, one call | **21.9** | 61.9 | 49.2 | 86.9 |

**In process** — the `bench.rs` measurements, run inside each runtime:

| measurement | wasmrt (`bench.rs`, A → A′) | Bun (JSC) | Deno (V8) |
| --- | ---: | ---: | ---: |
| cold, toy module (compile + instantiate + call) | **4.5 µs** | 53.0 µs | 26.0 µs |
| cold, 48 KB module | 3.20 → 3.54 ms | 2.01 ms | **1.24 ms** |
| steady `sum(n)` | 217–246 Mops/s | ~55,000 Mops/s | ~58,000 Mops/s |

⚠️ **Each JS in-process cold run compiles UNIQUE bytes** (the module plus a counter in a custom
section). V8 caches compiled modules by their bytes within a process, so compiling the same bytes
repeatedly timed a **cache hit**: Deno read 3.4 µs that way, against 24–26 µs uncached.

🔒 **Owner, 2026-10-23: Bun is the JS baseline, and the long-run target is wasmtime** — the end-to-end
crossover and the steady Mops/s against `wasmtime run -C cache=n` are the gauges every T11 step reports
(`../cmem/roadmap.md`, "T11 direction").

What this shows, without overreading it:

1. **wasmrt wins every run whose engine work is small**, and the margin is mostly START-UP: its
   floor is 11 ms below wasmtime's, 21 ms below Bun's and 42 ms below Deno's. On the 48 KB module it
   also beats wasmtime's eager Cranelift compile by ~40 ms end to end.
2. **⚠️ In process, wasmrt's real-module cold start is SLOWER than both JS engines** (3.2–3.5 ms vs
   2.0 and 1.2 ms). The 48 KB end-to-end win comes from start-up, not from decode/validate/instantiate.
   V8 and JSC compile and validate lazily; wasmrt does the whole module up front. T11 lead.
3. **The interpreter loses any real loop.** At ~235 Mops/s against a JIT's ~55,000, the end-to-end
   crossover, estimated from the medians above, is about **3.8 M wasm ops against wasmtime and
   6.5 M against Bun** (16.5 M against Deno). That is a few hundred thousand loop iterations. This
   regime was always ceded to a JIT (`cmem/vision.md`, "Fast").
4. **The inherited claim "1.5× on `sum(1e6)` vs Deno/V8" does not carry over to Bun.** Measured here,
   wasmrt finishes `sum(1e6)` 17 ms ahead of Deno and **24 ms behind Bun**. Quote differences; a
   ratio changes with load.
5. 🔍 **Unexplained, T11 lead:** the CLI's 48 KB end-to-end cost above its floor (6.6 ms) is about
   3.4 ms more than `bench.rs`'s in-process cold start. The CLI decodes the module to choose a run
   mode before loading it (`crates/wasmrt/src/main.rs`, run-mode dispatch). Whether it decodes TWICE
   is **unverified**: measure before believing it.

> ⚠️ **Do not quote wazmrt's numbers as wasmrt's.** The figures in the next section are
> the *oracle's*, kept here as the methodology and the target to beat. Inheriting the
> interpreter's shape does not inherit its measurements. Where the two are named
> together above, both are labelled.

## What it measures (from wazmrt `cmem/vision.md` + `docs/port/06`)

Two regimes, reported separately — never conflated:

- **Cold path** — decode + instantiate + one call: the per-run cost a short-lived
  program pays. This is where wasmrt aims to **beat Deno/V8** (which pay ~110 ms
  of V8 init + JIT + JS marshalling every run). Quote a real-script cold start
  (~4.4 ms for a 46 KB guest), NOT the sub-µs toy-module figure.
- **Steady state** — a hot loop inside one instance: raw dispatch throughput
  (~264 Mops/s for wazmrt; a JIT wins this regime — informs the Option A → B
  decision).

## Methodology (carry over)

- Build in release-fast for the steady numbers; measure in-process.
- Compare against a **same-session baseline** (`git stash` A/B/A) — never compare
  throughput across days (run-to-run spread ~8%).
- The cross-process cold-start-vs-Deno numbers are recorded in `cmem/testing.md`.
- Canonical workload: `sum(n)` over a tight `loop`/`br_if` (see wazmrt bench).
- Later: also measure SHA-256 (pin verify; `pin` was built 2026-09-19 and has not been benchmarked).
- **Per-artifact binary size is measured** (T9b, 2026-08-07) — the numbers are in
  `../cmem/roadmap.md` (T9b) and `../cmem/vision.md`. The wasm3/WAMR comparison is
  still outstanding: it needs those binaries present, not an estimate.
- **T11 (the optimization review) is no longer blocked** — both baselines it required
  now exist, so every proposal there can be stated as a delta.

Reference original: `../../wazmrt/bench/bench.zig`.
