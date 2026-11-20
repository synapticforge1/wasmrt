# Best practices § 3.15 — the same word on two surfaces

wasmrt's own lesson § 3.15 and § 3.15a. Last verified: 2026-11-20. Split out on 2026-11-20 (memory guide, letter H38); the
sections below are moved verbatim.

## §3.15 — **THE SAME WORD ON TWO SURFACES IS TWO WORDS** (2026-08-20)

*(Numbered §3.11 until 2026-10-24, when it was renumbered because §3.11 also named an earlier rule; workspace letter H2.)*

*Bought by: the owner's `anyfunc` question, probed and answered in about twenty minutes.*

The owner asked whether refusing `anyfunc` was wrong, on the recollection that wazmrt had fixed it and
that it "matches the output of wasmtk, wazero, wasmer and bun" — possibly a Rust issue, since wasmtime
is Rust. **Probed rather than agreed with, and the answer is no — but the recollection was pointing at
something real, on a different surface.**

`anyfunc` exists in two places that have nothing to do with each other:

| surface | spelling | verdict |
| --- | --- | --- |
| **`.wat` text format** — `(table 4 anyfunc)` | renamed to `funcref` by reference-types | **malformed**; `obsolete-keywords.wast` asserts it |
| **JS WebAssembly API** — `new WebAssembly.Table({element:"anyfunc"})` | the original and still-required string | **mandatory** — V8 (node, deno) *rejects* `"funcref"` here |

`wasmtk/src/wast.ts:362` builds its spectest table with `element: "anyfunc"`, and it is **correct** to.
That is almost certainly the memory the question came from.

**What the measurement showed** (run, not read — the coordinate rule applied to a technical claim):

* **wazmrt (Zig, no Rust anywhere) refuses all three files**, with a *dedicated* `ObsoleteKeyword`
  error for `anyfunc` and `DuplicateName` for the duplicate locals. Its `known-issues.md` records the
  closure on **2026-08-17** and names **the same two ArtOfWebAssembly files** as the cost it accepted.
  So the sibling is not fixed to accept them — it converged on the same refusal, nine days earlier.
* **wazero has no text front end at all** — it answers `invalid magic number` for a `.wat`, because it
  reads it as a binary. It has no opinion on either question.
* **bun / node / deno** consume binaries; their `anyfunc` is the JS-API string above.
* **wasmer** rejects both, but it uses the same Rust `wat` crate family as wasmtime, so it is
  *consistent* evidence, not *independent* evidence.
* **The spec testsuite is the anchor and settles it without any engine**: `obsolete-keywords.wast`
  asserts `anyfunc` malformed, and `func.wast` asserts `duplicate local` **three times** (param+param,
  param+local, local+local).

🎓 **Two lessons, and the second is the transferable one.**

1. **"Engine X accepts it" is only evidence if engine X has the front end you are asking about.** Four
   of the five runtimes named cannot parse `.wat` at all. Before quoting a runtime's behaviour as a
   cross-check, establish that it *has* the surface in question — otherwise "it works there" means
   only that it was never asked.
2. **A shared name across an API boundary will be recalled as one fact.** `anyfunc` in the JS API and
   `anyfunc` in `.wat` diverged when reference-types renamed the text form and the JS API kept the old
   string for compatibility. Anyone who has written both will remember "anyfunc is fine" and be right
   about the half they wrote. **Ask which surface before answering.**

⚠️ The cost of the refusal is unchanged and small: the `.wat` corpus reads 529/532, the three files are
not gated by any `cargo` step, and wazmrt paid exactly the same price for exactly the same reason.

### §3.15a — the trap inside it: **A REJECTION MUST BE ROUTED TO THE CODE THAT KNOWS WHY**

*(Numbered §3.11a until 2026-10-24, when it was renumbered because §3.11a also named an earlier rule; workspace letter H2.)*

*Reported by the owner from wazmrt's closure note, and it bit wasmrt too — checked because it was
reported, not assumed to be absent.*

wazmrt recorded that `isRefType` **still answers TRUE for `anyfunc`, deliberately**. Returning false
would route `(table 4 anyfunc)` down the func-index path, where `anyfunc` parses as a function NAME and
fails as `UnknownIdentifier` — which `wast.zig` banks as *its own* limitation. **The deviation would
have come back disguised as a SKIP and the baseline would have gone green for the wrong reason.**

wasmrt had the same slip in its own dialect. Dropping `"anyfunc"` from `string_to_val_type` also
dropped it out of the *routing* predicate `string_to_val_type(a).is_some()`, so two positions fell
through to the funcidx path and reported **`BadNumber`** — `anyfunc` read as an INDEX:

```
(elem (i32.const 0) anyfunc (ref.func $f))   -> BadNumber
(ref.null anyfunc)                           -> BadNumber
```

wasmrt's score was not corrupted — `BadNumber` is not in `is_unsupported()`, so it fails rather than
skips — but the *message* named the wrong thing, and the score being right was luck about one enum's
membership rather than design.

🔒 **The fix has two halves and both are load-bearing.** `is_type_keyword` (the routing predicate)
still claims an obsolete keyword, so the token reaches the code that can explain it; and
`Error::ObsoleteKeyword("funcref")` is a **dedicated** variant, so the message keeps the compatibility
hint even though the acceptance does not — *the input is legacy, not nonsense.* wazmrt made the same
two moves.

⚠️⚠️ **Enumerating the positions is what finished it.** Four were fixed on the first pass and the table
test found a **fifth**: `ref.null` reads a heap type through its own reader. Thirteen positions are now
pinned in one test, one row each, because a guard can be right in four places and wrong in one —
which is T12z's rule (*name an invariant, enumerate EVERY entry point in a table, check each*) paying
off in a place nobody had listed as a surface.

