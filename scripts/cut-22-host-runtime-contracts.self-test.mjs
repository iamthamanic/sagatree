#!/usr/bin/env node
/**
 * cut-22-host-runtime-contracts.self-test — Host-only Docker/docs/env contracts (#1157).
 * Location: scripts/cut-22-host-runtime-contracts.self-test.mjs
 *
 * Asserts root compose includes the Node host (no mandatory Supabase services),
 * host env examples exist, and leftover Edge invoke stubs stay SDK-free.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;

function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${msg}`);
  }
}

const rootCompose = readFileSync(join(root, 'docker-compose.yml'), 'utf8');
assert(/include:/.test(rootCompose), 'root compose uses include');
assert(
  /deployment\/docker-compose\.host\.yml/.test(rootCompose),
  'root compose includes host compose',
);
assert(!/supabase-db:/.test(rootCompose), 'root compose must not define supabase-db');
assert(
  existsSync(join(root, 'archive/supabase-legacy/docker-compose.supabase.yml')),
  'legacy supabase compose archived',
);
assert(existsSync(join(root, 'deployment/docker-compose.host.yml')), 'host compose present');
assert(existsSync(join(root, 'deployment/.env.host.example')), 'host env example present');
assert(existsSync(join(root, '.env.example')), 'root .env.example present');

const envExample = readFileSync(join(root, '.env.example'), 'utf8');
assert(/SAGATREE_BETTER_AUTH_SECRET/.test(envExample), 'env example has Better Auth secret');
assert(/VITE_SAGATREE_HOST_AUTH_URL/.test(envExample), 'env example has host auth URL');
assert(!/SUPABASE_ANON_KEY=/.test(envExample), 'root .env.example must not require SUPABASE_ANON_KEY');

const selfhost = readFileSync(join(root, 'README_SELFHOST.md'), 'utf8');
assert(/host-only|Node host|Better Auth/i.test(selfhost), 'README_SELFHOST is host-first');
assert(!/docker compose up -d\n/.test(selfhost) || /env\.host/.test(selfhost), 'selfhost uses host env file');

const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
assert(/SQLite/.test(agents), 'AGENTS.md mentions SQLite host stack');
assert(/archive\/supabase-legacy/.test(agents), 'AGENTS.md points at archive');

const stub = readFileSync(join(root, 'src/lib/supabase-client.ts'), 'utf8');
assert(!/@supabase\/supabase-js/.test(stub), 'supabase-client stub is SDK-free');
assert(!/createClient/.test(stub), 'supabase-client stub has no createClient');
assert(!/functions\.invoke/.test(stub), 'supabase-client stub has no functions.invoke');

// docker compose config — host-only services (no supabase-*)
const secret = 'cut22-self-test-secret-at-least-32-chars';
let services = '';
try {
  services = execFileSync(
    'docker',
    ['compose', '--env-file', 'deployment/.env.host.example', 'config', '--services'],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, SAGATREE_BETTER_AUTH_SECRET: secret },
    },
  );
} catch (err) {
  assert(false, `docker compose config failed: ${err instanceof Error ? err.message : err}`);
}
const serviceList = services
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);
assert(serviceList.includes('sagatree-host'), `expected sagatree-host, got ${serviceList.join(',')}`);
assert(
  serviceList.every((s) => !s.startsWith('supabase')),
  `no supabase services in default config: ${serviceList.join(',')}`,
);

if (failures > 0) {
  console.error(`\ncut-22-host-runtime-contracts.self-test: ${failures} failure(s)`);
  process.exit(1);
}
console.log('cut-22-host-runtime-contracts.self-test: PASS');
