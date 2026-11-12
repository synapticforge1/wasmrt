// The crates.io half of a release (workspace letter H33, slot U8; 🔒 the owner's decision D2,
// 2026-11-10: "it should be per the release flow not on my machine" — wasmrt publishes from CI only,
// through crates.io trusted publishing, with no stored token). The `publish` job of
// `.github/workflows/release.yml` runs, in order:
//
//   bun scripts/crates-io.ts has       # which of the three crates lack VERSION?  missing=<n>
//   bun scripts/crates-io.ts token     # GitHub OIDC (audience "crates.io") -> a short-lived crates.io token
//   bun scripts/crates-io.ts publish   # each crate in dependency order; one already listed is skipped
//   bun scripts/crates-io.ts revoke    # end the token (always runs once one was made)
//   bun scripts/crates-io.ts readback  # FATAL: crates.io serves VERSION of all three, none yanked
//
// The three crates share one version and publish in dependency order: wasmrt-core first (the other
// two depend on it), then wasmrt-capi, then the `wasmrt` CLI — the order of every release since
// v0.1.0. `cargo publish -p <crate> --locked --no-verify` packages the source and builds nothing (the
// `checks` job built, tested and dry-ran `cargo publish --workspace` on this commit), so no package
// code runs beside the token; cargo itself waits until crates.io's index serves each crate before
// returning, so the next one resolves it. A crate crates.io already lists is skipped, so "Re-run
// failed jobs" finishes a partial publish (U12).
//
// Trusted publishing as rust-lang/crates-io-auth-action implements it, and as loader-rs runs it in
// production (its `scripts/crates-io.ts`, read 2026-11-12): the OIDC audience is the registry host
// ("crates.io"); `POST <registry>/api/v1/trusted_publishing/tokens` with `{"jwt": …}` answers
// `{"token": …}`; `DELETE` on the same URL with that token revokes it. It needs the job's
// `id-token: write` and, on crates.io, a trusted publisher for synapticforge1/wasmrt and
// `release.yml` on EACH of the three crates — an owner setting (cmem/releasing.md § Tooling).
//
// Environment:
//   VERSION                     X.Y.Z, Cargo.toml's [workspace.package] version
//   CRATES_API_URL              default https://crates.io (the self-test points it at a mock)
//   ACTIONS_ID_TOKEN_REQUEST_*  set by GitHub when the job has id-token: write (`token`)
//   GITHUB_ENV / GITHUB_OUTPUT  where `token` hands the token on / where `has` answers
//   CARGO_REGISTRY_TOKEN        the token, for `publish` and `revoke`
//   GITHUB_SHA                  this run's commit: `publish` skips, and `readback` accepts, only a crate
//                               whose `.cargo_vcs_info.json` names it (provenance, review round 1)
//   CRATES_DL_URL               default https://static.crates.io/crates (the .crate downloads)
//   WASMRT_CARGO                the cargo command as a JSON argv prefix, default ["cargo"] (self-test)
//   WASMRT_HTTP_TIMEOUT_MS      the limit for EACH request, request to last byte; default 30000
//   READBACK_ATTEMPTS / READBACK_INTERVAL_MS   default 30 × 10000 (5 minutes)
//
// The token is never printed: `::add-mask::` comes first, then it goes to GITHUB_ENV only.
// `node:` builtins and `fetch` only. Self-test: `bun scripts/check-crates-io.ts`.
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import process from "node:process";

/** Dependency order: each crate's dependencies come before it. */
const CRATES = ["wasmrt-core", "wasmrt-capi", "wasmrt"] as const;

const command = process.argv[2];
if (!["has", "token", "publish", "revoke", "readback"].includes(command ?? "")) {
  fail(`the first argument must be has | token | publish | revoke | readback (got "${command ?? ""}")`);
}
if (process.argv.length > 3) fail(`unexpected arguments: ${process.argv.slice(3).join(" ")}`);

function fail(msg: string): never {
  console.error(`crates-io: ${msg}`);
  process.exit(1);
}

function need(name: string): string {
  const v = process.env[name];
  if (!v) fail(`${name} is not set`);
  return v;
}

const version = need("VERSION");
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`VERSION "${version}" is not X.Y.Z`);
const registry = (process.env.CRATES_API_URL || "https://crates.io").replace(/\/+$/, "");
const timeoutMs = Number(process.env.WASMRT_HTTP_TIMEOUT_MS ?? "30000");
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) fail("WASMRT_HTTP_TIMEOUT_MS must be a positive number");
const UA = "wasmrt release workflow (https://github.com/synapticforge1/wasmrt)";
const TOKENS = `${registry}/api/v1/trusted_publishing/tokens`;

