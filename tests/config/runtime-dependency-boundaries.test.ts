/** Compatible security patches must work through their real consumers. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { glob } from 'glob';
import { describe, expect, it } from 'vitest';

describe('runtime dependency consumer boundaries', () => {
  it('accepts multipart input with prototype-named headers without crashing the server', async () => {
    // GHSA-x8mw-p69m-v3mx: use the Fastify multipart integration, not Busboy alone.
    const app = Fastify();
    await app.register(multipart);
    app.post('/upload', async (request) => {
      const fields: string[] = [];
      for await (const part of request.parts()) {
        if (part.type === 'field') fields.push(String(part.value));
        else await part.toBuffer();
      }
      return { fields };
    });
    app.get('/health', async () => ({ ok: true }));
    try {
      for (const extra of ['', '__proto__: value\r\n', 'constructor: value\r\n']) {
        const response = await app.inject({ method: 'POST', url: '/upload',
          headers: { 'content-type': 'multipart/form-data; boundary=fixture' },
          payload: '--fixture\r\nContent-Disposition: form-data; name="message"\r\n'+extra+'\r\nsafe\r\n--fixture--\r\n' });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ fields: ['safe'] });
        expect((await app.inject('/health')).json()).toEqual({ ok: true });
      }
    } finally { await app.close(); }
  });

  it('resolves referenced JSON schemas through Fastify and the patched fast-uri consumer', async () => {
    const app = Fastify();
    app.addSchema({ $id: 'https://example.test/schemas/value.json', type: 'object',
      required: ['value'], properties: { value: { type: 'integer' } }, additionalProperties: false });
    app.post('/validate', { schema: { body: { $ref: 'https://example.test/schemas/value.json#' } } },
      async (request) => request.body);
    try {
      expect((await app.inject({ method: 'POST', url: '/validate', payload: { value: 7 } })).statusCode).toBe(200);
      expect((await app.inject({ method: 'POST', url: '/validate', payload: {} })).statusCode).toBe(400);
    } finally { await app.close(); }
  });

  it('expands file alternatives through glob without changing minimatch call shape', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'runtime-glob-'));
    try {
      await Promise.all(['one.ts', 'two.js', 'skip.txt'].map(name => writeFile(join(directory, name), 'fixture')));
      expect((await glob('*.{ts,js}', { cwd: directory })).sort()).toEqual(['one.ts', 'two.js']);
      // GHSA-q2hr-2g5m-vwhr's malformed brace shape remains literal at the consumer boundary.
      expect(await glob('{a}' + '}'.repeat(128) + ',z}', { cwd: directory })).toEqual([]);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
