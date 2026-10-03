// A source archive must stand alone: never follow host-local skill symlinks.
import { lstatSync, readdirSync, readlinkSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const generatedDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage']);
export function checkPortableSource(root) {
  const base = realpathSync(root);
  const failures = [];
  let links = 0;
  const inside = (target) => target === base || target.startsWith(base + path.sep);
  function visit(directory) {
    for (const name of readdirSync(directory)) {
      const file = path.join(directory, name);
      const relative = path.relative(base, file);
      const stat = lstatSync(file); // Never traverse a symlink, including a directory link.
      if (stat.isSymbolicLink()) {
        links++;
        const target = readlinkSync(file);
        if (path.posix.isAbsolute(target) || path.win32.isAbsolute(target)) {
          failures.push(`${relative}: absolute symlink target`);
        } else if (!inside(path.resolve(path.dirname(file), target))) {
          failures.push(`${relative}: symlink escapes source root`);
        } else {
          try {
            if (!inside(realpathSync(file))) failures.push(`${relative}: symlink chain escapes source root`);
          } catch {
            failures.push(`${relative}: unresolved or cyclic symlink`);
          }
        }
      } else if (stat.isDirectory() && !generatedDirectories.has(name)) {
        visit(file);
      } else if (!stat.isDirectory() && !stat.isFile()) {
        failures.push(`${relative}: unsupported source object`);
      }
    }
  }
  visit(base);
  return { links, failures };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  try {
    const result = checkPortableSource(root);
    if (result.failures.length) {
      console.error(`Source portability failed (${result.failures.length} findings):\n${result.failures.join('\n')}`);
      process.exitCode = 1;
    } else {
      console.log(`Source portability passed (${result.links} self-contained symlinks)`);
    }
  } catch (error) {
    console.error(`Source portability inspection failed: ${error.message}`);
    process.exitCode = 1;
  }
}
