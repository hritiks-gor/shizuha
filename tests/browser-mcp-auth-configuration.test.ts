import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { resolveBrowserMcpServer } from '../src/browser-mcp.js';

const http = { SHIZUHA_BROWSER_MCP_URL: 'http://127.0.0.1:18116/mcp' };

describe('HTTP browser MCP explicit authentication', () => {
  it.each([{}, { SHIZUHA_BROWSER_MCP_BEARER: ' ', SHIZUHA_BROWSER_MCP_TOKEN: '\t',
    SHIZUHA_BROWSER_MCP_JWT_SECRET: '\n', JWT_SECRET_KEY: ' ' }])('fails closed for missing or blank credentials', env => {
    expect(() => resolveBrowserMcpServer(undefined, { ...http, ...env }))
      .toThrow('requires an explicit bearer token or configured signing key');
  });

  it.each(['SHIZUHA_BROWSER_MCP_BEARER', 'SHIZUHA_BROWSER_MCP_TOKEN'])('preserves %s bytes', name => {
    const token = ' fixture-bearer ';
    const resolved = resolveBrowserMcpServer(undefined, { ...http, [name]: token });
    expect(resolved?.token).toBe(token);
    expect(resolved?.entry).toMatchObject({ headers: { Authorization: `Bearer ${token}` } });
  });

  it.each(['SHIZUHA_BROWSER_MCP_JWT_SECRET', 'JWT_SECRET_KEY'])('signs only with configured %s bytes', name => {
    const secret = ' fixture-signing-key-with-spaces ';
    const resolved = resolveBrowserMcpServer(undefined, { ...http, [name]: secret });
    const [header, payload, signature] = resolved!.token.split('.');
    expect(signature).toBe(createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url'));
    expect(JSON.parse(Buffer.from(payload!, 'base64url').toString()).aud).toBe('shizuha-browser');
  });

  it('preserves the uncredentialed stdio default', () => {
    const resolved = resolveBrowserMcpServer(undefined, { AGENT_EFFECTIVE_CAPABILITIES: 'qa' });
    expect(resolved?.transport).toBe('stdio');
    expect(resolved?.token).toBe('');
  });
});
