#!/usr/bin/env node
/**
 * saga-routing-public-id-foundation-check — contract for #276.
 * Location: scripts/saga-routing-public-id-foundation-check.mjs
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);

function mustInclude(file, needles, label) {
  const text = readFileSync(join(root, file), 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${label}: missing ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

function mustNotInclude(file, needles, label) {
  const text = readFileSync(join(root, file), 'utf8');
  for (const needle of needles) {
    if (text.includes(needle)) {
      throw new Error(`${label}: forbidden ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

mustInclude(
  'src/domains/resource-id/public-resource-id.ts',
  ['PUBLIC_RESOURCE_PREFIXES', 'parsePublicResourceId', 'SA', 'SE', 'CH', 'NPCC', 'IT', 'WO', 'LK'],
  'public id contract',
);
mustInclude(
  'src/domains/resource-id/session-routing.ts',
  ['resolveNeutralSessionPhase', 'resolveLiveEntryPath', 'authorizeLivePlayerCharacter'],
  'session routing rules',
);
mustInclude(
  'src/domains/resource-id/screen-vs-modal.ts',
  ['decideScreenOrModal'],
  'screen vs modal',
);
mustInclude(
  'archive/supabase-legacy/supabase/migrations/039_public_resource_ids_and_session_numbers.sql',
  [
    'generate_sagadrive_public_id',
    'allocate_next_session_number',
    'create_project_session',
    'sessions_project_session_number_uidx',
    'public_id',
  ],
  'migration',
);
mustInclude(
  'archive/supabase-legacy/supabase/migrations/083_world_profiles_public_id.sql',
  ['world_profiles', 'WO', 'generate_sagatree_public_id', 'ensure_public_id'],
  'world public id migration',
);
mustInclude(
  'archive/supabase-legacy/supabase/migrations/084_look_profiles_public_id.sql',
  ['look_profiles', 'LK', 'generate_sagatree_public_id', 'ensure_public_id'],
  'look public id migration',
);
mustInclude(
  'docs/navigation-public-ids.md',
  ['WO-', 'LK-', 'world_profiles', 'look_profiles'],
  'navigation public id docs',
);
mustInclude('src/App.tsx', ['SagaResourceScreen', 'SessionResourceScreen', 'useAppLocation'], 'App wiring');
mustInclude('AGENTS.md', ['Public IDs', 'Screen vs Modal', '/sagas/'], 'AGENTS navigation docs');
mustNotInclude('src/app/shell/routing/routes.ts', ['supabase', "from 'react'", 'from "react"'], 'pure routes');
mustNotInclude('src/domains/resource-id/public-resource-id.ts', ['supabase', "from 'react'", 'from "react"'], 'pure domain id');
mustNotInclude('src/domains/resource-id/session-routing.ts', ['supabase', "from 'react'", 'from "react"'], 'pure domain session');
mustNotInclude('src/domains/resource-id/screen-vs-modal.ts', ['supabase', "from 'react'", 'from "react"'], 'pure domain modal');

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/saga-routing-public-id-foundation-check');
mkdirSync(cacheDir, { recursive: true });

const domainOut = join(cacheDir, 'resource-id.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/resource-id/index.ts')],
  outfile: domainOut,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
});

const routesOut = join(cacheDir, 'routes.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/app/shell/routing/routes.ts')],
  outfile: routesOut,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
});

const domain = await import(pathToFileURL(domainOut).href);
const routes = await import(pathToFileURL(routesOut).href);

// --- Public ID contract ---
const valid = domain.parsePublicResourceId('SA-K7M4Q');
if (!valid || valid.kind !== 'saga') {
  throw new Error('parsePublicResourceId(SA-K7M4Q) failed');
}
if (domain.parsePublicResourceId('SA-OOOOO')) {
  throw new Error('ambiguous O must be rejected');
}
if (domain.parsePublicResourceId('SA-11111')) {
  throw new Error('digit-only / forbidden 1 must be rejected');
}
if (domain.parsePublicResourceId('XX-K7M4Q')) {
  throw new Error('unknown prefix must be rejected');
}
if (!domain.isValidPublicResourceId('SE-X4K73', 'session')) {
  throw new Error('SE-X4K73 should be valid session id');
}
if (!domain.isValidPublicResourceId('WO-K7M4Q', 'world')) {
  throw new Error('WO-K7M4Q should be valid world id');
}
if (!domain.isValidPublicResourceId('LK-K7M4Q', 'look')) {
  throw new Error('LK-K7M4Q should be valid look id');
}
if (domain.isValidPublicResourceId('SE-X4K73', 'saga')) {
  throw new Error('SE id must not validate as saga');
}

const generated = domain.generatePublicResourceId('character', () => 3);
if (!domain.isValidPublicResourceId(generated, 'character')) {
  throw new Error(`generated id invalid: ${generated}`);
}

if (domain.resolveNeutralSessionPhase('scheduled') !== 'prepare') {
  throw new Error('scheduled → prepare');
}
if (domain.resolveNeutralSessionPhase('active') !== 'live') {
  throw new Error('active → live');
}
if (domain.resolveNeutralSessionPhase('paused') !== 'live') {
  throw new Error('paused → live');
}
if (domain.resolveNeutralSessionPhase('completed') !== 'recap') {
  throw new Error('completed → recap');
}

const liveGm = domain.resolveLiveEntryPath({ role: 'gm', assignedCharacterPublicId: null });
if (liveGm.kind !== 'gamemaster') throw new Error('GM live entry → gamemaster');

const livePlayer = domain.resolveLiveEntryPath({
  role: 'player',
  assignedCharacterPublicId: 'CH-K7M4Q',
});
if (livePlayer.kind !== 'player' || livePlayer.characterPublicId !== 'CH-K7M4Q') {
  throw new Error('player live entry → canonical character');
}

const authOk = domain.authorizeLivePlayerCharacter({
  role: 'player',
  requestedCharacterPublicId: 'CH-K7M4Q',
  assignedCharacterPublicId: 'CH-K7M4Q',
});
if (!authOk.allowed) throw new Error('matching character must be allowed');

const authDeny = domain.authorizeLivePlayerCharacter({
  role: 'player',
  requestedCharacterPublicId: 'CH-AAAA2',
  assignedCharacterPublicId: 'CH-K7M4Q',
});
if (authDeny.allowed) throw new Error('foreign character must be denied');

const authUrlGm = domain.authorizeLivePlayerCharacter({
  role: 'none',
  requestedCharacterPublicId: 'CH-K7M4Q',
  assignedCharacterPublicId: null,
});
if (authUrlGm.allowed) throw new Error('no membership must be denied');

if (domain.decideScreenOrModal({
  needsReloadRestore: true,
  needsHistoryStep: false,
  needsShareableLink: false,
  hasOwnResourceIdentity: false,
  isStandaloneTask: false,
  isPrimaryNavTarget: false,
}) !== 'screen') {
  throw new Error('reload restore → screen');
}
if (domain.decideScreenOrModal({
  needsReloadRestore: false,
  needsHistoryStep: false,
  needsShareableLink: false,
  hasOwnResourceIdentity: false,
  isStandaloneTask: false,
  isPrimaryNavTarget: false,
}) !== 'modal') {
  throw new Error('ephemeral action → modal');
}

// --- Routes ---
function expectKind(path, kind) {
  const resolved = routes.resolvePathname(path);
  if (resolved.kind !== kind) {
    throw new Error(`resolvePathname(${path}) expected ${kind}, got ${resolved.kind}`);
  }
  return resolved;
}

expectKind('/', 'view');
expectKind('/sagas', 'saga-list');
expectKind('/sagas/new', 'saga-new');

const overview = expectKind('/sagas/SA-K7M4Q', 'saga-section');
if (overview.section !== 'overview' || overview.sagaPublicId !== 'SA-K7M4Q') {
  throw new Error('saga root must normalize to overview');
}

const chars = expectKind('/sagas/SA-K7M4Q/characters', 'saga-section');
if (chars.section !== 'characters') throw new Error('saga characters section');

const auto = expectKind('/sagas/SA-K7M4Q/sessions/SE-X4K73', 'session-phase');
if (auto.phase !== 'auto') throw new Error('neutral session → auto phase');

const prep = expectKind('/sagas/SA-K7M4Q/sessions/SE-X4K73/prepare', 'session-phase');
if (prep.phase !== 'prepare') throw new Error('prepare phase');

const liveGmRoute = expectKind(
  '/sagas/SA-K7M4Q/sessions/SE-X4K73/live/gamemaster',
  'session-live',
);
if (liveGmRoute.liveView !== 'gamemaster') throw new Error('live gamemaster');

const livePlayerResolve = expectKind(
  '/sagas/SA-K7M4Q/sessions/SE-X4K73/live/player',
  'session-live',
);
if (livePlayerResolve.liveView !== 'player-resolve') {
  throw new Error('live/player → player-resolve');
}

const livePlayerCanon = expectKind(
  '/sagas/SA-K7M4Q/sessions/SE-X4K73/live/player/CH-K7M4Q',
  'session-live',
);
if (livePlayerCanon.liveView !== 'player' || livePlayerCanon.characterPublicId !== 'CH-K7M4Q') {
  throw new Error('canonical player live route');
}

expectKind('/sagas/SA-K7M4Q/sessions/SE-X4K73/live/display', 'session-live');
expectKind('/characters/CH-K7M4Q', 'character-public');
expectKind('/characters/CH-K7M4Q/edit', 'character-public');

// Cross-prefix / invalid → not-found
expectKind('/sagas/SE-X4K73', 'not-found');
expectKind('/sagas/SA-OOOOO/overview', 'not-found');
expectKind('/sagas/SA-K7M4Q/sessions/SA-K7M4Q', 'not-found');

if (routes.pathForSagaSection('sa-k7m4q', 'overview') !== '/sagas/SA-K7M4Q/overview') {
  throw new Error('pathForSagaSection encoding');
}
if (
  routes.pathForSessionLive('SA-K7M4Q', 'SE-X4K73', 'player', 'CH-K7M4Q')
  !== '/sagas/SA-K7M4Q/sessions/SE-X4K73/live/player/CH-K7M4Q'
) {
  throw new Error('pathForSessionLive player mismatch');
}

// Compatibility legacy views still resolve
const gm = routes.resolvePathname('/gamemaster');
if (gm.kind !== 'view' || gm.view !== 'gamemaster') {
  throw new Error('/gamemaster compatibility must remain');
}

if (!existsSync(join(root, 'docs/navigation-public-ids.md'))) {
  throw new Error('missing docs/navigation-public-ids.md');
}

console.log('saga-routing-public-id-foundation-check: OK');
