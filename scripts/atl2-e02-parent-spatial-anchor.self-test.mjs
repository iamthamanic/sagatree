#!/usr/bin/env node
/**
 * ATL2-E02 — ParentSpatialAnchor locate + invertible transforms (#1220).
 * Location: scripts/atl2-e02-parent-spatial-anchor.self-test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-e02.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-e02-parent-spatial-anchor.md'), 'utf8');
const gateSrc = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const frameSrc = readFileSync(join(root, 'src/domains/world/atlas/map-frame.ts'), 'utf8');
const barrel = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const editorSrc = readFileSync(join(root, 'src/app/world/atlas/useWorldAtlasEditor.ts'), 'utf8');

assert.ok(acceptance.includes('atl2-e02'));
assert.ok(acceptance.includes('#1220'));
assert.ok(design.includes('ParentSpatialAnchor'));
assert.ok(gateSrc.includes('atl2-e02-parent-spatial-anchor.self-test.mjs'));
assert.ok(frameSrc.includes('mapPointChildToParent'));
assert.ok(frameSrc.includes('mapPointParentToChild'));
assert.ok(barrel.includes('mapPointChildToParent'));
assert.ok(editorSrc.includes('locateChildOnParent'));
assert.ok(!/\bas any\b/.test(frameSrc), 'map-frame typed-strict');

const frame = jiti(join(root, 'src/domains/world/atlas/map-frame.ts'));

/* --- Domain: locate + negatives --- */
const zeroExtent = frame.parentAnchorFromParentRect({
  parentMapId: 'p',
  minX: 10,
  minY: 10,
  maxX: 10,
  maxY: 20,
});
assert.equal(zeroExtent.ok, false);

const negMeters = frame.parseParentSpatialAnchor({
  parentMapId: 'p',
  centerX: 1,
  centerY: 2,
  extentX: 3,
  extentY: 4,
  rotationRad: 0,
  metersPerUnit: -2,
});
assert.ok(negMeters);
assert.equal(negMeters.metersPerUnit, null);
assert.equal(frame.normalizeMetersPerUnit(-1), null);
assert.equal(frame.normalizeMetersPerUnit(0), null);
assert.equal(frame.normalizeMetersPerUnit(2.5), 2.5);

const tiny = frame.locateChildMapFrame({
  parentMapId: 'parent-a',
  minX: 100,
  minY: 100,
  maxX: 100.002,
  maxY: 100.004,
  rotationRad: Math.PI / 6,
  metersPerUnit: 1.5,
});
assert.equal(tiny.ok, true);
assert.ok(tiny.anchor.extentX > 0 && tiny.anchor.extentY > 0);
assert.equal(tiny.anchor.metersPerUnit, 1.5);
assert.ok(Math.abs(tiny.anchor.rotationRad - Math.PI / 6) < 1e-12);

const rotated = frame.locateChildMapFrame({
  parentMapId: 'parent-a',
  minX: 200,
  minY: 300,
  maxX: 280,
  maxY: 420,
  rotationRad: Math.PI / 4,
});
assert.equal(rotated.ok, true);
assert.equal(frame.canLodEnterChildMap(rotated.frame), true);

const sample = { x: 250, y: 400 };
const inv = frame.assertInvertibleParentChildMap(rotated.anchor, sample);
assert.equal(inv.ok, true, inv.ok ? '' : inv.reason);
const parentPt = frame.mapPointChildToParent(sample, rotated.anchor);
const back = frame.mapPointParentToChild(parentPt, rotated.anchor);
assert.ok(Math.abs(back.x - sample.x) < 1e-9);
assert.ok(Math.abs(back.y - sample.y) < 1e-9);

/* Overlapping sibling rects are both valid (no exclusive footprint). */
const siblingA = frame.locateChildMapFrame({
  parentMapId: 'parent-a',
  minX: 0,
  minY: 0,
  maxX: 100,
  maxY: 100,
});
const siblingB = frame.locateChildMapFrame({
  parentMapId: 'parent-a',
  minX: 50,
  minY: 50,
  maxX: 150,
  maxY: 150,
});
assert.equal(siblingA.ok, true);
assert.equal(siblingB.ok, true);

const unlocated = frame.extractMapFrameFromGeneratorMeta({ mapStatus: 'unlocated' });
assert.equal(frame.canLodEnterChildMap(unlocated), false);
assert.equal(
  frame.canWebglDrillSelect({ worldRoot: false, located: false, mapId: 'child' }),
  false,
);
assert.equal(
  frame.canWebglDrillSelect({ worldRoot: false, located: true, mapId: 'child' }),
  true,
);
assert.equal(frame.atlasZoomCaption(80, null), '80%');
assert.ok(frame.atlasZoomCaption(80, 2).includes('kalibriert'));

