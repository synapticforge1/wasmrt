# shared-definitions.md — wasmrt and the workspace's shared definitions (letters H8, H10)

🗓️ Written 2026-10-23. **Every number here is a measurement with that date.** Re-run the commands
before quoting one.

## What it is

The workspace decided (owner, 2026-09-20; `../cmem/divergences.md`, "The shared definitions") that the
instruction table (**D1**), the feature list (**D2**) and the verdict vocabulary (**D3**) have ONE
source, in binaryang, and that every other repo keeps a **generated** copy, checked by a gate that
regenerates it and diffs.

| piece | where | what it does |
| --- | --- | --- |
| the source, vendored | `definitions/binaryang/{opcodes,features,verdicts}.json` | binaryang's `src/definitions/*.json` at a **published tag** |
| the pin | `definitions/binaryang/PIN.json` | repo, tag, commit, and each file's git blob id and content sha256 |
| the generator | `scripts/definitions.ts` | verifies the source, writes the copy; `--check` regenerates and diffs; `fetch <tag> <commit>` re-pins |
| the copy | `crates/wasmrt-core/src/definitions.rs` | GENERATED. **Hand-editing it is a DEFECT** (H10) |
| the cross-check | `crates/wasmrt-core/src/definitions_check.rs` | holds wasmrt's tables (and the `.wast` runner's verdicts, D3) to the copy; runs in `cargo test` |
| 🆕 the SHIPPED tables | `crates/wasmrt-core/src/tables.rs` | GENERATED (H10 step 2, 2026-10-24): `op_feature` (exhaustive over `Op`), the relaxed-SIMD set, the `0xFD`/`0xFE` mnemonic tables, the `0xFB`/`0xFC` dispatch (`fb_op`, `fc_op`, `prefixed`). Compiled into every binary |

✅ **D2's TYPE and ENCODING rules are held in `cargo test` (since the 2.2.0 re-pin, 2026-10-24).**
The generator emits `TYPE_RULES` / `ENCODING_RULES`; `definitions_check` maps each rule's subject
text to wasmrt types (`type_subjects`) or modules (`encoding_fixtures`, 11 rules, 17 modules) and
checks `features::val_type_unmet` under every subset of the features the type rules name, and each
module refused with its rule's features off and valid with all on. An unmapped subject, or a mapping
D2 dropped, fails the gate. Inverted on adding: the old `exact` exemption and a one-table "more than
one table" fixture each failed it. *(From 2026-10-24 morning until the re-pin the type rule ran
AHEAD of the pin, held only by a wasm-tools probe and a unit test.)* The re-pin's first matrix found
one wasmrt defect: an `exact` reference skipped the reference-types check (`known-issues.md`, top).

