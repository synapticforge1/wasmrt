// Self-test of scripts/crates-io.ts against a mock crates.io + GitHub OIDC endpoint (`node:http`) and
// a fake cargo that "publishes" into the mock: each case sets the mock's state, runs the script as a
// subprocess, and asserts the exit code, what was published in what order, and a fragment of the
// output. Inverted by mutants (cmem/releasing.md § Tooling).
//
//   bun scripts/check-crates-io.ts [path/to/crates-io.ts]
//
// Runs in the release workflow's `checks` job, before the job that holds the id-token.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import process from "node:process";

const SCRIPT = process.argv[2] ?? join(import.meta.dirname!, "crates-io.ts");
const V = "1.2.3";
const ALL = ["wasmrt-core", "wasmrt-capi", "wasmrt"];

const dir = mkdtempSync(join(tmpdir(), "wasmrt-crates-"));
const ENVFILE = join(dir, "github-env");
const OUTPUT = join(dir, "github-output");
const CALLS = join(dir, "cargo-calls");
const FAKE = join(dir, "fake-cargo.ts");
// The fake cargo: records its argv, then (unless told to fail for this crate) tells the mock
// registry the crate is published, as a real `cargo publish` would make it so.
writeFileSync(FAKE, [
  `import { appendFileSync } from "node:fs";`,
  `const args = process.argv.slice(2);`,
  `appendFileSync(process.env.FAKE_CALLS!, args.join(" ") + "\\n");`,
  `const crate = args[args.indexOf("-p") + 1];`,
  `if (process.env.FAKE_FAIL === crate) process.exit(101);`,
  `await fetch(process.env.CRATES_API_URL + "/mock/publish/" + crate, { method: "POST" });`,
].join("\n"));

interface State {
  listed: string[]; // crates that list V
  yanked: string[]; // listed crates whose V is yanked
  hidden: string[]; // listed but the version URL answers 404 (index not yet serving)
  listStatus: number; // what the version list answers (200 normally)
  exchange: number; // what the trusted-publishing exchange answers
  tokenOnError: boolean; // a non-200 exchange answer still carries a token
  token: string; // the token a 200 exchange carries
  revoke: number; // what DELETE answers
  oidc: number; // what GitHub's OIDC endpoint answers
  stall: boolean;
  from: Record<string, string>; // crate -> the commit its .crate names (default SHA, this run's)
  noDownload: string[]; // listed crates whose .crate is not served yet
  paged: boolean; // the version list puts V on a SECOND page
  shape: Record<string, "dup" | "badsize" | "dirty">; // a hostile .crate (review round 2)
  dl503: string[]; // the CDN answers 503 for these .crate downloads
  paging: "" | "repeat" | "404on2"; // the version list's paging misbehaves
}

const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);

/** A minimal ustar archive holding `<crate>-<V>/.cargo_vcs_info.json` naming `sha`, gzipped — the
 *  shape of a real .crate (measured on wasmrt-core 2.0.1). */
function member(name: string, body: Buffer, sizeField?: string): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0, "utf8");
  header.write("0000644\0", 100);
  header.write("0000000\0", 108);
  header.write("0000000\0", 116);
  header.write(sizeField ?? body.length.toString(8).padStart(11, "0") + "\0", 124);
  header.write("00000000000\0", 136);
  header.write("        ", 148);
  header.write("0", 156);
  header.write("ustar\0", 257);
  header.write("00", 263);
  let sum = 0;
  for (const b of header) sum += b;
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  return Buffer.concat([header, body, Buffer.alloc((512 - (body.length % 512)) % 512)]);
}
function crateFile(crate: string, sha: string, shape?: "dup" | "badsize" | "dirty"): Buffer {
  const vcs = (s: string, dirty = false) =>
    Buffer.from(JSON.stringify({ git: { sha1: s, ...(dirty ? { dirty: true } : {}) }, path_in_vcs: `crates/${crate}` }, null, 2));
  const name = `${crate}-${V}/.cargo_vcs_info.json`;
  const parts = shape === "dup"
    ? [member(name, vcs(sha)), member(name, vcs(OTHER))] // the first names this commit, the second (what tar keeps) another
    : shape === "badsize"
    ? [member(name, vcs(sha), "0000000017z\0")]
    : [member(name, vcs(sha, shape === "dirty"))];
  return gzipSync(Buffer.concat([...parts, Buffer.alloc(1024)]));
}
let state: State;
let audience = "";
let jwtSent = "";
let revokedWith = "";

