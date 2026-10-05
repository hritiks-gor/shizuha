use serde::Serialize;
use std::io::{Read, Write};
use std::net::{Shutdown, SocketAddr, TcpListener, TcpStream};
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;

static CORE: Mutex<Option<Child>> = Mutex::new(None);
/// Webviews reject `http://[::1]` inside connect-src. The page talks to this
/// IPv4 port; the bridge dials the real daemon on ::1.
const BRIDGE_PORT: u16 = 18016;
static BRIDGE_URL: OnceLock<String> = OnceLock::new();

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartCoreResult {
    pub ok: bool,
    pub message: String,
}

fn home_dir() -> Option<std::path::PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(std::path::PathBuf::from)
}

/// A Dock-launched app has PATH=/usr/bin:/bin:/usr/sbin:/sbin, so `which`
/// misses the CLI the installer put in the home directory.
fn find_shizuha() -> Option<String> {
    if let Ok(path) = std::env::var("SHIZUHA_BIN") {
        if !path.trim().is_empty() && std::path::Path::new(path.trim()).is_file() {
            return Some(path);
        }
    }
    let mut candidates = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        if let Some(macos) = exe.parent() {
            candidates.push(macos.join("../Resources/cli/shizuha"));
        }
    }
    if let Some(home) = home_dir() {
        candidates.push(home.join(".shizuha/bin/shizuha"));
        candidates.push(home.join(".local/bin/shizuha"));
    }
    candidates.push(std::path::PathBuf::from("/opt/homebrew/bin/shizuha"));
    candidates.push(std::path::PathBuf::from("/usr/local/bin/shizuha"));
    for candidate in candidates {
        if candidate.is_file() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }
    which("shizuha")
}

fn which(name: &str) -> Option<String> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return Some(candidate.to_string_lossy().into_owned());
        }
        #[cfg(windows)]
        {
            let exe = dir.join(format!("{name}.cmd"));
            if exe.is_file() {
                return Some(exe.to_string_lossy().into_owned());
            }
            let exe = dir.join(format!("{name}.exe"));
            if exe.is_file() {
                return Some(exe.to_string_lossy().into_owned());
            }
        }
    }
    None
}

pub fn start_core() -> StartCoreResult {
    if let Ok(guard) = CORE.lock() {
        if let Some(child) = guard.as_ref() {
            if child.id() > 0 {
                return StartCoreResult {
                    ok: true,
                    message: "Local core is already running.".to_string(),
                };
            }
        }
    }
    let Some(bin) = find_shizuha() else {
        return StartCoreResult {
            ok: false,
            message: "The Shizuha core is not running, and this app did not find ~/.shizuha/bin/shizuha.".to_string(),
        };
    };
    let child = Command::new(&bin)
        .args(["up", "--foreground", "--no-service"])
        .env("SHIZUHA_ALLOW_LOCAL_DAEMON", "1")
        // Match launchd / WKWebView policy: bind IPv4 loopback, not ::1-only.
        .env("SHIZUHA_DASHBOARD_HOST", "127.0.0.1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
    match child {
        Ok(proc) => {
            if let Ok(mut guard) = CORE.lock() {
                *guard = Some(proc);
            }
            StartCoreResult {
                ok: true,
                message: "Started `shizuha up`.".to_string(),
            }
        }
        Err(err) => StartCoreResult {
            ok: false,
            message: format!("Failed to start {bin}: {err}"),
        },
    }
}

fn loopback_v4(port: u16) -> SocketAddr {
    SocketAddr::from(([127, 0, 0, 1], port))
}

fn loopback_v6(port: u16) -> SocketAddr {
    SocketAddr::from(([0, 0, 0, 0, 0, 0, 0, 1], port))
}

/// Probe order for an already-running voice core.
/// Prefer IPv4 first: launchd on m1 binds `SHIZUHA_DASHBOARD_HOST=127.0.0.1`
/// only, and WKWebView cannot fetch `http://[::1]`.
fn upstream_candidates() -> [SocketAddr; 4] {
    [
        loopback_v4(8016),
        loopback_v6(8016),
        loopback_v4(8015),
        loopback_v6(8015),
    ]
}

fn http_get(addr: SocketAddr, path: &str) -> Option<String> {
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_millis(800)).ok()?;
    stream.set_read_timeout(Some(Duration::from_millis(1500))).ok()?;
    stream.set_write_timeout(Some(Duration::from_millis(800))).ok()?;
    let req = format!("GET {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n");
    stream.write_all(req.as_bytes()).ok()?;
    let mut buf = Vec::new();
    let mut tmp = [0u8; 2048];
    loop {
        match stream.read(&mut tmp) {
            Ok(0) => break,
            Ok(n) => {
                buf.extend_from_slice(&tmp[..n]);
                if buf.len() > 65_536 {
                    break;
                }
            }
            Err(_) => break,
        }
    }
    String::from_utf8(buf).ok()
}

