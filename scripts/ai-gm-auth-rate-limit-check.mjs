#!/usr/bin/env node
/**
 * ai-gm-auth-rate-limit-check — #670 static contract for AI GM + auth abuse limits.
 * Location: scripts/ai-gm-auth-rate-limit-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`ai-gm-auth-rate-limit-check failed: ${msg}`);
  process.exit(1);
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const migration = 'archive/supabase-legacy/supabase/migrations/087_ai_gm_rate_limits.sql';
const shared = 'archive/supabase-legacy/supabase/functions/_shared/ai-gm-rate-limit.ts';
const sharedTest = 'archive/supabase-legacy/supabase/functions/_shared/ai-gm-rate-limit_test.ts';
const aiGm = 'archive/supabase-legacy/supabase/functions/ai-gm/index.ts';
const kong = 'archive/supabase-legacy/supabase/config/kong.yml';
const compose = 'docker-compose.yml';
const login = 'src/app/shell/auth/LoginScreen.tsx';
const docs = 'docs/ops/auth-ai-gm-rate-limits.md';
const allowlist = 'archive/supabase-legacy/supabase/functions/_shared/edge-dispatcher-allowlist.ts';

for (const rel of [migration, shared, sharedTest, aiGm, kong, compose, login, docs]) {
  if (!existsSync(join(root, rel))) fail(`missing ${rel}`);
}

const sql = read(migration);
if (!/CREATE TABLE IF NOT EXISTS public\.ai_gm_rate_limits/.test(sql)) {
  fail('migration must create ai_gm_rate_limits');
}
if (!/consume_ai_gm_rate_limit/.test(sql)) fail('migration missing consume_ai_gm_rate_limit');
if (!/GRANT EXECUTE[\s\S]*service_role/.test(sql)) fail('RPC must be service_role only');
if (/GRANT EXECUTE[\s\S]*TO authenticated/.test(sql)) {
  fail('authenticated must not execute consume_ai_gm_rate_limit');
}

const sharedSrc = read(shared);
if (!sharedSrc.includes('consumePersistentAiGmRateLimit')) fail('shared missing consumer');
if (!sharedSrc.includes('consume_ai_gm_rate_limit')) fail('shared missing RPC path');

const aiGmSrc = read(aiGm);
if (!aiGmSrc.includes('consumePersistentAiGmRateLimit')) fail('ai-gm must import rate limit');
if (!aiGmSrc.includes('enforceAiGmRateLimit')) fail('ai-gm must call enforceAiGmRateLimit');
if (!aiGmSrc.includes('status: 429')) fail('ai-gm must return 429 when exhausted');
if (!aiGmSrc.includes('status: 503')) fail('ai-gm must fail closed (503) when limiter infra missing');

const allowSrc = read(allowlist);
if (/\b'ai-gm'\b/.test(allowSrc) || /\b"ai-gm"\b/.test(allowSrc)) {
  fail('do not re-allowlist ai-gm in this ticket — limiter ships before remount');
}

const kongSrc = read(kong);
if (!/name:\s*rate-limiting/.test(kongSrc)) fail('kong auth-v1 must use rate-limiting plugin');
if (!/minute:\s*30/.test(kongSrc)) fail('kong auth rate limit minute=30 expected');
if (!/fault_tolerant:\s*false/.test(kongSrc)) {
  fail('kong rate-limiting must fail closed (fault_tolerant: false)');
}

const composeSrc = read(compose);
if (!/rate-limiting/.test(composeSrc)) fail('compose KONG_PLUGINS must include rate-limiting');
if (!/GOTRUE_RATE_LIMIT_EMAIL_SENT/.test(composeSrc)) {
  fail('compose must set GOTRUE_RATE_LIMIT_EMAIL_SENT');
}

const loginSrc = read(login);
if (!loginSrc.includes('authErrorMessage')) fail('LoginScreen must map 429');
if (!/Zu viele Anmeldeversuche/.test(loginSrc)) fail('LoginScreen missing DE rate-limit copy');

const docsSrc = read(docs);
if (!/429/.test(docsSrc)) fail('docs must document 429 behavior');
if (!/ai-gm/.test(docsSrc)) fail('docs must mention ai-gm limiter');
if (!/allowlist|dispatcher/i.test(docsSrc)) {
  fail('docs must note ai-gm remains dispatcher-blocked until remount');
}

const apply = read('scripts/apply-migrations.sh');
if (!apply.includes('087_ai_gm_rate_limits.sql')) {
  fail('apply-migrations.sh must list 087');
}

console.log('✓ ai-gm-auth-rate-limit-check OK');
