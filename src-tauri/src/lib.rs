//! SagaTree desktop shell — boots the Vite SPA and a Node host sidecar on loopback.
//! Location: src-tauri/src/lib.rs

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Manager, RunEvent, State};

struct HostSidecar(Mutex<Option<Child>>);

fn resolve_sidecar_script(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled = resource_dir.join("resources").join("host-sidecar.mjs");
        if bundled.is_file() {
            return Some(bundled);
        }
        let flat = resource_dir.join("host-sidecar.mjs");
        if flat.is_file() {
            return Some(flat);
        }
    }

    // Dev / repo checkout: script next to this crate.
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/host-sidecar.mjs");
    if dev.is_file() {
        return Some(dev);
    }
    None
}

fn resolve_repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn spawn_host_sidecar(app: &AppHandle) -> Option<Child> {
    let script = match resolve_sidecar_script(app) {
        Some(path) => path,
        None => {
            eprintln!("sagatree-desktop: host-sidecar.mjs missing — SPA-only mode");
            return None;
        }
    };

    let repo_root = resolve_repo_root();
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| repo_root.join(".sagatree-desktop-data"));

    let mut child = match Command::new("node")
        .arg(&script)
        .env("SAGATREE_DATA_DIR", &data_dir)
        .env("SAGATREE_REPO_ROOT", &repo_root)
        .env("SAGATREE_SIDECAR_PORT", "8787")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(err) => {
            eprintln!("sagatree-desktop: failed to spawn host sidecar: {err}");
            return None;
        }
    };

    if let Some(stdout) = child.stdout.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().flatten() {
                eprintln!("sagatree-host: {line}");
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().flatten() {
                eprintln!("sagatree-host-err: {line}");
            }
        });
    }

    // Brief settle so a fast boot failure is visible in logs before the window opens.
    thread::sleep(Duration::from_millis(150));
    match child.try_wait() {
        Ok(Some(status)) => {
            eprintln!("sagatree-desktop: host sidecar exited early ({status}) — SPA continues");
            None
        }
        Ok(None) => Some(child),
        Err(err) => {
            eprintln!("sagatree-desktop: host sidecar status check failed: {err}");
            let _ = child.kill();
            None
        }
    }
}

fn stop_host_sidecar(state: &HostSidecar) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(HostSidecar(Mutex::new(None)))
        .setup(|app| {
            let child = spawn_host_sidecar(app.handle());
            if let Ok(mut guard) = app.state::<HostSidecar>().0.lock() {
                *guard = child;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building SagaTree desktop application")
        .run(|app_handle, event| {
            if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
                let state: State<'_, HostSidecar> = app_handle.state();
                stop_host_sidecar(&state);
            }
        });
}
