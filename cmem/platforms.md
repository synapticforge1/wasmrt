# platforms.md — wasmrt's support matrix and platform notes

Last verified: 2026-11-19. The workspace rules are `../workspace/cmem/platforms.md` (IDs, status
values, roles, the Tested on rule, add-platform); `review-process.md` § 12 (letter H37 (g)). wasmrt
is **tier 3, the full matrix** (native by nature). Machine names stay in `local/`.

## Support matrix

| Platform | Status | Target name (Rust) | Tested on |
| --- | --- | --- | --- |
| `win-x64` | `tested` | `x86_64-pc-windows-gnu` (the host, both stable and nightly) | dev machine |
| `win-arm64` | `pending` | `aarch64-pc-windows-gnullvm` | — (arm64 Mac, not yet) |
| `mac-x64` | `pending` | `x86_64-apple-darwin` | — (Intel Mac, not yet) |
| `mac-arm64` | `pending` | `aarch64-apple-darwin` | — (arm64 Mac, not yet) |
| `linux-x64` | `tested` | `x86_64-unknown-linux-gnu` | dev machine's WSL (Ubuntu 26.04.1 LTS), first 2026-11-19 |
| `linux-arm64` | `pending` | `aarch64-unknown-linux-gnu` | — (arm64 Mac, not yet) |

`tested`, not `shipped`: wasmrt publishes SOURCE crates to crates.io (`wasmrt-core`, `wasmrt-capi`,
`wasmrt`); the Release page carries no binary. A user builds on their own platform.

`linux-x64` was exercised by CI's Linux `checks` (Ubuntu runner) up to 2026-11-12; CI tests nothing
since H37 (e), so it is run here (WSL) for each release. 🔁 First run 2026-11-19, for 2.0.2 at
`76ca5a0` (owner: "you can add rust in wsl"): rustup in WSL Ubuntu with CI's dated nightly
(`nightly-2026-11-04`, rustc `708c94ef0`, the Windows run's compiler), `cargo-public-api` 0.52.0 (the
surface step needs it — the first gate attempt stopped there without it), the spec suite through a
symlink to the wasmtk checkout. A fresh clone in the WSL home, ~900 MB once built — removed after the
run. One test is `#[cfg(windows)]` (`a_drive_without_a_separator_is_drive_relative`), so Linux counts
one fewer: 607 / 0 / 1 against Windows' 608 / 0 / 1.

**Second axis — distros (`linux-x64`).**

| Distro and version | libc | Status | Tested on |
| --- | --- | --- | --- |
| Ubuntu 26.04.1 LTS (WSL) | glibc | `tested` 2026-11-19 (2.0.2 review) | dev machine |

**Second axis — wasm targets** (the dual-target contract, `architecture.md`): `wasmrt-core` builds
for `wasm32-unknown-unknown` (`no_std`, `--no-default-features`) and `wasm32-wasip1`; `gate.ts`
builds both on every run. Built, not run: no wasm-hosted test suite exists.

**glibc 2.28 baseline:** unaffected while no Linux binary is shipped (source crates; the user's own
glibc links it). If a prebuilt Linux CLI is ever attached to a Release page, it targets 2.28 with a
gate on its `GLIBC_` symbols, plus a musl build for Alpine (workspace `platforms.md`).

## win-x64

- **Toolchains (owner, 2026-11-24): gnu on both OSes, the same versions** — stable 1.100.0
  (`0ef1bc386`, the MSRV) and one nightly, `nightly-2026-11-04` (`708c94ef0`, pinned in
  `rust-toolchain.toml` and release.yml, and the default: rsxtk's `cargo -Z script` takes the default).
  The gnullvm toolchain is gone; cargo-zigbuild (0.24.1) is built on the gnu nightly.
- **The gnu host's binaries are standalone with no flag** (measured 2026-11-24): release `wasmrt.exe`
  and `wasmrt_capi.dll` import only `KERNEL32`, `ntdll`, `bcryptprimitives` and the `api-ms-win-*`
  UCRT set; a copied `wasmrt.exe` printed its version on a system-only `PATH`. 872 KiB.
- **The gnullvm host links `libunwind.dll` from the toolchain** unless the CRT is static: a copied
  `wasmrt.exe` died before `main` (exit 127) on a system-only `PATH`. Setting: `.cargo/config.toml`,
  `[target.x86_64-pc-windows-gnullvm] rustflags = +crt-static` (~33 KiB). Why: one standalone file.
  Kept for a gnullvm build (win-arm64's target is gnullvm).
- **Entropy:** no `/dev/urandom`; `os_entropy` hashes under `RandomState` keys, which `std` seeds
  from `BCryptGenRandom` (`crates/wasmrt-core/src/rng.rs`, the `not(unix)` twin). No `unsafe`.
- **Raw OS error codes** differ: `ERROR_DIRECTORY` 267, `ERROR_ACCESS_DENIED` 5 (Windows has no
  EISDIR), `ERROR_DIR_NOT_EMPTY` 145 (`wasi/fs.rs`, `is_notdir` / `is_isdir` / `is_notempty`).
- **Symlinks need privilege** (Developer Mode or admin) and must be told file vs directory at
  creation (`wasi/fs.rs` `make_symlink`); the symlink tests say so aloud where they cannot stage one.
- **Host paths:** `.\`, `..\`, drive (`C:/`, `C:\`, `x:/`) and UNC forms are paths only here; a
  drive without a separator (`C:`, `C:Users`) is refused (`crates/wasmrt/src/main.rs`
  `check_host_path`; contract, `interop.md`).
- **Pin DB:** `%ProgramData%\wasmtk\pins` (shared), then the per-runtime paths (`main.rs`
  `db_paths`).
- **The C-ABI gate needs `CC=gcc`** on the dev host (no `cc`); `gate.ts` sets it on Windows.

## linux-x64, linux-arm64, mac-x64, mac-arm64 (the Unix-likes)

- **Entropy:** `/dev/urandom` (`rng.rs`, the `unix` twin).
- **Pin DB:** `/etc/wasmtk/pins` (shared), then the per-runtime paths (`main.rs` `db_paths`).
- **clippy for the other OS:** `gate.ts` type-checks `x86_64-unknown-linux-gnu` from Windows and
  `x86_64-pc-windows-gnu` from Linux (`rust-toolchain.toml` declares both). It does not replace
  running the suite: `rng.rs`'s Linux-only clippy failure (2026-11-12) is why it exists.

## mac-x64, mac-arm64

- ⚠️ **Open (I8, `review-issues.md`): `is_notempty` checks errno 39, which is Linux's ENOTEMPTY;
  macOS's is 66**, so a WASI `rmdir` of a non-empty directory would report `IO`, not `NOTEMPTY`, on
  a Mac. Found by reading, 2026-11-19; unmeasured (no Mac yet).

## Result lines

Per-release results go in that release's `release.md` entry ("Platforms verified"), one line each:
version, commit, date, platform ID (and distro), suite counts.
