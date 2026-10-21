import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { CommandError, type AdapterHandle, type Actor, type ApplicationPort, type FaultHook, type MapUpdate } from './domain/contracts.js';
import { freshFixture, inspectFixture, transferFixtureWorldToX } from './fixture.js';
import { applicationCommands } from './application/commands.js';
import { domainImportEvidence, filesBelow, rejectAppImports } from './boundary.js';
import { zenstackEngineProbes, drizzleRawCapabilityProbe } from './engine-probes.js';

const local = path.dirname(fileURLToPath(import.meta.url));
const repo = process.env.GATE01_REPO_ROOT ?? path.resolve(local, '../../..');
const sourceRoot = process.env.GATE01_SOURCE_ROOT ?? local;
const evidence = process.env.GATE01_EVIDENCE_DIR ?? path.join(repo, '.qa/evidence/stack-migration-prep/pocs/gate-01');
fs.mkdirSync(evidence, { recursive: true });
const startedAt = new Date().toISOString();
type Variant = 'drizzle' | 'zenstack';
type Result = { id: string; description: string; status: 'PASS' | 'FAIL'; durationMs: number; observation?: unknown; error?: unknown };
type FixtureContext = { file: string; app: ApplicationPort; reopen(fault?: FaultHook): Promise<void> };

function errorObservation(error: unknown) {
  return {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    code: error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined,
    reason: error !== null && typeof error === 'object' && 'reason' in error ? error.reason : undefined,
  };
}

async function mustDeny(action: () => PromiseLike<unknown>) {
  try {
    const value = await action();
    assert.ok(value === null || (Array.isArray(value) && value.length === 0), 'Expected no authorized response data');
    return { mode: 'filtered', value };
  } catch (error) {
    const observed = errorObservation(error);
    if (observed.code !== 'DENIED' && !['not-found', 'rejected-by-policy'].includes(String(observed.reason))) throw error;
    return { mode: 'rejected', ...observed };
  }
}

async function mustFailCode(action: () => PromiseLike<unknown>, code: string) {
  try { await action(); } catch (error) {
    assert.equal(errorObservation(error).code, code);
    return errorObservation(error);
  }
  throw new Error('Expected ' + code);
}

const actor = (userId: string): Actor => Object.freeze({ userId });
const context = (userId: string, sagaId = 'A') => ({ actor: actor(userId), sagaId });
const request = (changes: Partial<MapUpdate> = {}): MapUpdate => ({
  mapId: 'public', title: 'OWNER_EDIT', expectedRevision: 0, idempotencyKey: 'request-1', ...changes,
});

function stats(values: number[]) {
  assert.ok(values.length > 0 && values.every(Number.isFinite));
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.ceil(p * sorted.length) - 1];
  return { n: sorted.length, min: sorted[0], median: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1), samples: values };
}

