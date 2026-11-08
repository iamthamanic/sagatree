#!/usr/bin/env node
/**
 * saga-between-sessions-bote-check — #578 Prepare between-sessions + Bote + hub deadlines.
 * Location: scripts/saga-between-sessions-bote-check.mjs
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
  console.error(`Saga between-sessions/bote check failed: ${message}`);
  process.exit(1);
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) fail(`missing ${label}`);
}

const migrationPath = 'archive/supabase-legacy/supabase/migrations/066_saga_between_sessions_bote.sql';
if (!existsSync(join(root, migrationPath))) fail(`missing ${migrationPath}`);
const migration = read(migrationPath);
requireMatch(migration, /openDeadlines/i, 'openDeadlines in overview');
requireMatch(migration, /v_open_deadlines/i, 'v_open_deadlines');
requireMatch(migration, /deadlines/i, 'deadlines projection');
requireMatch(
  migration,
  /sagatree_project_shared_adventure|sagadrive_project_shared_adventure/i,
  'shared adventure filter',
);

const domain = read('src/domains/session/contracts/bote-lines.ts');
requireMatch(domain, /export function buildBoteLines/i, 'buildBoteLines');
requireMatch(domain, /export function listOpenDeadlines/i, 'listOpenDeadlines');
requireMatch(domain, /gm_only/i, 'gm_only guard');

const hook = read('src/app/session/hooks/useSessionPrepareRecap.ts');
requireMatch(hook, /boteLines/i, 'boteLines on VM');
requireMatch(hook, /openDeadlines/i, 'openDeadlines on VM');
requireMatch(hook, /buildBoteLines/i, 'uses buildBoteLines');
requireMatch(hook, /useState|useEffect|useCallback/i, 'allowed hooks');

const prepare = read('src/app/session/SessionPrepareScreen.tsx');
requireMatch(prepare, /SagaBetweenSessionsSection/i, 'between sessions section');
requireMatch(prepare, /SagaBotePanel/i, 'bote panel');
requireMatch(prepare, /data-au-surface="session-prepare"/i, 'AU prepare');

const between = read('src/app/session/SagaBetweenSessionsSection.tsx');
requireMatch(between, /data-saga-between-sessions/i, 'between marker');
requireMatch(between, /SagaSimulationGmPanel/i, 'reuses sim panel');
requireMatch(between, /min-h-11|data-au-surface/i, 'AU');

const bote = read('src/app/session/SagaBotePanel.tsx');
requireMatch(bote, /data-saga-bote-panel/i, 'bote marker');
requireMatch(bote, /Der Bote/i, 'German title');

const overview = read('src/domains/project/contracts/saga-overview.ts');
requireMatch(overview, /openDeadlines/i, 'overview openDeadlines');
requireMatch(overview, /SagaOverviewDeadlineVm/i, 'deadline VM type');

const world = read('src/app/project/overview/SagaWorldStatePanel.tsx');
requireMatch(world, /data-saga-overview-open-deadlines/i, 'hub deadlines marker');
requireMatch(world, /Offene Fristen/i, 'German deadlines');

const apply = read('scripts/apply-migrations.sh');
if (!apply.includes('066_saga_between_sessions_bote.sql')) {
  fail('apply-migrations must list 066');
}

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('saga-between-sessions-bote-check.mjs')) {
  fail('test-gate must invoke saga-between-sessions-bote-check.mjs');
}

const touched = [
  domain,
  hook,
  prepare,
  between,
  bote,
  overview,
  world,
  read('src/app/session/SagaSimulationGmPanel.tsx'),
];
for (const content of touched) {
  if (/\bas any\b|eslint-disable|@ts-ignore|@ts-expect-error/.test(content)) {
    fail('type escape hatch');
  }
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/saga-between-sessions-bote-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'bote.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/bote-lines.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  logLevel: 'silent',
});
const mod = await import(pathToFileURL(out).href);
const empty = mod.buildBoteLines({ consequences: [] });
if (!Array.isArray(empty) || empty.length !== 1 || empty[0].kind !== 'empty') {
  fail('empty bote must return one empty line');
}
const lines = mod.buildBoteLines({
  consequences: [
    {
      id: '1',
      kind: 'deadline',
      summary: 'Der Bote berichtet von der Frist',
      visibility: 'shared',
      createdAt: '2026-01-02T00:00:00Z',
    },
    {
      id: 'secret',
      kind: 'deadline',
      summary: 'Geheim',
      visibility: 'gm_only',
      createdAt: '2026-01-03T00:00:00Z',
    },
    {
      id: 'noise',
      kind: 'note',
      summary: 'Nicht Bote',
      visibility: 'public',
      createdAt: '2026-01-04T00:00:00Z',
    },
  ],
});
if (lines.length !== 1 || lines[0].id !== '1') {
  fail('bote must keep only public/shared simulation kinds');
}
const open = mod.listOpenDeadlines({
  deadlines: [
    { id: 'a', label: 'A', dueDay: 3, fired: false, visibility: 'shared' },
    { id: 'b', label: 'B', dueDay: 1, fired: true, visibility: 'shared' },
    { id: 'c', label: 'C', dueDay: 2, fired: false, visibility: 'gm_only' },
  ],
});
if (open.length !== 1 || open[0].id !== 'a') {
  fail('open deadlines must drop fired and gm_only; sort by dueDay');
}

console.log('Saga between-sessions/bote check OK');
