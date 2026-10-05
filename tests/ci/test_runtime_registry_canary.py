"""Exercise the registry canary over real HTTP, including failed cleanup paths."""
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import threading
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('registry_canary', ROOT / 'scripts/runtime-registry-canary.py')
canary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(canary)


class RegistryCanaryTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.payload = b''
        self.mode = 'success'
        test = self

        class Registry(BaseHTTPRequestHandler):
            def log_message(self, *_args):
                pass

            def handle_request(self):
                method = self.command
                test.calls.append((method, self.path))
                body = self.rfile.read(int(self.headers.get('Content-Length', '0')))
                prefix = '/v2/ci-network-canary/123/blobs/'
                status, result, location = 200, b'', None
                if method == 'POST':
                    status = 202
                    location = prefix + 'uploads/session?state=one'
                    if test.mode == 'foreign':
                        location = 'http://127.0.0.1:1/foreign'
                elif method == 'PATCH':
                    test.payload = body
                    status = 500 if test.mode == 'patch-failure' else 202
                    location = prefix + 'uploads/session?state=two'
                elif method == 'PUT':
                    test.assertIn('digest=sha256%3A' + hashlib.sha256(test.payload).hexdigest(), self.path)
                    status = 201
                elif method == 'GET':
                    result = b'corrupt' if test.mode == 'corrupt-read' else test.payload
                elif method == 'DELETE':
                    status = 204 if 'uploads/' in self.path else 202
                    if test.mode == 'cleanup-failure':
                        status = 500
                self.send_response(status)
                if location:
                    self.send_header('Location', location)
                self.send_header('Content-Length', str(len(result)))
                self.end_headers()
                self.wfile.write(result)

            do_POST = do_PATCH = do_PUT = do_GET = do_DELETE = handle_request

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Registry)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = 'http://127.0.0.1:' + str(self.server.server_port)

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def test_complete_chunked_upload_readback_and_blob_cleanup(self):
        receipt = canary.probe(self.base, '123')
        self.assertEqual(receipt['uploaded_bytes'], 65536)
        self.assertTrue(receipt['readback_verified'])
        self.assertTrue(receipt['cleanup_verified'])
        self.assertEqual([method for method, _ in self.calls], ['POST', 'PATCH', 'PUT', 'GET', 'DELETE'])
        self.assertNotIn('uploads/', self.calls[-1][1])

    def test_failed_chunk_upload_cancels_only_own_session(self):
        self.mode = 'patch-failure'
        with self.assertRaises(Exception):
            canary.probe(self.base, '123')
        self.assertEqual([method for method, _ in self.calls], ['POST', 'PATCH', 'DELETE'])
        self.assertIn('uploads/session', self.calls[-1][1])

    def test_corrupt_readback_fails_and_deletes_committed_blob(self):
        self.mode = 'corrupt-read'
        with self.assertRaisesRegex(RuntimeError, 'readback mismatch'):
            canary.probe(self.base, '123')
        self.assertEqual(self.calls[-1][0], 'DELETE')
        self.assertNotIn('uploads/', self.calls[-1][1])

    def test_cleanup_failure_never_emits_success_receipt(self):
        self.mode = 'cleanup-failure'
        with self.assertRaises(Exception):
            canary.probe(self.base, '123')

    def test_foreign_location_rejected_before_sending_payload(self):
        self.mode = 'foreign'
        with self.assertRaisesRegex(ValueError, 'escaped'):
            canary.probe(self.base, '123')
        self.assertEqual(len(self.calls), 1)

    def test_invalid_identity_rejected_before_network(self):
        with self.assertRaises(ValueError):
            canary.probe(self.base, '../other')
        self.assertEqual(self.calls, [])

    def test_configured_runner_shell_accepts_actual_workflow_preamble(self):
        from tests.ci._mini_yaml import loads
        workflow = loads((ROOT / '.forgejo/workflows/test-runtime-builder-registry.yml').read_text())
        job = workflow['jobs']['qualify']
        step = next(step for step in job['steps'] if 'run' in step)
        # Container jobs default to sh, unlike non-container GitHub runners.
        shell = step.get('shell', job.get('defaults', {}).get('run', {}).get('shell', 'sh'))
        script = step['run']
        result = subprocess.run([shell, '-c', script.splitlines()[0]], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        subprocess.run([shell, '-n'], input=script, text=True, check=True)

    def test_rendered_job_has_finite_unprivileged_scope(self):
        result = subprocess.check_output([sys.executable, str(ROOT / 'scripts/render-runtime-registry-canary.py'), '123'], text=True)
        job = json.loads(result)
        pod = job['spec']['template']['spec']
        self.assertEqual(job['spec']['activeDeadlineSeconds'], 180)
        self.assertFalse(pod['automountServiceAccountToken'])
        self.assertEqual(pod['nodeSelector'], {'kubernetes.io/hostname': 'i9-ws'})
        self.assertEqual(pod['containers'][0]['resources']['limits']['cpu'], '500m')
        self.assertNotIn('privileged', pod['containers'][0]['securityContext'])
        self.assertEqual(pod['containers'][0]['command'][-1], '123')


if __name__ == '__main__':
    unittest.main()
