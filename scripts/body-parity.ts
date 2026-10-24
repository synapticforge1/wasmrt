#!/usr/bin/env bun
// body-parity.ts — wasmrt's assembler output against an OUTSIDE READER, byte for byte.
//
//   bun scripts/body-parity.ts [--wasmrt <exe>] [corpus-root]      # default root: ../wasmtk/tests
//
// For every `.wat` under the root, assemble it with `wasmrt wat` and with `wasm-tools parse`, strip
// every CUSTOM section from both, and require the remaining bytes (the module BODY) to be identical.
// Custom sections are compared separately and only for one rule: wasmrt may not write MORE `name`
// sections than wasm-tools (workspace I8: `(@custom "name" …)` plus identifiers gave two).
//
// 🔒 Why this exists (workspace letter H13; divergences I12–I14). wasmrt's bodies differed from
// wasm-tools' on 539 of 603 corpus files, for three reasons no wasmrt gate could see: locals written
// one entry per local instead of in runs, exports grouped by kind instead of in source order, and
// implicit types interned in a different order. Every module still decoded, validated and ran, and
// wasmrt's decoder read its own bytes back, so every round trip was green (best-practices §3.8b:
// agreement with yourself is not evidence). Only a reader that did not write the bytes can say.
//
// For each file whose bodies differ it names the FIRST section that differs, so each cause is its
// own bucket. A file only one tool assembles is reported, not failed: refusals belong to
// `scripts/wat-corpus.ts`. Exit 1 on any body difference or extra `name` section.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import process from "node:process";
import { releaseWasmrt } from "./target-dir.ts";

const argv = process.argv.slice(2);
const exeAt = argv.indexOf("--wasmrt");
// Default: the release binary cargo actually builds (`target-dir.ts`).
const WASMRT = exeAt >= 0 ? argv[exeAt + 1] : releaseWasmrt();
const rest = argv.filter((_, i) => i !== exeAt && i !== exeAt + 1);
const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ROOT = rest[0] ?? join(here, "..", "..", "wasmtk", "tests");

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && e.name !== "node_modules") walk(p, acc);
    else if (e.isFile() && e.name.endsWith(".wat")) acc.push(p);
  }
  return acc;
}

function leb(b: Uint8Array, at: number): [number, number] {
  let r = 0, s = 0, i = at;
  for (;;) {
    const c = b[i++];
    r |= (c & 0x7f) << s;
    if (!(c & 0x80)) return [r >>> 0, i];
    s += 7;
  }
}
const SECTION = ["custom", "type", "import", "func", "table", "memory", "global", "export", "start",
  "elem", "code", "data", "datacount", "tag"];
type Parsed = { sections: { id: number; bytes: Uint8Array }[]; names: number };
function parse(b: Uint8Array): Parsed {
  const sections: { id: number; bytes: Uint8Array }[] = [];
  let names = 0, i = 8;
  while (i < b.length) {
    const id = b[i];
    const [size, p] = leb(b, i + 1);
    const end = p + size;
    if (id === 0) {
      const [nlen, q] = leb(b, p);
      if (new TextDecoder().decode(b.subarray(q, q + nlen)) === "name") names++;
    } else sections.push({ id, bytes: b.subarray(i, end) });
    i = end;
  }
  return { sections, names };
}
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, k) => x === b[k]);

const tmp = mkdtempSync(join(tmpdir(), "wasmrt-body-parity-"));
const files = walk(ROOT).sort();
const buckets = new Map<string, string[]>();
const extraNames: string[] = [];
let both = 0, identical = 0, onlyOne = 0;
try {
  for (const f of files) {
    const a = join(tmp, "a.wasm"), b = join(tmp, "b.wasm");
    rmSync(a, { force: true });
    rmSync(b, { force: true });
    const ra = spawnSync(WASMRT, ["wat", f, "-o", a]).status === 0;
    const rb = spawnSync("wasm-tools", ["parse", f, "-o", b]).status === 0;
    if (ra !== rb) { onlyOne++; continue; }
    if (!ra) continue;
    both++;
    const pa = parse(readFileSync(a)), pb = parse(readFileSync(b));
    if (pa.names > pb.names) extraNames.push(relative(ROOT, f));
    let first: string | null = null;
    const n = Math.max(pa.sections.length, pb.sections.length);
    for (let k = 0; k < n && !first; k++) {
      const x = pa.sections[k], y = pb.sections[k];
      if (!x || !y || x.id !== y.id) first = "section ORDER or set";
      else if (!same(x.bytes, y.bytes)) first = SECTION[x.id] ?? `id${x.id}`;
    }
    if (!first) { identical++; continue; }
    buckets.set(first, [...(buckets.get(first) ?? []), relative(ROOT, f)]);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const differ = both - identical;
console.log(`body parity vs wasm-tools: ${files.length} files; both assembled ${both}; bodies identical ${identical}; differ ${differ}` +
  (onlyOne ? `; assembled by only one tool ${onlyOne} (see wat-corpus.ts)` : ""));
for (const [s, fs] of [...buckets].sort((x, y) => y[1].length - x[1].length)) {
  console.log(`  first difference in ${s.padEnd(22)} ${String(fs.length).padStart(4)}   e.g. ${fs.slice(0, 2).join(", ")}`);
}
if (extraNames.length) console.log(`  MORE name sections than wasm-tools: ${extraNames.length}   e.g. ${extraNames.slice(0, 2).join(", ")}`);
const bad = differ > 0 || extraNames.length > 0;
console.log(bad ? "body parity: FAILED" : "body parity: PASSED");
process.exit(bad ? 1 : 0);
