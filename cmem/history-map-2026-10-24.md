# history-map-2026-10-24.md — old → new commit ids after the drive-letter purge

**On 2026-10-24 the history was rewritten a second time** (owner: *"Yes I want the history
rewrite"*), to remove machine specifics that the 2026-10-23 path purge did not cover: the
development volume's drive letter, the volume health query run against it, and the name of the
security agent installed on the machine. **141 of 230 commits changed id**, every
commit from the first one that carried the text. Ids quoted from before 2026-10-24 for those
commits are OLD: look them up below. For an id from before 2026-10-23, look it up in
[`history-map-2026-10-23.md`](history-map-2026-10-23.md) first, then here.

What changed: 14 exact phrases (anchored on the machine text, so grammar examples such as `C:/p` and
convention paths such as `C:\ProgramData\wasmtk\pins` were untouched) in five files, in 163 of
304 historical file versions, and in one commit message. Each became the generic wording the tip
already used. Verified before the push:

* 230 commits before and after; the tip TREE is byte-identical (`8a4f4488ec71`).
* Historical file versions with the text: 163 → **0** (the original count is the positive control).
  Messages: 1 → **0**. No other file in any commit carried it.
* Author, author email, committer, committer email, both dates and the subject identical on every
  commit, in order. The commit email is kept: the owner approved it in the author fields
  (2026-10-24).
* **No tag moved**: the text first appeared on 2026-08-10, after the last tag (`v0.9.0`,
  2026-08-06), so every released version, and every crate on crates.io, is unaffected.
* ⚠️ **Not in our control:** GitHub can serve the old commits by id until its own garbage
  collection; forks and caches may keep them. A full purge is a GitHub Support request (owner).
* The pre-rewrite history is kept privately as a git bundle in the gitignored `cmem/local/backups/`.
  **Never push from an old clone**: re-clone, or `fetch --force` + `reset --hard origin/main`.

## Commits (old → new)

```text
9826877d2383  df03ca3879bf  2026-08-10  fix: `wasmrt run` executed without validating — and so did the oracle
93dd11e5e016  07978d0ae851  2026-08-10  Match wasmtime's invalid-module diagnostic, byte-for-byte on the offset
7b5f181b41af  7bdcdde895f4  2026-08-10  Re-baseline the oracle to wazmrt@6b7795a; log two T12 sweeps
161e3e9a2ae4  97494f4ebda0  2026-08-10  docs(cmem): sync wasmrt's project memory to the validation + diagnostic work
6ddc13f01e81  191fae61f061  2026-08-10  Re-baseline the oracle to wazmrt@1507f48 (docs-only drift)
7541a22df57d  d5f18191ea52  2026-08-10  Correct T12y: the oracle's skips are exFAT, not privilege — 493/493 on NTFS
ee3a2fc5e76f  aba8ea76e952  2026-08-10  Record the symlink-authority finding; re-pin oracle to wazmrt@4a6d745
ea60416c15e8  1bbe74740af8  2026-08-10  Deny symlink CREATION by default; `--allow-symlink` opts in
ea3f54359233  c6ae079a26f8  2026-08-10  docs(cmem): finish the memory sync for the symlink policy
3b5388b86a26  0df2ffa334cd  2026-08-10  Make the shipped CLI standalone; document the distribution manifest
e544ea0be9db  180de914bb61  2026-08-10  Re-pin oracle to wazmrt@619d324 (docs-only: the distribution manifest)
11fc5a04d269  afc83bef1bff  2026-08-10  best-practices §2.2a: a stated BENEFIT is a hypothesis about someone else's code
7def90aee540  94d8d0d04953  2026-08-10  docs(cmem): record the two new core APIs in architecture.md
9ea672bd284c  09eb570f167d  2026-08-11  fix(cli): run, wasi and summarize now accept .wat text, not only .wasm
c665127f9394  59bea9ba6711  2026-08-11  docs: retire the wazmrt oracle -- wasmrt stands alone and competes on merit
ca5f1b97df76  23cde87a1f40  2026-08-11  docs(cmem): finish the anchor sweep -- and READ rsxtk instead of assuming it
a368ad95285d  b95c117a509e  2026-08-14  docs(cmem): GC reference identity across a link — reported from wazmrt
3e728e80a53a  73a0b1df4e79  2026-08-14  fix(gc): a reference's TYPE lives in its owning module, not the reader's
0d0ed1a62a8c  e2ac1f39a72a  2026-08-14  listing from wazmrt
c41d78314d4c  441a0c968940  2026-08-14  feat(interp): T9f tail calls -- and return_call_ref had been a FAKE one
546f0f979caf  3bd38ff83341  2026-08-14  docs(cmem): sync the memory to T9f -- tail calls, and what they exposed
e739010b6918  e6f3c6372b5a  2026-08-14  docs(cmem): correct the wazmrt registry advice — wrong mechanism, stale on arrival
e9255d02b5a8  4e16d84e8f02  2026-08-19  docs(cmem): borrow wazmrt's method a second time — and audit our own live claims
8c3ba597ad71  f6e40ee2a4b5  2026-08-19  docs: re-cut the ladder — 1.0.0 IS the conformance clear-out; review load-once vs pin
8f998fb6eff1  887083d7a747  2026-08-19  docs(cmem): pin DECIDED — wazmrt's application, and swappable at the CLI + the checks
4500d677c9ff  516c70b995a8  2026-08-19  docs(cmem): open interop.md — the wasmrt/wazmrt swappability contract, v1
c9c447f3f2a2  aa2769b8930e  2026-08-19  docs(cmem): interop v2 — CLI options settled, and the iteration budget adopted
215ffef27fbc  b5e8897ef541  2026-08-19  docs(cmem): add the "coordinate" binding trigger — and record a collision it would have prevented
0d3045ac94a7  c0c0b4398df9  2026-08-19  docs: NEITHER PROJECT EDITS THE OTHER'S FILES — contract v5, and v4's exception revoked
7119bccdd163  adf7613f166c  2026-08-19  docs(cmem): adopt interop v6 — the first run of the propose/adopt protocol
64bb5928569e  e3266d196089  2026-08-19  coordinate: run check 5 for the first time — five findings, two of them silent
827478c19112  68310030d6d1  2026-08-19  coordinate: wazmrt holds the pen until we reach hardening; then stage-boundary gates
eb76ae3de0ee  808825308c9d  2026-08-19  T13-0 first run: 300 skips are correct rejections, and the fix is not in the scorer
974506076ff9  c3ab39cfb5a1  2026-08-19  T13-0 complete: all 2,038 skips attributed — 80% are cascades, and the track order was wrong
d869e88f0482  3591f3eaee8c  2026-08-19  Seven in-scope WasmGC instructions are missing, in a proposal recorded as DONE
160bf67b7a66  354d083fef0b  2026-08-19  Implement the six missing WasmGC array bulk ops — +197 passes, -213 skips
bf8e42de1d8e  cb9cef58977e  2026-08-19  coordinate: mirror interop v10 — and their H7 turns our F3 into a blocker
4e77e731130d  bc1268953458  2026-08-19  Fix the flag-position defect: host flags in both positions, and no silent donation
0816145e3d16  d73be2bd7eea  2026-08-19  Track T: table64 — 99.5%, and an identity conversion hid the emitter site
629874c2119a  3a901852d992  2026-08-19  Track T complete: table64 end to end — 62,796/306/1,466
198d221f1557  17f7c27b8ece  2026-08-19  The assembler scoring split: +263 passes, no feature work — 63,059/310/1,199
4a8ba742405b  56fac3dd714e  2026-08-19  T13-0 round 3: BadForm attributed — a THIRD feature wearing a parser error's name
a36514558696  e63498d4b3a7  2026-08-19  Two in-scope text-format gaps: §6.5.2 label repetition and typed `select`
f33793d0ffc5  e30142ba84ab  2026-08-19  br_on_non_null demanded a non-null operand — the idiom it exists for was rejected
3e64417d2f7b  0422346c0fe3  2026-08-19  elem.wast to zero: the funcidx shorthand is NON-NULL, and encoding is not a type question
e231118928cd  d929566037db  2026-08-19  binary.wast 4 failures -> 1: a named binary module, and a reftype field read as a valtype
1d248ccff1cc  daaf0ccab11f  2026-08-19  instance.wast to zero: module definition / module instance, and generativity is the point
2d05fe8b5f85  34e674069726  2026-08-19  The per-file gate was keyed on a non-unique name — seven files were being merged
12019f44a037  14b85a7ce238  2026-08-19  99.7%: the relaxed-SIMD `either` form, and three of four rounding ops kept a signalling NaN
80d7d739b6bc  d7b5c1d71e3e  2026-08-19  A named local aliased the parameter — silent wrong output inside func.wast's failure count
9f2e6aab7aeb  09665445cf4a  2026-08-19  A SIMD lane index admits no sign — and accept-invalid is now the biggest class
09619925ce75  63ee02e08630  2026-08-19  Duplicate $names were accepted — a namespace rule enforced on the namespace
45ddf70ecc55  57aebf5cf18f  2026-08-19  An implicit type use reused a rec-group member — the assembler changed what the module meant
1aff5c067bd1  6b2d97de8806  2026-08-19  The conformance gate had a second hole — and it hid three regressions I nearly shipped
373be9c72478  41817bf0fbfa  2026-08-19  `(register "M")` after a named module registered nothing — +30 passes
a9af7235859a  0940ad928843  2026-08-19  memory.init read its operands backwards — wrote into the wrong memory
153dfd41576c  56f4f92329c5  2026-08-19  fix(wast): give every skip a REASON — 91% of them were one number's shadow
e355b7e56176  c441e2a011d3  2026-08-19  docs(cmem): record T13 day 1 — 99.7%, and the skip census that re-scoped everything
94a9f0f34bff  01768212cc36  2026-08-19  docs(cmem): FAILURES FIRST, THEN SKIPS (owner) — probed against our corpus, and it holds
e06ecf408367  face2adad86a  2026-08-20  S1: the externref bridge — a representation first, then two opcode arms
df66f4d01fbf  c34cd51ee4d2  2026-08-20  F1 — accept-invalid to ZERO, and two of them were wrong VALUES
933621900252  16ea41cb8bbd  2026-08-20  F2/F3/F4 — and the assembler was not emitting WebAssembly
bcea1d451ffb  14adb872387b  2026-08-20  F5/F6 — core failures 23 -> 1, and three of them were wrong ANSWERS
ba5cb517b675  e826ce30d26b  2026-08-20  F7 — the three hierarchy BOTTOMS, and CORE FAILURES REACH ZERO
44ea88410dbe  c715672bfab7  2026-08-20  S2 + S3 — assert_exception, and imported TAGS link (with two defects behind them)
96bfb1833409  7d45ea3d967e  2026-08-20  S6 + S7 — legacy `delegate`, and the inline-module abbreviation
b93eca35e1da  128624c60a80  2026-08-20  the `get` action — and THE CORE SUITE REACHES 0 FAILED / 0 SKIPPED
92e8ae10700e  b5c72444256e  2026-08-20  docs(cmem): T13 day 2 — the core suite is at 0/0, and the finding is not in the numbers
a3dc9d3d557f  1c4a9e21d238  2026-08-20  docs(cmem): the `anyfunc` question — PROBED, and the recollection was a different SURFACE
ffee8c6d025f  e3d7c2590245  2026-08-20  route the `anyfunc` refusal to the code that knows WHY — wazmrt's trap, and it bit here too
98a2e574fc75  d88d87053480  2026-08-20  docs(cmem): scope the remaining proposal work — and scoping found a live defect
b96694aaf76d  9b5080d19a24  2026-08-20  docs(cmem): Track M/A triaged — 0 of 13 are threads defects, and it corrects a claim
57f0e8595c09  5509fac66f29  2026-08-20  docs(cmem): DECIDED — refresh the vendored threads snapshot (owner, 2026-08-20)
41fddc4d3d3b  934e3a77471d  2026-09-17  X1 — refuse `(pagesize N)`, and the per-file gate could not see what it cost
146d3706be85  1c639ac06c6f  2026-09-17  a validity assertion stops at VALIDATION — the runner was taking it to the linker
7c1da1d81a8d  580bf62dc364  2026-09-17  a segment may name its target with a BARE INDEX — and for `elem` we were assembling a different segment
79ae311b6c9f  22b4c2066603  2026-09-17  `spectest.shared_memory` — and one assertion had been passing for the wrong reason
9ec6cf225f03  8f21b4a82475  2026-09-17  X2 — the clause-coverage sweep, and T10a asked for the weaker half
78f7abd7dd20  1081981097ac  2026-09-17  TRACK W — wide arithmetic, and the feature gate was a doc comment that lied
c104925e4286  599899db656c  2026-09-17  T10b — the proposal list has THREE spellings, and Track W updated two of them
2ddeba91712d  90b16f5b0383  2026-09-17  docs(cmem): T13 day 3 — X1, X2, X3/T10b, the M/A residue and TRACK W
a375a3a5080d  c0e8556d81d0  2026-09-17  docs(cmem): the threads snapshot PATCHED (owner), and `Op`→u16 MEASURED
ca597b7a29c7  691930a45047  2026-09-17  widen `Op` to u16 — for TAG SPACE, and the speed is a lead not a claim
6734cf021f68  0f782fbb2db7  2026-09-17  move the internal tags out of the wire byte space — and the assembler was emitting `i32.trunc_sat_*` as an illegal opcode
3e13618d7de1  4fcd26a04be7  2026-09-17  docs(cmem): day 3 close-out — the `Op`→u16 move, the trunc_sat divergence, and the handoff
23e88afccdf7  b29955a014fb  2026-09-17  docs(cmem): Miri RUN and PASSED — 31/31, and the count on record was stale
0207a244ce2d  82b4d75aea71  2026-09-19  wast: a whole-module quote was always refused — and it was passing 6 assert_malformed it never reached
51112cb9a97c  1055c324f49a  2026-09-19  sexpr: keep @custom, @name and branch hints instead of discarding them as trivia
035f65ab4aaa  63c6856a9d3d  2026-09-19  wat: emit @custom, @name, $ids and branch hints as canonical tooling does — track A done
3823d91fd679  333f9620f702  2026-09-19  capi: drop `rlib` from crate-type — it was keeping dead code in the shipped cdylib (-62%)
55c8698d8524  e6a2911587c9  2026-09-19  wat: one type-use authority for imports and tags — #4 closed, with wasmtime's own reason
04c000ca251f  0c4aea958fd4  2026-09-19  track P: custom-page-sizes — every page-size site converted, byte-granular bounds cross-checked on wasmtime
145fc41ba26b  29d3ba8603f7  2026-09-19  docs(cmem): the threads-snapshot contradiction PATCHED (owner-directed); next is track D
e4cd99ec82a8  0ee4a09c2347  2026-09-19  track D1: exact reference types — and the type-confusion hole found before it was reachable
c327ab09afa0  b149f0262f26  2026-09-19  track D2: describes/descriptor — type identity carries the links, and 71 false passes removed
0c6450a81522  3860dd6e1ba8  2026-09-19  track D3/D4: the *_desc instructions — and the spec corpus at 64,598 / 0 / 0
da17c367b6c1  76e77ec770a7  2026-09-19  decode: one reader for a value type in a function body — three defects, not the two logged
5d0de362cc96  aba8837763b8  2026-09-19  cli: the exit status is the verdict — coordinated with wazmrt (interop §2.3m)
b02a77a4341a  187a5d3b9a49  2026-09-19  contract: owner decisions §2.4a (unknown flag) and §2.5 (Z3); Z1-Z3 handed to wazmrt
23a730cf7844  dbbaf74c20ff  2026-09-19  contract: narrow §2.4a — after the module path, a single dash is the guest's
5eb8eecdd2c6  ab83f0012d76  2026-09-19  coordinate: record that wazmrt folded in the PRE-narrowing §2.4a as v11
15d675ae4e8c  92185c631f72  2026-09-19  coordinate: the narrowing was relayed — wazmrt is adjusting (owner)
c49234c2f279  4775fd2bcd5a  2026-09-19  T9e: the pin gate, and the CLI converges on wazmrt's run modes
fd217b594462  078633eecc8d  2026-09-19  T9i: the execution bound — one loop back-edge or one tail-call hop
bc683cf00cb4  b396486d192a  2026-09-19  docs: record T9e/T9i, the DB-path decision, and the .wat digest divergence
4e3de99579cc  97b610c9fe7d  2026-09-19  test: pin the anti-silent-disarm rule, the preopen separators and size parsing
a9e24f83dc21  479ad0aaa6a7  2026-09-19  coordinate: Z4 and the T9e/T9i items are relayed to wazmrt (owner)
d0d038a93119  53d11c6b9c1e  2026-09-19  docs: 1.0.0 release prep is ON HOLD until wazmrt's contract copy settles
40680f90ac37  cdebf8a28101  2026-09-19  tooling: scripts are TypeScript (Deno/Bun), and no heredocs
1d1866ef0a83  7adfeb74740d  2026-09-19  docs(cmem): the session's lessons, the tooling pass, and the counts
6c965f0b2cd4  08be6f17f5ef  2026-09-19  docs: the conformance failure count is IN FLUX -- wasmtk is reverting the threads patch
0966b521b301  6252cb084f79  2026-09-19  fix: six issues a review found in the day's own work, five of them silent
bb1b7592849b  439fd58294fb  2026-09-19  fix(wasi): a sandbox escape, three allocation DoS cases, and six silent wrong answers
7d3e22b7cb86  c75060dbc464  2026-09-19  wast: a proposal snapshot must not be given features that POSTDATE it
ff99f6f1f0da  01d0dc42529d  2026-09-19  fix(decode): eight decoder defects, and a ninth the first fix exposed in the assembler
7354078184b0  bc50fa79daed  2026-09-20  fix(validate): a validator review found eight, and two of them were not in the validator
e0d0fe4d338d  e25e70d580fc  2026-09-20  chore: line endings are LF, everywhere — a rule and a gate, not a coping branch
646963ae6581  2846aabd6054  2026-09-20  chore(eol): standardize on git's own form — LF — and give the rule a trigger
f08af04a4333  aaf98caf1631  2026-09-20  docs(cmem): re-run the backlog instead of re-reading it — eight headings were stale
1799bba47142  ab3480b5c694  2026-10-21  docs(cmem): the repo moved to the synapticforge1 organization
02a0fff46c1c  00a683c7d5a3  2026-10-21  docs: point every markdown link at the synapticforge1 organization
2d018f6d9112  abbf341eb8f7  2026-10-21  chore(scripts): Bun only — Deno is going away
a108db9f535f  8c18a81aca33  2026-10-21  docs: the remaining Deno-as-toolchain references now name Bun
184170b9d142  826460e4faf6  2026-10-21  docs(CLAUDE.md): read the workspace handoffs; new origin; Bun only
069ff9b0be16  cf7c07a8e9ca  2026-10-21  docs(cmem): record the 2026-10-21 housekeeping and the three items it left open
09ccaf78830a  5a4a41c458f0  2026-10-23  chore: org-move references and the workspace-rule items that need no owner input
8cced02cb981  9110a314c935  2026-10-23  docs(cmem): adopt the one-time shell script rule; keep the personal commit email
ba9d5dde6541  c932a071bc3e  2026-10-23  docs(cmem): the workspace now records the commit-email exception
23b31997325a  e2f0de97aa6d  2026-10-23  docs(cmem): record the 2026-10-23 drive-path history rewrite
0d14bc0f40c5  aa85f34d348b  2026-10-23  bench: first same-machine comparison against wasmtime, Bun and Deno
cff2f7d250b6  8b88d97ed23a  2026-10-23  docs(cmem): T11 direction - Bun is the JS baseline, wasmtime the long-run target
e7e08d37309d  836ce7ea6405  2026-10-23  feat(definitions): generated copy of binaryang's D1/D2/D3, and wasmrt held to it (H8, H10)
38ea7e5c5434  8d7a5af06db9  2026-10-23  chore(licensing): attribute wabt for the vendored instruction-table data
9e26948be37d  15dce6c8c634  2026-10-23  docs(cmem): the contract mirror is v11-v31; correct a v30 claim
28f2982d527c  ea18aea323d7  2026-10-23  feat(cli): mirror the contract to v31 and fix the three rows wasmrt breached
6c06f5d58029  53111f27ad54  2026-10-23  docs(interop): mirror contract v32; pause v30 as v32 directs
97d2d5559ee9  f95f48f7658b  2026-10-23  feat(wat): letter H13 - wasmrt's module bodies match wasm-tools byte for byte
188fe8a38d5f  6f68bab06999  2026-10-23  test(behaviour): letter H23 carry-forward (S1/S2/S3); fix MVP element segments
dc9b79e48cd7  8b259b9fbd46  2026-10-24  fix(cli): say "invalid module" once; indent wrapped --help lines
9b68625b35c9  569150e755a8  2026-10-24  docs(interop): mirror contract v33; record the review
c729d66e4774  c65db4b2fc96  2026-10-24  docs(cmem): move machine specifics out of the public records
```
