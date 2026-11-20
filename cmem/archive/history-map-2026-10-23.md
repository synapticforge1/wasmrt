# history-map-2026-10-23.md — old → new commit ids after the drive-path purge

**On 2026-10-23 the whole history was rewritten to remove personal drive paths** (owner: *"fix the
old drive paths in the git history"*; workspace letter H19, path half only — the commit email is
kept by owner decision, `roadmap.md` track B). **Every commit id changed. Any id quoted elsewhere in
`cmem/`, in a commit message, or in a sibling's memory from before that day is an OLD id: look it
up here.** Commits made after the rewrite are not listed.

What changed: four literal strings, in four files, in 123 of 204 historical file versions, and one
line of one commit message. Each became the form the tip already used: the vendored testsuite path →
`../wasmtk/tests/module/wasm_wast/testsuite-main/`, the old rsxtk checkout → `../rsxtk`, the old
loaders checkout → `../universalWasmLoader`. Verified before the push:

* 217 commits before and after; the tip TREE is byte-identical (`f44f8bd75d5f`).
* Trees with a path: 213 → **0** (the original count is the positive control). Message lines: 1 → **0**.
* Author, author email, committer, committer email and both dates identical on all 217.
* Every tag differs from its original in the path lines only (2 or 4 changed lines each).
* The three published crates contain no `cmem/` or `docs/` file (`cargo package --list`), so no
  crate CONTENT is affected. ⚠️ **crates.io's `.cargo_vcs_info.json` for 0.2.0–0.9.0 keeps naming the
  OLD commit, forever** (immutable): use the tag table below.
* Pushed with a lease on each of the 18 refs (`main` + 17 tags). The 8 GitHub Releases
  (v0.6.4–v0.8.0) are still published, now on the moved tags. No workflow fired: GitHub creates no
  tag event when more than three tags are pushed at once. v0.9.0 has no GitHub Release; its run
  had already failed on 2026-08-06 (`releasing.md`).
* ⚠️ **Not in our control:** GitHub can serve the old commits by id until its own garbage
  collection; forks and caches may keep them. A full purge is a GitHub Support request (owner).
* The pre-rewrite history is kept privately as a git bundle in the gitignored `cmem/local/backups/`.
  **Never push from an old clone**: re-clone, or `fetch --force --tags` + `reset --hard origin/main`.

## Tags (old → new)

| tag | old | new |
| --- | --- | --- |
| `v0.2.0` | `5cead91cd006` | `148a8b0f8c2a` |
| `v0.3.0` | `aa8c9e6dab2d` | `8aabfd8d8c57` |
| `v0.4.0` | `5cfa2cd401d1` | `d0690585a4e5` |
| `v0.5.0` | `217651d3e10a` | `f50d4d449f72` |
| `v0.6.0` | `afc44d79534e` | `d2b8d3a296be` |
| `v0.6.1` | `400833ecdb07` | `830464ea1729` |
| `v0.6.2` | `f1f745655854` | `51aa09936828` |
| `v0.6.3` | `afb2cc94bea8` | `e59e3461010a` |
| `v0.6.4` | `09f7e13674b2` | `d02ccea35524` |
| `v0.6.5` | `3d308b7f842a` | `24f355b90884` |
| `v0.6.6` | `76d59300a060` | `809d2bef29f0` |
| `v0.6.7` | `74bedd40ccfb` | `c3bdc905ec43` |
| `v0.6.8` | `741c51cfa77b` | `83d94691239d` |
| `v0.6.9` | `2595b5346d12` | `68831149380c` |
| `v0.7.0` | `489204c9a6bc` | `171f303a3a77` |
| `v0.8.0` | `81d1c241246d` | `1bcab1b09056` |
| `v0.9.0` | `a7abd83012e7` | `bc1f7ca115fc` |

## Every commit (old → new, oldest first)

