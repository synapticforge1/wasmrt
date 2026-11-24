//! **A refusal names the byte, as wasmtime does** (review I1 and its siblings, 2026-11-23).
//!
//! wasmtime 51 and wasm-tools 1.263, measured on the same bytes: `call_indirect`'s table index
//! without reference-types is "zero byte expected" AT that byte, and a truncated module is
//! "unexpected end-of-file" at the offset where the next byte was needed. wasmrt reported the
//! instruction's start for the first and no offset at all for the second.

use std::process::Command;

fn file(name: &str, bytes: &[u8]) -> std::path::PathBuf {
    let d = std::path::Path::new(env!("CARGO_TARGET_TMPDIR")).join(format!("wasmrt_reports_offsets_{}", std::process::id()));
    std::fs::create_dir_all(&d).expect("scratch dir");
    let p = d.join(name);
    std::fs::write(&p, bytes).expect("write fixture");
    p
}

fn stderr_of(args: &[&str]) -> String {
    let out = Command::new(env!("CARGO_BIN_EXE_wasmrt")).args(args).output().expect("run wasmrt");
    assert!(!out.status.success(), "{args:?} must fail");
    String::from_utf8_lossy(&out.stdout).to_string() + &String::from_utf8_lossy(&out.stderr)
}

#[test]
fn a_call_indirect_table_byte_is_reported_at_that_byte() {
    // type () -> (); one function; a funcref table; a memory; body: i32.const 0 ; call_indirect
    // type 0 with the table index overlong (`80 00`) ; end. The table index's first byte is at 38.
    let m = file(
        "call_indirect_overlong.wasm",
        &[
            0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x03, 0x02, 0x01,
            0x00, 0x04, 0x04, 0x01, 0x70, 0x00, 0x01, 0x05, 0x03, 0x01, 0x00, 0x01, 0x0a, 0x0a, 0x01, 0x08, 0x00,
            0x41, 0x00, 0x11, 0x00, 0x80, 0x00, 0x0b,
        ],
    );
    let text = stderr_of(&["--features", "all,-reference-types", m.to_str().unwrap()]);
    assert!(
        text.contains("invalid module at offset 38 (function 0): zero byte expected"),
        "as wasmtime: `Invalid input WebAssembly code at offset 38: zero byte expected`; got:\n{text}"
    );
}

#[test]
fn a_truncated_module_is_reported_where_the_next_byte_was_needed() {
    // The header, then a type section id and a size LEB that never ends.
    let m = file("truncated.wasm", &[0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x80]);
    let text = stderr_of(&[m.to_str().unwrap()]);
    assert!(
        text.contains("decode failed at offset 10: unexpected end of input"),
        "as wasmtime: `unexpected end-of-file (at offset 0xa)`; got:\n{text}"
    );
}

/// Review P1 / P4 (2026-11-23): `wasmrt wasi` reported its decode failure with no offset — the one CLI path
/// the fix had missed.
#[test]
fn the_wasi_path_reports_the_offset_too() {
    let m = file("truncated_wasi.wasm", &[0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x80]);
    let text = stderr_of(&["wasi", m.to_str().unwrap()]);
    assert!(text.contains("decode failed at offset 10: unexpected end of input"), "got:\n{text}");
}
