import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkPortableSource } from '../../scripts/ci/check-portable-source.mjs';

const roots: string[] = [];
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'portable-source-'));
  roots.push(root);
  mkdirSync(path.join(root, '.agents/skills'), { recursive: true });
  writeFileSync(path.join(root, 'README.md'), 'portable fixture');
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('portable source archive contract', () => {
  it('rejects the published host skill link even without Git metadata', () => {
    const root = fixture();
    symlinkSync('/opt/skills/wiki-lifecycle', path.join(root, '.agents/skills/wiki-lifecycle'));
    const cli = spawnSync(process.execPath, ['scripts/ci/check-portable-source.mjs', root], { encoding: 'utf8' });
    expect(cli.status).toBe(1);
    expect(cli.stderr).toContain('.agents/skills/wiki-lifecycle: absolute symlink target');
  });
  it('accepts self-contained relative links and a complete source tree without Git', () => {
    const root = fixture();
    symlinkSync('../../README.md', path.join(root, '.agents/skills/readme'));
    expect(checkPortableSource(root)).toEqual({ links: 1, failures: [] });
  });
  it.each(['../../../outside', 'C:\\private\\skills', '//host/share/skills'])('rejects external target %s', (target) => {
    const root = fixture();
    symlinkSync(target, path.join(root, '.agents/skills/external'));
    expect(checkPortableSource(root).failures).toHaveLength(1);
  });
  it('rejects dangling links and indirect escapes without following directory links', () => {
    const root = fixture();
    symlinkSync('missing', path.join(root, 'dangling'));
    symlinkSync('/tmp', path.join(root, 'outer'));
    symlinkSync('outer', path.join(root, 'indirect'));
    expect(checkPortableSource(root).failures).toHaveLength(3);
  });
  it('runs the source gate before the full CI build and suite', () => {
    const ci = readFileSync('scripts/ci/full-ci.mjs', 'utf8');
    expect(ci.indexOf("[process.execPath, ['scripts/ci/check-portable-source.mjs']]")).toBeGreaterThan(0);
    expect(ci.indexOf("[process.execPath, ['scripts/ci/check-portable-source.mjs']]")).toBeLessThan(ci.indexOf("[npmCmd, ['run', 'build:check']]"));
  });
});
