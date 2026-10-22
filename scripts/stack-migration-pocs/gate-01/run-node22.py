#!/usr/bin/env python3
"""Fresh isolated Node22 installation and full PoC; never reuses Node24 native bindings."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
NODE = ROOT / 'work/toolchains/node-v22.23.3-linux-x64/bin/node'
NPM = NODE.parent.parent / 'lib/node_modules/npm/bin/npm-cli.js'
COPY = ROOT / 'work/node22-package'
EVIDENCE = REPO / '.qa/evidence/stack-migration-prep/pocs/gate-01/node22'
if not NODE.is_file():
    raise SystemExit('Run provision-node22.py first')
if COPY.exists():
    shutil.rmtree(COPY)
shutil.copytree(ROOT, COPY, ignore=shutil.ignore_patterns('work', 'node_modules', '__pycache__'))
EVIDENCE.mkdir(parents=True, exist_ok=True)
env = dict(os.environ)
env.update({
    'PATH': str(NODE.parent) + os.pathsep + env.get('PATH', ''),
    'npm_config_cache': str(ROOT / 'work/npm-cache-node22'),
    'GATE01_REPO_ROOT': str(REPO),
    'GATE01_SOURCE_ROOT': str(ROOT),
    'GATE01_EVIDENCE_DIR': str(EVIDENCE),
})
results = []
for label, args in [
    ('install', [str(NODE), str(NPM), 'ci', '--no-audit', '--no-fund', '--fetch-retries=0', '--fetch-timeout=30000']),
    ('native-abi', [str(NODE), '--input-type=module', '-e',
      "import SQLite from 'better-sqlite3'; const db = new SQLite(':memory:'); console.log(JSON.stringify({node:process.version,abi:process.versions.modules,sqlite:db.prepare('select sqlite_version() as version').get()})); db.close();"]),
    ('generate', [str(NODE), str(NPM), 'run', 'generate']),
    ('typecheck', [str(NODE), str(NPM), 'run', 'typecheck']),
    ('execute', [str(NODE), str(NPM), 'run', 'run']),
    ('render', [str(NODE), str(NPM), 'run', 'render']),
    ('verify', [str(NODE), str(NPM), 'run', 'verify']),
]:
    started = time.perf_counter()
    done = subprocess.run(args, cwd=COPY, env=env, capture_output=True, text=True)
    output = done.stdout + done.stderr
    (EVIDENCE / f'{label}.log').write_text(output)
    results.append({'step': label, 'exitCode': done.returncode, 'elapsedSeconds': time.perf_counter() - started,
                    'log': str((EVIDENCE / f'{label}.log').relative_to(REPO)),
                    'logSha256': hashlib.sha256(output.encode()).hexdigest()})
    (EVIDENCE / 'execution.json').write_text(json.dumps({'nodeVersion': 'v22.23.3', 'cleanInstall': True,
       'sourcePackage': str(ROOT.relative_to(REPO)), 'executedCopy': str(COPY.relative_to(REPO)),
       'nodeBinarySha256': hashlib.sha256(NODE.read_bytes()).hexdigest(), 'steps': results}, indent=2) + '\n')
    print(label, 'exit', done.returncode, f'{results[-1]["elapsedSeconds"]:.3f}s', flush=True)
    if done.returncode:
        print(output, flush=True)
        raise SystemExit(done.returncode)
print('Node22 clean native installation and both complete candidates passed', flush=True)
