<!-- Part of the wasmrt ⇄ wazmrt swappability contract (interop.md is its entry point and holds the CONTRACT VERSION).
     Split from the one file on 2026-11-25 by moving each section verbatim (owner: "perform the work on W3"). -->
# interop — §2.5 A validity claim must match the verdict

### 2.5 A validity claim in the output must match the verdict (Z3) · 🔒 **OWNER DECISION 2026-09-19** · ✅ **CONTRACT
VERSION 12 — FOLDED IN AND NUMBERED by the pen-holder (wazmrt, regime A), 2026-09-19**

> Owner, 2026-09-19: *"we also need a contract item for Z3"*.

**The rule.** No line a command prints may describe a module as **valid** unless it validated. The
exit status (§2.3), any verdict line, and any header or summary wording must **agree**. A summary that
prints before validation finishes must use neutral wording ("WebAssembly module", "wasm v1", section
counts), never "valid". **Only validity claims are in scope** (§0); the rest of the output text is not.

- summary of an INVALID module
  - wazmrt (measured 2026-09-19, 1.0.1): ⚠️ header `…: valid wasm v1, 4 section(s)`, then `validation: FAILED …`, rc 1
  - wasmrt: header `…: WebAssembly module (version 1)`, then `validation FAILED: …`, rc 1
  - status: ⚠️ **wazmrt must adopt** (the header)

wasmrt is pinned by `cli_exit_codes.rs::the_summary_never_calls_an_invalid_module_valid`. That test
**fails when wazmrt's header wording is injected into wasmrt's summary** (mutation-verified), so it
checks exactly this.

### 📬 2.5h — HANDOFF TO wazmrt (owner-directed, 2026-09-19)

Owner: *"lets pass all three issues to the wazmrt team."* Passed **through this file**, because §1a
forbids writing into wazmrt's tree. For wazmrt's own session to adopt in wazmrt's own commit:

- **Z1**
  - issue: an unmatched export name is silently ignored (rc 0)
  - contract item: §2.3, new row
  - wazmrt action: fail with rc 1 and name the export, when the argument can only be an export name
  - verify by running: `wazmrt m.wasm nosuch` → rc 1
- **Z2**
  - issue: unknown flags are ignored or misreported
  - contract item: **§2.4a** (owner decision, **as narrowed by v15**)
  - wazmrt action: `unknown flag`, rc 1, in every host-flag position — but after the module path **only for a
    `--flag`**: a single-dash token there is the guest's, and no "looks like" guessing anywhere (v14)
  - verify by running: `wazmrt m.wasm --bogus`, `wazmrt --bogus m.wasm` and `wazmrt s.wast --bogus` → `unknown flag`, rc
    1; `wazmrt m.wasm -- --bogus` **and `wazmrt m.wasm -la`** → untouched
- **Z3**
  - issue: the summary header says "valid" for an invalid module
  - contract item: **§2.5** (owner decision)
  - wazmrt action: neutral header wording until validation has passed
  - verify by running: `wazmrt invalid.wasm` → no line claims validity; rc 1

⚠️ **Z1 needs care on wazmrt's side.** Its bare path runs `_start` when the module exports one, so a
following word may be guest argv rather than an export name. The failure applies when the word **can
only be** an export name: the module has no `_start`, or the word is in the export position of an
explicit call form. How wazmrt draws that line is its design call; the observable requirement is only
*"never silently succeed at something other than what was asked"*.

#### ✅ 2.5h-a — THE HANDOFF IS ACCEPTED, AND ALL THREE RE-MEASURED BEFORE ACCEPTING (wazmrt, pen-holder, 2026-09-19)

⚠️ **The pen-holder did not fold these in on the strength of the annex.** §1 rule 4 says a row is
verified by **running both**, and that applies to a row arriving from the sibling exactly as it applies
to one this side wrote. All three were re-run here, on the same bytes, before any of them was numbered:

- **Z1**
  - invocation: `wazmrt valid.wasm nosuch`
  - wazmrt 1.0.1 (re-measured): **rc 0**, prints the summary; `nosuch` silently dropped
  - wasmrt 0.9.0 (re-measured): `run`: **rc 1**, *"no exported function `nosuch`"*
  - verdict: ⚠️ **confirmed — wazmrt in breach**
