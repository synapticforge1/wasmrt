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

/** Lines with ``` fenced blocks and `<!-- … -->` comments blanked — the SAME rule as
 *  `release-record.ts notes` (which checks it before CI tags; this file is fetched alone in CI, so the
 *  rule is kept identical here rather than imported). */
function prose(lines: string[]): string[] {
  const out: string[] = [];
  let fence = false, comment = false;
  for (const raw of lines) {
    let l = raw;
    if (/^\s*```/.test(l)) { fence = !fence; out.push(""); continue; }
    if (fence) { out.push(""); continue; }
    let kept = "";
    // An inline code span is text, not markup (the same rule as release-record.ts).
    if (!comment) l = l.replace(/`[^`]*`/g, (s) => " ".repeat(s.length));
    while (l.length) {
      if (comment) {
        const end = l.indexOf("-->");
        if (end < 0) { l = ""; break; }
        comment = false;
        l = l.slice(end + 3);
      } else {
        const start = l.indexOf("<!--");
        if (start < 0) { kept += l; break; }
        kept += l.slice(0, start);
        comment = true;
        l = l.slice(start + 4);
      }
    }
    out.push(kept);
  }
  return out;
}

/** The heading and body of `## [version]` (exactly: then a space or the end) in the CHANGELOG, up to
 *  the next `## [`. The body is the section's text as written; it must hold more than fences and
 *  comments. */
function notesFor(v: string): { title: string; body: string } {
  let text: string;
  try {
    text = readFileSync(changelog, "utf8").replace(/\r\n/g, "\n");
  } catch (e) {
    fail(`cannot read ${changelog}: ${(e as Error).message}`);
  }
  const pre = `## [${v}]`;
  const raw = text.split("\n");
  const lines = prose(raw);
  const head = new RegExp(`^## \\[${v.replace(/\./g, "\\.")}\\](\\s|$)`);
  const start = lines.findIndex((l) => head.test(l));
  if (start < 0) fail(`no CHANGELOG section "${pre}"; refusing to publish an empty release`);
  let end = lines.findIndex((l, i) => i > start && l.startsWith("## ["));
  if (end < 0) end = lines.length;
  if (!lines.slice(start + 1, end).join("\n").trim()) {
    fail(`the CHANGELOG section "${pre}" is empty; refusing to publish an empty release`);
  }
  // The title from the comment-free heading: an inline `<!-- -->` must not show in the page name.
  return { title: lines[start].slice(3).trim(), body: raw.slice(start + 1, end).join("\n").trim() };
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

type V = [number, number, number];
const vparse = (s: string): V | null => {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
const vcmp = (a: V, b: V) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Every vX.Y.Z tag on GitHub. ONE request: `git/matching-refs` ignores `per_page`/`page` and
 *  answers every matching ref at once (measured by review round 2 on nodejs/node: 975 refs on
 *  "page 1" and on "page 2"), so a page loop never ended once a repo had 100 tags. */
async function tagsOnGitHub(): Promise<string[]> {
  const r = await call("GET", `/repos/${repo}/git/matching-refs/tags/v`);
  if (r.status !== 200 || !Array.isArray(r.json)) fail(`listing tags: HTTP ${r.status} ${JSON.stringify(r.json)}`);
  const out: string[] = [];
  for (const ref of r.json) {
    const name = String(ref?.ref ?? "").replace(/^refs\/tags\//, "");
    if (vparse(name)) out.push(name);
  }
  return out;
}

/** The crate names in CRATES (comma-separated; empty entries dropped). */
function crateNames(): string[] {
  const names = need("CRATES").split(",").map((s) => s.trim()).filter(Boolean);
  if (!names.length || !names.every((c) => /^[a-z0-9_-]+$/.test(c))) fail(`CRATES "${process.env.CRATES}" is not a list of crate names`);
  return names;
}

/** At most this many pages of any paginated list, and never the same page twice: a paging loop
 *  must end (review round 2: a repeating `next_page` made 50,688 requests in 4 s). */
const MAX_PAGES = 50;

/** A tag at or above this version that already exists, or null: a NEW release must be above every
 *  tag (review round 1: a re-run of an abandoned version's old run would otherwise tag it). */
async function notAboveNewest(): Promise<string | null> {
  const mine = vparse(tag)!;
  const higher = (await tagsOnGitHub()).filter((t) => t !== tag && vcmp(vparse(t)!, mine) >= 0)
    .sort((a, b) => vcmp(vparse(b)!, vparse(a)!));
  return higher[0] ?? null;
}

/** The crates (CRATES, comma-separated) that crates.io does NOT list at this version, read from each
 *  crate's version list (every page). */
async function cratesMissing(): Promise<string[]> {
  const registry = (process.env.CRATES_API_URL || "https://crates.io").replace(/\/+$/, "");
  const missing: string[] = [];
  for (const c of crateNames()) {
    let found = false;
    const seen = new Set<string>();
    for (let url: string | null = `${registry}/api/v1/crates/${c}/versions`, page = 1; url && !found; page++) {
      if (seen.has(url) || page > MAX_PAGES) fail(`crates.io version list for ${c}: pagination did not end (page ${page}, ${url})`);
      seen.add(url);
      let status = 0, json: any = null;
      try {
        const res = await fetch(url, { headers: { "User-Agent": `${repo} release workflow` }, signal: AbortSignal.timeout(timeoutMs) });
        status = res.status;
        json = await res.json().catch(() => null);
      } catch (e) {
        fail(`crates.io version list for ${c}: ${(e as Error).message}`);
      }
      // A 404 means "no such crate" only on the FIRST page; later, it is an error, not an answer.
      if (status === 404 && page === 1) break;
      if (status !== 200 || !Array.isArray(json?.versions)) fail(`crates.io version list for ${c}: HTTP ${status} (page ${page})`);
      found = json.versions.some((v: { num: string }) => v.num === version);
      const next = json.meta?.next_page;
      url = next ? `${registry}/api/v1/crates/${c}/versions${next}` : null;
    }
    if (!found) missing.push(c);
  }
  return missing;
}

if (command === "state") {
  const at = await peel();
  let state: string;
  if (at === sha) state = "rerun";
  else if (at === null) {
    // NEW — but only for a version that has never been released and is above every tag.
    const above = await notAboveNewest();
    if (above) fail(`${tag} has no tag, but ${above} exists: this commit's version is not new (an old run re-run?). Nothing to release; bump the version.`);
    const missing = await cratesMissing();
    const listed = crateNames().filter((c) => !missing.includes(c));
    if (listed.length) {
      fail(`${tag} has no tag, yet crates.io already lists ${listed.join(", ")} at ${version}: the tag was lost or deleted. Restore it on the commit those crates were published from (owner) — never tag this commit.`);
    }
    state = "new";
  } else {
    // The tag is on another commit. A FINISHED release there means nothing to do here; an unfinished
    // one must not read as "nothing to do" (review round 1: a green run while a tagged version never
    // reached crates.io — a burned version nobody was told about).
    const page = await call("GET", `/repos/${repo}/releases/tags/${tag}`);
    if (page.status !== 200 && page.status !== 404) fail(`GET release ${tag}: HTTP ${page.status}`);
    const missing = await cratesMissing();
    if (page.status === 404 || missing.length) {
      fail(`${tag} is tagged on ${at}, but its release is not finished (page: ${page.status === 200 ? "made" : "missing"}; crates.io missing: ${missing.join(", ") || "none"}). If the release run for ${at} is STILL IN PROGRESS, wait for it to finish, then "Re-run all jobs" here. If that run FAILED, finish it with "Re-run failed jobs" on it — GitHub keeps a run re-runnable for 30 days — or, if it cannot succeed, release the next version and record ${tag} in cmem/release.md as unfinished.`);
    }
    state = "none";
  }
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
  if (at !== null) {
    fail(`tag ${tag} is on ${at}, not ${sha}: another commit took this version. A published tag never moves, so re-running this run cannot succeed — nothing here is left to release; bump the version for this commit's changes.`);
  }
  const above = await notAboveNewest();
  if (above) fail(`${above} exists, so ${tag} is not new: refusing to tag (an old run re-run?). Nothing to do; bump the version.`);
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
// `releases/tags/{tag}` does not see DRAFTS: a draft for this tag would be a second page (review round 1).
// Every page (this endpoint does paginate), at most MAX_PAGES, stopping on a short page.
for (let p = 1; ; p++) {
  if (p > MAX_PAGES) fail(`listing releases: more than ${MAX_PAGES} pages`);
  const list = await call("GET", `/repos/${repo}/releases?per_page=100&page=${p}`);
  if (list.status !== 200 || !Array.isArray(list.json)) fail(`listing releases: HTTP ${list.status}`);
  const draft = list.json.find((r: { tag_name?: string; draft?: boolean }) => r.tag_name === tag && r.draft);
  if (draft) fail(`a DRAFT release for ${tag} exists (${draft.html_url ?? draft.id}): publish or delete it on GitHub (owner), then "Re-run failed jobs"`);
  if (list.json.length < 100) break;
}

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
