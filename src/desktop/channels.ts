/**
 * One personal bot attached to a local agent. The token stays in
 * ~/.shizuha/desktop-channels.json (mode 0600). Shizuha ID is not involved.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export type DesktopChannelKind = 'telegram' | 'discord';

export interface DesktopChannelConfig {
  kind: DesktopChannelKind;
  token: string;
  agentUsername: string;
  /** Comma-separated Telegram chat ids or Discord guild ids. Empty means unrestricted. */
  allow: string;
}

export function desktopChannelsPath(): string {
  if (process.env['SHIZUHA_DESKTOP_CHANNELS_PATH']) return process.env['SHIZUHA_DESKTOP_CHANNELS_PATH'];
  return path.join(process.env['HOME'] ?? '~', '.shizuha', 'desktop-channels.json');
}

export function readDesktopChannel(): DesktopChannelConfig | null {
  try {
    const raw = JSON.parse(fs.readFileSync(desktopChannelsPath(), 'utf-8')) as Partial<DesktopChannelConfig>;
    if (raw.kind !== 'telegram' && raw.kind !== 'discord') return null;
    const token = typeof raw.token === 'string' ? raw.token.trim() : '';
    const agentUsername = typeof raw.agentUsername === 'string' ? raw.agentUsername.trim() : '';
    if (!token || !agentUsername) return null;
    return {
      kind: raw.kind,
      token,
      agentUsername,
      allow: typeof raw.allow === 'string' ? raw.allow.trim() : '',
    };
  } catch {
    return null;
  }
}

export function writeDesktopChannel(config: DesktopChannelConfig | null): void {
  const file = desktopChannelsPath();
  if (!config) {
    try { fs.unlinkSync(file); } catch { /* already gone */ }
    return;
  }
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function desktopChannelPublicView(config: DesktopChannelConfig | null): {
  configured: boolean;
  kind: DesktopChannelKind | null;
  agentUsername: string | null;
  allow: string;
  tokenPrefix: string | null;
} {
  if (!config) {
    return { configured: false, kind: null, agentUsername: null, allow: '', tokenPrefix: null };
  }
  return {
    configured: true,
    kind: config.kind,
    agentUsername: config.agentUsername,
    allow: config.allow,
    tokenPrefix: config.token.slice(0, 6) + '…',
  };
}
