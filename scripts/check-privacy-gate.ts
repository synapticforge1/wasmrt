// check-privacy-gate.ts — self-test of scripts/privacy-gate.ts (H37 (b)). Every rule is shown to FIRE
// on a planted sample and to stay quiet on its look-alike. Samples are assembled at run time so this
// file itself passes the gate.  bun scripts/check-privacy-gate.ts
import process from "node:process";
import { findLeaks, mask, parseArgs, privateFilesTracked, textOf } from "./privacy-gate.ts";

let pass = 0, failures = 0;
function check(name: string, ok: boolean) {
  if (ok) pass++;
  else {
    failures++;
    console.error(`✗ ${name}`);
  }
}
const kinds = (name: string, text: string) => findLeaks(name, text).map((l) => l.kind);
const at = "@";
const d = (letter: string, rest: string) => `${letter}:${rest}`;

// Paths: real-looking ones fire, placeholders do not.
check("Windows profile path", kinds("a.md", `see ${d("C", "\\Users\\alice\\x")}`).includes("drive path"));
check("Windows profile path, forward slashes", kinds("a.md", d("D", "/Programs/proj")).includes("drive path"));
check("JSON-escaped drive path", kinds("a.json", `"${d("C", "\\\\Users\\\\bob")}"`).includes("drive path"));
check("WSL drive path", kinds("a.md", "/mnt/c/" + "Users/bob/x").includes("drive path"));
check("Git Bash drive path", kinds("a.md", " /d/" + "Programs/x").includes("drive path"));
check("macOS home", kinds("a.md", "/Users/" + "carol/src").includes("home path"));
check("Linux home", kinds("a.md", "/home/" + "dave/src").includes("home path"));
check("CI runner home is not personal", kinds("a.md", "/home/" + "runner/work").length === 0);
check("a placeholder drive is not a path", kinds("a.md", "`<drive>:\\Users\\<name>\\…`").length === 0);
check("system32 is not a profile", kinds("a.md", d("C", "\\Windows\\system32")).length === 0);

// Credentials.
check("private key block", kinds("k", "-----BEGIN " + "RSA PRIVATE KEY-----").includes("private key"));
check("GitHub token", kinds("t", "ghp_" + "a".repeat(36)).includes("GitHub token"));
check("crates.io token", kinds("t", "cio" + "A1b2".repeat(8)).includes("crates.io token"));
check("secret assignment", kinds("t", `api_key = "${"x".repeat(12)}"`).includes("secret assignment"));
check("an env-var reference is not a secret", kinds("t", `token = "$${"CARGO_REGISTRY_TOKEN"}"`).length === 0);
check("URL password", kinds("t", "https://u:" + "pw" + at + "srv.io/x").includes("URL password"));
check("localhost URL password is not a leak", kinds("t", "http://u:pw" + at + "localhost/x").length === 0);

// Email addresses.
const person = "someone" + at + "mail.io";
check("an address outside Cargo.toml", kinds("README.md", person).includes("email address"));
check("the maintainer address in Cargo.toml", kinds("Cargo.toml", `authors = ["X <${person}>"]`).length === 0);
check("a SECOND address in Cargo.toml", kinds("Cargo.toml", `${person}\nother${at}mail.io`).includes("email address"));
check("a crate's Cargo.toml is not the root's", kinds("crates/x/Cargo.toml", person).includes("email address"));
check("noreply is not personal", kinds("a", "noreply" + at + "anthropic.com").length === 0);
check("GitHub noreply is not personal", kinds("a", "1+x" + at + "users.noreply.github.com").length === 0);
check("example.com is not personal", kinds("a", "x" + at + "example.com").length === 0);

// Encodings, masking, private files, arguments.
check("UTF-16LE text is read", kinds("b", textOf(new Uint8Array(Buffer.from("ghp_" + "b".repeat(36), "utf16le")))).includes("GitHub token"));
check("a mask never shows more than three characters", mask("ghp_secretsecret") === "ghp*************".slice(0, 3 + 12));
check("review-issues.md tracked is refused", privateFilesTracked(["cmem/review-issues.md"]).length === 1);
check("cmem/local tracked is refused", privateFilesTracked(["cmem/local/x.md"]).length === 1);
check(".claude tracked is refused", privateFilesTracked([".claude/settings.local.json"]).length === 1);
check("ordinary files pass", privateFilesTracked(["cmem/INDEX.md", "src/lib.rs"]).length === 0);
check("--commits takes a range", parseArgs(["--commits", "a..b"]).commits === "a..b");
let threw = false;
try { parseArgs(["--commits"]); } catch { threw = true; }
check("--commits without a value is refused", threw);
threw = false;
try { parseArgs(["--other"]); } catch { threw = true; }
check("an unknown argument is refused", threw);

console.log(`check-privacy-gate: ${pass} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
