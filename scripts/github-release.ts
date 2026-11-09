// Create the GitHub Release page for a version tag through GitHub's REST API (workspace letters
// H30 and H32: no `gh`, in CI too; the page is made by CI, never by hand). Run by the
// `github-release` job of `.github/workflows/release.yml`, after the compatibility gate:
//
//   bun scripts/github-release.ts            # create the page (or find it already there)
//   bun scripts/github-release.ts --dry-run  # every check, no POST
//
// Environment (GitHub Actions sets all but the token, which the job passes in):
//   GITHUB_REPOSITORY  owner/repo          GITHUB_REF_NAME  the tag, e.g. v2.0.1
//   GITHUB_SHA         the commit the run is for
//   GITHUB_TOKEN       contents: write (needed only for the POST; reads work without it)
//   GITHUB_API_URL     default https://api.github.com (the self-test points it at a mock)
//   WASMRT_HTTP_TIMEOUT_MS  per-request time limit, default 30000 (best-practices 7.21)
//   WASMRT_CHANGELOG   default CHANGELOG.md at the repository root (the self-test sets it)
//
// The page is what `gh release create` made before (H30 changes HOW, not WHAT): title = the
// CHANGELOG heading without "## ", body = that version's CHANGELOG section. No generated notes.
//
// The order (H32; keep it), each step refusing with exit 1 on anything unexpected:
//   0. The CHANGELOG has a non-empty section for this version (checked before any request).
//   1. The tag exists on GitHub and peels (annotated tags followed) to GITHUB_SHA.
//      `POST /releases` would CREATE a missing tag from the default branch.
//   2. A release for the tag already exists → done, exit 0, no write (a re-run is safe).
//   3. POST {tag_name, name, body}, then read the release back and check the tag again.
//
// Adapted from universalWasmLoader-c `scripts/github-release.ts` (itself from loader-rs).
// `node:` builtins and `fetch` only. Self-test: `bun scripts/check-github-release.ts`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
for (const arg of args) {
  if (arg !== "--dry-run") fail(`unknown argument "${arg}" — use --dry-run or nothing`);
}
const dryRun = args.includes("--dry-run");

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
const tag = need("GITHUB_REF_NAME");
const sha = need("GITHUB_SHA");
const token = process.env.GITHUB_TOKEN ?? "";
const api = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/+$/, "");
const timeoutMs = Number(process.env.WASMRT_HTTP_TIMEOUT_MS ?? "30000");
const changelog = process.env.WASMRT_CHANGELOG || join(import.meta.dirname!, "..", "CHANGELOG.md");

if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) fail(`GITHUB_REPOSITORY "${repo}" is not owner/repo`);
if (!/^v\d+\.\d+\.\d+$/.test(tag)) fail(`GITHUB_REF_NAME "${tag}" is not a vX.Y.Z tag`);
if (!/^[0-9a-f]{40}$/.test(sha)) fail(`GITHUB_SHA "${sha}" is not a full commit id`);
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  fail(`WASMRT_HTTP_TIMEOUT_MS "${timeoutMs}" is not a positive number`);
}

/** The heading and body of `## [version]` in the CHANGELOG, up to the next `## [`. */
function notesFor(version: string): { title: string; body: string } {
  let text: string;
  try {
    text = readFileSync(changelog, "utf8");
  } catch (e) {
    fail(`cannot read ${changelog}: ${(e as Error).message}`);
  }
  const pre = `## [${version}]`;
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

/** The commit a tag peels to on GitHub, or fail. */
async function peel(): Promise<string> {
  const ref = await call("GET", `/repos/${repo}/git/ref/tags/${tag}`);
  if (ref.status === 404) fail(`tag ${tag} does not exist on GitHub; refusing (a release would create it)`);
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

// 0. The notes exist (no request is made for a version the CHANGELOG does not describe).
const notes = notesFor(tag.slice(1));

// 1. The tag exists and peels to the commit this run is for.
const peeled = await peel();
if (peeled !== sha) fail(`tag ${tag} is ${peeled}, this run is for ${sha}; refusing`);
console.log(`tag ${tag} = ${sha}`);

// 2. Already released?
const existing = await call("GET", `/repos/${repo}/releases/tags/${tag}`);
if (existing.status === 200) {
  console.log(`GitHub Release ${tag} already exists: ${existing.json?.html_url}`);
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
if (after !== sha) fail(`after the POST, tag ${tag} is ${after}, not ${sha}`);
console.log(`GitHub Release ${tag} created by ${back.json?.author?.login ?? "?"}: ${back.json?.html_url}`);
