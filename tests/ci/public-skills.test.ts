import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { materialize, readCatalog } from '../../scripts/materialize-public-skills.mjs';

const roots: string[] = [];
function temporary() { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-test-')); roots.push(root); return root; }
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

it('materializes the exact nonempty reviewed release payload without Git or external files', () => {
  const destination = path.join(temporary(), 'runtime-skills');
  const result = spawnSync(process.execPath, ['scripts/materialize-public-skills.mjs', '--dest', destination], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  const manifest = readCatalog(destination);
  expect(manifest.skills).toHaveLength(12);
  expect(manifest.license).toBe('AGPL-3.0-or-later');
  expect(fs.readFileSync(path.join(destination, 'LICENSE'), 'utf8')).toBe(fs.readFileSync('LICENSE', 'utf8'));
  expect(fs.readFileSync(path.join(destination, 'LICENSE'), 'utf8')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
  expect(fs.readFileSync(path.join(destination, 'LICENSE'), 'utf8')).toContain('Copyright (C) 2007 Free Software Foundation, Inc.');
  expect(manifest.skills.map((skill: { name: string }) => skill.name)).toEqual(expect.arrayContaining(['skill-loader', 'engineering-core', 'verify-before-push']));
  expect(fs.existsSync(path.join(destination, '.git'))).toBe(false);
  for (const skill of manifest.skills) {
    expect(fs.readFileSync(path.join(destination, skill.name, 'SKILL.md')))
      .toEqual(fs.readFileSync(path.join('skills-public', skill.name, 'SKILL.md')));
  }
  expect(() => materialize(path.resolve('skills-public'), destination)).toThrow();
});

it('rejects changed bodies and unreviewed payloads before creating release output', () => {
  const root = temporary(); const source = path.join(root, 'source');
  fs.cpSync('skills-public', source, { recursive: true });
  fs.appendFileSync(path.join(source, 'skill-loader', 'SKILL.md'), '\nUnreviewed content');
  expect(() => materialize(source, path.join(root, 'output'))).toThrow('digest mismatch');
  expect(fs.existsSync(path.join(root, 'output'))).toBe(false);
  fs.copyFileSync('skills-public/skill-loader/SKILL.md', path.join(source, 'skill-loader', 'SKILL.md'));
  fs.writeFileSync(path.join(source, 'unreviewed.txt'), 'Not part of catalog');
  expect(() => readCatalog(source)).toThrow('Unreviewed catalog entry');
});

it('rejects a symlink even when it points to bytes with the approved digest', () => {
  const root = temporary(); const source = path.join(root, 'source');
  fs.cpSync('skills-public', source, { recursive: true });
  const body = path.join(source, 'skill-loader', 'SKILL.md');
  fs.renameSync(body, path.join(root, 'outside.md')); fs.symlinkSync(path.join(root, 'outside.md'), body);
  expect(() => readCatalog(source)).toThrow('regular files');
});

it('wires the public image to the reviewed subset and keeps private image defaults', () => {
  const release = fs.readFileSync('.github/workflows/release.yml', 'utf8');
  expect(release).toContain('materialize-public-skills.mjs --dest .runtime-skills');
  expect(release).toContain('SKILLS_MIN_COUNT=${{ env.PUBLIC_SKILLS_COUNT }}');
  expect(release).toContain('SKILLS_REQUIRED=skill-loader engineering-core verify-before-push');
  const dockerfile = fs.readFileSync('Dockerfile.agent-runtime', 'utf8');
  expect(dockerfile).toContain('ARG SKILLS_MIN_COUNT=50');
  expect(dockerfile).toContain('COPY .runtime-skills /opt/skills');
  expect(fs.readFileSync('esbuild.config.js', 'utf8')).toContain("materialize(path.resolve('skills-public')");
});