/** One request under ONE time limit, request to last byte. Never logs headers or bodies. */
async function call(method: string, url: string, init: { headers?: Record<string, string>; body?: string } = {}) {
  const signal = AbortSignal.timeout(timeoutMs);
  const label = `${method} ${url.replace(/\?.*$/, "")}`;
  try {
    const res = await fetch(url, { method, headers: { "User-Agent": UA, ...init.headers }, body: init.body, signal });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json };
  } catch (e) {
    const name = (e as Error).name;
    if (signal.aborted || name === "TimeoutError" || name === "AbortError") fail(`${label}: no answer within ${timeoutMs} ms`);
    fail(`${label}: ${(e as Error).message}`);
  }
}

/** Does crates.io list VERSION of `crate`? Read from the crate's version LIST — every page, following
 *  `meta.next_page` (review round 1: unpaginated today, not promised) — never the version's own URL
 *  before it exists (a caching layer may cache the miss; loader-go, 2026-11-10). */
async function listed(crate: string): Promise<boolean> {
  for (let url: string | null = `${registry}/api/v1/crates/${crate}/versions`; url;) {
    const r = await call("GET", url);
    if (r.status === 404) return false; // the crate itself does not exist
    if (r.status !== 200 || !Array.isArray(r.json?.versions)) fail(`crates.io's version list for ${crate}: HTTP ${r.status} — re-run when crates.io answers`);
    if (r.json.versions.some((v: { num: string }) => v.num === version)) return true;
    const next = r.json.meta?.next_page;
    url = next ? `${registry}/api/v1/crates/${crate}/versions${next}` : null;
  }
  return false;
}

/** The commit a PUBLISHED crate was packaged from: `.cargo_vcs_info.json` inside the `.crate`
 *  (`git.sha1`), or null while the download is not served yet. Presence on crates.io is not
 *  provenance (review round 1): a crate at VERSION published from another commit must not be skipped
 *  or read back as this release. Measured 2026-11-12: all three 2.0.1 crates name `c3cb7dd`, v2.0.1's
 *  commit. */
async function packagedFrom(crate: string): Promise<string | null> {
  const dl = (process.env.CRATES_DL_URL || "https://static.crates.io/crates").replace(/\/+$/, "");
  const url = `${dl}/${crate}/${crate}-${version}.crate`;
  const signal = AbortSignal.timeout(timeoutMs);
  let bytes: Buffer;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal });
    if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) fail(`GET ${url}: HTTP ${res.status} — re-run when crates.io answers`);
    bytes = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    if (signal.aborted) fail(`GET ${url}: no answer within ${timeoutMs} ms`);
    fail(`GET ${url}: ${(e as Error).message}`);
  }
  let tar: Buffer;
  try {
    tar = gunzipSync(bytes);
  } catch {
    fail(`${crate} ${version}: the downloaded .crate is not gzip`);
  }
  const want = `${crate}-${version}/.cargo_vcs_info.json`;
  for (let off = 0; off + 512 <= tar.length;) {
    const h = tar.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    const str = (a: number, n: number) => h.subarray(a, a + n).toString("utf8").replace(/\0.*$/s, "");
    const name = (str(345, 155) ? `${str(345, 155)}/` : "") + str(0, 100);
    const size = parseInt(str(124, 12).trim() || "0", 8);
    if (!Number.isFinite(size) || size < 0) fail(`${crate} ${version}: a malformed tar header in the .crate`);
    if (name === want) {
      let sha: unknown;
      try {
        sha = JSON.parse(tar.subarray(off + 512, off + 512 + size).toString("utf8"))?.git?.sha1;
      } catch {
        fail(`${crate} ${version}: .cargo_vcs_info.json is not JSON`);
      }
      if (typeof sha !== "string" || !/^[0-9a-f]{40}$/.test(sha)) fail(`${crate} ${version}: .cargo_vcs_info.json names no commit`);
      return sha;
    }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  fail(`${crate} ${version}: the published .crate has no ${want} — its provenance cannot be read`);
}

if (command === "has") {
  const missing: string[] = [];
  for (const c of CRATES) {
    const has = await listed(c);
    console.log(`crates.io ${has ? "already lists" : "does not list"} ${c} ${version}`);
    if (!has) missing.push(c);
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `missing=${missing.length}\n`);
  console.log(`missing=${missing.length}${missing.length ? ` (${missing.join(", ")})` : ""}`);
  process.exit(0);
}

