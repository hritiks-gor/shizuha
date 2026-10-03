/** Public catalog materialization and existing-checkout fast-forward sync.
 * All Git arguments are separate argv entries. Neither an override nor a fresh
 * install may rewrite an existing private origin or overwrite edited skills.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const PUBLIC_SKILLS_REPO = 'https://github.com/shizuha-labs/shizuha.git';
type Manifest = { schema: string; license: string; skills: { name: string; sha256: string }[] };
type State = { schema: string; skills: Record<string, string> };
const hash = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

function git(directory: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', directory, ...args], {
      encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  } catch { throw new Error('Skill source Git operation failed; local skills were retained'); }
}

function regular(file: string, directory = false): void {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || !(directory ? stat.isDirectory() : stat.isFile())) {
    throw new Error('Skill catalog contains an unsafe filesystem entry');
  }
}

function catalog(source: string): Manifest {
  regular(source, true);
  regular(path.join(source, 'manifest.json'));
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8')) as Manifest;
  if (manifest.schema !== 'shizuha.public-skills.v1' || manifest.license !== 'AGPL-3.0-or-later'
      || !Array.isArray(manifest.skills) || !manifest.skills.length) throw new Error('Invalid public skill manifest');
  const names = new Set<string>();
  for (const skill of manifest.skills) {
    if (!/^[a-z][a-z0-9-]*$/.test(skill.name) || names.has(skill.name)
        || !/^[a-f0-9]{64}$/.test(skill.sha256)) throw new Error('Invalid public skill entry');
    names.add(skill.name);
    const directory = path.join(source, skill.name);
    regular(directory, true);
    if (fs.readdirSync(directory).join() !== 'SKILL.md') throw new Error('Unreviewed public skill payload');
    const file = path.join(directory, 'SKILL.md');
    regular(file);
    if (hash(fs.readFileSync(file)) !== skill.sha256) throw new Error('Public skill digest mismatch');
  }
  return manifest;
}

function installedDigest(directory: string): string | null {
  try {
    regular(directory, true);
    if (fs.readdirSync(directory).join() !== 'SKILL.md') return null;
    const file = path.join(directory, 'SKILL.md');
    regular(file);
    return hash(fs.readFileSync(file));
  } catch { return null; }
}

/** Install only absent, identical, or previously managed unedited entries. */
export function installPublicSkills(source: string, destination: string, stateFile: string): { installed: number; preserved: number } {
  const manifest = catalog(source); // Verify every skill before any mutation.
  if (fs.existsSync(destination)) regular(destination, true);
  else fs.mkdirSync(destination, { recursive: true });
  let state: State = { schema: 'shizuha.installed-skills.v1', skills: {} };
  if (fs.existsSync(stateFile)) {
    regular(stateFile);
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as State;
    if (state.schema !== 'shizuha.installed-skills.v1' || !state.skills || typeof state.skills !== 'object') {
      throw new Error('Invalid installed skill receipt');
    }
  }
  let installed = 0;
  let preserved = 0;
  for (const skill of manifest.skills) {
    const target = path.join(destination, skill.name);
    const digest = installedDigest(target);
    // lstat catches dangling links as well as existing files/directories.
    let exists = true;
    try { fs.lstatSync(target); } catch { exists = false; }
    if (exists && digest !== skill.sha256 && (digest === null || digest !== state.skills[skill.name])) {
      preserved++;
      continue;
    }
    if (digest !== skill.sha256) {
      fs.mkdirSync(target, { recursive: true });
      const temporary = path.join(destination, `.skill-${randomUUID()}`);
      try {
        fs.writeFileSync(temporary, fs.readFileSync(path.join(source, skill.name, 'SKILL.md')), { flag: 'wx', mode: 0o644 });
        fs.renameSync(temporary, path.join(target, 'SKILL.md'));
      } finally { fs.rmSync(temporary, { force: true }); }
      installed++;
    }
    state.skills[skill.name] = skill.sha256;
  }
  // Removed upstream entries stay locally available; no implicit deletion of
  // user configuration. Their last digest remains available for a later return.
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const next = `${stateFile}.${randomUUID()}.new`;
  try {
    fs.writeFileSync(next, JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    fs.renameSync(next, stateFile);
  } finally { fs.rmSync(next, { force: true }); }
  return { installed, preserved };
}

export type SkillSyncOptions = {
  home: string;
  repository?: string;
  subdirectory?: string;
  branch?: string;
};

export function syncSkillsOnce(options: SkillSyncOptions): string {
  const parent = path.join(options.home, '.shizuha');
  const destination = path.join(parent, 'skills');
  if (fs.existsSync(path.join(destination, '.git'))) {
    // `remote get-url origin` exits 2 for an originless checkout. Enumerating
    // remotes allows that supported bootstrap case to reach the public path.
    if (git(destination, ['remote']).split('\n').includes('origin')) {
      if (git(destination, ['status', '--porcelain'])) return 'preserved dirty existing checkout';
      const branch = git(destination, ['symbolic-ref', '--short', 'HEAD']);
      if (!branch) throw new Error('Cannot update a detached skill checkout');
      git(destination, ['fetch', '--quiet', 'origin', branch]);
      git(destination, ['merge', '--ff-only', 'FETCH_HEAD']);
      return 'synchronized existing origin';
    }
  }
  const repository = options.repository?.trim() || PUBLIC_SKILLS_REPO;
  const subdirectory = options.subdirectory ?? 'skills-public';
  const branch = options.branch ?? 'master';
  if (repository.startsWith('-') || !subdirectory || path.isAbsolute(subdirectory)
      || subdirectory.includes('\\') || subdirectory.split('/').includes('..')
      || branch.startsWith('-') || !branch) throw new Error('Invalid public skill source configuration');
  fs.mkdirSync(parent, { recursive: true });
  const cache = path.join(parent, `skills-source-${hash(JSON.stringify([repository, branch])).slice(0, 16)}`);
  if (!fs.existsSync(cache)) {
    const temporary = fs.mkdtempSync(path.join(parent, '.skills-source-'));
    try {
      git(temporary, ['clone', '--quiet', '--no-tags', '--single-branch', '--branch', branch, '--', repository, 'checkout']);
      fs.renameSync(path.join(temporary, 'checkout'), cache);
    } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  } else {
    regular(cache, true);
    if (git(cache, ['remote', 'get-url', 'origin']) !== repository) throw new Error('Skill source origin changed');
    if (git(cache, ['status', '--porcelain'])) throw new Error('Skill source cache has local edits');
    git(cache, ['fetch', '--quiet', 'origin', branch]);
    git(cache, ['merge', '--ff-only', 'FETCH_HEAD']);
  }
  // Verify intermediate directories too: a symlinked subtree may escape the
  // checkout even if its final directory and files are individually regular.
  let source = cache;
  for (const part of subdirectory.split('/').filter(part => part !== '.')) {
    source = path.join(source, part);
    regular(source, true);
  }
  const result = installPublicSkills(source, destination, path.join(parent, 'public-skills-state.json'));
  return `public skills: ${result.installed} installed, ${result.preserved} local entries preserved`;
}