- **Z2**
  - invocation: after the path (`m.wasm --bogus`)
  - wazmrt 1.0.1 (re-measured): **rc 0** — handed to the guest
  - wasmrt 0.9.0 (re-measured): **rc 1**, `unknown flag`
  - verdict: ⚠⚠ **confirmed**
- **Z2**
  - invocation: before the path (`--bogus m.wasm`)
  - wazmrt 1.0.1 (re-measured): rc 1, but *"cannot read '--bogus': FileNotFound"*
  - wasmrt 0.9.0 (re-measured): **rc 1**, `unknown flag`
  - verdict: ⚠️ **confirmed — right code, wrong reason**
- **Z2**
  - invocation: `.wast` (`s.wast --bogus`)
  - wazmrt 1.0.1 (re-measured): **rc 0** — ignored
  - wasmrt 0.9.0 (re-measured): **rc 1**, `unknown flag`
  - verdict: ⚠⚠ **confirmed**
- **Z2**
  - invocation: guest position (`m.wasm -- --bogus`)
  - wazmrt 1.0.1 (re-measured): untouched, rc 0
  - wasmrt 0.9.0 (re-measured): untouched
  - verdict: ✅ **agreed — the carve-out works**
- **Z3**
  - invocation: `wazmrt invalid.wasm`
  - wazmrt 1.0.1 (re-measured): header `invalid.wasm: valid wasm v1, 5 section(s)`, then `validation: FAILED …`, rc 1
  - wasmrt 0.9.0 (re-measured): `invalid.wasm: WebAssembly module (version 1)`, then `validation FAILED: …`, rc 1
  - verdict: ⚠️ **confirmed — wazmrt in breach**

🔎 **And one thing the re-run adds, which is why re-running mattered: `wazmrt invalid.wasm bad` — the
CALL form on an invalid module — already exits 1.** Z1 is therefore **not** a general "wazmrt ignores the
export name" defect; it is specific to the **export-name lookup on a module that validates**. The word is
dropped only on the path where everything else succeeded, which is the narrowest and most deceiving
version of the bug: *the run that silently does the wrong thing is the one where nothing else went wrong.*

⚠️ **F1 IS STILL LIVE ON wasmrt, and the pen-holder verified it rather than taking the note on trust.**
`wasmrt valid.wasm nosuch` → **rc 0**, summarizes, drops the name — identical in shape to Z1. wasmrt's own
copy says so (§2.3, §2.1) and this is not a counter-charge; it is the reason the §2.3 row above is worded
as binding on **both** sides. 🎓 **wasmrt's compliance is via its `run` subcommand; its bare-path form is
in breach of the row it authored.** *A project is least likely to run a new check against the form it did
not have in mind when it wrote the check.*

🆕 **v15 RE-MEASURED THE SAME DAY (the narrowing arrived mid-pass), and it MOVED the line in both
directions:**

| invocation | mode | wazmrt | wasmrt | v15 requires |
| --- | --- | --- | --- | --- |
| `start.wasm -la` (`_start` present) | **has** guest argv | rc 0 — guest's | rc 0 — guest's | ✅ **both correct** — `-la` runs, no `--` needed |
| `start.wasm --bogus` | **has** guest argv | **rc 0** | rc 1, `unknown flag` | ⚠⚠ **wazmrt in breach** |
| `valid.wasm -la` (no `_start`) | **no** guest argv | **rc 0** | rc 1, `unknown flag` | ⚠⚠ **wazmrt in breach** — the carve-out does not apply |

🎯 **The middle and last rows are the whole point of measuring after a narrowing rather than assuming
it shrank the work.** v15 genuinely removed one obligation from wazmrt (`-la` with `_start`: already
right). ⚠️ **It removed nothing in a mode with no guest argv** — there, *every* argument is a host
position under §2.4a item 4, both dash forms, and wazmrt ignores single-dash tokens there today.
🎓 **An implementer reading only v15's headline — "after the path, one dash is the guest's" — would
apply it in summarize mode and ship a second Z2.**

📍 **Where wazmrt tracks the work: `cmem/roadmap.md` → Track B → B-b.** ⚠️ **Nothing is adopted in
wazmrt's code by this fold-in — deliberately.** §1d puts adoption at a track, and §1's other half
("coordinate BEFORE shipping a contract surface") is what this pass **is**: the rule is decided and
numbered first, then built. Adopting it inside a coordination pass would invert exactly the order that
§1d exists to enforce.

---

