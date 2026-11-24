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

/// The same module named twice in ONE run is pinned once, and a second run says so (review B1). The DB's lock is the
/// operating system's: a run waits while another holds it, and a lock file left beside the DB (by a run that died)
/// does not hold it (re-review N1). A device as the DB is refused.
#[test]
fn pin_dedupes_within_a_run_waits_for_a_held_lock_and_refuses_a_device() {
    let d = dir().join("pin_more");
    std::fs::create_dir_all(&d).unwrap();
    let module = d.join("m.wasm");
    std::fs::write(&module, [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]).unwrap();
    let db = d.join("p.db");
    let _ = std::fs::remove_file(&db);
    // a lock file nobody holds, as a killed run leaves it
    let lock = d.join("p.db.lock");
    std::fs::write(&lock, b"").unwrap();
    let t = std::time::Instant::now();
    let out = run(&["pin".as_ref(), module.as_os_str(), module.as_os_str(), "--db".as_ref(), db.as_os_str()]);
    assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
    assert!(t.elapsed().as_secs() < 5, "an unheld lock file does not hold the DB");
    assert_eq!(std::fs::read_to_string(&db).unwrap().lines().count(), 1, "pinned once");

    // held here: the run waits for it, then records
    let held = std::fs::OpenOptions::new().write(true).open(&lock).unwrap();
    held.lock().unwrap();
    let (m, b) = (module.clone(), db.clone());
    let waiting = std::thread::spawn(move || run(&["pin".as_ref(), m.as_os_str(), "--db".as_ref(), b.as_os_str()]));
    std::thread::sleep(std::time::Duration::from_millis(1500));
    assert!(!waiting.is_finished(), "a run waits while the lock is held");
    held.unlock().unwrap();
    let out = waiting.join().unwrap();
    assert!(String::from_utf8_lossy(&out.stdout).contains("(1 already present)"));

    let null = if cfg!(windows) { "NUL" } else { "/dev/null" };
    let out = run(&["pin".as_ref(), module.as_os_str(), "--db".as_ref(), null.as_ref()]);
    assert!(!out.status.success(), "a device is not a pin DB");
}

