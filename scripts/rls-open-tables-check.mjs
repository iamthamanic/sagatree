#!/usr/bin/env node
/**
 * rls-open-tables-check — #669 static contract for rulesets / world_graphs RLS.
 * Location: scripts/rls-open-tables-check.mjs
 *
 * Wired into test-gate. Live deny: negative-authz-suite.mjs
 * (rest.non_member_rulesets_deny / rest.non_member_world_graphs_deny).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationRel = 'archive/supabase-legacy/supabase/migrations/086_rls_rulesets_world_graphs.sql';

function fail(msg) {
  console.error(`rls-open-tables-check failed: ${msg}`);
  process.exit(1);
}

if (!existsSync(join(root, migrationRel))) fail(`missing ${migrationRel}`);

const sql = readFileSync(join(root, migrationRel), 'utf8');

for (const table of ['rulesets', 'world_graphs']) {
  if (!new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`).test(sql)) {
    fail(`must ENABLE ROW LEVEL SECURITY on ${table}`);
  }
  for (const op of ['select', 'insert', 'update', 'delete']) {
    if (!sql.includes(`${table}_${op}_`)) {
      fail(`${table} missing named ${op} policy`);
    }
  }
  if (!sql.includes(`ON public.${table}`)) {
    fail(`policies must target public.${table}`);
  }
}

for (const needle of [
  'current_user_is_active_project_member',
  'gm_user_id = auth.uid()',
  'TO authenticated',
  'project_id IS NOT NULL',
]) {
  if (!sql.includes(needle)) fail(`migration missing ${JSON.stringify(needle)}`);
}

// No open SELECT for all authenticated without membership predicate.
if (/FOR SELECT[\s\S]{0,80}USING\s*\(\s*true\s*\)/i.test(sql)) {
  fail('forbidden open SELECT USING (true)');
}

const live = readFileSync(join(root, 'scripts/negative-authz-suite.mjs'), 'utf8');
for (const check of [
  'rest.non_member_rulesets_deny',
  'rest.non_member_world_graphs_deny',
  'rest.member_rulesets_allow',
]) {
  if (!live.includes(check)) fail(`live suite missing ${check}`);
}

console.log('✓ rls-open-tables-check OK', { migration: migrationRel });
