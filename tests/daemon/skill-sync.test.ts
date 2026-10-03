import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { installPublicSkills, PUBLIC_SKILLS_REPO, syncSkillsOnce } from '../../src/daemon/skill-sync.js';

const roots: string[] = [];
function temporary() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'public-skill-test-'));
  roots.push(root);
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
function git(root: string, ...args: string[]) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function init(root: string) {
  fs.mkdirSync(root, { recursive: true });
  git(root, 'init', '-b', 'master');
  git(root, 'config', 'user.name', 'Public Skills Test');
  git(root, 'config', 'user.email', 'test@example.org');
}
function commit(root: string) {
  git(root, 'add', '--', 'skills-public');
  git(root, 'commit', '-m', 'Update synthetic public catalog');
}
function catalog(root: string, body = 'Synthetic public guide v1', name = 'public-guide') {
  const source = path.join(root, 'skills-public');
  fs.mkdirSync(path.join(source, name), { recursive: true });
  fs.writeFileSync(path.join(source, name, 'SKILL.md'), body);
  fs.writeFileSync(path.join(source, 'LICENSE'), 'AGPL-3.0-or-later');
  fs.writeFileSync(path.join(source, 'manifest.json'), JSON.stringify({
    schema: 'shizuha.public-skills.v1', license: 'AGPL-3.0-or-later',
    skills: [{ name, sha256: createHash('sha256').update(body).digest('hex') }],
  }));
  return source;
}
function fixture() {
  const root = temporary(); const upstream = path.join(root, 'upstream');
  init(upstream); catalog(upstream); commit(upstream);
  const home = path.join(root, 'home');
  const destination = path.join(home, '.shizuha', 'skills');
  const options = { home, repository: upstream };
  return { root, upstream, home, destination, options };
}
const skill = (root: string) => fs.readFileSync(path.join(root, 'public-guide', 'SKILL.md'), 'utf8');

