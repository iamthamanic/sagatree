#!/usr/bin/env node
/**
 * negative-authz-suite-check — static + evidence contract for #607.
 * Location: scripts/negative-authz-suite-check.mjs
 *
 * Wired into test-gate. Live probes: `node scripts/negative-authz-suite.mjs`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(msg) {
  console.error(`negative-authz-suite-check failed: ${msg}`);
  process.exit(1);
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const mainTs = 'archive/supabase-legacy/supabase/functions/main/index.ts';
const gateTs = 'archive/supabase-legacy/supabase/functions/_shared/edge-jwt-gate.ts';
const liveScript = 'scripts/negative-authz-suite.mjs';
const acceptance = '.qa/acceptance/negative-authz-suite.md';
const reportRel = '.qa/runs/negative-authz-suite/report.json';
const localAdmin = 'src/lib/localAdmin.ts';
const authCtx = 'src/lib/auth-context.tsx';
const compose = 'docker-compose.yml';
const envEx = '.env.example';
const docs = 'docs/ops/negative-authz-suite.md';

for (const rel of [mainTs, gateTs, liveScript, acceptance, localAdmin, authCtx, compose, envEx, docs]) {
  if (!existsSync(join(root, rel))) fail(`missing ${rel}`);
}

const mainSrc = read(mainTs);
if (!mainSrc.includes('gateEdgeRequestJwt')) {
  fail('main dispatcher must call gateEdgeRequestJwt');
}
if (!mainSrc.includes('edge-jwt-gate')) {
  fail('main must import edge-jwt-gate');
}

const gateSrc = read(gateTs);
for (const needle of [
  'isJwtVerificationEnabled',
  'missing Authorization bearer token',
  'VERIFY_JWT',
  'HS256',
]) {
  if (!gateSrc.includes(needle)) fail(`edge-jwt-gate missing ${JSON.stringify(needle)}`);
}

const adminSrc = read(localAdmin);
if (!adminSrc.includes('isLocalAdminEnabled')) fail('localAdmin missing isLocalAdminEnabled');
if (!adminSrc.includes('import.meta.env.DEV')) {
  fail('localAdmin must gate on import.meta.env.DEV');
}

const authSrc = read(authCtx);
if (!authSrc.includes('isLocalAdminEnabled()')) {
  fail('auth-context shortcut must consult isLocalAdminEnabled');
}

const composeSrc = read(compose);
if (!/VERIFY_JWT:\s*\$\{VERIFY_JWT:-true\}/.test(composeSrc)) {
  fail('compose must default VERIFY_JWT to true');
}
if (!/127\.0\.0\.1:5432:5432/.test(composeSrc)) {
  fail('Postgres must bind loopback (no internet-facing DB with weak seeds)');
}
if (!/127\.0\.0\.1:9998:9998/.test(composeSrc)) {
  fail('Edge must bind loopback');
}

const envSrc = read(envEx);
if (!/admin\/1234/.test(envSrc) || !/DEV-only/i.test(envSrc)) {
  fail('.env.example must document admin/1234 as DEV-only');
}

const docsSrc = read(docs);
if (!/negative-authz-suite\.mjs/.test(docsSrc)) {
  fail('docs must reference live suite script');
}
if (!/test-gate/i.test(docsSrc)) {
  fail('docs must mention test-gate wiring');
}

const liveSrc = read(liveScript);
for (const needle of [
  'edge.anon_no_bearer_deny',
  'edge.invalid_jwt_deny',
  'edge.ai_gm_foreign_session_deny',
  'rest.non_member_project_deny',
  'rest.non_member_rulesets_deny',
  'rest.non_member_world_graphs_deny',
  'rest.non_member_rulesets_update_deny',
]) {
  if (!liveSrc.includes(needle)) fail(`live suite missing check ${needle}`);
}

const rlsMigration = 'archive/supabase-legacy/supabase/migrations/086_rls_rulesets_world_graphs.sql';
if (!existsSync(join(root, rlsMigration))) fail(`missing ${rlsMigration}`);
const rlsSql = read(rlsMigration);
if (!/ALTER TABLE public\.rulesets ENABLE ROW LEVEL SECURITY/.test(rlsSql)) {
  fail('086 must enable RLS on rulesets');
}
if (!/ALTER TABLE public\.world_graphs ENABLE ROW LEVEL SECURITY/.test(rlsSql)) {
  fail('086 must enable RLS on world_graphs');
}

if (!existsSync(join(root, reportRel))) {
  fail(`missing live evidence ${reportRel} — run: node ${liveScript}`);
}

let report;
try {
  report = JSON.parse(read(reportRel));
} catch (e) {
  fail(`report.json parse error: ${e}`);
}

if (report.suite !== 'negative-authz-suite') fail('report.suite mismatch');
if (report.ok !== true) fail('report.ok must be true');

const required = [
  'edge.anon_no_bearer_deny',
  'edge.invalid_jwt_deny',
  'edge.member_jwt_allow',
  'edge.ai_gm_foreign_session_deny',
  'rest.non_member_project_deny',
  'rest.member_rulesets_allow',
  'rest.non_member_rulesets_deny',
  'rest.non_member_rulesets_update_deny',
  'rest.non_member_world_graphs_deny',
];
const byName = Object.fromEntries((report.checks || []).map((c) => [c.name, c]));
for (const name of required) {
  if (!byName[name]?.pass) fail(`evidence missing pass for ${name}`);
}

console.log('✓ negative-authz-suite-check OK', { checks: required.length });
