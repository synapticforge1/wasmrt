// The GitHub half of a release, through GitHub's REST API — never `gh` (workspace letters H30, H32,
// H33). The `release` workflow (`.github/workflows/release.yml`) runs on every push of `main`:
//
//   bun scripts/github-release.ts state   # checks job: is this push a release?  new | rerun | none
//   bun scripts/github-release.ts tag     # tag job (U6): CI's annotated tag vX.Y.Z on GITHUB_SHA
//   bun scripts/github-release.ts page    # release job (U7): the Release page FROM that tag
//   … --dry-run                           # every check, nothing written
//
// 🔒 The owner's order (2026-11-10): "CI to check first, then push the tag, and then create the
// release page from the tag, then publish the package to the registry". Nobody pushes a tag by hand
// any more: `scripts/release.ts` pushes `main` only. A tag made with the job's GITHUB_TOKEN starts no
// workflow run, so tag, page and publish all run in the one run the push of `main` started.
//
// Environment (GitHub Actions sets all but the token and VERSION, which the job passes in):
//   GITHUB_REPOSITORY  owner/repo        GITHUB_SHA  the commit the run is for
//   VERSION            X.Y.Z, Cargo.toml's [workspace.package] version (the tag is vX.Y.Z)
//   GITHUB_TOKEN       contents: write for `tag` / `page`; reads work without it
//   GITHUB_API_URL     default https://api.github.com (the self-test points it at a mock)
//   GITHUB_OUTPUT      when set, `state` also writes `state=<answer>` there
//   WASMRT_HTTP_TIMEOUT_MS  per-request time limit, request to last byte, default 30000 (best-practices 7.21)
//   WASMRT_CHANGELOG   default CHANGELOG.md at the repository root (the self-test sets it)
//
// state: the tag is absent → new (a release); it peels to GITHUB_SHA → rerun (finish what a failed
//        run left); it peels elsewhere → none (an ordinary push of an already-released version).
// tag:   absent → POST git/tags (annotated, message "vX.Y.Z") + POST git/refs, then read back: it must
//        peel to GITHUB_SHA. Already on GITHUB_SHA → done, nothing written. Elsewhere → refused: a
//        published tag never moves.
// page:  the page is what it has been since v0.6.4 — title = the CHANGELOG heading without "## ",
//        body = that version's CHANGELOG section, no generated notes (wasmrt's recorded choice: the
//        CHANGELOG is the release note). H32's order, each step refusing with exit 1 on anything
//        unexpected: (0) the CHANGELOG has a non-empty section, checked before any request; (1) the
//        tag exists and peels to GITHUB_SHA (`POST /releases` would CREATE a missing tag from the
//        default branch); (2) an existing page = done, no write; (3) POST, read back (the tag, not a
//        draft), peel again. No `target_commitish`, no `release/<tag>` branch (ledger C45).
//
// `node:` builtins and `fetch` only. Self-test: `bun scripts/check-github-release.ts`.
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const argv = process.argv.slice(2);
const command = argv[0];
if (!["state", "tag", "page"].includes(command ?? "")) {
  fail(`the first argument must be state | tag | page (got "${command ?? ""}")`);
}
for (const arg of argv.slice(1)) {
  if (arg !== "--dry-run") fail(`unknown argument "${arg}" — use --dry-run or nothing`);
}
const dryRun = argv.slice(1).includes("--dry-run");

function fail(msg: string): never {
  console.error(`github-release: ${msg}`);
  process.exit(1);
}

function need(name: string): string {
  const v = process.env[name];
  if (!v) fail(`${name} is not set`);
  return v;
}

const repo = need("GITHUB_REPOSITORY");
const sha = need("GITHUB_SHA");
const version = need("VERSION");
const tag = `v${version}`;
const token = process.env.GITHUB_TOKEN ?? "";
const api = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/+$/, "");
const timeoutMs = Number(process.env.WASMRT_HTTP_TIMEOUT_MS ?? "30000");
const changelog = process.env.WASMRT_CHANGELOG || join(import.meta.dirname!, "..", "CHANGELOG.md");

if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) fail(`GITHUB_REPOSITORY "${repo}" is not owner/repo`);
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`VERSION "${version}" is not X.Y.Z`);
if (!/^[0-9a-f]{40}$/.test(sha)) fail(`GITHUB_SHA "${sha}" is not a full commit id`);
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  fail(`WASMRT_HTTP_TIMEOUT_MS "${timeoutMs}" is not a positive number`);
}

