# Tooling rules

The owner's tooling rules: Bun scripts, no heredoc, the edit discipline. Last verified: 2026-11-20. Split out on 2026-11-20 (memory guide, letter H38); the
sections below are moved verbatim.

## 🔒 TOOLING RULES (owner, 2026-09-19) — scripts are TypeScript, and no heredocs

### 1. Every script is TypeScript, run by **Bun** — **no bash, NO PYTHON, and no longer Deno**

🆕 **BUN ONLY from 2026-10-21 (owner): *"from this point further utilize bun scripts, since deno is
going away."*** Run every script, gate and throwaway helper as `bun <file>.ts`. Nothing in `scripts/`
had to change: all nine files use `node:` builtins only, and each one builds under Bun 1.4.3 (`bun
build --target=bun`, measured 2026-10-21). **Keep it that way — no `Deno.*` API, no `jsr:` or
`https://deno.land` import**, so nothing comes back that needs the runtime that is going away. Where
the text below says "Deno or Bun", read **Bun**; it is kept as the record of the 2026-09-19 rule.
**Why Deno is going away** (taken from binaryang's record, not re-measured here:
`../binaryang/cmem/jsr-deno-exit-guide.md` §1): on 2026-10-09 the Deno team announced it is
joining Cloudflare. The runtime gets about a year of maintenance releases, so development ends
around 2027-10 (an inferred date). binaryang started moving to Bun on 2026-10-12. wasmrt's own
exposure was small: only the gate scripts ran on Deno, and they already used `node:` builtins.

🆕 **WORKSPACE AMENDMENTS, 2026-10-22 (letter H15, `../workspace/cmem/working-rules.md` § Tooling rule 1),
recorded here 2026-10-23.**
* **A committed script uses the repo language's own scripting mechanism, else TypeScript on Bun.**
  A mechanism that has to **build an executable** to run the script does not count. So **Rust →
  Bun**; the owner also calls `cargo -Zscript` "a moving target". Nothing changes here.
* **A port replaces its TypeScript original only after an output diff proves them equivalent**:
  same inputs, compare the files written, stdout and exit code, include one input that must fail,
  and record the comparison in the commit. The 2026-09-19 gate ports below already met this bar.
* **Conformance, measured 2026-10-23:** `git ls-files` shows no `.sh`, `.ps1`, `.bat`, `.nu`,
  `.mjs` or `.py`. The only shell is the `run:` blocks in `.github/workflows/release.yml`, which the
  workspace rule accepts (a `run:` block only launches commands). *(Since 2026-11-09 each one only
  launches `rustup`, `cargo install` or `bun`; the `awk` notes extraction moved into
  `scripts/github-release.ts`.)*