async function runVariant(variant: Variant) {
  const module: { createAdapter(file: string, fault?: FaultHook): AdapterHandle } = variant === 'drizzle'
    ? await import('./drizzle/adapter.js') : await import('./zenstack/adapter.js');
  const results: Result[] = [];
  async function test(id: string, description: string, execute: (fixture: FixtureContext) => Promise<unknown>, fault?: FaultHook) {
    const file = path.join(local, 'work', variant, id + '.sqlite');
    freshFixture(file);
    let handle = module.createAdapter(file, fault);
    const fixture: FixtureContext = {
      file, app: applicationCommands(handle.app),
      async reopen(newFault) {
        await handle.close();
        handle = module.createAdapter(file, newFault);
        fixture.app = applicationCommands(handle.app);
      },
    };
    const started = performance.now();
    try {
      results.push({ id, description, status: 'PASS', observation: await execute(fixture), durationMs: performance.now() - started });
    } catch (error) {
      results.push({ id, description, status: 'FAIL', error: errorObservation(error), durationMs: performance.now() - started });
    } finally { await handle.close(); }
  }

  await test('P1_PROJECTION', 'P1 sees public + own A reveal; hidden titles/bodies/layers and GM-only notes absent', async ({ app }) => {
    const rows = await app.listMaps(context('P1'));
    assert.deepEqual(rows.map((row) => row.id), ['p1', 'public']);
    assert.ok(rows.every((row) => row.gmNotes === null));
    assert.doesNotMatch(JSON.stringify(rows), /UNREVEALED_|OTHER_SAGA_|FOREIGN_|GM_NOTES_/);
    return rows;
  });
  await test('P2_PROJECTION', 'P2 does not inherit P1 reveal in saga A', async ({ app }) => {
    const rows = await app.listMaps(context('P2'));
    assert.deepEqual(rows.map((row) => row.id), ['public']);
    assert.doesNotMatch(JSON.stringify(rows), /P1_REVEAL_|UNREVEALED_|OTHER_SAGA_|FOREIGN_|GM_NOTES_/);
    return rows;
  });
  await test('P2_SAGA_B', 'P2 reveal in B authorizes B only; membership and reveal are checked in the same saga', async ({ app }) => {
    const rows = await app.listMaps(context('P2', 'B'));
    assert.deepEqual(rows.map((row) => row.id), ['public', 'wrong-saga']);
    assert.ok(rows.every((row) => row.gmNotes === null));
    return rows;
  });
  await test('P1_WRONG_SAGA_REVEAL', 'P1 has a B reveal but no B membership: reject saga B', async ({ app }) =>
    mustDeny(() => app.listMaps(context('P1', 'B'))));
  await test('P1_CORRUPT_FOREIGN_REVEAL', 'An inconsistent A reveal for a W2 map does not cross the project world', async ({ app }) =>
    mustDeny(() => app.getMap('foreign', context('P1'))));
  for (const userId of ['G', 'O']) {
    await test(userId + '_FULL_VIEW', userId + ' can read W1 full view; O has no GM membership', async ({ app }) => {
      const rows = await app.listMaps(context(userId));
      assert.deepEqual(rows.map((row) => row.id), ['hidden', 'p1', 'perf', 'public', 'wrong-saga']);
      assert.equal(rows.find((row) => row.id === 'hidden')?.gmNotes, 'GM_NOTES_HIDDEN');
      return rows;
    });
  }
  await test('X_CROSS_OWNER_GET', 'X cannot get a W1 map through saga A', async ({ app }) => mustDeny(() => app.getMap('hidden', context('X'))));
  await test('X_OWN_SAGA_WRONG_WORLD', 'X valid own saga still cannot get a W1 map', async ({ app }) => mustDeny(() => app.getMap('hidden', context('X', 'X'))));
  await test('UNKNOWN_SAGA', 'An unknown saga fails closed', async ({ app }) => mustDeny(() => app.listMaps(context('P1', 'unknown'))));
  await test('MISSING_SAGA', 'An absent saga does not select an arbitrary project for a player', async ({ app }) => mustDeny(() => app.listMaps({ actor: actor('P1'), sagaId: undefined })));
  await test('INACTIVE_MEMBER', 'Inactive membership does not authorize reads', async ({ app }) => mustDeny(() => app.listMaps(context('INACTIVE'))));
  await test('MISSING_ACTOR_READ', 'Missing authenticated actor yields no map data', async ({ app }) => mustDeny(() => app.listMaps({ actor: undefined, sagaId: 'A' })));

  await test('OWNER_WRITE', 'World owner O edits without a GM assignment', async ({ app, file }) => {
    const result = await app.updateMapTitle(request(), actor('O'));
    assert.deepEqual(result, { id: 'public', title: 'OWNER_EDIT', revision: 1 });
    assert.equal(inspectFixture(file).receipts.length, 1);
    return result;
  });
  for (const userId of ['G', 'P1', 'P2', 'X', 'INACTIVE']) {
    await test(userId + '_MAP_WRITE_DENIED', userId + ' cannot edit O-owned maps', async ({ app, file }) => {
      const before = inspectFixture(file);
      const result = await mustDeny(() => app.updateMapTitle(request(), actor(userId)));
      assert.deepEqual(inspectFixture(file), before);
      return result;
    });
  }
  await test('MISSING_ACTOR_WRITE', 'Unauthenticated writes fail before any map or receipt mutation', async ({ app, file }) => {
    const before = inspectFixture(file);
    const result = await mustDeny(() => app.updateMapTitle(request(), undefined));
    assert.deepEqual(inspectFixture(file), before);
    return result;
  });
  await test('FORGED_OWNER_FIELDS', 'Client owner_user_id/world_id cannot move ownership or attach the map to W2', async ({ app, file }) => {
    const result = await app.updateMapTitle(request({ owner_user_id: 'X', world_id: 'W2' }), actor('O'));
    const state = inspectFixture(file);
    assert.deepEqual(state.worlds, [{ id: 'W1', owner_user_id: 'O' }, { id: 'W2', owner_user_id: 'X' }]);
    assert.ok(state.maps.some((row) => typeof row === 'object' && row !== null && 'id' in row && row.id === 'public' && 'world_id' in row && row.world_id === 'W1'));
    return { result, worlds: state.worlds };
  });
  await test('FORGED_OWNER_NO_ESCALATION', 'X cannot gain a world write by submitting owner O in the payload', async ({ app, file }) => {
    const before = inspectFixture(file);
    const result = await mustDeny(() => app.updateMapTitle(request({ owner_user_id: 'O' }), actor('X')));
    assert.deepEqual(inspectFixture(file), before);
    return result;
  });
  await test('STALE_REVISION', 'Stale expectedRevision conflicts without changes to title, revision or receipt ledger', async ({ app, file }) => {
    await app.updateMapTitle(request(), actor('O'));
    const before = inspectFixture(file);
    const failure = await mustFailCode(() => app.updateMapTitle(request({ title: 'STALE', idempotencyKey: 'stale' }), actor('O')), 'CONFLICT');
    assert.deepEqual(inspectFixture(file), before);
    return failure;
  });
  await test('NEGATIVE_REVISION', 'Negative expectedRevision has no legacy revision-bypass semantics in the successor PoC', async ({ app, file }) => {
    const before = inspectFixture(file);
    const failure = await mustFailCode(() => app.updateMapTitle(request({ expectedRevision: -1 }), actor('O')), 'INVALID_INPUT');
    assert.deepEqual(inspectFixture(file), before);
    return failure;
  });
  await test('TRANSACTION_ROLLBACK', 'Failure after map update rolls back title/revision and prevents receipt insertion', async ({ app, file }) => {
    const before = inspectFixture(file);
    const failure = await mustFailCode(() => app.updateMapTitle(request(), actor('O')), 'INJECTED_FAILURE');
    assert.deepEqual(inspectFixture(file), before);
    return failure;
  }, () => { throw new CommandError('INJECTED_FAILURE'); });
  await test('IDEMPOTENT_REPLAY', 'Same actor/map/key/payload replays one committed mutation and one receipt', async ({ app, file }) => {
    const first = await app.updateMapTitle(request(), actor('O'));
    const before = inspectFixture(file);
    const replay = await app.updateMapTitle(request(), actor('O'));
    assert.deepEqual(replay, first);
    assert.deepEqual(inspectFixture(file), before);
    assert.equal(before.receipts.length, 1);
    return { first, replay, receiptCount: before.receipts.length };
  });
  await test('IDEMPOTENCY_PAYLOAD_MISMATCH', 'Reusing a key with a different request fails without a second mutation', async ({ app, file }) => {
    await app.updateMapTitle(request(), actor('O'));
    const before = inspectFixture(file);
    const failure = await mustFailCode(() => app.updateMapTitle(request({ title: 'DIFFERENT' }), actor('O')), 'IDEMPOTENCY_MISMATCH');
    assert.deepEqual(inspectFixture(file), before);
    return failure;
  });
  await test('REPLAY_AFTER_OWNER_REVOKED', 'A stored receipt does not preserve authorization after world ownership changes', async ({ app, file }) => {
    await app.updateMapTitle(request(), actor('O'));
    transferFixtureWorldToX(file);
    const before = inspectFixture(file);
    const denial = await mustDeny(() => app.updateMapTitle(request(), actor('O')));
    assert.deepEqual(inspectFixture(file), before);
    return denial;
  });
  await test('REOPEN_AND_REPLAY', 'Closing and reopening the real database preserves revision and idempotent replay', async (fixture) => {
    const first = await fixture.app.updateMapTitle(request(), actor('O'));
    const before = inspectFixture(fixture.file);
    await fixture.reopen();
    const replay = await fixture.app.updateMapTitle(request(), actor('O'));
    assert.deepEqual(replay, first);
    assert.deepEqual(inspectFixture(fixture.file), before);
    return { first, replay };
  });
  await test('COMPETING_REVISIONS', 'Two queued writes from revision 0 yield exactly one commit and one conflict', async ({ app, file }) => {
    const attempts = await Promise.allSettled([
      app.updateMapTitle(request({ title: 'FIRST', idempotencyKey: 'first' }), actor('O')),
      app.updateMapTitle(request({ title: 'SECOND', idempotencyKey: 'second' }), actor('O')),
    ]);
    assert.equal(attempts.filter((entry) => entry.status === 'fulfilled').length, 1);
    const rejection = attempts.find((entry) => entry.status === 'rejected');
    assert.ok(rejection && rejection.status === 'rejected');
    assert.equal(errorObservation(rejection.reason).code, 'CONFLICT');
    assert.equal(inspectFixture(file).receipts.length, 1);
    return attempts.map((entry) => entry.status === 'fulfilled' ? entry : { status: entry.status, reason: errorObservation(entry.reason) });
  });
  await test('QUEUED_DUPLICATE_KEY', 'Two queued identical requests return the same result and create one receipt', async ({ app, file }) => {
    const results = await Promise.all([app.updateMapTitle(request(), actor('O')), app.updateMapTitle(request(), actor('O'))]);
    assert.deepEqual(results[0], results[1]);
    assert.equal(inspectFixture(file).receipts.length, 1);
    return results;
  });

  await test('GM_SESSION_STATUS', 'G changes their project session status without world ownership', async ({ app }) => {
    const result = await app.setSessionStatus('S-A', 'active', context('G'));
    assert.deepEqual(result, { id: 'S-A', projectId: 'A', status: 'active', revision: 1 });
    return result;
  });
  for (const userId of ['O', 'P1', 'P2', 'X', 'INACTIVE']) {
    await test(userId + '_SESSION_STATUS_DENIED', userId + ' cannot exercise G-only session authority', async ({ app, file }) => {
      const before = inspectFixture(file);
      const result = await mustDeny(() => app.setSessionStatus('S-A', 'active', context(userId)));
      assert.deepEqual(inspectFixture(file), before);
      return result;
    });
  }
  await test('GM_FOREIGN_SESSION', 'G cannot mutate the session in X project', async ({ app, file }) => {
    const before = inspectFixture(file);
    const result = await mustDeny(() => app.setSessionStatus('S-X', 'active', context('G')));
    assert.deepEqual(inspectFixture(file), before);
    return result;
  });
  await test('MISSING_ACTOR_SESSION', 'Unauthenticated session status changes fail without mutation', async ({ app, file }) => {
    const before = inspectFixture(file);
    const result = await mustDeny(() => app.setSessionStatus('S-A', 'active', { actor: undefined, sagaId: 'A' }));
    assert.deepEqual(inspectFixture(file), before);
    return result;
  });
  await test('GM_UNKNOWN_SAGA_SESSION', 'An unknown saga does not grant the GM a session operation in a different context', async ({ app, file }) => {
    const before = inspectFixture(file);
    const result = await mustDeny(() => app.setSessionStatus('S-A', 'active', context('G', 'unknown')));
    assert.deepEqual(inspectFixture(file), before);
    return result;
  });
  await test('APPLICATION_CAPABILITIES', 'App receives no SQL/query-builder/driver/policy-client capability', async ({ app }) => {
    const capabilities = Object.keys(app).sort();
    assert.deepEqual(capabilities, ['getMap', 'listMaps', 'setSessionStatus', 'updateMapTitle']);
    for (const key of ['$queryRaw', '$executeRaw', '$qb', 'run', 'all', 'db', 'sqlite']) assert.equal(Reflect.get(app, key), undefined);
    assert.ok(Object.isFrozen(app));
    return capabilities;
  });

  let writes: ReturnType<typeof stats> | undefined;
  await test('SEQUENTIAL_100_WRITES', '100 sequential owner transactions preserve every increment and receipt', async ({ app, file }) => {
    const durations: number[] = [];
    let last;
    for (let revision = 0; revision < 100; revision++) {
      const start = performance.now();
      last = await app.updateMapTitle(request({ mapId: 'perf', title: 'PERF_' + revision, expectedRevision: revision, idempotencyKey: 'perf-' + revision }), actor('O'));
      durations.push(performance.now() - start);
      assert.equal(last.revision, revision + 1);
    }
    assert.equal(last?.title, 'PERF_99');
    assert.equal(inspectFixture(file).receipts.length, 100);
    writes = stats(durations);
    return { final: last, receiptCount: 100, latencyMs: writes };
  });

  const coldFile = path.join(local, 'work', variant, 'cold.sqlite');
  freshFixture(coldFile);
  const coldStarts: Array<{ processWallMs: number; observation: unknown }> = [];
  for (let sample = 0; sample < 10; sample++) {
    const start = performance.now();
    const child = spawnSync(process.execPath, ['--import', 'tsx', path.join(local, 'cold-start.ts'), variant, coldFile], {
      cwd: local, encoding: 'utf8', timeout: 20000,
    });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr);
    assert.ok(child.stdout.trim(), 'Cold-process measurement must produce an actual observation');
    const parsed: unknown = JSON.parse(child.stdout);
    coldStarts.push({ processWallMs: performance.now() - start, observation: parsed });
  }
  return { variant, passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length, results, writes,
    coldStarts: { processWallMs: stats(coldStarts.map((x) => x.processWallMs)), observations: coldStarts } };
}

