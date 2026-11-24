//! **A `.wast` file's feature set does not depend on the working directory** (review I2, 2026-11-23).
//!
//! `wast::features_for_script` gives a spec-suite file the standard plus its own proposal, and any
//! other script every feature. The CLI used to judge that on the cwd-relative name it prints, so
//! running from INSIDE the suite folder (`proposals/threads/imports.wast`, no `testsuite` in it)
//! gave a proposal file every feature: `threads/imports.wast` failed 3 "multiple memories"
//! assertions that pass from outside. The features are now judged on the file's absolute path.

use std::path::{Path, PathBuf};
use std::process::Command;

/// `threads/` asserts two memories INVALID ("multiple memories", as the real suite does): it passes
/// only under the threads feature set, which turns multi-memory off.
const SCRIPT: &str = "(assert_invalid (module (memory 0) (memory 0)) \"multiple memories\")\n";

fn scratch() -> PathBuf {
    let d = std::path::Path::new(env!("CARGO_TARGET_TMPDIR")).join(format!("wasmrt_wast_abs_path_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    d
}

fn put(root: &Path, rel: &str) -> PathBuf {
    let p = root.join(rel);
    std::fs::create_dir_all(p.parent().unwrap()).expect("scratch dir");
    std::fs::write(&p, SCRIPT).expect("write fixture");
    p
}

fn wast(cwd: &Path, file: &Path) -> Option<i32> {
    Command::new(env!("CARGO_BIN_EXE_wasmrt"))
        .current_dir(cwd)
        .arg("wast")
        .arg(file)
        .output()
        .expect("run wasmrt")
        .status
        .code()
}

#[test]
fn a_proposal_file_gets_its_era_features_from_any_working_directory() {
    let root = scratch();
    let suite = root.join("testsuite");
    let file = put(&suite, "proposals/threads/t.wast");
    let control = put(&root, "elsewhere/proposals/threads/t.wast");

    let from_inside = wast(&suite, Path::new("proposals/threads/t.wast"));
    let from_outside = wast(&root, &file);
    let not_the_suite = wast(&root, &control);
    let _ = std::fs::remove_dir_all(&root);

    // The fixture tells the two feature sets apart: outside any `testsuite` folder a script gets
    // every feature, multi-memory makes the module valid, and the assertion fails.
    assert_eq!(not_the_suite, Some(1), "control: a non-suite script runs with every feature");
    assert_eq!(from_outside, Some(0), "the suite file, by its absolute path");
    assert_eq!(from_inside, Some(0), "the suite file, run from inside the suite folder (I2)");
}
