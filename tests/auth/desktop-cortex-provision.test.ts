import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeShizuhaAuth } from '../../src/config/shizuhaAuth.js';
import { readCredentials } from '../../src/config/credentials.js';
import { provisionCortexKeyForCurrentLogin } from '../../src/auth/shizuha-login.js';

describe('provisionCortexKeyForCurrentLogin', () => {
  let tmpHome: string;
  const originalHome = process.env['HOME'];

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-cortex-'));
    process.env['HOME'] = tmpHome;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env['HOME'] = originalHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('keeps an existing non-JWT Cortex key', async () => {
    fs.mkdirSync(path.join(tmpHome, '.shizuha'), { recursive: true });
    fs.writeFileSync(path.join(tmpHome, '.shizuha', 'credentials.json'), JSON.stringify({
      cortex: { apiKey: 'sk-cortex-already' },
    }));
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    await expect(provisionCortexKeyForCurrentLogin()).resolves.toEqual({ cortex: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('mints and stores a key after Shizuha ID login', async () => {
    writeShizuhaAuth({
      username: 'hritik',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      lastLoginAt: new Date().toISOString(),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ key: 'sk-cortex-minted' }),
    })));
    await expect(provisionCortexKeyForCurrentLogin('shizuha-desktop')).resolves.toEqual({ cortex: true });
    expect(readCredentials().cortex?.apiKey).toBe('sk-cortex-minted');
  });

  it('reports a warning when Cortex mint fails and does not throw', async () => {
    writeShizuhaAuth({
      username: 'hritik',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      lastLoginAt: new Date().toISOString(),
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({}),
    })));
    const result = await provisionCortexKeyForCurrentLogin();
    expect(result.cortex).toBe(false);
    expect(result.warning).toMatch(/HTTP 403/);
  });
});
