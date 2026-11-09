// Self-test of scripts/github-release.ts against a mock GitHub REST API (`node:http`): each case
// sets the mock's state, runs the script as a subprocess with GITHUB_API_URL pointing at the mock,
// and asserts the exit code, how many POSTs were sent, and a fragment of the output. A check never
// seen to fail is not a check: this one was inverted by mutants (cmem/releasing.md § The release page).
//
//   bun scripts/check-github-release.ts [path/to/github-release.ts]
//
// Runs in the release workflow's compatibility gate, before the job that holds the write token.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const SCRIPT = process.argv[2] ?? join(import.meta.dirname!, "github-release.ts");
const REPO = "acme/widget";
const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);
const TAGOBJ = "c".repeat(40);

const dir = mkdtempSync(join(tmpdir(), "wasmrt-release-"));
const CHANGELOG = join(dir, "CHANGELOG.md");
writeFileSync(CHANGELOG, [
  "# Changelog", "", "## [Unreleased]", "", "## [1.2.3] — 2026-11-09 — a test release", "",
  "### Fixed", "- the widget", "", "## [1.2.2] — empty next", "", "## [1.2.1] — older", "- x", "",
].join("\n"));

type Tag = { kind: "lightweight" | "annotated"; commit: string } | null;
interface State {
  tag: Tag;
  tagAfterPost?: Tag; // the tag as the read-back after the POST sees it
  release: boolean; // a release already exists for the tag
  postStatus: number; // what POST /releases answers
  draftBack: boolean; // the read-back says draft: true
  stall: boolean; // never answer the ref request in time
}
let state: State;
let posts: any[] = [];
let requests = 0;

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
  requests++;
  const path = new URL(req.url ?? "/", "http://x").pathname;
  const tag = posts.length && state.tagAfterPost !== undefined ? state.tagAfterPost : state.tag;
  const t = "v1.2.3";
  if (path === `/repos/${REPO}/git/ref/tags/${t}`) {
    if (state.stall) await new Promise((r) => setTimeout(r, 5000));
    if (!tag) return send(res, 404, { message: "Not Found" });
    const object = tag.kind === "annotated" ? { type: "tag", sha: TAGOBJ } : { type: "commit", sha: tag.commit };
    return send(res, 200, { ref: `refs/tags/${t}`, object });
  }
  if (path === `/repos/${REPO}/git/tags/${TAGOBJ}` && tag) {
    return send(res, 200, { object: { type: "commit", sha: tag.commit } });
  }
  if (path === `/repos/${REPO}/releases/tags/${t}`) {
    return state.release || (posts.length && state.postStatus === 201)
      ? send(res, 200, {
        tag_name: t, draft: state.draftBack, html_url: "https://example/r", author: { login: "github-actions[bot]" },
      })
      : send(res, 404, { message: "Not Found" });
  }
  if (path === `/repos/${REPO}/releases` && req.method === "POST") {
    posts.push(JSON.parse(await readBody(req)));
    return send(res, state.postStatus, { id: 1 });
  }
  return send(res, 500, { message: `mock: no route ${req.method} ${path}` });
});
await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
const port = (server.address() as { port: number }).port;

let pass = 0, failed = 0;
function check(name: string, ok: boolean, detail: string) {
  if (ok) pass++;
  else {
    failed++;
    console.log(`  FAIL: ${name} — ${detail}`);
  }
}

const base: State = {
  tag: { kind: "lightweight", commit: SHA }, release: false, postStatus: 201, draftBack: false, stall: false,
};

function runScript(env: Record<string, string>, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [SCRIPT, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (out += c));
    p.on("close", (code) => ok({ code: code ?? -1, out }));
  });
}

