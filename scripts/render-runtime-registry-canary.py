#!/usr/bin/env python3
"""Render the bounded i9 registry qualification Job used only by Origin CI."""
import json
from pathlib import Path
import re
import sys

run_id = sys.argv[1]
if not re.fullmatch(r'[0-9]+', run_id):
    raise SystemExit('numeric run ID required')
name = 'ci-runtime-registry-' + run_id
source = Path(__file__).with_name('runtime-registry-canary.py').read_text()
pod = {
    'restartPolicy': 'Never', 'automountServiceAccountToken': False,
    'nodeSelector': {'kubernetes.io/hostname': 'i9-ws'},
    'tolerations': [{'key': 'node.shizuha/workstation', 'operator': 'Exists', 'effect': 'NoSchedule'}],
    'securityContext': {'runAsNonRoot': True, 'runAsUser': 1000, 'seccompProfile': {'type': 'RuntimeDefault'}},
    'containers': [{'name': 'probe', 'image': 'python:3.12-alpine',
        'command': ['python3', '-B', '-c', source, 'http://registry.registry.svc.cluster.local:5000', run_id],
        'resources': {'requests': {'cpu': '100m', 'memory': '64Mi'}, 'limits': {'cpu': '500m', 'memory': '128Mi'}},
        'securityContext': {'allowPrivilegeEscalation': False, 'readOnlyRootFilesystem': True, 'capabilities': {'drop': ['ALL']}}}],
}
print(json.dumps({'apiVersion': 'batch/v1', 'kind': 'Job', 'metadata': {'name': name, 'namespace': 'build', 'labels': {'app': 'ci-build', 'service': 'runtime-registry-probe'}}, 'spec': {'backoffLimit': 0, 'activeDeadlineSeconds': 180, 'ttlSecondsAfterFinished': 300, 'template': {'metadata': {'labels': {'app': 'ci-build', 'service': 'runtime-registry-probe'}}, 'spec': pod}}}))