function send(res: ServerResponse, status: number, json: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(json));
}
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => ok(s));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const p = url.pathname;
  if (state.stall) await new Promise((r) => setTimeout(r, 5000));
  let m: RegExpMatchArray | null;
  if (req.method === "POST" && (m = p.match(/^\/mock\/publish\/([\w-]+)$/))) {
    state.listed.push(m[1]);
    return send(res, 200, {});
  }
  if ((m = p.match(/^\/dl\/([\w-]+)\/([\w-]+)-([\d.]+)\.crate$/))) {
    const c = m[1];
    if (state.dl503.includes(c)) return send(res, 503, {});
    if (!state.listed.includes(c) || state.noDownload.includes(c) || m[3] !== V) return send(res, 403, {});
    res.writeHead(200, { "Content-Type": "application/gzip" });
    return res.end(crateFile(c, state.from[c] ?? SHA, state.shape[c]));
  }
  if (p === "/oidc") {
    audience = url.searchParams.get("audience") ?? "";
    return state.oidc === 200 ? send(res, 200, { value: "the-jwt" }) : send(res, state.oidc, {});
  }
  if (p === "/api/v1/trusted_publishing/tokens" && req.method === "POST") {
    jwtSent = JSON.parse(await readBody(req)).jwt;
    if (state.exchange === 200) return send(res, 200, { token: state.token });
    // An error status that still carries a token (a proxy, a partial failure) is still a refusal.
    return send(res, state.exchange, state.tokenOnError
      ? { token: "cio_secret", errors: [{ detail: "upstream error" }] }
      : { errors: [{ detail: "no trusted publisher" }] });
  }
  if (p === "/api/v1/trusted_publishing/tokens" && req.method === "DELETE") {
    revokedWith = req.headers.authorization ?? "";
    return send(res, state.revoke, {});
  }
  if ((m = p.match(/^\/api\/v1\/crates\/([\w-]+)\/versions$/))) {
    if (state.listStatus !== 200) return send(res, state.listStatus, {});
    if (state.paging === "repeat") return send(res, 200, { versions: [{ num: "0.1.0" }], meta: { next_page: "?page=2" } });
    if (state.paging === "404on2") {
      return url.searchParams.get("page") === "2"
        ? send(res, 404, {})
        : send(res, 200, { versions: [{ num: "0.1.0" }], meta: { next_page: "?page=2" } });
    }
    const has = state.listed.includes(m[1]);
    if (state.paged && url.searchParams.get("page") !== "2") {
      return send(res, 200, { versions: [{ num: "1.0.1" }], meta: { next_page: "?page=2" } });
    }
    return send(res, 200, { versions: has ? [{ num: "1.0.0" }, { num: V }] : [{ num: "1.0.0" }], meta: { next_page: null } });
  }
  if ((m = p.match(/^\/api\/v1\/crates\/([\w-]+)\/([\d.]+)$/))) {
    const c = m[1];
    if (!state.listed.includes(c) || state.hidden.includes(c) || m[2] !== V) return send(res, 404, {});
    return send(res, 200, { version: { num: V, yanked: state.yanked.includes(c) } });
  }
  return send(res, 500, { message: `mock: no route ${req.method} ${p}` });
});
await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
const port = (server.address() as { port: number }).port;
const BASE = `http://127.0.0.1:${port}`;

