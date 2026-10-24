//! Two contract rows wasmrt was found breaching when it mirrored `interop.md` v11–v31 (2026-10-23),
//! each measured against wazmrt on the same command lines before the fix.
//!
//! * **v27, the `--dir` host GRAMMAR** (§2.2): a relative host path must start `./` or `../`; a
//!   drive needs a separator (`C:/`, Windows only). Anything else is a SYNTAX error, rc 1, before the
//!   filesystem is touched. wasmrt accepted `data`, `data:/m`, `C:` and `data/../data`.
//! * **v28, exact host-flag names in a GUEST position** (§2.4a): after the first guest word, one of
//!   eleven exact names is an error, rc 1. wasmrt passed all eleven (rc 0), warning about three.
//!
//! A legal spelling that names a directory which does not exist fails with `cannot preopen`, which
//! is how these tests tell "refused by the GRAMMAR" from "accepted by it and then not found".

use std::process::Command;

fn wasmrt() -> Command {
    Command::new(env!("CARGO_BIN_EXE_wasmrt"))
}

/// A WASI command with nothing to do, so a run that gets past argument handling succeeds.
fn fixture() -> String {
    let p = std::env::temp_dir().join("wasmrt_contract_dir_guest.wat");
    std::fs::write(&p, br#"(module (func (export "_start")))"#).expect("write fixture");
    p.to_string_lossy().into_owned()
}

fn run(args: &[&str]) -> (bool, String) {
    let out = wasmrt().args(args).output().expect("run wasmrt");
    let text = String::from_utf8_lossy(&out.stderr).into_owned()
        + &String::from_utf8_lossy(&out.stdout);
    (out.status.success(), text)
}

const NOT_THERE: &str = "wasmrt_no_such_dir_contract";

// ---- v27 -------------------------------------------------------------------------------------

#[test]
fn a_bare_relative_host_path_is_a_syntax_error() {
    let m = fixture();
    for spec in [NOT_THERE, &format!("{NOT_THERE}:/m"), &format!("{NOT_THERE}::/m"), "data/../data", "~/x"] {
        let (ok, text) = run(&["wasi", "--dir", spec, &m]);
        assert!(!ok, "--dir {spec} must be refused; got: {text}");
        assert!(text.contains("must start with './'"), "--dir {spec}: refused by the GRAMMAR; got: {text}");
        assert!(!text.contains("cannot preopen"), "--dir {spec}: before the filesystem; got: {text}");
    }
}

#[test]
fn the_same_grammar_binds_ro_dir() {
    let (ok, text) = run(&["wasi", "--ro-dir", NOT_THERE, &fixture()]);
    assert!(!ok && text.contains("must start with './'"), "got: {text}");
}

#[test]
fn spelled_relative_and_rooted_paths_pass_the_grammar() {
    let m = fixture();
    let dot = format!("./{NOT_THERE}");
    let dotdot = format!("../{NOT_THERE}");
    for spec in [dot.as_str(), dotdot.as_str(), &format!("{dot}:/m"), &format!("/{NOT_THERE}")] {
        let (ok, text) = run(&["wasi", "--dir", spec, &m]);
        assert!(!ok && text.contains("cannot preopen"), "--dir {spec}: past the grammar, then not found; got: {text}");
    }
    // `.` exists, so it runs.
    let (ok, text) = run(&["wasi", "--dir", ".:/", &m]);
    assert!(ok, "--dir .:/ is the documented example and must run; got: {text}");
}

#[cfg(windows)]
#[test]
fn a_drive_without_a_separator_is_drive_relative() {
    let m = fixture();
    for spec in ["C:", "C:Users"] {
        let (ok, text) = run(&["wasi", "--dir", spec, &m]);
        assert!(!ok && text.contains("drive-relative"), "--dir {spec}; got: {text}");
    }
    // A drive WITH a separator is absolute, so it passes the grammar.
    let abs = std::env::temp_dir().join(NOT_THERE);
    let (ok, text) = run(&["wasi", "--dir", &abs.to_string_lossy(), &m]);
    assert!(!ok && text.contains("cannot preopen"), "an absolute drive path passes the grammar; got: {text}");
}

// ---- `--features=<list>` (§2.4b) ---------------------------------------------------------------

/// The `=` spelling is the same flag: applied before the path, an error after it naming the
/// position. Measured on wazmrt 2026-10-23; wasmrt refused it as an unknown flag in both places.
#[test]
fn features_with_an_equals_sign_is_the_same_flag() {
    let m = fixture();
    // ⚠️ Not `all,-simd`: wasmrt refuses that CONFIGURATION ("relaxed-simd requires simd"), which
    // contract v30 says it must not ("no configuration is refused — only modules"). That is v30's
    // work item, recorded in `cmem/roadmap.md` (H1); this test is about the `=` spelling only.
    let (ok, text) = run(&["--features=all,-wide-arithmetic", &m]);
    assert!(ok, "`--features=<list>` before the path must apply; got: {text}");
    let (ok, text) = run(&["wasi", "--features=mvp", &m]);
    assert!(ok, "and through `wasi`; got: {text}");
    let (ok, text) = run(&[&m, "--features=mvp"]);
    assert!(!ok && text.contains("must come BEFORE the module path"), "after the path it names the position; got: {text}");
    // It really is applied: a SIMD module is refused under `--features=mvp`.
    let simd = std::env::temp_dir().join("wasmrt_contract_simd.wat");
    std::fs::write(&simd, br#"(module (func (export "f") (result v128) (v128.const i32x4 1 2 3 4)))"#).unwrap();
    let (ok, text) = run(&["--features=mvp", &simd.to_string_lossy()]);
    assert!(!ok && text.contains("simd"), "`--features=mvp` must refuse a SIMD module, naming it; got: {text}");
}

// ---- v28 -------------------------------------------------------------------------------------

/// The eleven names, as measured on wazmrt 2026-10-23. A twelfth added to the CLI must be decided
/// here explicitly — which is the point of listing them.
const REFUSED: [&str; 11] = [
    "--dir", "--ro-dir", "--env", "--max-memory", "--max-table-elems", "--max-iterations",
    "--pins", "--verify", "--no-verify", "--yes", "--allow-symlink",
];

#[test]
fn each_exact_host_flag_name_in_a_guest_position_is_an_error() {
    let m = fixture();
    for name in REFUSED {
        let (ok, text) = run(&[&m, "install", name]);
        assert!(!ok, "`prog install {name}` must be refused (rc 1); got: {text}");
        assert!(text.contains("passed to the GUEST"), "`{name}`: say why; got: {text}");
        // The same through the `wasi` subcommand.
        let (ok, text) = run(&["wasi", &m, "install", name]);
        assert!(!ok, "`wasi prog install {name}` must be refused; got: {text}");
    }
}

#[test]
fn the_guest_keeps_what_is_not_an_exact_host_flag_name() {
    let m = fixture();
    for tail in [
        &["install", "--", "--yes"][..], // the one unconditional hand-off
        &["install", "--yess"],          // EXACT names, never resemblance
        &["install", "--Yes"],
        &["install", "--dirs"],
        &["install", "--dir=x"],         // a `=value` spelling is not the name
        &["install", "--features", "mvp"], // §2.4b's flag, and a guest's own
        &["install", "--help"],          // first-argument-only
        &["-la"],                        // single dash after the path is the guest's (v15)
    ] {
        let mut args = vec![m.as_str()];
        args.extend_from_slice(tail);
        let (ok, text) = run(&args);
        assert!(ok, "`prog {}` must reach the guest; got: {text}", tail.join(" "));
    }
}