const domain = domainImportEvidence(repo, local);
assert.deepEqual(domain.forbidden, []);
const applicationFiles = filesBelow(path.join(local, 'application')).filter((file) => file.endsWith('.ts'));
const appImportFailures = applicationFiles.flatMap((file) => rejectAppImports(file, fs.readFileSync(file, 'utf8')));
assert.deepEqual(appImportFailures, []);
const attempts = [
  "import { drizzle } from 'drizzle-orm/better-sqlite3';",
  "import { ZenStackClient } from '@zenstackhq/orm';",
  "import SQLite from 'better-sqlite3';",
  "import { openPolicyClient } from '../zenstack/engine.js';",
  "const db = await import('../drizzle/adapter.js');",
  'const db = await import(request.module);',
];
const importAttackResults = attempts.map((source) => ({ source, rejected: rejectAppImports('application/attack.ts', source) }));
assert.ok(importAttackResults.every((r) => r.rejected.length > 0));
const variants = [];
for (const variant of ['drizzle', 'zenstack'] satisfies Variant[]) {
  process.stdout.write('Running real SQLite candidate: ' + variant + '\n');
  variants.push(await runVariant(variant));
}
const directEngine = await zenstackEngineProbes(path.join(local, 'work/zenstack-engine.sqlite'));
const rawCapability = drizzleRawCapabilityProbe(path.join(local, 'work/drizzle-raw.sqlite'));