**Pinned 2026-10-24: binaryang `v2.2.0`, commit `6e1923397def`** (D1 1.0.1, D2 2.2.0 with
`typeRules` and `encodingRules`, D3 1.0.0) — 582 instructions, 22 features, 20 verdicts; only
`features.json` changed from 2.1.0. *(Was `v2.1.0` / `b7fdb9de5785` earlier the same day.)*
*(Before that: binaryang `v2.1.0`, commit `b7fdb9de5785`* (D1 1.0.1, D2 2.1.0 with `requires`
and `presets`, D3 1.0.0). *(Was `v1.14.0` /
`7ebcee3ad055` from 2026-10-23; re-pinned for the contract v37 migration, where the one generator
override and three KNOWN entries became stale because binaryang adopted wasmrt's answers.)* The copy and the cross-check are `#[cfg(test)]`; 🔁 since 2026-10-24 `tables.rs` ships
(owner-cleared, with the wabt attribution in NOTICE).

### 🆕 H10 step 2, stage 1 — the generated tables (2026-10-24)

`scripts/definitions.ts` now also writes `tables.rs`, keyed on wasmrt's own `Op` variants: it reads
`define_ops!` from `opcode.rs` and `Feature::from_name` from `features.rs`, and maps every D1
instruction onto a variant (199 single-byte by byte; 59 prefixed by name, the `null` forms of
`ref.test` / `ref.cast` / `ref.cast_desc_eq` sharing one; `Simd` / `Atomic` as family floors).
* **It refuses, rather than guesses:** a variant D1 lacks, a D1 entry no variant takes, two D1 forms
  of one variant disagreeing on the feature, a D2 feature `from_name` cannot resolve, a non-contiguous
  relaxed-SIMD range, and a STALE override.
* **One override, with its reason:** `return_call_ref` → function-references (D1 says tail-call;
  wasm-tools 1.262 gates function-references only).
* **Proved equal before the swap:** a temporary test compared every one of the 258 ops, every SIMD
  and atomic entry, and the relaxed set, generated against hand-kept, and found no difference
  (inverted by hand-editing one arm, which also failed `--check`). Then the hand code was deleted:
  `lookup_simd`'s ~270-line table, `lookup_atomic`'s layout arithmetic, `op_feature`'s match.
* **Inverted after it:** an op added to `define_ops!` without regenerating fails the BUILD
  (`non-exhaustive patterns`), and the generator refuses it; a stale override fails the generator.
* **Cost, measured back to back:** release CLI +1,024 bytes (845,312 → 846,336), cdylib −512 bytes
  (537,600 → 537,088). The interpreter's dispatch is untouched, so no hot-path benchmark applies.
* **Stage 2 (2026-10-24, `bfde4a2`): the `0xFB`/`0xFC` dispatch is generated too.** `tables::fb_op` /
  `fc_op` (decoder: sub-opcode → op, plus the encoding's nullability) and `tables::prefixed(op,
  nullable)` (assembler: op → prefix + sub-opcode, including the nullable re-select for `ref.test` /
  `ref.cast` / `ref.cast_desc_eq`). Immediates stay hand-written (`read_prefixed_immediate`, matched
  on `Op`): they are wasmrt's representation, not D1's. A temporary test proved the generated and hand
  tables equal on all 256 sub-opcodes of both prefixes before the swap. Hot path, so measured
  interleaved A/B over 3 rounds: cold 48 KB 3.30/3.29/3.46 ms before vs 3.16/3.24/3.33 ms after,
  steady 210–219 vs 209–227 Mops/s. No regression; the difference is within noise.
* **Deliberately NOT generated: the `define_ops!` list.** `Op`'s variant names are public API, and
  three are not a mechanical function of the D1 name (`try` → `TryLegacy`, `catch` → `CatchLegacy`,
  `ref.cast` → `RefCastOp`). The 59 internal tags are contiguous from `0x100`. The list is already held
  to D1 by `definitions_check` in `cargo test`, so generating it would add an exceptions table and
  change nothing that is checked.

### How the source is verified (every run)

1. Each file's own `sha256` header: SHA-256 of the canonical JSON (keys sorted, no whitespace) with
   that field emptied. That is binaryang's rule (`binaryang/scripts/definitions.ts`, `canonical`),
   reproduced here. The reproduction matched binaryang's header on all three files, which proves the
   algorithm is the same.
2. Each file's git blob id against `PIN.json`, so a vendored file cannot be edited by hand.
3. `fetch` refuses a commit that is not what the tag names **on GitHub**: the pin must be a published
   version, never a sibling's local tree.

⚠️ **That third check fired on its first use.** At 12:40 the tag `v1.14.0` named `e2d44d66c935`; minutes
later it named `7ebcee3ad055`, because binaryang force-pushed its history purge (H19) in between. The
files are byte-identical under both commits (same blob ids). 🎓 A pin to a sibling's commit id is a
pin to something its owner may rewrite. Pin the tag and verify the CONTENT, which survives a rewrite.

### Updating the pin

```
bun scripts/definitions.ts fetch <tag> <40-hex commit>   # refuses unless GitHub's tag names that commit
bun scripts/definitions.ts                               # writes the copy
cargo test -p wasmrt-core --lib definitions_check        # the cross-check
```

Then classify every new difference (below). **Change flows source → copy, never the other way**: a
difference that is binaryang's goes to binaryang through the workspace, not into the copy.

## What the cross-check asserts

wasmrt's instruction set is not one table. It lives in five places: `define_ops!` (`opcode.rs`), the
`0xFB`/`0xFC` dispatch in `decode_expr`, `decode_simd`'s ranges with `UNASSIGNED_SIMD`,
`wat::lookup_simd` / `lookup_atomic`, and `features::op_feature` / `simd_sub_feature`. The check reads
all five through their real entry points. For each of D1's 582 entries:

1. **decode**: the encoding, plus immediates synthesized from the entry's immediate KINDS, inside
   whatever structure the instruction needs, decodes as ONE instruction consuming EXACTLY those bytes.
   That means the count and width of every immediate agree, which is binaryang's own proof shape;
2. **name**: wasmrt's mnemonic is D1's;
3. **feature**: wasmrt gates it with D1's feature, resolved through D2's CLI spelling (the
   `--features` path).

The **reverse sweep** covers all 256 single bytes, `0xFB`/`0xFC`/`0xFE` sub-opcodes to `0x7f`, and
`0xFD` to `0x1ff`. Nothing wasmrt decodes may be absent from D1. D2 is checked both ways.

A classified difference is listed in `KNOWN` with its reason. **A KNOWN entry that stops occurring
also fails**, so an excuse cannot outlive the difference it excuses.

**Inverted 2026-10-23** (each with `Edit`, confirmed applied, then restored):

| mutation | result |
| --- | --- |
| ungate `array.fill` again | caught |
| give `v128.load8x8_u` the wrong sub-opcode | caught |
| hand-edit the copy | `--check` fails |
| hand-edit a vendored JSON | blob mismatch |

Each caught exactly its own mutation and nothing else.

## Results, 2026-10-23 (H8: I5 opcode membership, I6 feature names)

✅ **Opcode membership: wasmrt = D1 exactly.**
* All 582 decode as one instruction of D1's exact width.
* The reverse sweep finds nothing extra.

🔴 **One DEFECT, fixed the same day.** Six GC bulk array ops were gated by no flag:
`array.new_data`, `new_elem`, `fill`, `copy`, `init_data`, `init_elem`. They had been missing from
`op_feature`'s GC arm since they landed (2026-08-19). It was **latent**: each needs an array type,
and an array TYPE is refused with GC off first. Measured on wasmrt ("uses the disabled proposal
`gc`") and on wasm-tools 1.262 ("array indexed types not supported without the gc feature", offset
`0xb`). The fix:
* `UNGATED_CORE_OPS` 178 → **172**, which equals D1's core count;
* the six are pinned by name;
* `op_feature`'s doc comment no longer claims an exhaustiveness it never had.

This is the fifth time the X3 shape has turned up, and again a sweep found it, not reading.

**Classified (in `KNOWN`):**

| key | what | class |
| --- | --- | --- |
| `15` `return_call_ref` | D1 gates it under tail-call. **wasm-tools 1.262 needs function-references ONLY** (accepted with tail-call off; refused with function-references off), and wasmrt does exactly that | **binaryang's D1 differs from wasm-tools**; reported upstream |
| `1c`, `fb 15`, `fb 17`, `fb 24` | D1 names the second `select` opcode `select`, and the nullable casts `ref.test null` etc. wasmrt uses an internal `select.t` sentinel, and one mnemonic with the nullability in the immediate | naming of the two TABLES; bytes and text forms agree |
| D2 `sat-float-to-int` | wasmrt's `--features` accepts `saturating-float-to-int` and `nontrapping-float-to-int-conversions`, not binaryang's spelling | vocabulary gap on a **contract surface** (`interop.md` §2.2) — coordinate before adding an alias. The gating itself agrees (`D2_ALIASES`) |
| D2 `mutable-globals`, `annotations`, `code-metadata`, `compact-imports` | no wasmrt flag. The first two are always on; code metadata is not implemented; compact imports: binaryang `implemented:false` too, and whether wasmrt decodes the form is UNMEASURED | FEATURE |

✅ **D3 (verdicts) is CHECKED since 2026-10-24**, both ways: every D3 message is in the `.wast`
runner's `wast::TRAP_VERDICTS` and classifies to the verdict D3's key names, and the table holds
nothing D3 lacks (`definitions_check`, kinds `d3-membership` / `d3-verdict`; inverted). D3 is exactly
the vendored suite's vocabulary (5,267 assertions, 20 messages). Using it made the runner compare
the trap message, which found 54 wrong traps the suite had been scoring as passes
(`known-issues.md`, top). *(Until then: "D3 is vendored and generated but not yet checked".)*

## Cross-repo results (H8: I3/I4 sweeps, I8) — observations, for the workspace

wasmrt's three sweeps were run with each sibling as the SUBJECT. wazmrt used its existing
`zig-out/bin/wazmrt.exe` (reports 1.0.3, built 2026-09-21 20:34, two minutes before its last source
commit; **not rebuilt**, so as not to write into its tree). binaryang used `bun main.ts
wasm-validate`, through one-time harnesses that read the fixtures out of the committed scripts. Both
trees were checked unchanged afterwards. wasmrt itself passes all three.

| sweep | wazmrt 1.0.3 | binaryang (`main` at the time) |
| --- | --- | --- |
| feature-gate (22 rows) | **3 accept with the proposal off**: `(table i64 …)` with memory64 off (and there is no separate `table64` flag); `call_ref` with function-references off **while GC is on** (refused once GC is off too, so GC implies function-references there). ⚠️ *Corrected the same day:* this first said "a dependency rule the contract does not state". That was read from wasmrt's copy, which is still at **v10**. wazmrt's **v30** (2026-09-21) makes `--features` take wasm-tools' vocabulary *with wasm-tools' meanings*, each dependency enforced on the module, and wasm-tools refuses this module. So the binary **appears to breach v30**, unless it predates v30 (both are dated 2026-09-21; unverified); the table-initializer form even with function-references AND GC off | **3 accept**: multi-value, reference-types and the table-initializer form, even with a plain `--disable-…` (flag order verified not to be the cause) |
| index-type (23 × 2, and past 2^32) | PASSED | not run: no interpreter, and the typing half would need a new harness |
| differential fuzz (300 + 1,200) | **refuse-valid 12**: all `ConstantExpressionRequired`, and a probe isolates **operand-stack depth > 8** (depth 8 accepted, 9 refused; wasm-tools and wasmrt accept to 64). That is wasmrt's day-6 defect; that all 12 are this cause is probable, not verified per case. **accept-invalid 3**: element-segment flags `0x41`, `0x4b`, `0x0d` (the spec allows 0–7) reported "validation: OK". A minimal flags-`8` module IS refused, so the mechanism is unverified | refuse-valid 0; **accept-invalid 2** ("func 0 failed to validate"; "invalid value type" at `0x3b`) |

**I8, `(@custom "name" …)`**: with no identifiers in the module, wasm-tools, wasmrt, wazmrt and
binaryang all emit one `name` section, the annotation. **With identifiers too (`$m`, `$f`), wasm-tools
and binaryang still emit ONE (the annotation), while wasmrt and wazmrt emit TWO** (the annotation,
then a generated one; byte-identical between the runtimes). Two `name` sections are legal and still
validate, but a reader picks one, and `.wat` pin digests move. **The runtimes are the losers**
(the row's own wording). ✅ **wasmrt FIXED it the same day with the H13 batch**: the annotation is now
the only `name` section, byte-identical to wasm-tools' output and pinned by
`an_annotated_name_section_is_the_only_name_section`. wazmrt still writes two (measured on its
2026-09-21 build). The pins still agree corpus-wide, because no corpus file has the shape.

**I7**: no wasmrt assembler commit since 2026-09-20, so the workspace's 2026-10-22 figures describe
current source. ⚠️ **But the workspace harness (`tools/assembler-parity/measure.ts`) runs
`wasmrt/target/release/wasmrt.exe`, a STALE build** (2026-09-20 12:50). cargo's target directory on
this host is elsewhere. Whether that build includes 2026-09-20's assembler fix is unverified, so the
harness should run the current build.

## 🆕 2026-10-24 — contract v33 makes D1/D2 the MEANING of `--features`

v32 aligned `--features` with D2's names; **v33 adds the meanings** (owner: *"aligning with binaryang
means its meanings also"*): which feature gates an instruction follows D1's `feature` column, and the
preset and dependency rules follow D2. Two findings follow from reading the definitions against that
(measured 2026-10-24):

* **D2 has no dependency or preset rules** — not in the vendored D2 `1.0.0` (binaryang v1.14.0), and
  not in binaryang's current tree (D2 `1.1.0`, v1.17.0). So there is nothing yet to follow for the one
  live disagreement, `call_ref` under `all,-function-references`, where the three tools give three
  answers (`known-issues.md`, top).
* **D1's single `feature` column cannot say "needs function-references, not tail-call"** for
  `return_call_ref`, and says `tailCall`. All three tools accept it with tail-call off. This is the
  KNOWN entry in `definitions_check.rs`; it now matters more, because v33 makes D1 binding.
* The pin is behind: wasmrt vendors **v1.14.0**; binaryang is at **v1.17.0**. Re-pin with the D2
  migration, not before, so the vocabulary moves once.

## What the workspace is asked to take (draft — nothing is written there from here)

1. **To binaryang (via a letter):** D1 `return_call_ref` is gated under tail-call, where wasm-tools
   needs function-references only — 🆕 binding since v33, so it would turn a correct acceptance into
   a refusal in both runtimes. 🆕 **D2 needs dependency and preset rules** before the v33 migration
   can settle `call_ref`. Also its validator's three accepted gate rows and two fuzz accept-invalid
   cases, as observations to triage.
2. **To wazmrt:** ~~the table64 gate~~ ✅ fixed in wazmrt 2.0.0 (v33 re-measured, and wasmrt
   confirmed: all three refuse); ~~the table-initializer gate~~ ✅ fixed (v33); `call_ref` with GC on
   and function-references off is still admitted (measured on 2.0.0; v33 calls it a D2 question);
   const-expr depth > 8 and the element flags are NOT re-measured since the 2026-09-21 build.
3. **To the workspace:** I8 measured (the runtimes lose); the harness binary path; I5/I6 for wasmrt as
   above. ~~Canonical rule 5.2 names the development drive by its letter~~ ✅ the workspace changed
   it on 2026-10-24 (its letter H23), and wasmrt's copy is exact again.