/** The heading and body of `## [version]` in the CHANGELOG, up to the next `## [`. */
function notesFor(v: string): { title: string; body: string } {
  let text: string;
  try {
    text = readFileSync(changelog, "utf8");
  } catch (e) {
    fail(`cannot read ${changelog}: ${(e as Error).message}`);
  }
  const pre = `## [${v}]`;
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.startsWith(pre));
  if (start < 0) fail(`no CHANGELOG section "${pre}"; refusing to publish an empty release`);
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## ["));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end).join("\n").trim();
  if (!body) fail(`the CHANGELOG section "${pre}" is empty; refusing to publish an empty release`);
  return { title: lines[start].slice(3).trim(), body };
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": `${repo} release workflow`,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; json: any }> {
  let res: Response;
  let text: string;
  try {
    // The limit covers the request AND the body (a server that stalls mid-body still fails).
    const signal = AbortSignal.timeout(timeoutMs);
    res = await fetch(`${api}${path}`, {
      method,
      headers: body === undefined ? headers() : { ...headers(), "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    text = await res.text();
  } catch (e) {
    const name = (e as Error).name;
    if (name === "TimeoutError" || name === "AbortError") fail(`${method} ${path}: no answer within ${timeoutMs} ms`);
    fail(`${method} ${path}: ${(e as Error).message}`);
  }
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

/** The commit the tag peels to on GitHub (annotated tags followed), or null when it is absent. */
async function peel(): Promise<string | null> {
  const ref = await call("GET", `/repos/${repo}/git/ref/tags/${tag}`);
  if (ref.status === 404) return null;
  if (ref.status !== 200) fail(`GET tag ref ${tag}: HTTP ${ref.status} ${JSON.stringify(ref.json)}`);
  let object = ref.json?.object as { type: string; sha: string } | undefined;
  for (let depth = 0; object?.type === "tag"; depth++) {
    if (depth > 5) fail(`tag ${tag} nests more than 5 tag objects`);
    const t = await call("GET", `/repos/${repo}/git/tags/${object.sha}`);
    if (t.status !== 200) fail(`GET tag object ${object.sha}: HTTP ${t.status}`);
    object = t.json?.object;
  }
  if (object?.type !== "commit") fail(`tag ${tag} does not point to a commit (${JSON.stringify(object)})`);
  return object.sha;
}

if (command === "state") {
  const at = await peel();
  const state = at === null ? "new" : at === sha ? "rerun" : "none";
  console.log(`state=${state}  (tag ${tag} ${at === null ? "absent" : `on ${at}`}; this run is for ${sha})`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `state=${state}\n`);
  process.exit(0);
}

if (command === "tag") {
  const at = await peel();
  if (at === sha) {
    console.log(`tag ${tag} already on ${sha}, nothing written`);
    process.exit(0);
  }
  if (at !== null) fail(`tag ${tag} is on ${at}, not ${sha}; refusing (a published tag never moves)`);
  if (dryRun) {
    console.log(`dry-run: would create the annotated tag ${tag} on ${sha}`);
    process.exit(0);
  }
  if (!token) fail("GITHUB_TOKEN is not set; cannot create the tag");
  const obj = await call("POST", `/repos/${repo}/git/tags`, { tag, message: tag, object: sha, type: "commit" });
  if (obj.status !== 201 || !/^[0-9a-f]{40}$/.test(obj.json?.sha ?? "")) {
    fail(`POST tag object ${tag}: HTTP ${obj.status} ${JSON.stringify(obj.json)}`);
  }
  const ref = await call("POST", `/repos/${repo}/git/refs`, { ref: `refs/tags/${tag}`, sha: obj.json.sha });
  if (ref.status !== 201) fail(`POST ref refs/tags/${tag}: HTTP ${ref.status} ${JSON.stringify(ref.json)}`);
  const back = await peel();
  if (back !== sha) fail(`after creating it, tag ${tag} peels to ${back ?? "nothing"}, not ${sha}`);
  console.log(`tag ${tag} created (annotated, object ${obj.json.sha}) on ${sha}, read back`);
  process.exit(0);
}

// page — H32's order.
// 0. The notes exist (no request is made for a version the CHANGELOG does not describe).
const notes = notesFor(version);

// 1. The tag exists and peels to the commit this run is for.
const peeled = await peel();
if (peeled === null) fail(`tag ${tag} does not exist on GitHub; refusing (a release would create it)`);
if (peeled !== sha) fail(`tag ${tag} is ${peeled}, this run is for ${sha}; refusing`);
console.log(`tag ${tag} = ${sha}`);

// 2. Already released?
const existing = await call("GET", `/repos/${repo}/releases/tags/${tag}`);
if (existing.status === 200) {
  console.log(`GitHub Release ${tag} already exists, nothing written: ${existing.json?.html_url}`);
  process.exit(0);
}
if (existing.status !== 404) fail(`GET release ${tag}: HTTP ${existing.status} ${JSON.stringify(existing.json)}`);

// 3. Create it, then read it back and check the tag again.
const body = { tag_name: tag, name: notes.title, body: notes.body, draft: false, prerelease: false };
if (dryRun) {
  console.log(`dry-run: would POST /repos/${repo}/releases name=${JSON.stringify(notes.title)} body=${notes.body.length} chars`);
  process.exit(0);
}
if (!token) fail("GITHUB_TOKEN is not set; cannot create the release");
const created = await call("POST", `/repos/${repo}/releases`, body);
if (created.status !== 201) fail(`POST release ${tag}: HTTP ${created.status} ${JSON.stringify(created.json)}`);
const back = await call("GET", `/repos/${repo}/releases/tags/${tag}`);
if (back.status !== 200 || back.json?.tag_name !== tag || back.json?.draft !== false) {
  fail(`read-back of release ${tag}: HTTP ${back.status} ${JSON.stringify(back.json)}`);
}
const after = await peel();
if (after !== sha) fail(`after the POST, tag ${tag} is ${after ?? "missing"}, not ${sha}`);
console.log(`GitHub Release ${tag} created by ${back.json?.author?.login ?? "?"}: ${back.json?.html_url}`);
