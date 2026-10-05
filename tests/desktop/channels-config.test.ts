import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  desktopChannelPublicView,
  readDesktopChannel,
  writeDesktopChannel,
} from '../../src/desktop/channels.js';

const original = process.env['SHIZUHA_DESKTOP_CHANNELS_PATH'];

afterEach(() => {
  if (original === undefined) delete process.env['SHIZUHA_DESKTOP_CHANNELS_PATH'];
  else process.env['SHIZUHA_DESKTOP_CHANNELS_PATH'] = original;
});

describe('desktop channel config', () => {
  it('stores one bot token for an agent and does not echo it back', () => {
    const file = path.join(os.tmpdir(), `desktop-channels-${process.pid}-${Date.now()}.json`);
    process.env['SHIZUHA_DESKTOP_CHANNELS_PATH'] = file;
    writeDesktopChannel({
      kind: 'telegram',
      token: '123456:telegram-bot-token',
      agentUsername: 'aoi',
      allow: '42',
    });
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    const stored = readDesktopChannel();
    expect(stored?.agentUsername).toBe('aoi');
    expect(stored?.token).toBe('123456:telegram-bot-token');
    const view = desktopChannelPublicView(stored);
    expect(view.configured).toBe(true);
    expect(view.tokenPrefix?.includes('telegram-bot-token')).toBe(false);
    writeDesktopChannel(null);
    expect(readDesktopChannel()).toBeNull();
    fs.rmSync(file, { force: true });
  });
});
