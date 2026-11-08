#!/usr/bin/env node
/**
 * saga-definitions-versions-check — #574 tables, Dornhain seed, client redaction.
 * Location: scripts/saga-definitions-versions-check.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function fail(message) {
  console.error(`Saga definitions versions check failed: ${message}`);
  process.exit(1);
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) fail(`missing ${label}`);
}

const migrationPath = 'archive/supabase-legacy/supabase/migrations/063_saga_definitions.sql';
if (!existsSync(join(root, migrationPath))) fail(`missing ${migrationPath}`);
const migration = read(migrationPath);
requireMatch(migration, /CREATE TABLE IF NOT EXISTS public\.saga_definitions/i, 'saga_definitions');
requireMatch(migration, /CREATE TABLE IF NOT EXISTS public\.saga_definition_versions/i, 'versions');
requireMatch(migration, /ADD COLUMN IF NOT EXISTS saga_id/i, 'projects.saga_id');
requireMatch(migration, /dornhain\.whisper/i, 'Dornhain slug');
requireMatch(migration, /Ein Relikt wurde geöffnet/i, 'Dornhain gm_only seed text');
requireMatch(migration, /private_backfill/i, 'backfill origin');
requireMatch(migration, /create_project_from_saga_version/i, 'create from version RPC');
requireMatch(migration, /get_native_saga_definition_by_slug/i, 'native slug RPC');
requireMatch(migration, /sagaDefinitionId/i, 'overview sagaDefinitionId');
requireMatch(migration, /REVOKE ALL ON TABLE public\.saga_definition_versions FROM anon, authenticated/i, 'versions SELECT revoke');

const clientPkg = read('src/domains/session/contracts/golden-adventure-dornhain.ts');
if (clientPkg.includes('Ein Relikt wurde geöffnet')) {
  fail('client bundle must not contain Dornhain gm_only secret summary');
}
if (clientPkg.includes('vertrauter Dorfbewohner')) {
  fail('client bundle must not contain hidden-npc secret summary');
}
requireMatch(clientPkg, /Client Dornhain package must redact gm_only/i, 'integrity redaction');

const domain = read('src/domains/saga/contracts/saga-definition.ts');
requireMatch(domain, /projectSagaDefinitionPayload/i, 'audience project');
requireMatch(domain, /groupProjectsBySagaDefinition/i, 'group helper');

const service = read('src/infrastructure/saga/saga-definition-service.ts');
requireMatch(service, /getHostNativeSagaDefinitionBySlug/i, 'service native host HTTP (CUT-20)');
requireMatch(service, /createHostProjectFromSagaVersion/i, 'service create host HTTP (CUT-20)');
requireMatch(service, /isHostLibraryEnabled/i, 'service host library gate');
if (/get_native_saga_definition_by_slug|create_project_from_saga_version|\.rpc\s*\(|supabase/.test(service)) {
  fail('service must not call legacy saga-definition RPCs (CUT-20)');
}

const panel = read('src/app/session/GoldenAdventureDornhainPanel.tsx');
requireMatch(panel, /sagaDefinitionService/i, 'panel loads server definition');
requireMatch(panel, /data-dornhain-source="server"/i, 'server source marker');

const docs = read('docs/navigation-public-ids.md');
requireMatch(docs, /Gruppen-Saga|Playthrough|saga_definitions/i, 'docs SA- clarification');

const apply = read('scripts/apply-migrations.sh');
if (!apply.includes('063_saga_definitions.sql')) fail('apply-migrations must list 063');

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('saga-definitions-versions-check.mjs')) {
  fail('test-gate must invoke saga-definitions-versions-check.mjs');
}

if (/\bas any\b|eslint-disable|@ts-ignore/.test(domain + service)) {
  fail('type escape hatch');
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/saga-definitions-versions-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'def.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/saga/contracts/saga-definition.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});
const mod = await import(pathToFileURL(out).href);

const projected = mod.projectSagaDefinitionPayload(
  {
    packageId: 'x',
    title: 'T',
    synopsis: 'S',
    knowledgeFacts: [
      { id: 'a', visibility: 'public', summary: 'Öffentlich' },
      { id: 'b', visibility: 'gm_only', summary: 'Geheim' },
    ],
    locations: [],
  },
  false,
);
if (projected.knowledgeFacts.length !== 1 || projected.knowledgeFacts[0].id !== 'a') {
  fail('expected player projection to drop gm_only');
}

const groups = mod.groupProjectsBySagaDefinition([
  { id: '1', sagaId: 's1' },
  { id: '2', sagaId: 's1' },
  { id: '3', sagaId: null },
]);
if (groups.length !== 2) fail('expected 2 groups (shared saga + orphan)');

console.log('Saga definitions versions check passed.');
