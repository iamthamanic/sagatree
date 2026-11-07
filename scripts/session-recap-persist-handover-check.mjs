#!/usr/bin/env node
/**
 * session-recap-persist-handover-check — #572 recap table + hydrate create + domain.
 * Location: scripts/session-recap-persist-handover-check.mjs
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
  console.error(`Session recap persist handover check failed: ${message}`);
  process.exit(1);
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) fail(`missing ${label}`);
}

const migrationPath = 'supabase/migrations/061_session_recaps_and_handover.sql';
if (!existsSync(join(root, migrationPath))) fail(`missing ${migrationPath}`);

const migration = read(migrationPath);
requireMatch(migration, /CREATE TABLE IF NOT EXISTS public\.session_recaps/i, 'session_recaps table');
requireMatch(migration, /sagadrive_upsert_session_recap/i, 'upsert recap helper');
requireMatch(migration, /get_session_recap/i, 'get_session_recap RPC');
requireMatch(migration, /CREATE OR REPLACE FUNCTION public\.create_project_session/i, 'create_project_session hydrate');
requireMatch(migration, /adventure_runtime/i, 'hydrate from adventure_runtime');
requireMatch(migration, /p_status = 'completed'/i, 'complete → upsert');
requireMatch(migration, /GRANT SELECT ON TABLE public\.session_recaps TO authenticated/i, 'SELECT grant');
requireMatch(migration, /recapSnippet/i, 'overview snippet from recaps');

const domain = read('src/domains/session/contracts/session-prepare-recap.ts');
requireMatch(domain, /sessionStartedAtIso/i, 'session-scoped highlight filter');
requireMatch(domain, /parsePersistedRecapHighlightLines/i, 'persisted parse');

const hook = read('src/app/session/hooks/useSessionPrepareRecap.ts');
requireMatch(hook, /sessionRecapService/i, 'hook loads persisted recap');
requireMatch(hook, /highlightsSource/i, 'highlights source flag');
requireMatch(hook, /persisted/i, 'persisted path');

const service = read('src/infrastructure/session/session-recap-service.ts');
requireMatch(service, /fetchHostSessionRecap/i, 'service host HTTP (CUT-20)');
requireMatch(service, /isHostLibraryEnabled/i, 'service host library gate');
if (/get_session_recap|\.rpc\s*\(|supabase/.test(service)) {
  fail('service must not call legacy get_session_recap RPC (CUT-20)');
}
if (/\bas any\b|eslint-disable|@ts-ignore/.test(service + domain)) {
  fail('type escape hatch');
}

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('session-recap-persist-handover-check.mjs')) {
  fail('test-gate must invoke session-recap-persist-handover-check.mjs');
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/session-recap-persist-handover-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'recap.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/session-prepare-recap.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});
const mod = await import(pathToFileURL(out).href);

const newest = mod.buildRecapHighlightLines({
  consequences: [
    { id: 'a', kind: 'x', summary: 'Alt', createdAt: '2026-01-01T10:00:00Z' },
    { id: 'b', kind: 'x', summary: 'Neu', createdAt: '2026-01-01T12:00:00Z' },
  ],
});
if (newest[0]?.summary !== 'Neu') fail('expected newest-first highlights');

const scoped = mod.buildRecapHighlightLines({
  consequences: [
    { id: 'old', kind: 'x', summary: 'Vor Episode', createdAt: '2026-01-01T09:00:00Z' },
    { id: 'in', kind: 'x', summary: 'In Episode', createdAt: '2026-01-01T11:00:00Z' },
    { id: 'after', kind: 'x', summary: 'Nach Episode', createdAt: '2026-01-01T13:00:00Z' },
  ],
  sessionStartedAtIso: '2026-01-01T10:00:00Z',
  sessionEndedAtIso: '2026-01-01T12:00:00Z',
});
if (scoped.length !== 1 || scoped[0]?.summary !== 'In Episode') {
  fail('expected session-window filter to keep only in-episode events');
}

const parsed = mod.parsePersistedRecapHighlightLines([
  { id: '1', kind: 'note', summary: 'Persistiert', visibility: 'shared' },
]);
if (parsed[0]?.summary !== 'Persistiert') fail('parse persisted lines');

requireMatch(migration, /sagadrive_build_recap_highlight_lines\(\s*COALESCE\(sr\.snapshot/i, 'overview audience-safe snippet');

console.log('Session recap persist handover check passed.');