let pass = 0, failed = 0;
function check(name: string, ok: boolean, detail: string) {
  if (ok) pass++;
  else {
    failed++;
    console.log(`  FAIL: ${name} — ${detail}`);
  }
}

const base: State = {
  listed: [], yanked: [], hidden: [], listStatus: 200, exchange: 200, tokenOnError: false, token: "cio_secret",
  revoke: 204, oidc: 200, stall: false, from: {}, noDownload: [], paged: false, shape: {}, dl503: [], paging: "",
};

function runScript(env: Record<string, string>, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [SCRIPT, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    // A script that never ends is a failure, not a hang of the self-test (review round 2).
    const kill = setTimeout(() => { out += "\n[self-test: killed after 15 s]"; p.kill(); }, 15_000);
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (out += c));
    p.on("close", (code) => { clearTimeout(kill); ok({ code: code ?? -1, out }); });
  });
}

async function run(
  name: string,
  s: Partial<State>,
  args: string[],
  want: { code: number; out: string; published?: string[] },
  env: Record<string, string> = {},
) {
  state = { ...base, ...s, listed: [...(s.listed ?? [])] };
  audience = jwtSent = revokedWith = "";
  for (const f of [ENVFILE, OUTPUT, CALLS]) writeFileSync(f, "");
  const { code, out } = await runScript({
    PATH: process.env.PATH ?? "",
    SystemRoot: process.env.SystemRoot ?? "",
    VERSION: V, CRATES_API_URL: BASE, CRATES_DL_URL: `${BASE}/dl`, GITHUB_SHA: SHA, WASMRT_HTTP_TIMEOUT_MS: "1500",
    READBACK_ATTEMPTS: "2", READBACK_INTERVAL_MS: "10",
    ACTIONS_ID_TOKEN_REQUEST_URL: `${BASE}/oidc?api-version=2.0`, ACTIONS_ID_TOKEN_REQUEST_TOKEN: "req-token",
    GITHUB_ENV: ENVFILE, GITHUB_OUTPUT: OUTPUT, CARGO_REGISTRY_TOKEN: "cio_secret",
    WASMRT_CARGO: JSON.stringify([process.execPath, FAKE]), FAKE_CALLS: CALLS,
    ...env,
  }, args);
  const calls = readFileSync(CALLS, "utf8").split("\n").filter(Boolean);
  const published = calls.map((c) => c.split(" ")[c.split(" ").indexOf("-p") + 1]);
  const pubOk = want.published === undefined || published.join(",") === want.published.join(",");
  check(
    name,
    code === want.code && out.includes(want.out) && pubOk,
    `exit ${code} (want ${want.code}), published [${published}] (want [${want.published ?? "any"}]), output: ${
      out.trim().slice(0, 260)
    }`,
  );
  return { calls, out };
}
const file = (f: string) => readFileSync(f, "utf8");

// ── has ──
await run("has: none listed → missing=3", {}, ["has"], { code: 0, out: "missing=3" });
check("has: missing=3 reaches GITHUB_OUTPUT", file(OUTPUT) === "missing=3\n", JSON.stringify(file(OUTPUT)));
await run("has: all listed → missing=0", { listed: ALL }, ["has"], { code: 0, out: "missing=0" });
check("has: missing=0 reaches GITHUB_OUTPUT", file(OUTPUT) === "missing=0\n", JSON.stringify(file(OUTPUT)));
await run("has: core only → missing=2", { listed: ["wasmrt-core"] }, ["has"], { code: 0, out: "missing=2 (wasmrt-capi, wasmrt)" });
await run("has: the version list fails → exit 1", { listStatus: 503 }, ["has"], { code: 1, out: "HTTP 503" });