/// The voice-capable daemon. A different process can answer /health on
/// 127.0.0.1:8016 and still not be this core.
fn voice_core(addr: SocketAddr) -> bool {
    let Some(health) = http_get(addr, "/health") else {
        return false;
    };
    if !health.contains("shizuha-daemon") {
        return false;
    }
    match http_get(addr, "/v1/voice/s2s") {
        Some(body) => !body.contains("Route GET"),
        None => false,
    }
}

fn upstream_core() -> Option<SocketAddr> {
    for addr in upstream_candidates() {
        if voice_core(addr) {
            return Some(addr);
        }
    }
    None
}

fn splice(client: TcpStream, upstream: SocketAddr) {
    let Ok(remote) = TcpStream::connect_timeout(&upstream, Duration::from_secs(2)) else {
        return;
    };
    let _ = client.set_nodelay(true);
    let _ = remote.set_nodelay(true);
    let Ok(mut client_reader) = client.try_clone() else { return };
    let Ok(mut remote_writer) = remote.try_clone() else { return };
    let client_for_join = client;
    let remote_for_join = remote;
    let forward = thread::spawn(move || {
        let _ = std::io::copy(&mut client_reader, &mut remote_writer);
        let _ = remote_writer.shutdown(Shutdown::Write);
    });
    let mut remote_reader = remote_for_join;
    let mut client_writer = client_for_join;
    let _ = std::io::copy(&mut remote_reader, &mut client_writer);
    let _ = client_writer.shutdown(Shutdown::Write);
    let _ = forward.join();
}

fn ensure_bridge(upstream: SocketAddr) -> Result<String, String> {
    if let Some(url) = BRIDGE_URL.get() {
        return Ok(url.clone());
    }
    let listener = TcpListener::bind(("127.0.0.1", BRIDGE_PORT))
        .map_err(|err| format!("desktop bridge could not listen on 127.0.0.1:{BRIDGE_PORT}: {err}"))?;
    thread::spawn(move || {
        for conn in listener.incoming() {
            let Ok(client) = conn else { continue };
            thread::spawn(move || splice(client, upstream));
        }
    });
    let url = format!("http://127.0.0.1:{BRIDGE_PORT}");
    let _ = BRIDGE_URL.set(url.clone());
    Ok(url)
}

/// URL the webview is allowed to fetch. The page must not call `[::1]` itself.
pub fn desktop_bridge() -> StartCoreResult {
    if let Some(upstream) = upstream_core() {
        return match ensure_bridge(upstream) {
            Ok(url) => url_result(url),
            Err(message) => StartCoreResult { ok: false, message },
        };
    }
    let started = start_core();
    if !started.ok {
        return started;
    }
    for _ in 0..20 {
        if let Some(upstream) = upstream_core() {
            return match ensure_bridge(upstream) {
                Ok(url) => url_result(url),
                Err(message) => StartCoreResult { ok: false, message },
            };
        }
        thread::sleep(Duration::from_millis(250));
    }
    StartCoreResult {
        ok: false,
        message: "The core process started, but it did not answer on 127.0.0.1 or [::1] ports 8016/8015.".to_string(),
    }
}

fn url_result(url: String) -> StartCoreResult {
    StartCoreResult {
        ok: true,
        message: url,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upstream_candidates_prefer_ipv4_then_ipv6_per_port() {
        let c = upstream_candidates();
        assert_eq!(c[0], SocketAddr::from(([127, 0, 0, 1], 8016)));
        assert_eq!(c[1], SocketAddr::from(([0, 0, 0, 0, 0, 0, 0, 1], 8016)));
        assert_eq!(c[2], SocketAddr::from(([127, 0, 0, 1], 8015)));
        assert_eq!(c[3], SocketAddr::from(([0, 0, 0, 0, 0, 0, 0, 1], 8015)));
    }
}
