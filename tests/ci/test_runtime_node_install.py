"""Exercise the Dockerfile's APT selection against isolated real APT indexes."""
import os
import hashlib
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class RuntimeNodeInstallTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(shutil.which("apt-get"), "the Debian CI image must provide APT")
        self.temporary = tempfile.TemporaryDirectory(prefix='runtime-node-apt-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        for name in ['repo', 'lists/partial', 'cache/archives/partial', 'parts', 'sources']:
            (self.root / name).mkdir(parents=True)
        (self.root / 'status').write_text('')
        dockerfile = (ROOT / 'Dockerfile.agent-runtime').read_text().replace('\\\n', ' ')
        layer = re.search(r'RUN apt-get update.*?rm -rf /var/lib/apt/lists/\*', dockerfile, re.S).group()
        self.major = re.search(r'^ENV NODE_MAJOR=(\d+)$', dockerfile, re.M).group(1)
        self.update_args = shlex.split(re.findall(r'apt-get (update[^&\n]*)', layer)[-1])
        self.install_args = shlex.split(re.findall(r'apt-get (install[^&\n]*)', layer)[-1].replace('${NODE_MAJOR}', self.major))
        self.base = ['apt-get']
        settings = {
            'Dir::Etc::sourcelist': str(self.root / 'sources.list'),
            'Dir::Etc::sourceparts': str(self.root / 'sources'),
            'Dir::Etc::parts': str(self.root / 'parts'),
            'Dir::Etc::main': '/dev/null',
            'Dir::State::status': str(self.root / 'status'),
            'Dir::State::lists': str(self.root / 'lists'),
            'Dir::Cache': str(self.root / 'cache'),
            'Dir::Cache::pkgcache': str(self.root / 'cache/pkgcache.bin'),
            'Dir::Cache::srcpkgcache': str(self.root / 'cache/srcpkgcache.bin'),
            'APT::Architecture': 'amd64', 'Acquire::Retries': '0',
            'Acquire::http::Timeout': '1', 'Debug::NoLocking': 'true',
            'Acquire::http::Proxy': 'DIRECT', 'APT::Update::Error-Mode': 'persistent',
        }
        for key, value in settings.items():
            self.base.extend(['-o', f'{key}={value}'])

    def repository(self, versions, unavailable_source=False):
        entries = []
        fixture_hash = hashlib.sha256(b'fixture').hexdigest()
        for name, version in [('nodejs', v) for v in versions] + [('gh', '2.0')]:
            (self.root / 'repo' / f'{name}-{version}.deb').write_bytes(b'fixture')
            entries.append(f'Package: {name}\nVersion: {version}\nArchitecture: amd64\nMaintainer: Test <test@example.org>\nFilename: {name}-{version}.deb\nSize: 7\nSHA256: {fixture_hash}\nDescription: synthetic selection fixture\n\n')
        (self.root / 'repo/Packages').write_text(''.join(entries))
        sources = f'deb [trusted=yes] file:{self.root}/repo ./\n'
        if unavailable_source:
            sources += 'deb [trusted=yes] http://127.0.0.1:1/ ./\n'
        (self.root / 'sources.list').write_text(sources)

    def apt(self, args):
        return subprocess.run(self.base + args, capture_output=True, text=True, timeout=20,
                              env={**os.environ, 'LC_ALL': 'C', 'DEBIAN_FRONTEND': 'noninteractive'})

    def test_failed_index_cannot_silently_install_distribution_node(self):
        self.repository(['18.19.1'], unavailable_source=True)
        # Positive reproduction: ordinary apt update tolerates the unavailable
        # source, and unqualified install would select the distribution package.
        control_update = self.apt(['update'])
        self.assertEqual(control_update.returncode, 0, control_update.stderr)
        control = self.apt(['install', '--simulate', 'nodejs'])
        self.assertEqual(control.returncode, 0, control.stderr)
        self.assertIn('18.19.1', control.stdout)
        self.assertNotEqual(self.apt(self.update_args).returncode, 0)

    def test_declared_major_cannot_fall_back_even_with_a_successful_index(self):
        self.repository(['18.19.1'])
        update = self.apt(self.update_args)
        self.assertEqual(update.returncode, 0, update.stderr)
        result = self.apt(self.install_args + ['--simulate'])
        self.assertNotEqual(result.returncode, 0)

    def test_declared_major_is_selected_when_both_sources_are_available(self):
        self.repository(['18.19.1', f'{self.major}.16.0-1nodesource1'])
        update = self.apt(self.update_args)
        self.assertEqual(update.returncode, 0, update.stderr)
        result = self.apt(self.install_args + ['--simulate'])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertRegex(result.stdout, rf'Inst nodejs \({self.major}\.16\.0-1nodesource1\b')


if __name__ == '__main__':
    unittest.main()