// ── token ──
const tok = await run("token: OIDC → exchange → masked, to GITHUB_ENV", {}, ["token"], { code: 0, out: "::add-mask::cio_secret" });
check("token: audience is the registry host", audience === `127.0.0.1:${port}`, audience);
check("token: the GitHub JWT is what is exchanged", jwtSent === "the-jwt", jwtSent);
check("token: GITHUB_ENV gets CARGO_REGISTRY_TOKEN", file(ENVFILE) === "CARGO_REGISTRY_TOKEN=cio_secret\n", JSON.stringify(file(ENVFILE)));
check(
  "token: printed only inside the mask line",
  tok.out.split("cio_secret").length - 1 === 1,
  tok.out.slice(0, 200),
);
await run("token: crates.io refuses → exit 1, names the setting", { exchange: 400 }, ["token"], {
  code: 1, out: "trusted publisher",
});
check("token: a refused exchange writes no token", file(ENVFILE) === "", JSON.stringify(file(ENVFILE)));
await run("token: an error status carrying a token → still refused", { exchange: 502, tokenOnError: true }, ["token"], {
  code: 1, out: "HTTP 502",
});
check("token: that token is not handed on", file(ENVFILE) === "", JSON.stringify(file(ENVFILE)));
await run("token: a token with a newline → refused, nothing written to GITHUB_ENV", { token: "cio_x\nBASH_ENV=/tmp/evil" }, ["token"], {
  code: 1, out: "whitespace or control characters",
});
check("token: an injected line never reaches GITHUB_ENV", file(ENVFILE) === "", JSON.stringify(file(ENVFILE)));
await run("token: GitHub's OIDC fails → exit 1", { oidc: 500 }, ["token"], { code: 1, out: "OIDC token request" });
await run("token: no OIDC request URL (no id-token: write) → exit 1", {}, ["token"], {
  code: 1, out: "ACTIONS_ID_TOKEN_REQUEST_URL is not set",
}, { ACTIONS_ID_TOKEN_REQUEST_URL: "" });

// ── publish ──
const all = await run("publish: none listed → all three, dependency order", {}, ["publish"], {
  code: 0, out: "published (or found)", published: ALL,
});
check(
  "publish: each call is `publish -p <crate> --locked --no-verify`",
  all.calls.every((c, i) => c === `publish -p ${ALL[i]} --locked --no-verify`),
  JSON.stringify(all.calls),
);
await run("publish: core already listed → capi and the CLI only", { listed: ["wasmrt-core"] }, ["publish"], {
  code: 0, out: "wasmrt-core 1.2.3: already on crates.io from this commit, skipped", published: ["wasmrt-capi", "wasmrt"],
});
// Review round 1: presence is not provenance.
await run("publish: core listed but packaged from ANOTHER commit → refused, nothing published", {
  listed: ["wasmrt-core"], from: { "wasmrt-core": OTHER },
}, ["publish"], { code: 1, out: `published from ${OTHER}`, published: [] });
await run("publish: core listed, its .crate not served yet → refused with 're-run'", {
  listed: ["wasmrt-core"], noDownload: ["wasmrt-core"],
}, ["publish"], { code: 1, out: "Re-run failed jobs", published: [] });
await run("publish: the version only on the list's SECOND page is still found (no republish)", { listed: ALL, paged: true }, ["publish"], {
  code: 0, out: "published (or found)", published: [],
});
await run("publish: all listed (re-run) → nothing published", { listed: ALL }, ["publish"], {
  code: 0, out: "published (or found)", published: [],
});
await run("publish: core fails → exit 1, nothing after it attempted", {}, ["publish"], {
  code: 1, out: "cargo publish -p wasmrt-core failed", published: ["wasmrt-core"],
}, { FAKE_FAIL: "wasmrt-core" });
await run("publish: capi fails → exit 1, the CLI not attempted", {}, ["publish"], {
  code: 1, out: "cargo publish -p wasmrt-capi failed", published: ["wasmrt-core", "wasmrt-capi"],
}, { FAKE_FAIL: "wasmrt-capi" });
await run("publish: no token → refused before any cargo", {}, ["publish"], {
  code: 1, out: "CARGO_REGISTRY_TOKEN is not set", published: [],
}, { CARGO_REGISTRY_TOKEN: "" });