if (command === "token") {
  const reqUrl = need("ACTIONS_ID_TOKEN_REQUEST_URL");
  const reqToken = need("ACTIONS_ID_TOKEN_REQUEST_TOKEN");
  const envFile = need("GITHUB_ENV");
  const audience = registry.replace(/^https?:\/\//, "");
  const oidcUrl = new URL(reqUrl);
  oidcUrl.searchParams.set("audience", audience);
  const oidc = await call("GET", oidcUrl.toString(), { headers: { Authorization: `bearer ${reqToken}` } });
  const jwt = oidc.json?.value;
  if (oidc.status !== 200 || typeof jwt !== "string" || !jwt) fail(`GitHub's OIDC token request: HTTP ${oidc.status}`);
  const ex = await call("POST", TOKENS, { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jwt }) });
  const token = ex.json?.token;
  if (ex.status !== 200 || typeof token !== "string" || !token) {
    const detail = Array.isArray(ex.json?.errors) ? ex.json.errors.map((e: { detail?: string }) => e.detail).join("; ") : "";
    fail(`crates.io refused the trusted-publishing exchange: HTTP ${ex.status}${detail ? ` — ${detail}` : ""} (is a trusted publisher for synapticforge1/wasmrt and release.yml configured on each crate?)`);
  }
  // The token goes into GITHUB_ENV, one `NAME=value` per line: a newline in it would set other
  // variables for every later step (review round 1). Printable ASCII, no spaces, or refuse.
  if (!/^[\x21-\x7e]+$/.test(token)) fail("crates.io returned a token with whitespace or control characters; refusing to hand it on");
  console.log(`::add-mask::${token}`);
  appendFileSync(envFile, `CARGO_REGISTRY_TOKEN=${token}\n`);
  console.log(`crates.io issued a trusted-publishing token (audience ${audience}); handed to the next steps, masked`);
  process.exit(0);
}

if (command === "publish") {
  need("CARGO_REGISTRY_TOKEN");
  let cargo: string[];
  try {
    cargo = JSON.parse(process.env.WASMRT_CARGO || '["cargo"]');
  } catch {
    fail("WASMRT_CARGO is not a JSON array");
  }
  if (!Array.isArray(cargo) || !cargo.length || !cargo.every((s) => typeof s === "string")) {
    fail("WASMRT_CARGO is not a JSON array of strings");
  }
  const sha = need("GITHUB_SHA");
  for (const c of CRATES) {
    if (await listed(c)) {
      // Skipped only when it is THIS commit's crate (a re-run finishing a partial publish).
      const from = await packagedFrom(c);
      if (from === null) fail(`${c} ${version} is listed but its .crate is not served yet — "Re-run failed jobs" in a few minutes`);
      if (from !== sha) {
        fail(`${c} ${version} is already on crates.io, published from ${from}, not this commit ${sha}: the version was taken elsewhere. Nothing here can finish it — bump the version (owner).`);
      }
      console.log(`${c} ${version}: already on crates.io from this commit, skipped`);
      continue;
    }
    console.log(`== cargo publish -p ${c} --locked --no-verify`);
    const r = spawnSync(cargo[0], [...cargo.slice(1), "publish", "-p", c, "--locked", "--no-verify"], {
      cwd: join(import.meta.dirname!, ".."),
      stdio: "inherit",
    });
    if (r.status !== 0) {
      fail(`cargo publish -p ${c} failed (exit ${r.status}); the crates after it were not attempted. Read cargo's message above; if it was transient, "Re-run failed jobs" (published crates are skipped).`);
    }
  }
  console.log(`published (or found) all of ${CRATES.join(", ")} at ${version}`);
  process.exit(0);
}

if (command === "revoke") {
  const token = need("CARGO_REGISTRY_TOKEN");
  const r = await call("DELETE", TOKENS, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status < 200 || r.status > 299) fail(`revoking the trusted-publishing token: HTTP ${r.status}`);
  console.log("the trusted-publishing token is revoked");
  process.exit(0);
}

// readback — FATAL unless crates.io serves VERSION of every crate, none yanked, each packaged from
// THIS commit
const sha = need("GITHUB_SHA");
const attempts = Number(process.env.READBACK_ATTEMPTS ?? "30");
const interval = Number(process.env.READBACK_INTERVAL_MS ?? "10000");
for (const c of CRATES) {
  let last = "";
  let served = false;
  for (let i = 1; i <= attempts && !served; i++) {
    const r = await call("GET", `${registry}/api/v1/crates/${c}/${version}`);
    const v = r.json?.version;
    if (r.status === 200 && v?.num === version) {
      if (v.yanked) fail(`crates.io serves ${c} ${version} but it is YANKED — the owner decides what to do; a re-run cannot fix it`);
      const from = await packagedFrom(c);
      if (from !== null) {
        if (from !== sha) fail(`crates.io serves ${c} ${version} packaged from ${from}, not this commit ${sha} — not this release (owner)`);
        console.log(`crates.io serves ${c} ${version} (not yanked, packaged from this commit), attempt ${i}`);
        served = true;
        break;
      }
      last = "listed, .crate not served yet";
    } else last = `HTTP ${r.status}`;
    console.log(`${c}: attempt ${i}/${attempts}: ${last}`);
    if (i < attempts) await new Promise((resolve) => setTimeout(resolve, interval));
  }
  if (!served) fail(`crates.io does not serve ${c} ${version} after ${attempts} attempts (${last}) — if it is only slow, "Re-run failed jobs" (the publish step skips what is there)`);
}
console.log(`read back: ${CRATES.join(", ")} ${version}, none yanked, all packaged from ${sha}`);
