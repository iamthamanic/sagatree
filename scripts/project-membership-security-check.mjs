import { readFileSync } from 'node:fs';
import process from 'node:process';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) {
    console.error(`Project membership security check failed: missing ${label}.`);
    process.exit(1);
  }
}

function rejectMatch(content, pattern, label) {
  if (pattern.test(content)) {
    console.error(`Project membership security check failed: ${label}.`);
    process.exit(1);
  }
}

const canonicalRls = read('archive/supabase-legacy/src-supabase/schema_v3_rls.sql');
const migration = read('archive/supabase-legacy/supabase/migrations/004_project_membership_security.sql');
const projectService = read('src/infrastructure/project/project-service.ts');
const memberService = read('src/infrastructure/project/project-member-service.ts');
const loreFunction = read('archive/supabase-legacy/supabase/functions/character-lore/index.ts');
const loreAccess = read('archive/supabase-legacy/supabase/functions/_shared/character-lore-access.ts');

for (const [label, pattern] of [
  ['client join INSERT policy', /CREATE POLICY\s+"Users can join projects"/i],
  ['client membership UPDATE policy', /CREATE POLICY\s+"Users can update their member record"/i],
  ['unrestricted client membership DELETE policy', /CREATE POLICY\s+"Users can leave projects"/i],
]) {
  rejectMatch(canonicalRls, pattern, label);
}

requireMatch(
  canonicalRls,
  /CREATE POLICY\s+"GM can update members in their projects"[\s\S]*?WITH CHECK[\s\S]*?gm_user_id\s*=\s*auth\.uid\(\)/i,
  'GM-controlled membership update policy',
);
requireMatch(
  canonicalRls,
  /CREATE POLICY\s+"Active members can view their projects"[\s\S]*?current_user_is_active_project_member/i,
  'active-member project visibility policy',
);
requireMatch(
  canonicalRls,
  /CREATE OR REPLACE FUNCTION public\.join_project_by_code[\s\S]*?SECURITY DEFINER[\s\S]*?auth\.uid\(\)[\s\S]*?'player'[\s\S]*?'active'/i,
  'server-owned join-by-code RPC',
);
requireMatch(
  canonicalRls,
  /REVOKE ALL ON FUNCTION public\.join_project_by_code\(TEXT, UUID\) FROM PUBLIC;/i,
  'join RPC public revoke',
);
requireMatch(
  canonicalRls,
  /CREATE OR REPLACE FUNCTION public\.set_my_project_character[\s\S]*?SET character_id = p_character_id[\s\S]*?user_id = v_user_id[\s\S]*?status = 'active'/i,
  'character-only membership update RPC',
);

const incompleteGate = read('archive/supabase-legacy/supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql');
requireMatch(
  incompleteGate,
  /Unvollständige Charakterbögen können keinem Abenteuer beitreten/,
  '032 join rejects incomplete sheets',
);
requireMatch(
  incompleteGate,
  /Unvollständige Charakterbögen können keinem Abenteuer zugewiesen werden/,
  '032 set character rejects incomplete sheets',
);
requireMatch(
  canonicalRls,
  /Unvollständige Charakterbögen können keinem Abenteuer beitreten/,
  'canonical RLS join rejects incomplete sheets',
);

requireMatch(
  migration,
  /DROP POLICY IF EXISTS "Users can update their member record" ON public\.project_members;/i,
  'existing-deployment removal of self-update policy',
);
requireMatch(
  migration,
  /DROP POLICY IF EXISTS "Users can view their own projects" ON public\.projects;/i,
  'legacy project visibility hardening',
);
requireMatch(
  migration,
  /CREATE POLICY "Active members can view their projects"[\s\S]*?current_user_is_active_project_member/i,
  'migration active-member project policy',
);
requireMatch(
  migration,
  /CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_code_casefold_unique[\s\S]*?UPPER\(BTRIM\(code\)\)/i,
  'case-insensitive project-code uniqueness',
);
requireMatch(
  migration,
  /duplicate normalized codes exist/i,
  'fail-closed duplicate-code migration preflight',
);
requireMatch(
  migration,
  /WHERE UPPER\(BTRIM\(code\)\) = UPPER\(BTRIM\(p_code\)\)[\s\S]*?AND status = 'active';/i,
  'unambiguous case-insensitive join lookup',
);

for (const policyName of [
  'Users can view their characters',
  'Users can view their sessions',
  'Users can view session players',
  'Users can view NPC memories',
  'Users can view combat states',
  'Users can view chat messages',
  'Users can insert chat messages',
]) {
  requireMatch(
    migration,
    new RegExp(`DROP POLICY IF EXISTS "${policyName}"`, 'i'),
    `legacy policy replacement for ${policyName}`,
  );
}

for (const [label, pattern] of [
  ['legacy character project access', /CREATE POLICY "Users can view their characters"[\s\S]*?current_user_is_active_project_member\(project_id\)/i],
  ['legacy session access', /CREATE POLICY "Users can view their sessions"[\s\S]*?current_user_is_active_project_member\(project_id\)/i],
  ['legacy NPC memory access', /CREATE POLICY "Users can view NPC memories"[\s\S]*?current_user_is_active_project_member\(project_id\)/i],
  ['legacy combat-state access', /CREATE POLICY "Users can view combat states"[\s\S]*?current_user_is_active_project_member\(project_id\)/i],
  ['legacy chat read access', /CREATE POLICY "Users can view chat messages"[\s\S]*?current_user_is_active_project_member\(project_id\)/i],
  ['legacy chat write access', /CREATE POLICY "Users can insert chat messages"[\s\S]*?current_user_is_active_project_member\(project_id\)/i],
]) {
  requireMatch(migration, pattern, label);
}

requireMatch(
  loreFunction,
  /canUseWorldLoreReference\([\s\S]*?project\?\.gm_user_id/i,
  'independent project-linked world authorization',
);
requireMatch(
  loreAccess,
  /const referenceOwnerUserId = projectGmUserId \?\? callerUserId;[\s\S]*?world\.creatorUserId === referenceOwnerUserId/i,
  'private world ownership check',
);

requireMatch(
  memberService,
  /joinHostProjectByCode/,
  'frontend join path through host HTTP (CUT-20)',
);
requireMatch(
  memberService,
  /setHostMyProjectCharacter/,
  'frontend character selection through host HTTP (CUT-20)',
);
rejectMatch(
  memberService,
  /\.from\('project_members'\)[\s\S]{0,160}?\.insert\(/,
  'project member service directly inserts authorization rows',
);
rejectMatch(
  memberService,
  /\.from\('project_members'\)[\s\S]{0,160}?\.update\(/,
  'project member service directly updates protected membership rows',
);
requireMatch(
  projectService,
  /projectMemberService\.joinByCode\(payload\)/,
  'project join flow delegates to secure member service',
);
requireMatch(
  projectService,
  /fetchHostLibraryProjects/,
  'project listing via host library (server-scoped memberships, CUT-20)',
);

const sheetGate = read('archive/supabase-legacy/supabase/migrations/035_guard_sheet_status_complete.sql');
requireMatch(
  sheetGate,
  /enforce_character_sheet_status_complete/,
  'sheet_status complete DB gate',
);
requireMatch(
  sheetGate,
  /Unvollständiger Charakter kann nicht als complete/,
  'sheet_status gate fails closed',
);
requireMatch(
  read('scripts/apply-migrations.sh'),
  /035_guard_sheet_status_complete\.sql/,
  'apply-migrations lists 035',
);

console.log('Project membership security check passed.');