const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = filesBelow(local, new Set(['node_modules', 'work'])).filter((file) => !file.endsWith('/.gitignore'));
const sourceFiles = files.map((file) => {
  const sourceFile = path.join(sourceRoot, path.relative(local, file));
  const sha256 = sha(file);
  assert.equal(sha(sourceFile), sha256, 'Executed isolated copy must match the canonical source: ' + sourceFile);
  return { path: path.relative(repo, sourceFile), sha256 };
});
const upstreamFiles = ['supabase/migrations/015_inventory_item_definitions.sql', 'supabase/migrations/040_session_join_code_security.sql',
  'supabase/migrations/094_world_atlas.sql', 'supabase/migrations/104_atlas_worldbuilder_mutations.sql',
  'supabase/migrations/105_atlas_worldbuilder_player_projection.sql', '.qa/design/gates/GATE-01-drizzle-vs-zenstack.md'];
for (const relative of upstreamFiles) sourceFiles.push({ path: relative, sha256: sha(path.join(repo, relative)) });
const loc = (relative: string) => {
  const text = fs.readFileSync(path.join(local, relative), 'utf8');
  return { file: relative, physicalLines: text.trimEnd().split('\n').length,
    nonBlankNonCommentLines: text.split('\n').filter((line) => line.trim() && !/^\s*(\/\/|\/\*|\*|\*\/)/.test(line)).length };
};
const locFiles = ['drizzle/schema.ts', 'drizzle/policy-service.ts', 'drizzle/adapter.ts', 'zenstack/schema.zmodel',
  'zenstack/engine.ts', 'zenstack/adapter.ts', 'zenstack/schema.ts', 'zenstack/models.ts', 'zenstack/input.ts',
  'domain/contracts.ts', 'application/commands.ts', 'boundary.ts'];
