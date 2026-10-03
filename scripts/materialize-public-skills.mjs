#!/usr/bin/env node
// One reviewed catalog feeds release images and standalone CLI bundles.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function readCatalog(root) {
  const regular = (p, directory = false) => {
    const stat = fs.lstatSync(p);
    if (stat.isSymbolicLink() || !(directory ? stat.isDirectory() : stat.isFile())) {
      throw new Error('Public catalog must contain only regular files and directories');
    }
  };
  regular(root, true);
  regular(path.join(root, 'manifest.json'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 'shizuha.public-skills.v1' || manifest.license !== 'AGPL-3.0-or-later'
      || !Array.isArray(manifest.skills) || manifest.skills.length === 0) throw new Error('Invalid public catalog');
  const names = new Set();
  for (const skill of manifest.skills) {
    if (!/^[a-z][a-z0-9-]*$/.test(skill.name) || names.has(skill.name)
        || !/^[a-f0-9]{64}$/.test(skill.sha256)) throw new Error('Invalid public skill entry');
    names.add(skill.name);
    const directory = path.join(root, skill.name);
    regular(directory, true);
    if (fs.readdirSync(directory).join() !== 'SKILL.md') throw new Error('Unreviewed public skill payload');
    const file = path.join(directory, 'SKILL.md');
    regular(file);
    if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== skill.sha256) {
      throw new Error('Public skill digest mismatch');
    }
  }
  for (const entry of fs.readdirSync(root)) {
    if (names.has(entry)) continue;
    if (!['manifest.json', 'README.md', 'LICENSE'].includes(entry)) throw new Error('Unreviewed catalog entry');
    regular(path.join(root, entry));
  }
  regular(path.join(root, 'LICENSE'));
  return manifest;
}

export function materialize(root, target) {
  const manifest = readCatalog(root);
  // Never erase an existing tree: a fresh output makes accidental private
  // payload carry-over impossible and protects operator-managed catalogs.
  fs.mkdirSync(target, { recursive: false });
  for (const entry of ['manifest.json', 'README.md', 'LICENSE', ...manifest.skills.map(s => s.name)]) {
    fs.cpSync(path.join(root, entry), path.join(target, entry), { recursive: true });
  }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../skills-public');
  const args = process.argv.slice(2);
  const manifest = args.length === 1 && args[0] === '--check' ? readCatalog(root)
    : args.length === 2 && args[0] === '--dest' ? materialize(root, path.resolve(args[1]))
      : (() => { throw new Error('Usage: materialize-public-skills.mjs --check | --dest NEW_DIRECTORY'); })();
  console.log(`Verified ${manifest.skills.length} public skills`);
}