* 🔒 **A ONE-TIME script may be a shell script — ADOPTED here (owner, 2026-10-23: "adopt the
  looser one").** A script that is used once and then deleted may be PowerShell, bash, Bun or Rust,
  whichever fits. Three things still hold:
  1. It is **written to a file with `Write`**, never a heredoc, `-c` / `-e` string or `-F -` (§2).
  2. It lives in the scratchpad, not the repo. **If it is needed again, it is ported to a `.ts`
     before it is committed.**
  3. **No host Python, ever.** The workspace rule keeps that ban (a Store stub that hangs, and
     cp1252 stdout).

  This replaces the 2026-09-19 rule below that "every throwaway edit script" is a `.ts`. Because the
  damage below came from scripted edits that silently applied nothing, a one-time **edit** script
  must still assert that each match applied exactly once and read back what it changed (workspace
  Tooling rule 4). Language is not the safeguard; the assertion is.

🆕 **WORKSPACE AMENDMENTS, 2026-11-08 / 11-09 (letters H30, H31, H32; `../workspace/cmem/working-rules.md`
§ Tooling rules 9 and 10), recorded here 2026-11-09.**
* 🔒 **No `gh`, in CI too (owner, 2026-11-08: "just checking the repo is easier"; "yes change
  those").** Read what GitHub holds with `git ls-remote origin`, `git fetch`, or crates.io's public
  API. A task only GitHub's web UI can do is an OWNER item, never "blocked on gh". A workflow calls
  GitHub's REST API from a Bun step with the job's own `GITHUB_TOKEN`. **Done here 2026-11-09:**
  `release.yml`'s one call (`gh release create`) became `scripts/github-release.ts`; see
  `releasing.md` § Tooling.
* 🔒 **Every Bun-version notation is the latest installed Bun, always (owner, 2026-11-09: "update
  any notations on bun version to the latest installed version always").** Check `bun --version`
  before writing one; when the owner installs a newer Bun, the pins, setup lines and any minimum move at
  this repo's next session. A DATED measurement ("builds under Bun 1.4.3, measured 2026-10-21", above)
  stays as written until that test is re-run. **Measured 2026-11-09:** `bun --version` = 1.4.4 on
  Windows; `release.yml`'s two `bun-version:` pins are 1.4.4 *(since 2026-11-12: one `BUN_VERSION`
  1.4.4 + `BUN_SHA256`, used by four install steps)*; wasmrt declares no Bun floor; the
  remaining 1.4.3 lines (`design-decisions.md` §1, `testing.md`, `archive/roadmap-to-2.0.2.md`) are dated results.
* 🔒 **Every tagged release gets its GitHub Release page made BY CI (owner, 2026-11-09, H32), only
  for new tags (no backfill).** wasmrt has had this since v0.6.4; H30 changed how, not what.

**Owner's rule, restated 2026-09-19 because it was being honoured in `scripts/` and ignored
everywhere else:** *"python scripts not allowed either, only deno or bun"*. `scripts/` holds `.ts`
files. ~~**and so does every throwaway edit script a session writes**~~ *(superseded 2026-10-23,
above: a one-time script may be a shell script)*. The ad-hoc half is the half that gets skipped, and
it is where the damage happened (a `python -c` string executed backticks it should have quoted, and
mangled non-ASCII into a silent no-op). Not Python, and not a script passed as a string. For editing
source, prefer the `Edit` tool.

**The session's own helper is `edit.ts`**: a spec of `[file, [[find, replace], …]]` where every
`find` must match EXACTLY once or nothing is written and the run exits non-zero. JSON carries the
text verbatim, so no shell quoting touches it — which is what made the Python one-liners dangerous. Both runtimes are Rust-built (Bun since its
[Zig→Rust rewrite](https://bun.com/blog/bun-in-rust), merged 2026-05-14, shipped in 1.4), and both
are installed here. The scripts import from `node:` builtins only (`node:fs`, `node:child_process`,
`node:path`, `node:process`), so **one file runs under Bun or node**; **Bun is the runtime** (owner, 2026-10-21).

    bun scripts/c-gate.ts                  (was: deno run -A scripts/c-gate.ts — retired 2026-10-21)

🔻 **The four gates were ported on the day the rule landed** — `c-gate.sh`, `miri-gate.sh`,
`conformance-diff.sh` and `custom-sections-diff.py` — and each port was verified against the script
it replaced: **same verdict on the same inputs, and still FAILING when it should.** The
conformance gate was checked on all three regression shapes (lost passes, more failures, a clean
file that started failing) plus an honest improvement, with byte-identical output and exit status;
the custom-sections gate was run over the whole 535-file corpus for the same 531/4/0, and then
against an assembler wrapper that strips custom sections, which it must report as a difference.
⚠️ **That last check is the one that matters**: `conformance-diff`'s own header records two holes
that got in because the check was re-implemented ad hoc. A ported gate that quietly stops failing
is worse than no gate.

**Why, beyond the language:** the host's bash and Python have cost this project real time —
`python3` is a Store stub that HANGS (must be `python`), the working copy is CRLF so `\n`-only
`perl`/`sed` patterns silently fail to match, and see rule 2. One runtime removes all of it, and
wasmtk's own tooling is TypeScript already, so the scripts now match the consumer project.

### 2. ⛔ NO HEREDOCS — write the file, then run it

**Owner's rule, and it is about a failure mode, not a preference.** A heredoc (`<<EOF`,
`<<'PYEOF'`) that carries code into `bash`, `python -c` or `git commit -F -` goes through at least
two levels of quoting, and the failures are **silent or misleading**:

| what happened, in one session | result |
| --- | --- |
| a heredoc containing an apostrophe | `unexpected EOF while looking for matching quote` — the script never ran |
| non-ASCII (`—`, `§`, `’`) through `python -c` | mangled to `?` mid-string, so the anchor did not match and **the edit silently applied nothing** |
| backticks inside a double-quoted `-c` string | the shell EXECUTED them: a comment ended up reading *"a file called \"* |
| `\n` in a `perl -0pi -e` pattern against a CRLF file | matched nothing, and the mutation test then "passed" |

**The rule:** write the script to a file (the scratchpad, or `scripts/` if it is worth keeping) and
run the file. Editing source? Prefer the `Edit` tool, which matches exactly and fails loudly.
🎓 The cost of ignoring this is not a broken script — it is a script that reports success while
doing nothing, which is the silent-wrong class this project ranks worst (`best-practices.md` §3.1).

### 3. 🔒 Line endings are **LF**, everywhere, on every machine (owner, 2026-09-20)

*"if CRLF is what git wants, we need a rule for using it versus LF so this is a non issue"* — then
*"can we make the rule to standardize this on the git preference since we have no .bat or .sln files
in this project?"* **Yes, and that is the rule: LF, because LF is git's own canonical form.**

**Git's standard is not a preference, it is the storage format.** `gitattributes(5)`: *"When a
matching file is added to the index, the file's line endings are **normalized to LF in the index**.
Conversely, when the file is copied from the index to the working directory, its line endings **may
be converted** from LF to CRLF depending on the `eol` attribute, the Git config, and the platform."*
One direction only: LF is what a repository holds; CRLF is a working-tree rendering a checkout may
produce. Verified rather than quoted from memory — a throwaway repo, one CRLF file, three settings:

| committed | config / attributes | git STORED |
| --- | --- | --- |
| CRLF | `core.autocrlf=true` (this host's system default) | **LF** |
| CRLF | `core.autocrlf=false`, no attributes | CRLF |
| CRLF | `core.autocrlf=false`, `* text=auto` | **LF** |

CRLF reaches the object database only when *nothing* is configured to normalize — by omission, never
by design. So standardising on LF is not a house style over git's; it is **making the working tree
agree with what the repository already contains**, which is why normalizing twelve files recorded no
content change at all.

✅ **And nothing here wants the other direction**: the tracked tree is `.md`, `.rs`, `.wast`, `.ts`,
`.toml`, `.c`, `.h`, `.yml`, `.txt`, `.lock` — **no `.bat`, `.cmd`, `.ps1`, `.sln` or MSBuild
project**, the only file types with a real CRLF requirement. Measured, not assumed.

**What was actually true**, measured before deciding anything: all **111** tracked text blobs were
already **LF in the index**, while the working tree held **12 CRLF and 99 LF** files. Nothing in the
repo chose that split. `core.autocrlf=true` lives in this host's **system** gitconfig (the Git for
Windows installer writes it), so a file becomes CRLF when *git* checks it out and stays LF when a
tool writes it — which means **the same file has different endings depending on what touched it
last**, and no file records which.

**The rule, in four parts:**

1. **`.gitattributes`: `* text=auto eol=lf`.** `eol=lf` overrides `core.autocrlf`, so the working
   tree is LF on every machine with no per-developer git config, assumed or required.
2. **A TRIGGER: `crates/wasmrt-core/tests/line_endings.rs`** walks the repository under every
   `cargo test` and fails on any CR in a text file. The attribute alone is not enough — git enforces
   it at checkout and at commit, and **cannot stop an editor or a generator from writing CRLF into a
   file that then sits in the working tree looking normal**, which is precisely the gap the defect
   lived in. *A gate with no trigger is a preference* (`best-practices.md` §4.2), so this one runs
   with the test suite, like `regression_wast.rs`. Both it and the script below were proved able to
   fail by converting one tracked file back to CRLF.
3. **`scripts/eol-gate.ts`** is the same check plus `--fix` (it rewrites offenders) and it also
   inspects the **index**, which a file-walking test cannot see. Use it to repair; the test is what
   notices.
4. **Scripts match on `\n` and write `\n`.** No CRLF branch, no `\r?\n` defensiveness, no
   "normalize first" preamble.

⚠️ **A fixture that needs a real CR** — a lexer test for §6.2's source character set, say — builds it
from `\r` in Rust source or from bytes, and does **not** embed a raw CR in a checked-in file. A CR
that is content cannot be told from a CR that is an accident, and that ambiguity is what would force
the gate to become advisory.

⚠️ **Nothing here needs CRLF**: no `.bat`/`.cmd`/`.ps1`/`.sln`, a Rust + Bun toolchain, all
gates in TypeScript. A Windows-only script added later gets an explicit `*.bat text eol=crlf` line
rather than a relaxation of the rule.

🎓 **The cost this pays off.** Six mutation tests in one session silently applied nothing, because
their `\n` patterns could not match CRLF files — and a mutation that never applied is
indistinguishable from a gate that caught nothing (`best-practices.md` §8.1b). The old rule was
"every scripted edit must handle both endings and assert its own application". The second half still
stands; the first half is now unnecessary, which removes the branch people forget to write.

✅ **Normalizing cost nothing**: `git diff --numstat` was empty for all twelve rewritten files,
because the index had been LF all along.

