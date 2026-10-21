#!/usr/bin/env python3
"""Provision the pinned official Linux x64 Node 22 toolchain for the separate ABI check."""
import hashlib
import json
from pathlib import Path
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parent
VERSION = 'v22.23.3'
NAME = f'node-{VERSION}-linux-x64'
SHA256 = 'df450af89261115ef9f9e3830c3eeb2cc9213b63c720b1af623cb5dcbe2e02de'
URL = f'https://nodejs.org/dist/{VERSION}/{NAME}.tar.xz'
SHASUMS = f'https://nodejs.org/dist/{VERSION}/SHASUMS256.txt'
target = ROOT / 'work/toolchains'
target.mkdir(parents=True, exist_ok=True)
archive = target / (NAME + '.tar.xz')
with urllib.request.urlopen(SHASUMS, timeout=30) as response:
    manifest = response.read().decode()
if f'{SHA256}  {NAME}.tar.xz' not in manifest.splitlines():
    raise SystemExit('Pinned Node archive does not match the official versioned SHA manifest')
if not archive.exists():
    with urllib.request.urlopen(URL, timeout=60) as response:
        archive.write_bytes(response.read())
if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
    raise SystemExit('Node archive SHA256 mismatch')
with tarfile.open(archive, 'r:xz') as bundle:
    bundle.extractall(target, filter='data')
print(json.dumps({'version': VERSION, 'url': URL, 'officialHashManifest': SHASUMS,
                  'sha256': SHA256, 'binary': str(target / NAME / 'bin/node')}))
