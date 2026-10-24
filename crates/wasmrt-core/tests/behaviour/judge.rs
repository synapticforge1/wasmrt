//! The behaviour JUDGE (workspace letter H23, stage S1): which module each feature configuration
//! ACCEPTS. It decodes and validates; it never runs anything.
//!
//! ⚠️ **Compiled twice**: by `tests/behaviour.rs` against this tree, and by
//! `scripts/carry-forward.ts` against an OLDER release's `wasmrt-core`, so a release's behaviour can
//! be measured after the fact. It may therefore use only API every release since 0.9.0 has:
//! `features::{Feature, Features}` with `all()`, `mvp()` and `set()`, `module::decode` and
//! `validate::validate_with_features`. The feature TABLE is passed in, because `Feature::ALL` and
//! the newer variants do not exist in older releases. The carry-forward generates the table from
//! that release's own `Feature::name()`.

use wasmrt_core::features::{Feature, Features};
use wasmrt_core::{module, validate};

/// The configurations, labelled by feature NAME (stable across releases): everything; WebAssembly
/// 1.0; and, for each feature, everything without it and 1.0 with only it added.
pub fn configs(table: &[(Feature, &str)]) -> Vec<(String, Features)> {
    let mut out = vec![(String::from("all"), Features::all()), (String::from("mvp"), Features::mvp())];
    for &(f, name) in table {
        let mut without = Features::all();
        without.set(f, false);
        out.push((format!("all,-{name}"), without));
        let mut with = Features::mvp();
        with.set(f, true);
        out.push((format!("mvp,{name}"), with));
    }
    out
}

/// Does `features` accept `bytes`? Decode, then validate. Nothing runs.
pub fn accepts(bytes: &[u8], features: &Features) -> bool {
    match module::decode(bytes) {
        Ok(m) => validate::validate_with_features(&m, features).is_ok(),
        Err(_) => false,
    }
}

/// One line per ACCEPTED (configuration, module) pair, sorted: `<config> accepts <module>`.
/// Accepted → refused removes a line; refused → accepted adds one.
pub fn verdict_lines(table: &[(Feature, &str)], modules: &[(String, Vec<u8>)]) -> Vec<String> {
    let mut lines = Vec::new();
    for (label, features) in configs(table) {
        for (name, bytes) in modules {
            if accepts(bytes, &features) {
                lines.push(format!("{label} accepts {name}"));
            }
        }
    }
    lines.sort();
    lines
}

/// The corpus: every `.wasm` in `dir`, by file name, sorted.
pub fn load_corpus(dir: &std::path::Path) -> Vec<(String, Vec<u8>)> {
    let mut out: Vec<(String, Vec<u8>)> = std::fs::read_dir(dir)
        .expect("read the behaviour corpus directory")
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "wasm"))
        .map(|p| {
            let name = p.file_name().unwrap().to_string_lossy().into_owned();
            let bytes = std::fs::read(&p).expect("read a corpus module");
            (name, bytes)
        })
        .collect();
    out.sort();
    out
}