// ── revoke ──
await run("revoke: DELETE with the token", {}, ["revoke"], { code: 0, out: "revoked" });
check("revoke: the Bearer is the token", revokedWith === "Bearer cio_secret", revokedWith);
await run("revoke: crates.io refuses → exit 1", { revoke: 500 }, ["revoke"], { code: 1, out: "HTTP 500" });

// ── readback ──
await run("readback: all three served → exit 0", { listed: ALL }, ["readback"], { code: 0, out: "read back: wasmrt-core" });
await run("readback: capi packaged from ANOTHER commit → exit 1", { listed: ALL, from: { "wasmrt-capi": OTHER } }, ["readback"], {
  code: 1, out: `wasmrt-capi 1.2.3 packaged from ${OTHER}`,
});
await run("readback: the CLI listed but its .crate never served → exit 1 after the attempts", { listed: ALL, noDownload: ["wasmrt"] }, ["readback"], {
  code: 1, out: ".crate not served yet",
});
await run("readback: no GITHUB_SHA → refused", { listed: ALL }, ["readback"], { code: 1, out: "GITHUB_SHA is not set" }, { GITHUB_SHA: "" });
// Review round 2: a hostile or broken .crate, a flaky CDN, paging that never ends.
await run("readback: two vcs members (the second names another commit) → refused", { listed: ALL, shape: { wasmrt: "dup" } }, ["readback"], {
  code: 1, out: "2 copies of",
});
await run("readback: a non-octal tar size field → refused", { listed: ALL, shape: { "wasmrt-capi": "badsize" } }, ["readback"], {
  code: 1, out: "malformed tar size field",
});
await run("readback: a crate published from a DIRTY tree → refused", { listed: ALL, shape: { "wasmrt-core": "dirty" } }, ["readback"], {
  code: 1, out: "DIRTY tree",
});
await run("readback: the CDN answering 503 is retried, not fatal at once", { listed: ALL, dl503: ["wasmrt"] }, ["readback"], {
  code: 1, out: "after 2 attempts",
});
await run("has: a version list whose next_page repeats → red, and it ends", { paging: "repeat" }, ["has"], {
  code: 1, out: "pagination did not end",
});
await run("has: a 404 on page 2 is an error, not 'no such crate'", { paging: "404on2" }, ["has"], {
  code: 1, out: "HTTP 404 (page 2)",
});
await run("readback: the CLI missing → exit 1", { listed: ["wasmrt-core", "wasmrt-capi"] }, ["readback"], {
  code: 1, out: "does not serve wasmrt 1.2.3 after 2 attempts",
});
await run("readback: core missing → exit 1", { listed: ["wasmrt-capi", "wasmrt"] }, ["readback"], {
  code: 1, out: "does not serve wasmrt-core",
});
await run("readback: capi yanked → exit 1", { listed: ALL, yanked: ["wasmrt-capi"] }, ["readback"], {
  code: 1, out: "wasmrt-capi 1.2.3 but it is YANKED",
});
await run("readback: the index not yet serving → exit 1 after the attempts", { listed: ALL, hidden: ["wasmrt"] }, ["readback"], {
  code: 1, out: "after 2 attempts",
});

// ── bad input, time limit ──
await run("VERSION not X.Y.Z → refused", {}, ["has"], { code: 1, out: "is not X.Y.Z" }, { VERSION: "v1.2.3" });
await run("unknown command → refused", {}, ["upload"], { code: 1, out: "has | token | publish | revoke | readback" });
await run("extra argument → refused", {}, ["has", "--force"], { code: 1, out: "unexpected arguments" });
await run("a stalled registry: the time limit fails it", { stall: true }, ["has"], { code: 1, out: "no answer within 1500 ms" });

server.closeAllConnections();
server.close();
rmSync(dir, { recursive: true, force: true });
console.log(`\ncrates-io self-test: ${pass} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
