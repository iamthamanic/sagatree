#!/usr/bin/env node
/**
 * saga-overview-rpc-check — #570 membership-gated overview RPC + domain VM.
 * Location: scripts/saga-overview-rpc-check.mjs
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
  console.error(`Saga overview RPC check failed: ${message}`);
  process.exit(1);
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) fail(`missing ${label}`);
}

function rejectMatch(content, pattern, label) {
  if (pattern.test(content)) fail(label);
}

function mustInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      fail(`${label}: missing ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

const migrationPath = 'archive/supabase-legacy/supabase/migrations/060_saga_overview.sql';
if (!existsSync(join(root, migrationPath))) fail(`missing ${migrationPath}`);

const migration = read(migrationPath);
requireMatch(migration, /CREATE OR REPLACE FUNCTION public\.get_saga_overview\(p_public_id TEXT\)/i, 'get_saga_overview');
requireMatch(migration, /SECURITY DEFINER/i, 'SECURITY DEFINER');
requireMatch(migration, /current_user_is_active_project_member/i, 'membership gate');
requireMatch(
  migration,
  /sagatree_project_shared_adventure|sagadrive_project_shared_adventure/i,
  'audience projection helper',
);
requireMatch(migration, /GRANT EXECUTE ON FUNCTION public\.get_saga_overview\(TEXT\) TO authenticated/i, 'EXECUTE grant');
requireMatch(migration, /REVOKE ALL ON FUNCTION public\.get_saga_overview\(TEXT\) FROM PUBLIC/i, 'REVOKE PUBLIC');
rejectMatch(migration, /CREATE POLICY/i, 'must not add table policies in overview migration');

mustInclude(
  'src/domains/project/contracts/saga-overview.ts',
  [
    'parseSagaOverview',
    'assertSagaOverviewAudienceSafe',
    'SagaOverviewVm',
    'worldStateSummary',
    'primaryAction',
    'gm_only',
  ],
  'overview contract',
);

mustInclude(
  'src/domains/project/use-cases/saga-primary-action.ts',
  ['resolveSagaPrimaryAction', 'continue-session', 'host-session'],
  'primary action use-case',
);

mustInclude(
  'src/infrastructure/project/saga-overview-service.ts',
  [
    'fetchHostSagaOverview',
    'isHostLibraryEnabled',
    'getOverviewByPublicId',
    'parseSagaOverview',
    'assertSagaOverviewAudienceSafe',
  ],
  'overview service (CUT-20 host HTTP)',
);

const service = read('src/infrastructure/project/saga-overview-service.ts');
rejectMatch(
  service,
  /\.from\(\s*['"]projects['"]\s*\)/,
  'service must not SELECT projects table directly',
);
rejectMatch(
  service,
  /adventure_runtime/,
  'service must not mention adventure_runtime column select',
);
rejectMatch(
  service,
  /supabase|\.rpc\s*\(/,
  'service must not call Supabase RPC (CUT-20)',
);
rejectMatch(
  service,
  /get_saga_overview/,
  'service must not name legacy RPC (CUT-20 host HTTP)',
);

mustInclude(
  'src/app/project/hooks/useSagaOverview.ts',
  [
    'useSagaOverview',
    'sagaOverviewService',
    'entityCache',
    'visibilitychange',
    'useState',
    'useEffect',
    'useRef',
  ],
  'overview hook',
);

const hook = read('src/app/project/hooks/useSagaOverview.ts');
rejectMatch(hook, /useMemo|useCallback|useQuery|RealtimeChannel|channel\(/, 'hook must stay simple (no Realtime / extra hooks)');

mustInclude(
  'src/lib/entityCache.ts',
  ['sagaOverviewPrefix', 'sagaOverviewCacheKey'],
  'entity cache key',
);

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('saga-overview-rpc-check.mjs')) {
  fail('test-gate must invoke saga-overview-rpc-check.mjs');
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/saga-overview-rpc-check');
mkdirSync(cacheDir, { recursive: true });
const overviewOut = join(cacheDir, 'saga-overview.mjs');
const primaryOut = join(cacheDir, 'saga-primary-action.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/project/contracts/saga-overview.ts')],
  outfile: overviewOut,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/project/use-cases/saga-primary-action.ts')],
  outfile: primaryOut,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});

const overviewMod = await import(pathToFileURL(overviewOut).href);
const primaryMod = await import(pathToFileURL(primaryOut).href);

const playerRaw = {
  projectId: 'p1',
  sagaPublicId: 'SA-TEST1',
  title: 'Probe',
  blurb: 'Blurb',
  status: 'active',
  selfRole: 'player',
  isGm: false,
  definitionRef: 'dornhain',
  primaryAction: { kind: 'wait', labelDe: 'Warten', sessionPublicId: null },
  episodes: [],
  ensemble: [],
  worldStateSummary: {
    clocks: [
      { id: 'threat', label: 'Bedrohung', value: 2, max: 4, visibility: 'shared' },
    ],
    consequences: [
      { id: 'c1', kind: 'note', summary: 'Öffentlich', visibility: 'public', createdAt: null },
    ],
    flagCount: 1,
    updatedAt: null,
  },
};

const playerVm = overviewMod.parseSagaOverview(playerRaw);
overviewMod.assertSagaOverviewAudienceSafe(playerVm);
if (overviewMod.sagaOverviewHasGmOnlyWorldFields(playerVm)) {
  fail('player fixture must not report gm_only');
}

const leakRaw = {
  ...playerRaw,
  worldStateSummary: {
    ...playerRaw.worldStateSummary,
    clocks: [
      ...playerRaw.worldStateSummary.clocks,
      { id: 'secret', label: 'Geheim', value: 1, max: 3, visibility: 'gm_only' },
    ],
  },
};
const leakVm = overviewMod.parseSagaOverview(leakRaw);
let threw = false;
try {
  overviewMod.assertSagaOverviewAudienceSafe(leakVm);
} catch {
  threw = true;
}
if (!threw) fail('assertSagaOverviewAudienceSafe must reject gm_only for players');

const gmRaw = {
  ...playerRaw,
  selfRole: 'gamemaster',
  isGm: true,
  worldStateSummary: {
    clocks: [
      { id: 'secret', label: 'Geheim', value: 1, max: 3, visibility: 'gm_only' },
      { id: 'threat', label: 'Bedrohung', value: 2, max: 4, visibility: 'shared' },
    ],
    consequences: [
      { id: 'c2', kind: 'secret', summary: 'GM only', visibility: 'gm_only', createdAt: null },
    ],
    flagCount: 2,
    updatedAt: '2026-01-01T00:00:00Z',
  },
};
const gmVm = overviewMod.parseSagaOverview(gmRaw);
overviewMod.assertSagaOverviewAudienceSafe(gmVm);
if (!overviewMod.sagaOverviewHasGmOnlyWorldFields(gmVm)) {
  fail('GM fixture must include gm_only world fields');
}

const withSession = overviewMod.parseSagaOverview({
  ...gmRaw,
  episodes: [
    {
      sessionId: 's1',
      sessionPublicId: 'SE-AAAAA',
      sessionNumber: 1,
      name: 'Abend 1',
      status: 'active',
      startedAt: null,
      endedAt: null,
      recapSnippet: null,
    },
  ],
});
const action = primaryMod.resolveSagaPrimaryAction(withSession, 'gamemaster');
if (action.kind !== 'continue-session' || action.sessionPublicId !== 'SE-AAAAA') {
  fail(`expected continue-session, got ${JSON.stringify(action)}`);
}

const hostAction = primaryMod.resolveSagaPrimaryAction(
  overviewMod.parseSagaOverview({ ...gmRaw, episodes: [] }),
  'gamemaster',
);
if (hostAction.kind !== 'host-session') {
  fail(`expected host-session, got ${hostAction.kind}`);
}

// Escape-hatch scan on touched TS files
const touched = [
  'src/domains/project/contracts/saga-overview.ts',
  'src/domains/project/use-cases/saga-primary-action.ts',
  'src/infrastructure/project/saga-overview-service.ts',
  'src/app/project/hooks/useSagaOverview.ts',
];
for (const file of touched) {
  const text = read(file);
  if (/\bas any\b|\bas unknown as\b|@ts-ignore|@ts-expect-error/.test(text)) {
    fail(`type escape hatch in ${file}`);
  }
}

console.log('Saga overview RPC check passed.');