describe('real Git public skill synchronization', () => {
  it('bootstraps a missing skills directory with only the selected public subtree', () => {
    const f = fixture();
    fs.writeFileSync(path.join(f.upstream, 'not-a-skill.txt'), 'Unrelated application source');
    git(f.upstream, 'add', '--', 'not-a-skill.txt'); git(f.upstream, 'commit', '-m', 'Application file');
    expect(syncSkillsOnce(f.options)).toContain('1 installed');
    expect(skill(f.destination)).toContain('v1');
    expect(fs.readdirSync(f.destination)).toEqual(['public-guide']);
    expect(PUBLIC_SKILLS_REPO).toBe('https://github.com/shizuha-labs/shizuha.git');
  });
  it('adopts a plain bundled directory and refreshes it without changing user-authored entries', () => {
    const f = fixture(); const state = path.join(f.home, '.shizuha', 'public-skills-state.json');
    installPublicSkills(path.join(f.upstream, 'skills-public'), f.destination, state);
    fs.mkdirSync(path.join(f.destination, 'personal')); fs.writeFileSync(path.join(f.destination, 'personal', 'SKILL.md'), 'Mine');
    catalog(f.upstream, 'Synthetic public guide v2'); commit(f.upstream);
    syncSkillsOnce(f.options);
    expect(skill(f.destination)).toContain('v2');
    expect(fs.readFileSync(path.join(f.destination, 'personal', 'SKILL.md'), 'utf8')).toBe('Mine');
    expect(syncSkillsOnce(f.options)).toContain('0 installed');
  });
  it('bootstraps an originless checkout without attaching the application repo as its origin', () => {
    const f = fixture(); init(f.destination);
    fs.writeFileSync(path.join(f.destination, 'local.txt'), 'Keep this history');
    git(f.destination, 'add', '--', 'local.txt'); git(f.destination, 'commit', '-m', 'Local history');
    const head = git(f.destination, 'rev-parse', 'HEAD');
    syncSkillsOnce(f.options);
    expect(skill(f.destination)).toContain('v1');
    expect(git(f.destination, 'remote')).toBe('');
    expect(git(f.destination, 'rev-parse', 'HEAD')).toBe(head);
    expect(fs.readFileSync(path.join(f.destination, 'local.txt'), 'utf8')).toBe('Keep this history');
  });
  it('honors a configured source and explicit subtree through literal argv', () => {
    const f = fixture(); const odd = path.join(f.root, 'repository ; touch NOT_EXECUTED');
    fs.renameSync(f.upstream, odd);
    git(odd, 'mv', 'skills-public', 'guides'); git(odd, 'commit', '-m', 'Alternate subtree');
    expect(syncSkillsOnce({ home: f.home, repository: odd, subdirectory: 'guides' })).toContain('1 installed');
    expect(skill(f.destination)).toContain('v1');
    expect(fs.existsSync(path.join(f.home, '.shizuha', 'NOT_EXECUTED'))).toBe(false);
  });
  it('keeps an existing private origin and fast-forwards that checkout despite public overrides', () => {
    const f = fixture(); fs.mkdirSync(path.dirname(f.destination), { recursive: true });
    git(f.root, 'clone', f.upstream, f.destination);
    catalog(f.upstream, 'Private checkout update'); commit(f.upstream);
    expect(syncSkillsOnce({ home: f.home, repository: '/does/not/exist' })).toBe('synchronized existing origin');
    expect(git(f.destination, 'remote', 'get-url', 'origin')).toBe(f.upstream);
    expect(skill(path.join(f.destination, 'skills-public'))).toBe('Private checkout update');
    expect(fs.existsSync(path.join(f.destination, 'public-guide'))).toBe(false);
  });
  it('preserves dirty private checkouts and never resets divergent local history', () => {
    const f = fixture(); fs.mkdirSync(path.dirname(f.destination), { recursive: true }); git(f.root, 'clone', f.upstream, f.destination);
    fs.writeFileSync(path.join(f.destination, 'local.txt'), 'Keep');
    expect(syncSkillsOnce(f.options)).toBe('preserved dirty existing checkout');
    git(f.destination, 'config', 'user.name', 'Test'); git(f.destination, 'config', 'user.email', 'test@example.org');
    git(f.destination, 'add', '--', 'local.txt'); git(f.destination, 'commit', '-m', 'Local divergence');
    const head = git(f.destination, 'rev-parse', 'HEAD'); catalog(f.upstream, 'v2'); commit(f.upstream);
    expect(() => syncSkillsOnce(f.options)).toThrow('Git operation failed');
    expect(git(f.destination, 'rev-parse', 'HEAD')).toBe(head);
    expect(fs.readFileSync(path.join(f.destination, 'local.txt'), 'utf8')).toBe('Keep');
  });
  it('preserves edited public skills and retries safely after network failure', () => {
    const f = fixture(); syncSkillsOnce(f.options);
    fs.writeFileSync(path.join(f.destination, 'public-guide', 'SKILL.md'), 'My local edit');
    catalog(f.upstream, 'v2'); commit(f.upstream);
    expect(syncSkillsOnce(f.options)).toContain('1 local entries preserved');
    fs.renameSync(f.upstream, f.upstream + '-offline');
    expect(() => syncSkillsOnce(f.options)).toThrow('Git operation failed');
    expect(skill(f.destination)).toBe('My local edit');
    fs.renameSync(f.upstream + '-offline', f.upstream);
    expect(syncSkillsOnce(f.options)).toContain('1 local entries preserved');
  });
  it('refuses a modified cache instead of laundering its edits into installed skills', () => {
    const f = fixture(); syncSkillsOnce(f.options);
    const parent = path.join(f.home, '.shizuha');
    const cache = fs.readdirSync(parent).find(name => name.startsWith('skills-source-'))!;
    fs.writeFileSync(path.join(parent, cache, 'local.txt'), 'Cache edit');
    expect(() => syncSkillsOnce(f.options)).toThrow('cache has local edits');
    expect(skill(f.destination)).toContain('v1');
  });
  it('rejects digest tampering before changing installed entries', () => {
    const f = fixture(); syncSkillsOnce(f.options);
    fs.writeFileSync(path.join(f.upstream, 'skills-public', 'public-guide', 'SKILL.md'), 'Unreviewed changed content'); commit(f.upstream);
    expect(() => syncSkillsOnce(f.options)).toThrow('digest mismatch');
    expect(skill(f.destination)).toContain('v1');
  });
  it('rejects subtree symlinks and traversal while preserving preexisting content', () => {
    const f = fixture(); fs.symlinkSync('skills-public', path.join(f.upstream, 'alias'));
    git(f.upstream, 'add', '--', 'alias'); git(f.upstream, 'commit', '-m', 'Synthetic unsafe subtree');
    expect(() => syncSkillsOnce({ ...f.options, subdirectory: 'alias' })).toThrow('unsafe filesystem entry');
    expect(() => syncSkillsOnce({ ...f.options, subdirectory: '../escape' })).toThrow('configuration');
    expect(fs.existsSync(f.destination)).toBe(false);
  });
  it('leaves unowned colliding directories and dangling symlinks untouched', () => {
    const f = fixture(); fs.mkdirSync(f.destination, { recursive: true });
    fs.symlinkSync('missing-private-guide', path.join(f.destination, 'public-guide'));
    expect(syncSkillsOnce(f.options)).toContain('1 local entries preserved');
    expect(fs.readlinkSync(path.join(f.destination, 'public-guide'))).toBe('missing-private-guide');
  });
});
