#!/usr/bin/env python3
"""Prove a builder's registry upload/read/delete path without publishing images."""
import hashlib
import json
import os
import re
import sys
import urllib.parse
import urllib.request


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def probe(base, run_id):
    if not re.fullmatch(r'[0-9]+', run_id):
        raise ValueError('numeric CI run ID required')
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise ValueError('registry must be an explicit credential-free HTTP origin')
    base = base.rstrip('/')
    repository = 'ci-network-canary/' + run_id
    prefix = '/v2/' + repository + '/blobs/'
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    payload = os.urandom(65536)
    digest = 'sha256:' + hashlib.sha256(payload).hexdigest()
    cleanup = None
    committed = False

    def request(method, url, data=None, expected=200):
        req = urllib.request.Request(url, data=data, method=method,
                                     headers={'Content-Type': 'application/octet-stream'})
        with opener.open(req, timeout=20) as response:
            if response.status != expected:
                raise RuntimeError('unexpected registry response status')
            return response.read(), response.headers

    def upload_location(headers):
        location = urllib.parse.urljoin(base, headers['Location'])
        target = urllib.parse.urlsplit(location)
        if (target.scheme, target.netloc) != (parsed.scheme, parsed.netloc) or not target.path.startswith(prefix + 'uploads/'):
            raise ValueError('registry upload location escaped the approved origin/repository')
        return location

    try:
        _, headers = request('POST', base + prefix + 'uploads/', b'', 202)
        cleanup = upload_location(headers)
        _, headers = request('PATCH', cleanup, payload, 202)
        cleanup = upload_location(headers)
        separator = '&' if urllib.parse.urlsplit(cleanup).query else '?'
        request('PUT', cleanup + separator + urllib.parse.urlencode({'digest': digest}), b'', 201)
        cleanup = base + prefix + digest
        committed = True
        body, _ = request('GET', cleanup)
        if body != payload:
            raise RuntimeError('registry upload readback mismatch')
    finally:
        if cleanup is not None:
            request('DELETE', cleanup, expected=202 if committed else 204)
    return {'uploaded_bytes': len(payload), 'readback_verified': True, 'cleanup_verified': True}


if __name__ == '__main__':
    print(json.dumps(probe(sys.argv[1], sys.argv[2]), sort_keys=True))
