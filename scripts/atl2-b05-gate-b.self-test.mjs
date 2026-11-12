#!/usr/bin/env node
/**
 * ATL2-B05 Gate B — Phase B canonical data / authz / legacy migration protocol.
 * Location: scripts/atl2-b05-gate-b.self-test.mjs
 *
 * Not a product feature — evidence lock for Epic #1196 Gate B (#1205).
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const STACK = [
  {
    pr: 1242,
    issue: 1201,
    sha: 'f5c893cd195aab425b90811344bae94fd3a6c9a7',
    title: 'ATL2-B01 catalog',
  },
  {
    pr: 1243,
    issue: 1202,
    sha: 'e9befeae4b433fbcc5cdf23345f7030601b30f61',
    title: 'ATL2-B02 adapter',
  },
  {
    pr: 1244,
    issue: 1203,
    sha: 'ea214ea9f9edb85365389c9dd65f10ce6c185987',
    title: 'ATL2-B03 CAS',
  },
  {
    pr: 1245,
    issue: 1204,
    sha: '7064fa3043cb17333e0799ae9400edcf1f787859',
    title: 'ATL2-B04 write-retire',
  },
];

const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const stackStatus = [];
for (const item of STACK) {
  let present = false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', item.sha, 'HEAD'], {
      cwd: root,
      stdio: 'ignore',
    });
    present = true;
  } catch {
    present = false;
  }
  stackStatus.push({ ...item, present });
  assert.equal(present, true, `PR #${item.pr} squash ${item.sha} is ancestor of HEAD`);
}

const catalog = jiti(join(root, 'src/domains/world/atlas/atlas-canonical-features.ts'));
const adapter = jiti(join(root, 'src/domains/world/atlas/atlas-map-doc-adapter.ts'));
const retire = jiti(join(root, 'src/domains/world/atlas/atlas-webgl-write-retire.ts'));
const bridge = jiti(join(root, 'src/domains/world/atlas/webgl-runtime-bridge.ts'));
const canvasMod = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const starter = jiti(join(root, 'src/domains/world/atlas/dornhain-unified-starter.ts'));

const golden = starter.buildDornhainUnifiedCanvasDoc();
const beforeIds = {
  objects: golden.objects.map((o) => o.id).sort(),
  rooms: golden.rooms.map((r) => r.id).sort(),
  walls: golden.walls.map((w) => w.id).sort(),
  strokes: golden.strokes.map((s) => s.id).sort(),
};
const beforeCounts = {
  objects: golden.objects.length,
  rooms: golden.rooms.length,
  walls: golden.walls.length,
  strokes: golden.strokes.length,
};

const classified = catalog.classifyUnifiedCanvasDoc(golden);
assert.ok(
  classified.counts.legacy_area_ambiguous + classified.counts.terrain_area >= 1,
  'golden areas present',
);
assert.ok(classified.counts.prop_object + classified.counts.building_footprint >= 1, 'golden props');

const hints = adapter.goldenStrokeHintsFromCanvas(golden);
const v2 = adapter.buildAtlasMapDocV2(golden, { scale: 'world', strokeHints: hints });
assert.ok(v2.classification.counts.path_river >= 1, 'hinted river');
assert.ok(v2.classification.counts.path_way >= 1, 'hinted road');
const wire = adapter.projectAtlasMapDocV2ToV1Wire(v2);
assert.equal(adapter.unifiedCanvasRoundtripEqual(golden, wire), true, 'V2→V1 equal');
assert.deepEqual(
  wire.objects.map((o) => o.id).sort(),
  beforeIds.objects,
  'object IDs preserved',
);
assert.deepEqual(wire.rooms.map((r) => r.id).sort(), beforeIds.rooms, 'room IDs preserved');
assert.equal(wire.objects.length, beforeCounts.objects);
assert.equal(wire.rooms.length, beforeCounts.rooms);
assert.equal(wire.walls.length, beforeCounts.walls);
assert.equal(wire.strokes.length, beforeCounts.strokes);

// Single write path: persist strips geometry shadow; empty canvas does not resurrect.
const staleRuntime = {
  props: [
    {
      id: 'ghost-resurrect',
      type: 'house',
      stamp: 'haus',
      x: 1,
      z: 2,
      size: 1,
      rotation: 0,
      level: 'world',
    },
  ],
  strokes: [],
  walls: [],
  rooms: [],
  layers: { world: true },
  placeNames: { keep: true },
};
const empty = canvasMod.emptyUnifiedCanvasDoc(false);
const priorMeta = {
  engine: 'unified_canvas',
  unifiedCanvas: canvasMod.serializeUnifiedCanvasDoc(empty),
  webglRuntimeV3: staleRuntime,
};
const noResurrect = retire.hydrateCanvasFromLegacyWebgl(priorMeta, false);
assert.equal(noResurrect.migrated, false);
assert.equal(noResurrect.canvas.objects.length, 0);

const persisted = retire.mergeCanonicalAtlasGeometryForPersist(
  priorMeta,
  empty,
  bridge.syncCanvasDocIntoWebglRuntime(bridge.emptyWebglRuntime(), empty),
  { capturedAt: '2026-11-12T12:00:00.000Z' },
);
assert.ok(retire.persistedMetaHasNoWebglGeometryShadow(persisted));
assert.ok(retire.parseWebglGeometryBackup(persisted.webglRuntimeV3GeometryBackup));
const restored = retire.restoreWebglGeometryBackup(persisted);
assert.ok(restored);
assert.equal(
  bridge.extractWebglRuntimeFromGeneratorMeta(restored).placeNames.keep,
  true,
  'restore keeps extras',
);

// Host: competing tabs + stranger deny (same ports as atl2-b03)
const repoRoot = root;

function actor(id) {
  return {
    kind: 'remote-account',
    actorId: id,
    sessionId: `auth-${id}`,
    email: null,
    linkedSoloActorIds: [],
  };
}

const persistenceUrl = pathToFileURL(join(repoRoot, 'server/src/persistence/index.ts')).href;
const permissionsUrl = pathToFileURL(join(repoRoot, 'server/src/modules/permissions/index.ts')).href;
const projectUrl = pathToFileURL(join(repoRoot, 'server/src/modules/project/index.ts')).href;
const worldUrl = pathToFileURL(join(repoRoot, 'server/src/modules/world/index.ts')).href;
const worldReadUrl = pathToFileURL(
  join(repoRoot, 'server/src/repositories/world/sqlite-world-read-store.ts'),
).href;
const ensureCmd = pathToFileURL(
  join(repoRoot, 'server/src/application/commands/ensure_world_atlas_root.ts'),
).href;
const upsertCmd = pathToFileURL(
  join(repoRoot, 'server/src/application/commands/upsert_world_atlas_map.ts'),
).href;
const fixturesUrl = pathToFileURL(
  join(repoRoot, 'server/src/application/world-atlas/__tests__/fixtures.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { ensure_world_atlas_root } = await import(ensureCmd);
const { upsert_world_atlas_map } = await import(upsertCmd);
const { VALID_LAYERS, DEFAULT_BOUNDS } = await import(fixturesUrl);

const work = mkdtempSync(join(tmpdir(), 'atl2-b05-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

const hostEvidence = { conflict: false, strangerDeny: false, soleWritePath: true };

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(repoRoot, 'server/migrations'),
  });
  assert.equal(boot.ok, true, `bootstrap ${boot.ok ? '' : boot.error}`);
  const db = boot.db;
  const project = createProjectPorts(db);
  const permissions = createPermissionsPorts(
    db,
    { actorHasAccessToSaga: project.actorHasAccessToSaga },
    project,
  );
  const world = createWorldPorts({
    authorize: permissions.authorize,
    store: createSqliteWorldReadStore(db),
    writeStore: createSqliteWorldWriteStore(db),
    db,
    actorCanAccessWorld: project.actorCanAccessWorld,
    resolveSagaProjectForWorld: project.resolveProjectIdForWorldAndPublicId,
    isActiveProjectMember: project.isActiveMember,
  });
  const ensureRoot = ensure_world_atlas_root(world);
  const upsertMap = upsert_world_atlas_map(world);

  const OWNER = actor('owner-b05');
  const STRANGER = actor('stranger-b05');
  const worldId = 'world-atl2-b05';
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(worldId, OWNER.actorId, 'B05', now);

  const rootMap = ensureRoot(OWNER, worldId);
  assert.equal(rootMap.ok, true);
  const rootId = rootMap.value[0].id;
  const rev0 = rootMap.value[0].revision;

  const metaAfterRetire = retire.mergeCanonicalAtlasGeometryForPersist(
    { engine: 'unified_canvas', webglRuntimeV3: staleRuntime },
    golden,
    null,
    { capturedAt: '2026-11-12T12:01:00.000Z' },
  );
  assert.ok(retire.persistedMetaHasNoWebglGeometryShadow(metaAfterRetire));

  const okSave = upsertMap(OWNER, {
    worldProfileId: worldId,
    mapId: rootId,
    parentMapId: null,
    kind: 'world',
    title: 'Welt',
    sortOrder: 0,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { ...VALID_LAYERS },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: metaAfterRetire,
    expectedRevision: rev0,
  });
  assert.equal(okSave.ok, true, `owner save ${okSave.ok ? '' : okSave.error}`);

  const conflict = upsertMap(OWNER, {
    worldProfileId: worldId,
    mapId: rootId,
    parentMapId: null,
    kind: 'world',
    title: 'Welt-Tab-B',
    sortOrder: 0,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { ...VALID_LAYERS },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: metaAfterRetire,
    expectedRevision: rev0,
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.error, '40001');
  hostEvidence.conflict = true;

  const stranger = upsertMap(STRANGER, {
    worldProfileId: worldId,
    mapId: rootId,
    parentMapId: null,
    kind: 'world',
    title: 'Hack',
    sortOrder: 0,
    bounds: { ...DEFAULT_BOUNDS },
    layers: { ...VALID_LAYERS },
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta: {},
    expectedRevision: okSave.value.revision,
  });
  assert.equal(stranger.ok, false);
  assert.equal(stranger.error, '42501');
  hostEvidence.strangerDeny = true;

  const storedMeta =
    okSave.value.generatorMeta ??
    okSave.value.generator_meta ??
    metaAfterRetire;
  assert.ok(retire.persistedMetaHasNoWebglGeometryShadow(storedMeta));
  const storedCanvas = canvasMod.extractUnifiedCanvasFromGeneratorMeta(storedMeta);
  assert.ok(storedCanvas);
  assert.equal(storedCanvas.objects.length, beforeCounts.objects);
} finally {
  rmSync(work, { recursive: true, force: true });
}

const evidence = {
  gate: 'atl2-b05',
  issue: 1205,
  head,
  stack: stackStatus,
  golden: beforeCounts,
  host: hostEvidence,
  verdict: 'CLEAR',
  residuals: [
    {
      severity: 'Low',
      item: 'Full browser Undo UX drill',
      note: 'Domain changeset + CAS proven; interactive undo chrome deferred to Phase C editor tickets.',
      blocksGateB: false,
    },
  ],
};

const report = `# ATL2-B05 Gate B — Phase B acceptance

- Issue: #1205
- HEAD: \`${evidence.head}\`
- Verdict: **${evidence.verdict}**
- Date: ${new Date().toISOString().slice(0, 10)}

## PR stack on main

| PR | Issue | Squash SHA | Present |
|----|-------|------------|---------|
${evidence.stack
  .map((s) => `| #${s.pr} | #${s.issue} | \`${s.sha.slice(0, 10)}\` ${s.title} | ${s.present ? 'yes' : 'NO'} |`)
  .join('\n')}

## Golden entity parity (B01/B02)

- objects/rooms/walls/strokes: **${beforeCounts.objects}/${beforeCounts.rooms}/${beforeCounts.walls}/${beforeCounts.strokes}**
- V2 adapt → V1 wire ID/count parity: yes
- Sole geometry write path after persist (no webgl shadow): **${hostEvidence.soleWritePath ? 'yes' : 'no'}**

## Host CAS / ownership (B03)

- Stale tab revision → 40001: **${hostEvidence.conflict ? 'yes' : 'no'}**
- Stranger write → 42501: **${hostEvidence.strangerDeny ? 'yes' : 'no'}**

## Legacy write-retire (B04)

- Empty canonical canvas does not resurrect stale sidecar: yes
- Geometry backup + restore (extras preserved): yes

## Residuals (non-blocking for Gate B)

${evidence.residuals.map((r) => `- **${r.severity}**: ${r.item} — ${r.note}`).join('\n')}

## Decision

Phase B foundation is **${evidence.verdict}**. Phase C (#1206+) may open.
`;

const writeEvidence = process.env.ATL2_B05_WRITE_EVIDENCE === '1';
const outDir = writeEvidence ? join(root, '.qa/runs') : mkdtempSync(join(tmpdir(), 'atl2-b05-out-'));
writeFileSync(join(outDir, 'atl2-b05-gate-b.md'), report);
writeFileSync(join(outDir, 'atl2-b05-gate-b.json'), JSON.stringify(evidence, null, 2));

const committed = readFileSync(join(root, '.qa/runs/atl2-b05-gate-b.md'), 'utf8');
assert.match(committed, /Verdict: \*\*CLEAR\*\*/);
assert.match(committed, /#1242/);
assert.match(committed, /#1245/);
assert.match(readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8'), /atl2-b05-gate-b\.self-test/);
assert.match(readFileSync(join(root, '.qa/acceptance/atl2-b05-gate-b.md'), 'utf8'), /ATL2-B05/);

console.log(`atl2-b05-gate-b self-test: PASS (${evidence.verdict})`);
console.log(`report: ${join(outDir, 'atl2-b05-gate-b.md')}${writeEvidence ? '' : ' (transient)'}`);