/// Unix: a newline in a module's file name cannot forge a DB line (review S1); a symlink's file is written THROUGH,
/// keeping its permissions, and a dangling one is refused; a linked directory is not followed (a cycle once
/// overflowed the stack); a file is replaced, so another hard link keeps the old contents; a FIFO is not a pin DB.
#[cfg(unix)]
#[test]
fn unix_names_links_and_permissions() {
    use std::os::unix::fs::PermissionsExt as _;
    let d = dir().join("unix");
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(d.join("mods")).unwrap();
    let wasm = [0x00u8, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
    let forged = "0".repeat(64);
    std::fs::write(d.join("mods").join(format!("a\n{forged}  x\n.wasm")), wasm).unwrap();
    std::fs::write(d.join("mods").join("ok.wasm"), wasm).unwrap();
    std::os::unix::fs::symlink(d.join("mods"), d.join("mods").join("loop")).unwrap();
    let db = d.join("p.db");
    let out = run(&["pin".as_ref(), d.join("mods").as_os_str(), "--db".as_ref(), db.as_os_str()]);
    assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
    let text = std::fs::read_to_string(&db).unwrap();
    assert!(!text.contains(&forged), "no forged line:\n{text}");
    assert_eq!(text.lines().count(), 1, "only ok.wasm:\n{text}");

    let src = d.join("s.wat");
    std::fs::write(&src, b"(module)").unwrap();
    let real = d.join("real.wasm");
    std::fs::write(&real, b"old").unwrap();
    std::fs::set_permissions(&real, std::fs::Permissions::from_mode(0o640)).unwrap();
    std::os::unix::fs::symlink(&real, d.join("link.wasm")).unwrap();
    assert!(run(&["wat".as_ref(), src.as_os_str(), "-o".as_ref(), d.join("link.wasm").as_os_str()]).status.success());
    assert!(std::fs::symlink_metadata(d.join("link.wasm")).unwrap().file_type().is_symlink(), "the link stays");
    assert_eq!(&std::fs::read(&real).unwrap()[..4], b"\0asm");
    assert_eq!(std::fs::metadata(&real).unwrap().permissions().mode() & 0o777, 0o640, "permissions kept");

    std::os::unix::fs::symlink(d.join("absent.wasm"), d.join("dangling.wasm")).unwrap();
    assert!(!run(&["wat".as_ref(), src.as_os_str(), "-o".as_ref(), d.join("dangling.wasm").as_os_str()]).status.success());
    assert!(!d.join("absent.wasm").exists(), "a dangling link's target is not created");

    let one = d.join("one.wasm");
    std::fs::write(&one, b"old").unwrap();
    std::fs::hard_link(&one, d.join("two.wasm")).unwrap();
    assert!(run(&["wat".as_ref(), src.as_os_str(), "-o".as_ref(), one.as_os_str()]).status.success());
    assert_eq!(&std::fs::read(&one).unwrap()[..4], b"\0asm");
    assert_eq!(std::fs::read(d.join("two.wasm")).unwrap(), b"old", "the other link keeps the old file");

    let fifo = d.join("fifo.db");
    assert!(Command::new("mkfifo").arg(&fifo).status().unwrap().success());
    let out = run(&["pin".as_ref(), d.join("mods").join("ok.wasm").as_os_str(), "--db".as_ref(), fifo.as_os_str()]);
    assert!(!out.status.success(), "a FIFO is not a pin DB");

    // A symlink at the lock's name is refused, and its target is not created; a lock file this user cannot write
    // (another user's) still locks, read-only.
    let ok = d.join("mods").join("ok.wasm");
    std::os::unix::fs::symlink(d.join("planted"), d.join("q.db.lock")).unwrap();
    let out = run(&["pin".as_ref(), ok.as_os_str(), "--db".as_ref(), d.join("q.db").as_os_str()]);
    assert!(!out.status.success(), "a symlinked lock is refused");
    assert!(!d.join("planted").exists(), "and its target is not created");
    std::fs::write(d.join("r.db.lock"), b"").unwrap();
    std::fs::set_permissions(d.join("r.db.lock"), std::fs::Permissions::from_mode(0o444)).unwrap();
    let out = run(&["pin".as_ref(), ok.as_os_str(), "--db".as_ref(), d.join("r.db").as_os_str()]);
    assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
}

/// The tag `wasmrt` puts in a pin DB's temporary file names (`pin_temp_tag`): FNV-1a 64 of the DB's file name.
fn pin_temp_tag(name: &str) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in name.bytes() {
        h = (h ^ u64::from(b)).wrapping_mul(0x0100_0000_01b3);
    }
    format!("pin-{h:016x}-")
}

/// `pin --db` into a directory that does not exist is refused, not created; pinning the same module twice adds no
/// second line; a temporary file a killed run left for this DB is removed, and another target's is not (re-review N5).
#[test]
fn pin_db_directory_duplicates_and_dead_temps() {
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
    let dead = d.join(format!(".wasmrt-tmp-{}999999-0", pin_temp_tag("pins.db")));
    let other = d.join(".wasmrt-tmp-999999-0");
    std::fs::write(&dead, b"").unwrap();
    std::fs::write(&other, b"").unwrap();
    for _ in 0..2 {
        let out = run(&["pin".as_ref(), module.as_os_str(), "--db".as_ref(), db.as_os_str()]);
        assert!(out.status.success(), "{}", String::from_utf8_lossy(&out.stderr));
    }
    let text = std::fs::read_to_string(&db).unwrap();
    assert_eq!(text.lines().filter(|l| !l.trim().is_empty()).count(), 1, "pinned once:\n{text}");
    assert!(!dead.exists(), "this DB's dead temporary file is gone");
    assert!(other.exists(), "another target's temporary file is left alone");
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
