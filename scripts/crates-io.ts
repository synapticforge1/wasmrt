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
//   WASMRT_CARGO                the cargo command as a JSON argv prefix, default ["cargo"] (self-test)
//   WASMRT_HTTP_TIMEOUT_MS      the limit for EACH request, request to last byte; default 30000
//   READBACK_ATTEMPTS / READBACK_INTERVAL_MS   default 30 × 10000 (5 minutes)
//
// The token is never printed: `::add-mask::` comes first, then it goes to GITHUB_ENV only.
// `node:` builtins and `fetch` only. Self-test: `bun scripts/check-crates-io.ts`.
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
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

/** Does crates.io list VERSION of `crate`? Read from the crate's version LIST, never the version's own
 *  URL before it exists (a caching layer may cache the miss; loader-go, 2026-11-10). */
async function listed(crate: string): Promise<boolean> {
  const r = await call("GET", `${registry}/api/v1/crates/${crate}/versions`);
  if (r.status === 404) return false; // the crate itself does not exist
  if (r.status === 200 && Array.isArray(r.json?.versions)) {
    return r.json.versions.some((v: { num: string }) => v.num === version);
  }
  fail(`crates.io's version list for ${crate}: HTTP ${r.status}`);
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
  for (const c of CRATES) {
    if (await listed(c)) {
      console.log(`${c} ${version}: already on crates.io, skipped`);
      continue;
    }
    console.log(`== cargo publish -p ${c} --locked --no-verify`);
    const r = spawnSync(cargo[0], [...cargo.slice(1), "publish", "-p", c, "--locked", "--no-verify"], {
      cwd: join(import.meta.dirname!, ".."),
      stdio: "inherit",
    });
    if (r.status !== 0) fail(`cargo publish -p ${c} failed (exit ${r.status}); the crates after it were not attempted`);
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

// readback — FATAL unless crates.io serves VERSION of every crate, none yanked
const attempts = Number(process.env.READBACK_ATTEMPTS ?? "30");
const interval = Number(process.env.READBACK_INTERVAL_MS ?? "10000");
for (const c of CRATES) {
  let last = "";
  let served = false;
  for (let i = 1; i <= attempts && !served; i++) {
    const r = await call("GET", `${registry}/api/v1/crates/${c}/${version}`);
    const v = r.json?.version;
    if (r.status === 200 && v?.num === version) {
      if (v.yanked) fail(`crates.io serves ${c} ${version} but it is YANKED`);
      console.log(`crates.io serves ${c} ${version} (not yanked), attempt ${i}`);
      served = true;
      break;
    }
    last = `HTTP ${r.status}`;
    console.log(`${c}: attempt ${i}/${attempts}: ${last}`);
    if (i < attempts) await new Promise((resolve) => setTimeout(resolve, interval));
  }
  if (!served) fail(`crates.io does not serve ${c} ${version} after ${attempts} attempts (${last})`);
}
console.log(`read back: ${CRATES.join(", ")} ${version}, none yanked`);