const lock: unknown = JSON.parse(fs.readFileSync(path.join(local, 'package-lock.json'), 'utf8'));
const nodeMetadata = { node: process.version, nodeAbi: process.versions.modules, platform: process.platform, architecture: process.arch, release: os.release(),
  cpuModel: os.cpus()[0]?.model, availableParallelism: os.availableParallelism() };
const packageVersion = (name: string) => {
  const manifest: { version: string; license?: string } = JSON.parse(fs.readFileSync(path.join(local, 'node_modules', name, 'package.json'), 'utf8'));
  return { name, version: manifest.version, license: manifest.license };
};
const totalFailures = variants.reduce((n, v) => n + v.failed, 0);
const observations = { startedAt, completedAt: new Date().toISOString(), variants, directZenstackEngine: directEngine,
  drizzleRawCapability: rawCapability, domainBoundary: domain, applicationImportBoundary: { checkedFiles: applicationFiles.length, attackAttempts: importAttackResults },
  runtime: nodeMetadata };
fs.writeFileSync(path.join(evidence, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');
const report = {
  schemaVersion: 1, gate: 'GATE-01', status: totalFailures ? 'EXECUTED_WITH_FAILURES' : 'EXECUTED_SCOPE_PASS',
  architectureApproval: 'NOT_APPROVED', implementationUnblocked: false,
  observedAt: observations.completedAt,
  method: 'Two independent real ORM implementations over identically seeded file-backed SQLite; generated ZenStack PolicyPlugin engine; shared black-box port tests; direct engine and raw-capability probes.',
  sourceFiles, evidenceFiles: [{ path: path.relative(repo, path.join(evidence, 'observations.json')), sha256: sha(path.join(evidence, 'observations.json')) }],
  dependencies: ['@zenstackhq/cli', '@zenstackhq/orm', '@zenstackhq/plugin-policy', 'drizzle-orm', 'better-sqlite3', 'typescript', 'tsx'].map(packageVersion),
  lockfile: { sha256: sha(path.join(local, 'package-lock.json')), lockfilePresent: typeof lock === 'object' },
  nativeDriverSha256: sha(path.join(local, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node')),
  runtime: nodeMetadata,
  candidateResults: variants.map((v) => ({ candidate: v.variant, passed: v.passed, failed: v.failed,
    warmWriteLatencyMs: v.writes, coldProcessWallMs: v.coldStarts.processWallMs })),
  codeSize: { method: 'Physical and nonblank/noncomment LOC; generated TypeScript separated; no bundle-size or human-authoring-time claim', files: locFiles.map(loc),
    authoredDrizzleLoc: ['drizzle/schema.ts','drizzle/policy-service.ts','drizzle/adapter.ts'].reduce((sum, p) => sum + loc(p).nonBlankNonCommentLines, 0),
    authoredZenstackLoc: ['zenstack/schema.zmodel','zenstack/engine.ts','zenstack/adapter.ts'].reduce((sum, p) => sum + loc(p).nonBlankNonCommentLines, 0),
    generatedZenstackLoc: ['zenstack/schema.ts','zenstack/models.ts','zenstack/input.ts'].reduce((sum, p) => sum + loc(p).nonBlankNonCommentLines, 0) },
  gateRows: [
    { row: 1, scope: 'P1/P2 list/get projection, exact saga/player reveal and null GM notes', tests: ['P1_PROJECTION','P2_PROJECTION','P2_SAGA_B','P1_WRONG_SAGA_REVEAL','P1_CORRUPT_FOREIGN_REVEAL'] },
    { row: 2, scope: 'X cannot read W1 through A or own X saga', tests: ['X_CROSS_OWNER_GET','X_OWN_SAGA_WRONG_WORLD'] },
    { row: 3, scope: 'O owner without GM can edit; G/P1/P2/X cannot', tests: ['OWNER_WRITE','G_MAP_WRITE_DENIED','P1_MAP_WRITE_DENIED','P2_MAP_WRITE_DENIED','X_MAP_WRITE_DENIED'] },
    { row: 4, scope: 'Stale CAS revision fails atomically', tests: ['STALE_REVISION','COMPETING_REVISIONS'] },
    { row: 5, scope: 'AST checked product src/domains and PoC domain contain zero ORM imports', observation: domain },
    { row: 6, scope: '10 cold processes and 100 sequential transactional writes; no latency threshold prescribed', tests: ['SEQUENTIAL_100_WRITES'] },
    { row: 7, scope: 'PoC app facade and executable import allowlist prevent raw client exposure; ZenStack additionally rejects actual raw queries. Raw Drizzle capability remains unsafe if boundary is bypassed.', tests: ['APPLICATION_CAPABILITIES'], residual: 'Product CI wiring of this proposed app boundary has NOT RUN; neither candidate is an OS sandbox.' },
    { row: 8, scope: 'GM status authority remains distinct from world ownership', tests: ['GM_SESSION_STATUS','O_SESSION_STATUS_DENIED','P1_SESSION_STATUS_DENIED','P2_SESSION_STATUS_DENIED','X_SESSION_STATUS_DENIED','GM_FOREIGN_SESSION'] },
    { row: 9, scope: 'No actor, unknown saga, inactive/wrong-project memberships fail closed', tests: ['MISSING_ACTOR_READ','MISSING_ACTOR_WRITE','MISSING_ACTOR_SESSION','UNKNOWN_SAGA','GM_UNKNOWN_SAGA_SESSION','INACTIVE_MEMBER','P1_WRONG_SAGA_REVEAL'] },
  ],
  secureTargetChoices: [
    'Reveal requires the same saga, active membership, player and project world; the observed cross-Saga legacy defect is deliberately rejected.',
    'A missing saga does not select an arbitrary project; the product null-Saga UI path requires a separate migration contract.',
    'Negative/null expectedRevision bypass is not implemented; nonnegative integer revision is mandatory.',
    'Idempotency is actor+map+key scoped, rejects changed payload, records response atomically, and rechecks current authorization on replay.',
    'Forged ownership/foreign-key payload fields are discarded; only title and server incremented revision can change.',
  ],
  notRun: [
    'Human architecture approval, ADR-ST-05 or migration unblocking',
    'Port/migration of 50+ product tables, PostgreSQL functions/triggers/RLS, real product payloads and all nested Atlas GeoJSON redactions',
    'Production auth/JWT/HTTP integration or exposure of SQLite storage; actors are trusted synthetic harness inputs',
    'Windows/macOS/ARM/mobile/desktop packaging; libSQL and Electron/Tauri adapters',
    'Concurrent OS-process writers, crash/power-loss durability, database restore and schema upgrade',
    'Full session lifecycle transition parity, unbounded query workloads, production bundle size',
    'Controlled human time-to-add-resource measurement, subjective complexity score or total migration effort estimate',
    'Production application import-boundary CI integration and exhaustive capability-bypass security review',
  ],
  findings: [
    { severity: 'High', id: 'G01-RAW-DRIZZLE', status: 'boundary-required', detail: 'Actual unguarded Drizzle raw SQL reads all six rows and changes a foreign map inside the rolled-back probe. The application must receive only the guarded port and enforce imports; Drizzle itself has no policy engine.' },
    { severity: 'Medium', id: 'G01-ZEN-FIELD-PREVIEW', status: 'decision-required', detail: 'ZenStack field policies are documented as preview. Real nullable-field redaction and immutable worldId update rejection pass for 3.9.8; upgrade compatibility is not inferred.' },
    { severity: 'Medium', id: 'G01-MIGRATION-SCOPE', status: 'NOT_RUN', detail: 'Seven-table schema and command receipt ledger do not establish the port of 50+ tables or the PostgreSQL RPC/trigger semantics.' },
    { severity: 'Low', id: 'G01-MEASUREMENT-SCOPE', status: 'limited-sample', detail: 'Ten cold processes and 100 sequential writes on this Linux runner are reproducible smoke measurements, not production capacity or cross-platform rankings.' },
    { severity: 'Info', id: 'G01-FIXTURE-AUTH', status: 'NOT_RUN', detail: 'This gate tests authorization using explicitly trusted synthetic actors. Real JWT verification belongs to the separate auth gate.' },
    { severity: 'Info', id: 'G01-DEPENDENCY-INSTALL', status: 'observed', detail: 'npm installed the pinned package set successfully; installation warned about transitive prebuild-install and cuid deprecations. No generated CUID is used in this fixture.' },
  ],
};
fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify({ gate: report.gate, status: report.status, candidates: variants.map((v) => ({ name: v.variant, pass: v.passed, fail: v.failed })), evidence: path.relative(repo, evidence) }, null, 2) + '\n');
process.exitCode = totalFailures ? 1 : 0;
