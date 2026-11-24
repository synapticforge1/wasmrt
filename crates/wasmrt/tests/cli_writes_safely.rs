//! **The CLI never destroys a file it was given** (review H2 / H3, 2026-11-24).
//!
//! `wasmrt pin --db` treated a pin DB it could not read as UTF-8 as EMPTY and overwrote it with only the new lines,
//! and `wasmrt wat x.wat -o x.wat` replaced its source with the binary — both with exit code 0.

use std::process::Command;

fn dir() -> std::path::PathBuf {
    let d = std::path::Path::new(env!("CARGO_TARGET_TMPDIR")).join(format!("wasmrt_writes_safely_{}", std::process::id()));
    std::fs::create_dir_all(&d).expect("scratch dir");
    d
}

fn run(args: &[&std::ffi::OsStr]) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_wasmrt")).args(args).output().expect("run wasmrt")
}

#[test]
fn a_pin_db_it_cannot_read_is_refused_not_overwritten() {
    let d = dir();
    let module = d.join("m.wasm");
    std::fs::write(&module, [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]).unwrap();
    // A UTF-16 file (what PowerShell's `>` writes): not UTF-8, so not readable as a DB.
    let db = d.join("pins.db");
    let original: Vec<u8> = [0xff, 0xfe].into_iter().chain("a\0b\0".bytes()).collect();
    std::fs::write(&db, &original).unwrap();
    let out = run(&["pin".as_ref(), module.as_os_str(), "--db".as_ref(), db.as_os_str()]);
    assert!(!out.status.success(), "must refuse: {}", String::from_utf8_lossy(&out.stderr));
    assert_eq!(std::fs::read(&db).unwrap(), original, "the DB is left exactly as it was");
}

#[test]
fn wat_will_not_write_its_output_over_its_input() {
    let d = dir();
    let src = d.join("same.wat");
    let text = b"(module (func (export \"f\")))";
    std::fs::write(&src, text).unwrap();
    let out = run(&["wat".as_ref(), src.as_os_str(), "-o".as_ref(), src.as_os_str()]);
    assert!(!out.status.success(), "must refuse");
    assert_eq!(std::fs::read(&src).unwrap(), text, "the source is untouched");
    // …and an ordinary output is still written, whole.
    let dst = d.join("other.wasm");
    let out = run(&["wat".as_ref(), src.as_os_str(), "-o".as_ref(), dst.as_os_str()]);
    assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
    assert_eq!(&std::fs::read(&dst).unwrap()[..4], b"\0asm");
}

/// Re-review N1: the output may be a device (`NUL` / `/dev/null`), which is written, not renamed over.
#[test]
fn wat_writes_to_the_null_device() {
    let d = dir();
    let src = d.join("dev.wat");
    std::fs::write(&src, b"(module)").unwrap();
    let null = if cfg!(windows) { "NUL" } else { "/dev/null" };
    let out = run(&["wat".as_ref(), src.as_os_str(), "-o".as_ref(), null.as_ref()]);
    assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
    // …written to the device, not replaced by a regular file of that name
    assert!(!std::fs::metadata(null).is_ok_and(|m| m.is_file()), "{null} must still be a device");
}

/// A read-only output is refused (as on Windows, so on Unix too), and left as it was.
#[test]
fn a_read_only_output_is_refused() {
    let d = dir();
    let src = d.join("ro.wat");
    std::fs::write(&src, b"(module)").unwrap();
    let dst = d.join("ro.wasm");
    std::fs::write(&dst, b"keep").unwrap();
    let mut perm = std::fs::metadata(&dst).unwrap().permissions();
    perm.set_readonly(true);
    std::fs::set_permissions(&dst, perm.clone()).unwrap();
    let out = run(&["wat".as_ref(), src.as_os_str(), "-o".as_ref(), dst.as_os_str()]);
    #[allow(clippy::permissions_set_readonly_false)]
    {
        perm.set_readonly(false);
        let _ = std::fs::set_permissions(&dst, perm);
    }
    assert!(!out.status.success(), "a read-only output must be refused");
    assert_eq!(std::fs::read(&dst).unwrap(), b"keep");
}

/// `pin --db` into a directory that does not exist is refused, not created; pinning the same module twice adds no
/// second line; a temporary file a killed run left beside the DB is removed.
#[test]
fn pin_db_directory_duplicates_and_stale_temps() {
    let d = dir().join("pinning");
    std::fs::create_dir_all(&d).unwrap();
    let module = d.join("one.wasm");
    std::fs::write(&module, [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]).unwrap();
    let missing = d.join("no_such_dir").join("pins.db");
    let out = run(&["pin".as_ref(), module.as_os_str(), "--db".as_ref(), missing.as_os_str()]);
    assert!(!out.status.success(), "a missing DB directory is an error");
    assert!(!d.join("no_such_dir").exists(), "and is not created");

    let db = d.join("pins.db");
    let _ = std::fs::remove_file(&db);
    let stale = d.join("pins.db.wasmrt-tmp-999999");
    std::fs::write(&stale, b"left by a killed run").unwrap();
    for _ in 0..2 {
        let out = run(&["pin".as_ref(), module.as_os_str(), "--db".as_ref(), db.as_os_str()]);
        assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
    }
    let text = std::fs::read_to_string(&db).unwrap();
    assert_eq!(text.lines().filter(|l| !l.trim().is_empty()).count(), 1, "pinned once:\n{text}");
    assert!(!stale.exists(), "the stale temporary file is gone");
}


/// Re-review N3: concurrent `pin` runs into one DB keep every pin (each read-modify-write holds the DB's lock).
#[test]
fn concurrent_pins_keep_every_entry() {
    let d = dir().join("concurrent");
    std::fs::create_dir_all(&d).unwrap();
    let db = d.join("pins.db");
    let _ = std::fs::remove_file(&db);
    let runs: Vec<_> = (0..8u8)
        .map(|i| {
            // eight different modules: a custom section whose payload differs
            let module = d.join(format!("m{i}.wasm"));
            std::fs::write(&module, [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x00, 0x02, 0x01, b'a' + i]).unwrap();
            let db = db.clone();
            std::thread::spawn(move || run(&["pin".as_ref(), module.as_os_str(), "--db".as_ref(), db.as_os_str()]))
        })
        .collect();
    for r in runs {
        let out = r.join().unwrap();
        assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
    }
    let text = std::fs::read_to_string(&db).unwrap();
    assert_eq!(text.lines().filter(|l| !l.trim().is_empty() && !l.starts_with('#')).count(), 8, "every pin kept:\n{text}");
}
