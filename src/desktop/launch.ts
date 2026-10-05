import { spawn } from 'node:child_process';

// localhost first: on macOS, Node's listen('localhost') often binds ::1 only,
// and another app (VS Code) can own 127.0.0.1:8015. A TCP connect to that
// port is not the Shizuha core.
// Prefer IPv4 first (launchd SHIZUHA_DASHBOARD_HOST=127.0.0.1 / WKWebView).
// Same voice bar as Tauri voice_core: shizuha-daemon /health + non-route-404 s2s.
const CANDIDATES = [
  'http://127.0.0.1:8016',
  'http://[::1]:8016',
  'http://localhost:8016',
  'http://127.0.0.1:8015',
  'http://[::1]:8015',
  'http://localhost:8015',
];

async function probe(url: string): Promise<boolean> {
  try {
    const base = url.replace(/\/+$/, '');
    const healthResp = await fetch(`${base}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!healthResp.ok) return false;
    const healthText = await healthResp.text();
    if (!healthText.includes('shizuha-daemon')) return false;
    const s2sResp = await fetch(`${base}/v1/voice/s2s`, {
      signal: AbortSignal.timeout(1500),
    });
    const s2sText = await s2sResp.text();
    return !s2sText.includes('Route GET');
  } catch {
    return false;
  }
}

function openBrowser(url: string): void {
  const plat = process.platform;
  if (plat === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  else if (plat === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}

function startLocalCore(): void {
  const child = spawn(process.execPath, [process.argv[1] || 'shizuha', 'up', '--foreground', '--no-service'], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      SHIZUHA_ALLOW_LOCAL_DAEMON: '1',
      SHIZUHA_DASHBOARD_HOST: '127.0.0.1',
    },
  });
  child.unref();
}

export async function openShizuhaDesktop(opts: { openBrowser?: boolean } = {}): Promise<number> {
  let url = '';
  for (const candidate of CANDIDATES) {
    if (await probe(candidate)) {
      url = candidate;
      break;
    }
  }
  if (!url) {
    process.stdout.write('Starting local Shizuha core (`shizuha up`)…\n');
    startLocalCore();
    const deadline = Date.now() + 20_000;
    while (!url && Date.now() < deadline) {
      for (const candidate of CANDIDATES) {
        if (await probe(candidate)) {
          url = candidate;
          break;
        }
      }
      if (!url) await new Promise((r) => setTimeout(r, 300));
    }
    if (!url) {
      process.stderr.write(
        'Could not start the local core. Run `shizuha up --foreground` in another terminal and retry.\n',
      );
      return 1;
    }
  }
  process.stdout.write(`Shizuha Desktop → ${url}\n`);
  process.stdout.write('Click Live for Hina-style voice-to-voice (needs XAI_API_KEY or `shizuha login`).\n');
  if (opts.openBrowser !== false) openBrowser(url);
  return 0;
}