```text
6dc00b7d548d  20acc4677e56  2026-07-17  Initial commit
e7b1e2a77ee2  e8a23a1d1b7e  2026-07-17  docs: seed project memory + wazmrt port design notes + oracle monitor
1a2ea67b317a  c033ec7bf93a  2026-07-17  docs(CLAUDE): record GitHub remote; keep project memory synced
8beb1a05ddb8  655a972f1dc2  2026-07-17  scaffold: mirror wazmrt project structure (cmem/, licenses, bench/examples/tests)
95ca8f3b0a3c  9909868da21d  2026-07-27  docs(cmem): open the port gate — wazmrt frozen at parity, start the conversion task list
c01063d22a15  303bd8249ce8  2026-07-27  docs(cmem): finish the freeze sweep — clear remaining stale gate/scope refs
73cbb4d2a68a  0850a8907035  2026-07-27  feat(scaffold): T0 — 3-crate Rust workspace, dual-target build green
2bc96c575363  0879d4338211  2026-07-27  docs(release): version-progression mechanism + public progress trackers
5cead91cd006  148a8b0f8c2a  2026-07-28  [v0.2.0] feat(core): T1 — types + reader (v0.2.0)
aa8c9e6dab2d  8aabfd8d8c57  2026-07-28  [v0.3.0] feat(core): T2 — shared opcode IR table + body decoder (v0.3.0)
5cfa2cd401d1  d0690585a4e5  2026-07-28  [v0.4.0] feat(core): T3 — module decode + CLI summary (v0.4.0)
74650868172f  f4b4c42ed553  2026-07-28  docs(cmem): sync project memory to T0–T3 done (v0.4.0)
217651d3e10a  f50d4d449f72  2026-07-31  [v0.5.0] feat(core): T4 — validator, core language (v0.5.0)
afc44d79534e  d2b8d3a296be  2026-07-31  [v0.6.0] feat(core): T5 first slice — interpreter, integer compute (v0.6.0)
400833ecdb07  830464ea1729  2026-07-31  [v0.6.1] feat(core): T5 slice 2 — float arithmetic (v0.6.1)
c0238b5255e0  ada50893d2b8  2026-07-31  docs(cmem): sync project memory to v0.6.1 (decode→validate→run all working)
f1f745655854  51aa09936828  2026-07-31  [v0.6.2] feat(core): T5 slice 3 — linear memory (v0.6.2)
d39b4e50691a  8d757f88e44b  2026-07-31  docs(cmem): sync project memory to v0.6.2 (linear memory)
afb2cc94bea8  e59e3461010a  2026-07-31  [v0.6.3] feat(core): T5 slice 4 — tables + reference types (v0.6.3)
c27cc223d038  c37a62456545  2026-07-31  docs(cmem): sync project memory to v0.6.3 (tables + reference types)
0cfb188bdad3  d30151c872cc  2026-07-31  feat(core): T5 slice 5 — WasmGC (v0.6.4)
09f7e13674b2  d02ccea35524  2026-07-31  [v0.6.4] ci: add tag-triggered GitHub Release workflow
3d308b7f842a  24f355b90884  2026-07-31  [v0.6.5] feat(core): T5 slice 6 — SIMD (v0.6.5)
76d59300a060  809d2bef29f0  2026-07-31  [v0.6.6] feat(core): T5 slice 7 — multi-memory (v0.6.6)
5ad0e192f663  5fa9b9b37bcd  2026-07-31  docs(cmem): mark v0.6.5 + v0.6.6 published (releasing status)
74bedd40ccfb  c3bdc905ec43  2026-07-31  [v0.6.7] feat(core): T5 slice 8 — threads/atomics (v0.6.7)
32f72a5be6f5  ff2d64905c06  2026-08-03  feat(core): T5 slice 9 — memory64 (v0.6.8)
741c51cfa77b  83d94691239d  2026-08-03  [v0.6.8] docs(cmem): mark v0.6.7 published (releasing status)
df432c73f321  a3b2756aad14  2026-08-03  docs(cmem): mark v0.6.8 published (releasing status)
2595b5346d12  68831149380c  2026-08-03  [v0.6.9] feat(core): T5 slice 10 — exception handling (v0.6.9)
5c1a32fee95f  6eb145bdae2c  2026-08-03  docs(cmem): mark v0.6.9 published (releasing status)
8a37795ec334  8d13e21c358c  2026-08-03  feat(validate): the deferred SIMD / atomics / GC / EH typing arms (T4 complete)
5e82d08a4735  76f5d1b50e0a  2026-08-03  feat(sexpr): S-expression front-end for .wat/.wast (T6a)
5fd58bd035a3  5f62b3e3f957  2026-08-03  feat(opcode): text-format name table + reverse map (T6b, the deferred T2 table)
523ad3d7daad  5928d1282b59  2026-08-03  feat(wat): the WAT assembler — module fields, sections, core instructions (T6b)
6d8d56cb9657  2007a24cc6ec  2026-08-03  feat(wat): float literals + multi-value block types (T6b-4)
bd6d7679566d  cf452baa85a5  2026-08-03  docs(cmem): checkpoint mid-T6 — record where v0.7.0 stands
bbb2bdd423b8  60f7823869d9  2026-08-04  feat(wat): SIMD (0xFD) and atomics (0xFE) text forms (T6b-5a)
6e24ef8aa58a  c8a37adf8c0e  2026-08-04  feat(wat): WasmGC and exception-handling text forms (T6b-5b)
3f3c2956a8da  0667ae05fec8  2026-08-04  feat(wast): the .wast script runner (T6c)
cc9ac686aeb0  d67929888481  2026-08-04  feat(cli): conformance runner + the fixes its first run found (T6 gate)
a50f2271e1a9  24e5897211b6  2026-08-04  release: v0.7.0 — text toolchain (T6) + the validator's deferred arms (T4)
489204c9a6bc  171f303a3a77  2026-08-04  [v0.7.0] docs(cmem): fix stale project memory left by the v0.7.0 sync
1fdc8835d261  98e5314f966e  2026-08-04  docs(cmem): mark v0.7.0 published (releasing status)
fdf5a38d985d  619fa2f6d8e5  2026-08-04  docs(cmem): record the safety directive — no unsafe constructs from Zig
981c6b69e22b  ce8ea4f2cf44  2026-08-05  feat(interp): host imports — the T7 foundation
9cf0cafd68b1  6527b4baed49  2026-08-05  docs(cmem): resolve T7's two decision gates + record T7a
76ac5853c61c  b5418e672d6c  2026-08-05  feat(wasi): WASI preview 1 — the non-filesystem surface + a ChaCha20 CSPRNG (T7c)
6f149d901e07  748697dc4bc1  2026-08-05  docs(cmem): record the measured correction — host imports did not move the skips
fa01ce00144a  ee15178a761d  2026-08-05  refactor(interp): the shared-store model — resources owned once, indexed per instance
e70c9013b7de  45961f3a7292  2026-08-05  feat(interp): module linking — wasm→wasm imports across a shared store (T7b)
303164144588  6199d4c94d42  2026-08-05  feat(wast): register + a spectest provider — the linking payoff, measured
143ed5c34cd0  b03c107adea4  2026-08-05  fix(interp): route every pool access through the instance's IndexMaps
a7d08606074f  51d81ef093bc  2026-08-05  feat(wasi): the sandboxed filesystem (T7c-2)
812d7d741df7  642729a0e37a  2026-08-05  chore(safety): make the no-unsafe directive mechanical, + the pre-T8 review
3503498b5ff3  f9377d5d11ad  2026-08-05  fix(wat,sexpr): the literal/text edges — and two silent-wrong-output bugs
81d1c241246d  1bcab1b09056  2026-08-05  [v0.8.0] release: v0.8.0 — WASI preview 1, host imports and module linking (T7)
3bc674740245  5fea984a3a99  2026-08-05  docs(cmem): mark v0.8.0 published (releasing status + INDEX + roadmap)
878f605a9a40  c1751c711888  2026-08-05  docs(cmem): log the 5 defects the wasmtk corpus surfaced + record the T7 gate
116faf20b501  f775fa30c068  2026-08-06  feat(features,interp): engine configuration — proposal gating + resource ceilings (T8a)
12871bda8eae  1fd0d23f674e  2026-08-06  feat(linker): name-based import resolution in core — and two silent-wrong fixes it surfaced (T8b)
ce3de3a71b34  560a778e57c8  2026-08-06  feat(capi): the wasmrt.h C ABI — finalized header + implementation (T8c/d/e)
a7abd83012e7  bc1f7ca115fc  2026-08-06  [v0.9.0] release: v0.9.0 — the wasmrt.h C ABI (T8)
26f8a5ebf6a9  56c927c8b167  2026-08-06  docs(cmem): mark v0.9.0 published + the C-ABI embedding guide
f1465acf624d  9a518eb3ad1b  2026-08-07  docs(cmem): full staleness audit — 10 corrections across every memory file
b1fd4c520498  e7769ece0ebe  2026-08-07  docs(roadmap): scope T9 from a measured audit — 2 NEW defects found
0c0a204e4a7f  143b0a0611e4  2026-08-07  docs(roadmap): add T10 (bug hunt + hygiene) and T11 (optimization review)
df4f6a08ff38  cec0ecfee97b  2026-08-07  docs(roadmap): add T12 — security review of the penetration surfaces
0c198d41431d  78de11de66eb  2026-08-07  fix(scripts): the oracle monitor's test check could not fail — plus a doc sweep
1d763a7b2cbf  2c0490b51b63  2026-08-07  T9 first pass: 6 correctness defects + the size and perf axes measured
048104d8ce42  749820f19327  2026-08-08  T9a#4 memory half: imported memories link — and assert_unlinkable finds imports were never type-checked
b94e336a5c83  455791272033  2026-08-08  Decoder strictness: make the decoder the stage that rejects a malformed binary — 99.0%
5d2150f7f1a2  2571afaf9d9c  2026-08-08  An InstanceId from another store reached THIS store's memory — silent wrong memory
7085254d867d  b3bfdec96e78  2026-08-08  Declared subtyping was never validated: 21 invalid modules were being accepted — 99.1%
12b660504992  42771d7bdd59  2026-08-08  Type canonicalisation: types were compared by index, the spec compares by structure
22fb063e969a  e3701c9e1d17  2026-08-08  docs: add T10a (the emitter audit) and T9h (a Store type registry) to the task list
eff377176ef5  d905e5d16a92  2026-08-08  T9h: cross-module type identity via a Store type registry — type-subtyping.wast reaches 72/0/0
0f3bd1e569a7  85a813a6c053  2026-08-08  Enforce the text format's own grammar: type-use clause order — block/if/loop reach 0 failures
f194373b707c  ac3689c4ccd1  2026-08-08  docs: add cmem/best-practices.md — the lessons this port paid for, with the defect that bought each
d967a73c4a18  68076c9b948c  2026-08-08  Apply the type-use rules at their other two sites — call_indirect.wast reaches 169/0/0
8947793ea007  f91a652b74bf  2026-08-08  T9a#4 complete: a funcref carries its owning instance, so imported tables can land — 99.3%
b7213f0f1c96  44a1dab55728  2026-08-08  T9a#5: GC constant expressions — logged cost 6, delivered 88
6e1b0497a45d  1ad39a3defe5  2026-08-08  docs: best-practices §1.1 said 'four times' but listed three — add the T9a#5 case
4d159d820cce  f9642ab5f16b  2026-08-08  T9a#7 trap backtraces — and the start function, which never ran
f4a70782fe33  acfc453babb6  2026-08-08  docs(cmem): finish the memory sync for T9a#7 — the files the pass invalidated
88e98b91308a  ce4ee09a0ea4  2026-08-10  The text format's source character set (§6.2/§6.3) — and a scope note that was wrong
6d693010af60  efa2b9c1c276  2026-08-10  T9a#8: the assembler did not know four instructions took immediates
10474d3159f3  37099550ee59  2026-08-10  docs(cmem): the three lessons T9a#8 bought, and the files it invalidated
5d07c965237d  e50cfff74253  2026-08-10  T9a#9 is NOT a defect — wasmrt is correct and the fixture is invalid
d0f253978d6f  9826877d2383  2026-08-10  fix: `wasmrt run` executed without validating — and so did the oracle
50fd42a14039  93dd11e5e016  2026-08-10  Match wasmtime's invalid-module diagnostic, byte-for-byte on the offset
75993bba6b69  7b5f181b41af  2026-08-10  Re-baseline the oracle to wazmrt@6b7795a; log two T12 sweeps
086831cab80e  161e3e9a2ae4  2026-08-10  docs(cmem): sync wasmrt's project memory to the validation + diagnostic work
ff5c57d3c09c  6ddc13f01e81  2026-08-10  Re-baseline the oracle to wazmrt@1507f48 (docs-only drift)
72994c7a175e  7541a22df57d  2026-08-10  Correct T12y: the oracle's skips are exFAT, not privilege — 493/493 on NTFS
b9d300fd8303  ee3a2fc5e76f  2026-08-10  Record the symlink-authority finding; re-pin oracle to wazmrt@4a6d745
1d477beda040  ea60416c15e8  2026-08-10  Deny symlink CREATION by default; `--allow-symlink` opts in
1799c101cca9  ea3f54359233  2026-08-10  docs(cmem): finish the memory sync for the symlink policy
364acbe9ff49  3b5388b86a26  2026-08-10  Make the shipped CLI standalone; document the distribution manifest
da10c1cead1c  e544ea0be9db  2026-08-10  Re-pin oracle to wazmrt@619d324 (docs-only: the distribution manifest)
51a0d33b0b6c  11fc5a04d269  2026-08-10  best-practices §2.2a: a stated BENEFIT is a hypothesis about someone else's code
b11e11a9c8e5  7def90aee540  2026-08-10  docs(cmem): record the two new core APIs in architecture.md
03b5c3b07074  9ea672bd284c  2026-08-11  fix(cli): run, wasi and summarize now accept .wat text, not only .wasm
e754413ecb21  c665127f9394  2026-08-11  docs: retire the wazmrt oracle -- wasmrt stands alone and competes on merit
04c209517d05  ca5f1b97df76  2026-08-11  docs(cmem): finish the anchor sweep -- and READ rsxtk instead of assuming it
30ef88123bb3  a368ad95285d  2026-08-14  docs(cmem): GC reference identity across a link — reported from wazmrt
0dd53b29aeed  3e728e80a53a  2026-08-14  fix(gc): a reference's TYPE lives in its owning module, not the reader's
47de54a639c7  0d0ed1a62a8c  2026-08-14  listing from wazmrt
f0b8a2912d9f  c41d78314d4c  2026-08-14  feat(interp): T9f tail calls -- and return_call_ref had been a FAKE one
b9f9cae52c9b  546f0f979caf  2026-08-14  docs(cmem): sync the memory to T9f -- tail calls, and what they exposed
134f0a1a82ad  e739010b6918  2026-08-14  docs(cmem): correct the wazmrt registry advice — wrong mechanism, stale on arrival
968aae480b03  e9255d02b5a8  2026-08-19  docs(cmem): borrow wazmrt's method a second time — and audit our own live claims
e11cf8943002  8c3ba597ad71  2026-08-19  docs: re-cut the ladder — 1.0.0 IS the conformance clear-out; review load-once vs pin
84c9b74ba00e  8f998fb6eff1  2026-08-19  docs(cmem): pin DECIDED — wazmrt's application, and swappable at the CLI + the checks
02454ca5ffd2  4500d677c9ff  2026-08-19  docs(cmem): open interop.md — the wasmrt/wazmrt swappability contract, v1
7ce0dcd298cd  c9c447f3f2a2  2026-08-19  docs(cmem): interop v2 — CLI options settled, and the iteration budget adopted
fba97efcfd41  215ffef27fbc  2026-08-19  docs(cmem): add the "coordinate" binding trigger — and record a collision it would have prevented
b2413fdbc8d3  0d3045ac94a7  2026-08-19  docs: NEITHER PROJECT EDITS THE OTHER'S FILES — contract v5, and v4's exception revoked
154d9c1c9a34  7119bccdd163  2026-08-19  docs(cmem): adopt interop v6 — the first run of the propose/adopt protocol
3815d8b4d207  64bb5928569e  2026-08-19  coordinate: run check 5 for the first time — five findings, two of them silent
feef1d590d0e  827478c19112  2026-08-19  coordinate: wazmrt holds the pen until we reach hardening; then stage-boundary gates
f28092e0f602  eb76ae3de0ee  2026-08-19  T13-0 first run: 300 skips are correct rejections, and the fix is not in the scorer
a2d4eea3823a  974506076ff9  2026-08-19  T13-0 complete: all 2,038 skips attributed — 80% are cascades, and the track order was wrong
acf2cc0aaf5d  d869e88f0482  2026-08-19  Seven in-scope WasmGC instructions are missing, in a proposal recorded as DONE
de079bb3c297  160bf67b7a66  2026-08-19  Implement the six missing WasmGC array bulk ops — +197 passes, -213 skips
21e684fcd272  bf8e42de1d8e  2026-08-19  coordinate: mirror interop v10 — and their H7 turns our F3 into a blocker
0dacbcb395c6  4e77e731130d  2026-08-19  Fix the flag-position defect: host flags in both positions, and no silent donation
f3dfe580841e  0816145e3d16  2026-08-19  Track T: table64 — 99.5%, and an identity conversion hid the emitter site
189d664616a9  629874c2119a  2026-08-19  Track T complete: table64 end to end — 62,796/306/1,466
ff434a2817dd  198d221f1557  2026-08-19  The assembler scoring split: +263 passes, no feature work — 63,059/310/1,199
c9548de0a4ed  4a8ba742405b  2026-08-19  T13-0 round 3: BadForm attributed — a THIRD feature wearing a parser error's name
e81e6a91a615  a36514558696  2026-08-19  Two in-scope text-format gaps: §6.5.2 label repetition and typed `select`
324856a8eea4  f33793d0ffc5  2026-08-19  br_on_non_null demanded a non-null operand — the idiom it exists for was rejected
e456b54b4ae9  3e64417d2f7b  2026-08-19  elem.wast to zero: the funcidx shorthand is NON-NULL, and encoding is not a type question
035549e9f3fe  e231118928cd  2026-08-19  binary.wast 4 failures -> 1: a named binary module, and a reftype field read as a valtype
c0beb739d6ad  1d248ccff1cc  2026-08-19  instance.wast to zero: module definition / module instance, and generativity is the point
d5fbb661fdba  2d05fe8b5f85  2026-08-19  The per-file gate was keyed on a non-unique name — seven files were being merged
0175844157c2  12019f44a037  2026-08-19  99.7%: the relaxed-SIMD `either` form, and three of four rounding ops kept a signalling NaN
e7df97c40b0a  80d7d739b6bc  2026-08-19  A named local aliased the parameter — silent wrong output inside func.wast's failure count
862cae8d1156  9f2e6aab7aeb  2026-08-19  A SIMD lane index admits no sign — and accept-invalid is now the biggest class
1d921dc067ff  09619925ce75  2026-08-19  Duplicate $names were accepted — a namespace rule enforced on the namespace
6e4a9591e7da  45ddf70ecc55  2026-08-19  An implicit type use reused a rec-group member — the assembler changed what the module meant
50b228596ac6  1aff5c067bd1  2026-08-19  The conformance gate had a second hole — and it hid three regressions I nearly shipped
4ad82c359bad  373be9c72478  2026-08-19  `(register "M")` after a named module registered nothing — +30 passes
531c16f22b4e  a9af7235859a  2026-08-19  memory.init read its operands backwards — wrote into the wrong memory
a051fd9763d1  153dfd41576c  2026-08-19  fix(wast): give every skip a REASON — 91% of them were one number's shadow
17fa84f9bc30  e355b7e56176  2026-08-19  docs(cmem): record T13 day 1 — 99.7%, and the skip census that re-scoped everything
909ae75aaa4a  94a9f0f34bff  2026-08-19  docs(cmem): FAILURES FIRST, THEN SKIPS (owner) — probed against our corpus, and it holds
56359c1a282e  e06ecf408367  2026-08-20  S1: the externref bridge — a representation first, then two opcode arms
2af1b5f55c41  df66f4d01fbf  2026-08-20  F1 — accept-invalid to ZERO, and two of them were wrong VALUES
69af6a26e143  933621900252  2026-08-20  F2/F3/F4 — and the assembler was not emitting WebAssembly
c56f751b5c10  bcea1d451ffb  2026-08-20  F5/F6 — core failures 23 -> 1, and three of them were wrong ANSWERS
b1e20779765b  ba5cb517b675  2026-08-20  F7 — the three hierarchy BOTTOMS, and CORE FAILURES REACH ZERO
923ab3a373fb  44ea88410dbe  2026-08-20  S2 + S3 — assert_exception, and imported TAGS link (with two defects behind them)
3e31b38be83e  96bfb1833409  2026-08-20  S6 + S7 — legacy `delegate`, and the inline-module abbreviation
c222d50d8e0d  b93eca35e1da  2026-08-20  the `get` action — and THE CORE SUITE REACHES 0 FAILED / 0 SKIPPED
5d3533215d1c  92e8ae10700e  2026-08-20  docs(cmem): T13 day 2 — the core suite is at 0/0, and the finding is not in the numbers
eb25531a6515  a3dc9d3d557f  2026-08-20  docs(cmem): the `anyfunc` question — PROBED, and the recollection was a different SURFACE
f016570c664d  ffee8c6d025f  2026-08-20  route the `anyfunc` refusal to the code that knows WHY — wazmrt's trap, and it bit here too
04a107a41d91  98a2e574fc75  2026-08-20  docs(cmem): scope the remaining proposal work — and scoping found a live defect
fff239d89774  b96694aaf76d  2026-08-20  docs(cmem): Track M/A triaged — 0 of 13 are threads defects, and it corrects a claim
0a747f92cb99  57f0e8595c09  2026-08-20  docs(cmem): DECIDED — refresh the vendored threads snapshot (owner, 2026-08-20)
62947446caab  41fddc4d3d3b  2026-09-17  X1 — refuse `(pagesize N)`, and the per-file gate could not see what it cost
b44b450305a1  146d3706be85  2026-09-17  a validity assertion stops at VALIDATION — the runner was taking it to the linker
9f2f083d5622  7c1da1d81a8d  2026-09-17  a segment may name its target with a BARE INDEX — and for `elem` we were assembling a different segment
a436ed5b0d06  79ae311b6c9f  2026-09-17  `spectest.shared_memory` — and one assertion had been passing for the wrong reason
247021873777  9ec6cf225f03  2026-09-17  X2 — the clause-coverage sweep, and T10a asked for the weaker half
1b54bb3da38d  78f7abd7dd20  2026-09-17  TRACK W — wide arithmetic, and the feature gate was a doc comment that lied
059ddcef86e8  c104925e4286  2026-09-17  T10b — the proposal list has THREE spellings, and Track W updated two of them
dd38305fa28f  2ddeba91712d  2026-09-17  docs(cmem): T13 day 3 — X1, X2, X3/T10b, the M/A residue and TRACK W
64609304653c  a375a3a5080d  2026-09-17  docs(cmem): the threads snapshot PATCHED (owner), and `Op`→u16 MEASURED
dc48bd0a8cff  ca597b7a29c7  2026-09-17  widen `Op` to u16 — for TAG SPACE, and the speed is a lead not a claim
dd2aee716558  6734cf021f68  2026-09-17  move the internal tags out of the wire byte space — and the assembler was emitting `i32.trunc_sat_*` as an illegal opcode
809292aa01d6  3e13618d7de1  2026-09-17  docs(cmem): day 3 close-out — the `Op`→u16 move, the trunc_sat divergence, and the handoff
fa472c809e86  23e88afccdf7  2026-09-17  docs(cmem): Miri RUN and PASSED — 31/31, and the count on record was stale
178414c2938f  0207a244ce2d  2026-09-19  wast: a whole-module quote was always refused — and it was passing 6 assert_malformed it never reached
653d827a1f83  51112cb9a97c  2026-09-19  sexpr: keep @custom, @name and branch hints instead of discarding them as trivia
f8531866aab2  035f65ab4aaa  2026-09-19  wat: emit @custom, @name, $ids and branch hints as canonical tooling does — track A done
ea84f2c64a38  3823d91fd679  2026-09-19  capi: drop `rlib` from crate-type — it was keeping dead code in the shipped cdylib (-62%)
d5313e921177  55c8698d8524  2026-09-19  wat: one type-use authority for imports and tags — #4 closed, with wasmtime's own reason
3f0274638316  04c000ca251f  2026-09-19  track P: custom-page-sizes — every page-size site converted, byte-granular bounds cross-checked on wasmtime
8bc072b83961  145fc41ba26b  2026-09-19  docs(cmem): the threads-snapshot contradiction PATCHED (owner-directed); next is track D
530ddcdbc568  e4cd99ec82a8  2026-09-19  track D1: exact reference types — and the type-confusion hole found before it was reachable
6ea081d43e38  c327ab09afa0  2026-09-19  track D2: describes/descriptor — type identity carries the links, and 71 false passes removed
6d8f8682ddc5  0c6450a81522  2026-09-19  track D3/D4: the *_desc instructions — and the spec corpus at 64,598 / 0 / 0
3c49845dda33  da17c367b6c1  2026-09-19  decode: one reader for a value type in a function body — three defects, not the two logged
dff3781728a9  5d0de362cc96  2026-09-19  cli: the exit status is the verdict — coordinated with wazmrt (interop §2.3m)
efd0d52f0505  b02a77a4341a  2026-09-19  contract: owner decisions §2.4a (unknown flag) and §2.5 (Z3); Z1-Z3 handed to wazmrt
6d33e1e14630  23a730cf7844  2026-09-19  contract: narrow §2.4a — after the module path, a single dash is the guest's
39f16d0174fc  5eb8eecdd2c6  2026-09-19  coordinate: record that wazmrt folded in the PRE-narrowing §2.4a as v11
d2922d547943  15d675ae4e8c  2026-09-19  coordinate: the narrowing was relayed — wazmrt is adjusting (owner)
27f1452c2da7  c49234c2f279  2026-09-19  T9e: the pin gate, and the CLI converges on wazmrt's run modes
0c7bbe8566d4  fd217b594462  2026-09-19  T9i: the execution bound — one loop back-edge or one tail-call hop
061a9ac97df5  bc683cf00cb4  2026-09-19  docs: record T9e/T9i, the DB-path decision, and the .wat digest divergence
51254b9cf7ff  4e3de99579cc  2026-09-19  test: pin the anti-silent-disarm rule, the preopen separators and size parsing
0e67fce8d45e  a9e24f83dc21  2026-09-19  coordinate: Z4 and the T9e/T9i items are relayed to wazmrt (owner)
8a93e3feb4bc  d0d038a93119  2026-09-19  docs: 1.0.0 release prep is ON HOLD until wazmrt's contract copy settles
8ec7b52b1b57  40680f90ac37  2026-09-19  tooling: scripts are TypeScript (Deno/Bun), and no heredocs
28f3d97a6199  1d1866ef0a83  2026-09-19  docs(cmem): the session's lessons, the tooling pass, and the counts
14814fe4286d  6c965f0b2cd4  2026-09-19  docs: the conformance failure count is IN FLUX -- wasmtk is reverting the threads patch
765ee7b4a78f  0966b521b301  2026-09-19  fix: six issues a review found in the day's own work, five of them silent
52ca13cc7f93  bb1b7592849b  2026-09-19  fix(wasi): a sandbox escape, three allocation DoS cases, and six silent wrong answers
f2963fea1661  7d3e22b7cb86  2026-09-19  wast: a proposal snapshot must not be given features that POSTDATE it
ab13ba97568d  ff99f6f1f0da  2026-09-19  fix(decode): eight decoder defects, and a ninth the first fix exposed in the assembler
d9dd818a62cb  7354078184b0  2026-09-20  fix(validate): a validator review found eight, and two of them were not in the validator
aaa1f4b4e411  e0d0fe4d338d  2026-09-20  chore: line endings are LF, everywhere — a rule and a gate, not a coping branch
7d74517d1335  646963ae6581  2026-09-20  chore(eol): standardize on git's own form — LF — and give the rule a trigger
df774a517059  f08af04a4333  2026-09-20  docs(cmem): re-run the backlog instead of re-reading it — eight headings were stale
5614cdb8bc29  1799bba47142  2026-10-21  docs(cmem): the repo moved to the synapticforge1 organization
84b177500913  02a0fff46c1c  2026-10-21  docs: point every markdown link at the synapticforge1 organization
2833bb6ed226  2d018f6d9112  2026-10-21  chore(scripts): Bun only — Deno is going away
24cab6fd26e7  a108db9f535f  2026-10-21  docs: the remaining Deno-as-toolchain references now name Bun
78d31a50de97  184170b9d142  2026-10-21  docs(CLAUDE.md): read the workspace handoffs; new origin; Bun only
c9e838370d05  069ff9b0be16  2026-10-21  docs(cmem): record the 2026-10-21 housekeeping and the three items it left open
1d580b99b06b  09ccaf78830a  2026-10-23  chore: org-move references and the workspace-rule items that need no owner input
7c7aa43f94ed  8cced02cb981  2026-10-23  docs(cmem): adopt the one-time shell script rule; keep the personal commit email
38c28539e4a3  ba9d5dde6541  2026-10-23  docs(cmem): the workspace now records the commit-email exception
```
