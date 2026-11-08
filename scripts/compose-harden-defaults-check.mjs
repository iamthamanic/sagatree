#!/usr/bin/env node
/**
 * compose-harden-defaults-check — static #605 security defaults on archived Supabase compose (CUT-22).
 * Location: scripts/compose-harden-defaults-check.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
let failures = 0;
function check(ok, msg) {
  if (!ok) {
    console.error(`FAIL: ${msg}`);
    failures += 1;
  } else console.log(`ok: ${msg}`);
}

const compose = readFileSync(join(root, 'archive/supabase-legacy/docker-compose.supabase.yml'), 'utf8');
check(
  /KONG_NGINX_WORKER_PROCESSES:\s*\$\{KONG_NGINX_WORKER_PROCESSES:-1\}/.test(compose),
  'Kong workers default 1',
);
check(/VERIFY_JWT:\s*\$\{VERIFY_JWT:-true\}/.test(compose), 'VERIFY_JWT default true');
check(/127\.0\.0\.1:5432:5432/.test(compose), 'DB bound to loopback');
check(/127\.0\.0\.1:9998:9998/.test(compose), 'Edge bound to loopback');
check(!/VERIFY_JWT:\s*"false"/.test(compose), 'no hard-coded VERIFY_JWT false');
check(/rate-limiting/.test(compose), 'Kong plugins include rate-limiting (#670)');
check(/GOTRUE_RATE_LIMIT_EMAIL_SENT/.test(compose), 'GoTrue email rate limit env (#670)');

const kong = readFileSync(join(root, 'archive/supabase-legacy/supabase/config/kong.yml'), 'utf8');
const routeBlocks = kong.split(/^\s*-\s*name:/m).slice(1);
const keyAuthOnRoutes = routeBlocks.some(
  (b) => /plugins:[\s\S]*key-auth/.test(b) && !/consumers:/.test(b),
);
check(!keyAuthOnRoutes, 'no key-auth plugin on Kong routes');
check(/name:\s*rate-limiting/.test(kong), 'Kong auth-v1 rate-limiting plugin (#670)');
check(/fault_tolerant:\s*false/.test(kong), 'Kong rate-limiting fail-closed (#670)');

const envEx = readFileSync(join(root, 'archive/supabase-legacy/.env.supabase.example'), 'utf8');
check(/KONG_NGINX_WORKER_PROCESSES|VERIFY_JWT/.test(envEx), 'archived .env.supabase.example documents Kong/JWT knobs');
check(/DEV-only|local opt-out|Local Admin/i.test(envEx), 'archived .env.supabase.example notes Local Admin DEV-only');

const docs = readFileSync(join(root, 'docs/ops/compose-harden-defaults.md'), 'utf8');
check(/Never delete volumes|down -v/i.test(docs), 'docs forbid volume wipe');

if (failures) {
  console.error(`compose-harden-defaults-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log('compose-harden-defaults-check: OK');
