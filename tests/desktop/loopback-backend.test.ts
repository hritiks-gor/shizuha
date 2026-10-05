import { describe, expect, it } from 'vitest';
import { isLoopbackBackendUrl, preferDaemonLoopback } from '../../src/web/lib/backend.js';

describe('loopback desktop core', () => {
  it('treats localhost, ipv4, and ipv6 as this machine', () => {
    expect(isLoopbackBackendUrl('http://localhost:8016')).toBe(true);
    expect(isLoopbackBackendUrl('http://127.0.0.1:8016')).toBe(true);
    expect(isLoopbackBackendUrl('http://[::1]:8016')).toBe(true);
  });

  it('sends the desktop voice socket to the IPv6 daemon, not 127.0.0.1', () => {
    expect(preferDaemonLoopback('http://localhost:8016')).toBe('http://[::1]:8016');
    expect(preferDaemonLoopback('ws://127.0.0.1:8016/v1/voice/realtime?agent=shizuha')).toBe(
      'ws://[::1]:8016/v1/voice/realtime?agent=shizuha',
    );
    expect(preferDaemonLoopback('https://s1.tail.shizuha.com')).toBe('https://s1.tail.shizuha.com');
  });

  it('keeps a remote core behind the dashboard password', () => {
    expect(isLoopbackBackendUrl('https://s1.tail.shizuha.com')).toBe(false);
    expect(isLoopbackBackendUrl('not a url')).toBe(false);
  });
});
