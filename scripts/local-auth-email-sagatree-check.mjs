#!/usr/bin/env node
/**
 * local-auth-email-sagatree-check — App shortcut emails must match GoTrue seeds.
 * Prevents Local Admin falling back to anon (42501 library errors) after brand rename.
 * Location: scripts/local-auth-email-sagatree-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function fail(message) {
  console.error(`Local auth email sagatree check failed: ${message}`);
  process.exit(1);
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) fail(`missing ${label}`);
}

function extractExportString(source, exportName) {
  const re = new RegExp(
    `export\\s+const\\s+${exportName}\\s*=\\s*['"]([^'"]+)['"]`,
  );
  const m = source.match(re);
  if (!m) fail(`could not parse export ${exportName}`);
  return m[1];
}

const adminTs = read('src/lib/localAdmin.ts');
const playerTs = read('src/lib/localPlayer.ts');
const adminEmail = extractExportString(adminTs, 'LOCAL_ADMIN_EMAIL');
const playerEmail = extractExportString(playerTs, 'LOCAL_PLAYER_EMAIL');

if (adminEmail !== 'admin@sagatree.local') {
  fail(`LOCAL_ADMIN_EMAIL must be admin@sagatree.local (got ${adminEmail})`);
}
if (playerEmail !== 'player@sagatree.local') {
  fail(`LOCAL_PLAYER_EMAIL must be player@sagatree.local (got ${playerEmail})`);
}

const mig011 = 'archive/supabase-legacy/supabase/migrations/011_seed_local_admin.sql';
const mig074 = 'archive/supabase-legacy/supabase/migrations/074_seed_local_player.sql';
const mig080 = 'archive/supabase-legacy/supabase/migrations/080_rename_local_auth_emails_sagatree.sql';
for (const p of [mig011, mig074, mig080]) {
  if (!existsSync(join(root, p))) fail(`missing ${p}`);
}

const seed011 = read(mig011);
const seed074 = read(mig074);
const rename080 = read(mig080);

requireMatch(
  seed011,
  /v_email\s+text\s*:=\s*'admin@sagatree\.local'/,
  '011 canonical admin@sagatree.local',
);
requireMatch(
  seed011,
  /v_legacy_email\s+text\s*:=\s*'admin@sagadrive\.local'/,
  '011 legacy admin@sagadrive.local lookup',
);
requireMatch(
  seed074,
  /v_email\s+text\s*:=\s*'player@sagatree\.local'/,
  '074 canonical player@sagatree.local',
);
requireMatch(
  seed074,
  /v_legacy_email\s+text\s*:=\s*'player@sagadrive\.local'/,
  '074 legacy player@sagadrive.local lookup',
);

requireMatch(rename080, /admin@sagadrive\.local/, '080 admin legacy email');
requireMatch(rename080, /admin@sagatree\.local/, '080 admin new email');
requireMatch(rename080, /player@sagadrive\.local/, '080 player legacy email');
requireMatch(rename080, /player@sagatree\.local/, '080 player new email');
requireMatch(rename080, /auth\.identities/, '080 updates identities');
requireMatch(rename080, /auth\.users/, '080 updates users');

const apply = read('scripts/apply-migrations.sh');
if (!apply.includes('080_rename_local_auth_emails_sagatree.sql')) {
  fail('apply-migrations.sh must list 080_rename_local_auth_emails_sagatree.sql');
}

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('local-auth-email-sagatree-check.mjs')) {
  fail('test-gate must invoke local-auth-email-sagatree-check.mjs');
}

console.log('Local auth email sagatree check passed.');