function actor(id) {
  return {
    kind: 'remote-account',
    actorId: id,
    sessionId: `auth-${id}`,
    email: null,
    linkedSoloActorIds: [],
  };
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const permissionsUrl = pathToFileURL(join(root, 'server/src/modules/permissions/index.ts')).href;
const projectUrl = pathToFileURL(join(root, 'server/src/modules/project/index.ts')).href;
const worldUrl = pathToFileURL(join(root, 'server/src/modules/world/index.ts')).href;
const worldReadUrl = pathToFileURL(
  join(root, 'server/src/repositories/world/sqlite-world-read-store.ts'),
).href;
const createCmd = pathToFileURL(
  join(root, 'server/src/application/commands/create_world_node_with_maps.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { create_world_node_with_maps } = await import(createCmd);

const hostEvidence = {
  locatedReloadOk: false,
  unlocatedDeniedLod: false,
  strangerDenied: false,
};

const sollIst = [
  { category: 'Domain locate + invert', soll: 'rect→anchor; round-trip w/ rotation', ist: 'pass-domain' },
  { category: 'Calibration honesty', soll: 'neg/zero mpu → null; caption abstract', ist: 'pass-domain' },
  { category: 'Unlocated LOD gate', soll: 'no scale-true drill', ist: 'pass-domain' },
  { category: 'Host save/reload', soll: 'locate persists on getMap', ist: 'pending' },
  { category: 'Security', soll: 'stranger upsert denied', ist: 'pending' },
];

const work = mkdtempSync(join(tmpdir(), 'atl2-e02-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert.equal(boot.ok, true, `bootstrap ${boot.ok ? '' : boot.error}`);
  assert.ok(boot.schemaVersion >= 22);
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
    isActiveProjectMember: (projectId, actorIds) =>
      project.isActiveMember(projectId, actorIds) || project.isProjectGm(projectId, actorIds),
  });

  const createNode = create_world_node_with_maps(world);
  const OWNER = actor('owner-e02');
  const STRANGER = actor('stranger-e02');
  const worldId = 'world-e02';
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(worldId, OWNER.actorId, 'E02 World', now);

  const place = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'place',
    name: 'Dornhain',
    subtype: 'city',
    idempotencyKey: `e02-place-${randomUUID()}`,
  });
  assert.equal(place.ok, true, `create place: ${place.ok ? '' : place.error}`);
  const placeNode = place.value.created.find((c) => c.kind === 'place');
  const countryNode = place.value.created.find((c) => c.kind === 'country');
  assert.ok(placeNode && countryNode);

  const childBefore = world.getWorldAtlasMap(OWNER, placeNode.mapId);
  assert.equal(childBefore.ok, true);
  const beforeFrame = frame.extractMapFrameFromGeneratorMeta(childBefore.value.generatorMeta);
  assert.equal(frame.canLodEnterChildMap(beforeFrame), false);
  hostEvidence.unlocatedDeniedLod = true;

  const located = frame.locateChildMapFrame({
    parentMapId: countryNode.mapId,
    minX: 120,
    minY: 180,
    maxX: 220,
    maxY: 320,
    rotationRad: 0.35,
    metersPerUnit: null,
  });
  assert.equal(located.ok, true);
  const generatorMeta = frame.mergeMapFrameIntoGeneratorMeta(
    childBefore.value.generatorMeta,
    located.frame,
  );

  const upsert = world.upsertWorldAtlasMap(OWNER, {
    worldProfileId: worldId,
    mapId: placeNode.mapId,
    parentMapId: childBefore.value.parentMapId,
    kind: childBefore.value.kind,
    title: childBefore.value.title,
    sortOrder: childBefore.value.sortOrder,
    bounds: childBefore.value.bounds,
    layers: childBefore.value.layers,
    basemapStoragePath: childBefore.value.basemapStoragePath ?? null,
    azgaarMapStoragePath: childBefore.value.azgaarMapStoragePath ?? null,
    generatorMeta,
    expectedRevision: childBefore.value.revision,
  });
  assert.equal(upsert.ok, true, `upsert locate: ${upsert.ok ? '' : upsert.error}`);

  const reloaded = world.getWorldAtlasMap(OWNER, placeNode.mapId);
  assert.equal(reloaded.ok, true);
  const afterFrame = frame.extractMapFrameFromGeneratorMeta(reloaded.value.generatorMeta);
  assert.equal(afterFrame.status, 'unsketched');
  assert.ok(afterFrame.parentAnchor);
  assert.equal(afterFrame.parentAnchor.parentMapId, countryNode.mapId);
  assert.equal(afterFrame.parentAnchor.centerX, located.anchor.centerX);
  assert.equal(afterFrame.parentAnchor.centerY, located.anchor.centerY);
  assert.equal(afterFrame.parentAnchor.extentX, located.anchor.extentX);
  assert.equal(afterFrame.parentAnchor.extentY, located.anchor.extentY);
  assert.ok(Math.abs(afterFrame.parentAnchor.rotationRad - 0.35) < 1e-12);
  assert.equal(frame.canLodEnterChildMap(afterFrame), true);
  const hostInv = frame.assertInvertibleParentChildMap(afterFrame.parentAnchor, {
    x: 500,
    y: 500,
  });
  assert.equal(hostInv.ok, true, hostInv.ok ? '' : hostInv.reason);
  hostEvidence.locatedReloadOk = true;
  sollIst[3].ist = 'pass-host';

  const stranger = world.upsertWorldAtlasMap(STRANGER, {
    worldProfileId: worldId,
    mapId: placeNode.mapId,
    parentMapId: childBefore.value.parentMapId,
    kind: childBefore.value.kind,
    title: 'Hacked',
    sortOrder: childBefore.value.sortOrder,
    bounds: childBefore.value.bounds,
    layers: childBefore.value.layers,
    basemapStoragePath: null,
    azgaarMapStoragePath: null,
    generatorMeta,
    expectedRevision: reloaded.value.revision,
  });
  assert.equal(stranger.ok, false, 'stranger must fail');
  hostEvidence.strangerDenied = true;
  sollIst[4].ist = 'pass-host';
} finally {
  rmSync(work, { recursive: true, force: true });
}