async function run(
  name: string,
  s: Partial<State>,
  want: { code: number; posts: number; out: string; requests?: number },
  env: Record<string, string> = {},
  args: string[] = [],
) {
  state = { ...base, ...s };
  posts = [];
  requests = 0;
  const { code, out } = await runScript({
    PATH: process.env.PATH ?? "",
    SystemRoot: process.env.SystemRoot ?? "",
    GITHUB_REPOSITORY: REPO, GITHUB_REF_NAME: "v1.2.3", GITHUB_SHA: SHA, GITHUB_TOKEN: "t0ken",
    GITHUB_API_URL: `http://127.0.0.1:${port}`, WASMRT_HTTP_TIMEOUT_MS: "1500", WASMRT_CHANGELOG: CHANGELOG,
    ...env,
  }, args);
  const reqOk = want.requests === undefined || requests === want.requests;
  check(
    name,
    code === want.code && posts.length === want.posts && out.includes(want.out) && reqOk,
    `exit ${code} (want ${want.code}), ${posts.length} POST (want ${want.posts}), ${requests} requests, output: ${
      out.trim().slice(0, 240)
    }`,
  );
  return posts;
}

// 0. The CHANGELOG must describe the version — refused before any request.
await run("no CHANGELOG section: refused, no request", {}, { code: 1, posts: 0, out: "no CHANGELOG section", requests: 0 }, {
  GITHUB_REF_NAME: "v9.9.9",
});
await run("empty CHANGELOG section: refused, no request", {}, { code: 1, posts: 0, out: "is empty", requests: 0 }, {
  GITHUB_REF_NAME: "v1.2.2",
});
// 1. The tag must exist and peel to this run's commit — never a POST otherwise.
await run("missing tag: refused, no POST", { tag: null }, { code: 1, posts: 0, out: "does not exist on GitHub" });
await run("tag at another commit: refused, no POST", { tag: { kind: "lightweight", commit: OTHER } }, {
  code: 1, posts: 0, out: "refusing",
});
await run("annotated tag at another commit: refused", { tag: { kind: "annotated", commit: OTHER } }, {
  code: 1, posts: 0, out: "refusing",
});
// 2. An existing release: done, no write.
await run("release already there: exit 0, no POST", { release: true }, { code: 0, posts: 0, out: "already exists" });
// 3. Create, read back, re-check.
const made = await run("lightweight tag: created", {}, { code: 0, posts: 1, out: "created by github-actions[bot]" });
const b = made[0];
check(
  "POST body: tag, CHANGELOG title and section, not a draft",
  !!b && b.tag_name === "v1.2.3" && b.name === "[1.2.3] — 2026-11-09 — a test release" &&
    b.body === "### Fixed\n- the widget" && b.draft === false && b.prerelease === false &&
    !("generate_release_notes" in b),
  JSON.stringify(b),
);
await run("annotated tag (peeled): created", { tag: { kind: "annotated", commit: SHA } }, {
  code: 0, posts: 1, out: "created",
});
await run("POST answers 422: exit 1", { postStatus: 422 }, { code: 1, posts: 1, out: "HTTP 422" });
await run("read-back is a draft: exit 1", { draftBack: true }, { code: 1, posts: 1, out: "read-back" });
await run("tag moved after the POST: exit 1", { tagAfterPost: { kind: "lightweight", commit: OTHER } }, {
  code: 1, posts: 1, out: "after the POST",
});
// Dry run, missing token, bad input, time limit.
await run("--dry-run: every check, no POST", {}, { code: 0, posts: 0, out: "dry-run: would POST" }, {}, ["--dry-run"]);
await run("no token: refused before any POST", {}, { code: 1, posts: 0, out: "GITHUB_TOKEN is not set" }, {
  GITHUB_TOKEN: "",
});
await run("not a vX.Y.Z tag: refused", {}, { code: 1, posts: 0, out: "is not a vX.Y.Z tag" }, { GITHUB_REF_NAME: "main" });
await run("unknown argument: refused", {}, { code: 1, posts: 0, out: "unknown argument" }, {}, ["--force"]);
await run("a stalled API: the time limit fails it", { stall: true }, { code: 1, posts: 0, out: "no answer within 1500 ms" });

server.closeAllConnections();
server.close();
rmSync(dir, { recursive: true, force: true });
console.log(`\ngithub-release self-test: ${pass} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
