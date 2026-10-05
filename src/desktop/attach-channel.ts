import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Channel, Inbox } from '../gateway/types.js';
import { desktopChannelsPath, readDesktopChannel, type DesktopChannelConfig } from './channels.js';

export interface DesktopChannelHost {
  agentUsername?: string;
  running: boolean;
  registerChannel(channel: Channel): void;
  unregisterChannel(id: string): void;
  getChannels(): Channel[];
  getInbox(): Inbox;
}

const attachedToken = new Map<string, string>();
const watchers = new Map<string, fs.FSWatcher>();

async function buildChannel(config: DesktopChannelConfig): Promise<Channel> {
  if (config.kind === 'telegram') {
    const { TelegramChannel } = await import('../gateway/channels/telegram.js');
    const allowedChatIds = config.allow
      ? config.allow.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n))
      : undefined;
    return new TelegramChannel({ type: 'telegram', botToken: config.token, allowedChatIds });
  }
  const { DiscordChannel } = await import('../gateway/channels/discord.js');
  const allowedGuildIds = config.allow
    ? config.allow.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  return new DiscordChannel({
    type: 'discord',
    botToken: config.token,
    allowedGuildIds,
    respondMode: 'mention',
  });
}

/** Attach the saved desktop bot to this agent when the username matches. */
export async function syncDesktopChannel(host: DesktopChannelHost): Promise<void> {
  const username = host.agentUsername ?? '';
  if (!username) return;
  const wanted = readDesktopChannel();
  const mine = wanted && wanted.agentUsername === username ? wanted : null;
  const existing = host.getChannels().find((channel) => channel.type === 'telegram' || channel.type === 'discord');
  if (!mine) {
    if (existing && attachedToken.has(username)) {
      await existing.stop();
      host.unregisterChannel(existing.id);
      attachedToken.delete(username);
    }
    return;
  }
  if (existing && attachedToken.get(username) === mine.token) return;
  if (existing && attachedToken.has(username)) {
    await existing.stop();
    host.unregisterChannel(existing.id);
  }
  const channel = await buildChannel(mine);
  host.registerChannel(channel);
  attachedToken.set(username, mine.token);
  if (host.running) await channel.start(host.getInbox());
}

export function watchDesktopChannel(host: DesktopChannelHost): void {
  const username = host.agentUsername ?? '';
  if (!username || watchers.has(username)) return;
  const dir = path.dirname(desktopChannelsPath());
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const watcher = fs.watch(dir, () => { void syncDesktopChannel(host); });
    watchers.set(username, watcher);
  } catch {
    // A missing home directory must not stop the agent.
  }
}