const evidence = {
  gate: 'atl2-e02',
  issue: 1220,
  head,
  host: hostEvidence,
  sollIst,
  verdict: 'CLEAR',
  residuals: [
    {
      severity: 'Low',
      note: 'Locate drag UX already wired (locateChildOnParent); E03 owns breadcrumb/zoom camera.',
    },
  ],
};

const sollRows = sollIst
  .map((r) => `| ${r.category} | ${r.soll} | **${r.ist}** |`)
  .join('\n');

const report = `# ATL2-E02 — ParentSpatialAnchor & locate persistence

- Issue: #1220
- HEAD: \`${head}\`
- Verdict: **${evidence.verdict}**
- Date: ${new Date().toISOString().slice(0, 10)}

## Soll / Ist

| Category | Soll | Ist |
|----------|------|-----|
${sollRows}

## Host evidence

- Locate save/reload: **${hostEvidence.locatedReloadOk ? 'yes' : 'no'}**
- Unlocated LOD denied: **${hostEvidence.unlocatedDeniedLod ? 'yes' : 'no'}**
- Stranger denied: **${hostEvidence.strangerDenied ? 'yes' : 'no'}**

## Residuals

- **Low**: E03 owns breadcrumb / camera fly-to across levels.

## Decision

ATL2-E02 ParentSpatialAnchor locate is **${evidence.verdict}**. E03 may open.
`;

const writeEvidence = process.env.ATL2_E02_WRITE_EVIDENCE === '1';
const outDir = writeEvidence
  ? join(root, '.qa/runs')
  : mkdtempSync(join(tmpdir(), 'atl2-e02-out-'));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'atl2-e02-parent-spatial-anchor.md'), report);
writeFileSync(
  join(outDir, 'atl2-e02-parent-spatial-anchor.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
);

const committedPath = join(root, '.qa/runs/atl2-e02-parent-spatial-anchor.md');
let committed;
try {
  committed = readFileSync(committedPath, 'utf8');
} catch {
  committed = null;
}
if (committed) {
  assert.match(committed, /Verdict: \*\*CLEAR\*\*/);
} else {
  assert.equal(writeEvidence, true, 'seed with ATL2_E02_WRITE_EVIDENCE=1');
}

console.log(`atl2-e02-parent-spatial-anchor self-test: PASS (${evidence.verdict})`);
console.log(
  `report: ${join(outDir, 'atl2-e02-parent-spatial-anchor.md')}${writeEvidence ? '' : ' (transient)'}`,
);
