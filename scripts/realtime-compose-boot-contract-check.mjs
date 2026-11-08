#!/usr/bin/env node
/**
 * realtime-compose-boot-contract-check — static #604 wiring (no Docker required).
 * Location: scripts/realtime-compose-boot-contract-check.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
let failures = 0;
function check(ok, msg) {
  if (!ok) {
    console.error(`FAIL: ${msg}`);
    failures += 1;
  } else {
    console.log(`ok: ${msg}`);
  }
}

const compose = readFileSync(join(root, 'docker-compose.yml'), 'utf8');
check(compose.includes('SECRET_KEY_BASE'), 'compose wires SECRET_KEY_BASE');
check(compose.includes('DB_ENC_KEY'), 'compose wires DB_ENC_KEY');
check(compose.includes('FLY_APP_NAME'), 'compose wires FLY_APP_NAME');
check(compose.includes('SEED_SELF_HOST'), 'compose wires SEED_SELF_HOST');
check(/SELF_HOST_TENANT_NAME:.*localhost/.test(compose), 'compose default tenant localhost');

const envEx = readFileSync(join(root, '.env.example'), 'utf8');
check(envEx.includes('SECRET_KEY_BASE='), '.env.example documents SECRET_KEY_BASE');
check(envEx.includes('DB_ENC_KEY='), '.env.example documents DB_ENC_KEY');
check(envEx.includes('REALTIME_SELF_HOST_TENANT=localhost'), '.env.example tenant localhost');

const kong = readFileSync(join(root, 'archive/supabase-legacy/supabase/config/kong.yml'), 'utf8');
check(kong.includes('supabase-realtime:4000/socket'), 'kong upstream /socket');
check(/strip_path:\s*true/.test(kong) && kong.includes('/realtime/v1/'), 'kong strip /realtime/v1/');

const nginx = readFileSync(join(root, 'archive/supabase-legacy/supabase/config/nginx-proxy.template'), 'utf8');
check(nginx.includes('location /realtime/v1/'), 'nginx realtime location');
check(nginx.includes('/socket/'), 'nginx proxies to /socket/');

const seed = readFileSync(join(root, 'scripts/minimal-proof/seed-realtime-tenant.mjs'), 'utf8');
check(seed.includes('create_tenant'), 'seed script create_tenant');
check(seed.includes('/app/bin/migrate'), 'seed script migrate');

const checklist = readFileSync(join(root, 'docs/ops/realtime-restart-checklist.md'), 'utf8');
check(!/down\s+-v|volume\s+rm|wipe/i.test(checklist) || /Never/.test(checklist), 'checklist forbids volume wipe');

if (failures) {
  console.error(`realtime-compose-boot-contract-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log('realtime-compose-boot-contract-check: OK');
