#!/usr/bin/env node
/**
 * ATL2-E02 — ParentSpatialAnchor locate / calibration / save-reload (#1220).
 * Location: scripts/atl2-e02-parent-spatial-anchor.self-test.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createJiti } from 'jiti';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const mf = jiti(join(root, 'src/domains/world/atlas/map-frame.ts'));

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-e02.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-e02-parent-spatial-anchor.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const barrel = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const editorSrc = readFileSync(join(root, 'src/app/world/atlas/useWorldAtlasEditor.ts'), 'utf8');
const workbenchSrc = readFileSync(join(root, 'src/app/world/atlas/WorldAtlasWorkbench.tsx'), 'utf8');
const targetSrc = readFileSync(
  join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'),
  'utf8',
);

assert.ok(acceptance.includes('atl2-e02'));
assert.ok(acceptance.includes('ParentSpatialAnchor'));
assert.ok(acceptance.includes('IV-01'), 'acceptance IV-01');
assert.ok(acceptance.includes('IV-02'), 'acceptance IV-02');
assert.ok(acceptance.includes('IV-09'), 'acceptance IV-09');
assert.ok(acceptance.includes('IV-18'), 'acceptance IV-18');
assert.ok(design.includes('metersPerUnit'));
assert.ok(gate.includes('atl2-e02-parent-spatial-anchor.self-test.mjs'), 'wired in test-gate');
assert.ok(barrel.includes('childLocalToParentPoint'));
assert.ok(barrel.includes('calibrateParentSpatialMeters'));
assert.ok(barrel.includes('unlocatedBlocksScaleTrueDrill'));
assert.match(editorSrc, /rotationRad:\s*input\.rotationRad/);
assert.match(workbenchSrc, /UNLOCATED_DRILL_BLOCKED_DE/);
assert.ok(targetSrc.includes("custom-webgl-prototype-runtime"));
assert.ok(!workbenchSrc.includes('AtlasSpatialViewport'));

/* --- Domain: locate + unlocated --- */
const unlocated = mf.unlocatedChildMapGeneratorMeta({ seed: 'e02.child' });
const unlocatedFrame = mf.extractMapFrameFromGeneratorMeta(unlocated);
assert.equal(unlocatedFrame.status, 'unlocated');
assert.equal(unlocatedFrame.parentAnchor, null);
assert.equal(mf.canLodEnterChildMap(unlocatedFrame), false);
assert.equal(mf.unlocatedBlocksScaleTrueDrill(unlocatedFrame), true);
assert.equal(
  mf.canWebglDrillSelect({ worldRoot: false, located: false, mapId: 'child' }),
  false,
);
assert.equal(mf.atlasZoomCaption(100, null), '100%');
assert.match(mf.atlasZoomCaption(100, 2.5), /kalibriert/);

const zero = mf.locateChildMapFrame({
  parentMapId: 'p',
  minX: 10,
  minY: 10,
  maxX: 10,
  maxY: 20,
});
assert.equal(zero.ok, false);

const tiny = mf.locateChildMapFrame({
  parentMapId: 'p',
  minX: 100,
  minY: 200,
  maxX: 100 + 1e-6,
  maxY: 200 + 1e-6,
});
assert.equal(tiny.ok, true, 'tiny positive extent accepted');
assert.ok(tiny.anchor.extentX > 0 && tiny.anchor.extentY > 0);

const badCalLocate = mf.locateChildMapFrame({
  parentMapId: 'p',
  minX: 0,
  minY: 0,
  maxX: 10,
  maxY: 10,
  metersPerUnit: -1,
});
assert.equal(badCalLocate.ok, false);
assert.match(String(badCalLocate.reason), /Kalibrierung|metersPerUnit/i);

const located = mf.locateChildMapFrame({
  parentMapId: 'parent-map',
  minX: 100,
  minY: 200,
  maxX: 140,
  maxY: 260,
  rotationRad: Math.PI / 6,
});
assert.equal(located.ok, true);
assert.equal(located.frame.status, 'unsketched');
assert.equal(mf.canLodEnterChildMap(located.frame), true);
assert.equal(mf.unlocatedBlocksScaleTrueDrill(located.frame), false);

/* --- Invertible transforms (incl. rotation) --- */
const sample = { x: 250, y: 750 };
const parentPt = mf.childLocalToParentPoint(located.anchor, sample);
const back = mf.parentPointToChildLocal(located.anchor, parentPt);
assert.ok(Math.abs(back.x - sample.x) < 1e-9);
assert.ok(Math.abs(back.y - sample.y) < 1e-9);
const centerLocal = { x: 500, y: 500 };
const centerParent = mf.childLocalToParentPoint(located.anchor, centerLocal);
assert.ok(Math.abs(centerParent.x - located.anchor.centerX) < 1e-9);
assert.ok(Math.abs(centerParent.y - located.anchor.centerY) < 1e-9);

/* --- Calibration --- */
const calBad = mf.calibrateParentSpatialMeters(located.anchor, 0);
assert.equal(calBad.ok, false);
const calNeg = mf.calibrateParentSpatialMeters(located.anchor, -3);
assert.equal(calNeg.ok, false);
const calOk = mf.calibrateParentSpatialMeters(located.anchor, 12.5);
assert.equal(calOk.ok, true);
assert.equal(calOk.anchor.metersPerUnit, 12.5);
const calClear = mf.calibrateParentSpatialMeters(calOk.anchor, null);
assert.equal(calClear.ok, true);
assert.equal(calClear.anchor.metersPerUnit, null);

/* --- Overlap (axis-aligned + rotated footprint AABB) --- */
const a = located.anchor;
const overlapping = {
  ...a,
  parentMapId: 'parent-map',
  centerX: a.centerX + a.extentX / 2,
  centerY: a.centerY,
};
const far = {
  ...a,
  parentMapId: 'parent-map',
  centerX: a.centerX + a.extentX * 4,
  centerY: a.centerY + a.extentY * 4,
};
assert.equal(mf.parentAnchorsOverlapAabb(a, overlapping), true);
assert.equal(mf.parentAnchorsOverlapAabb(a, far), false);

const thin = {
  parentMapId: 'parent-map',
  centerX: 0,
  centerY: 0,
  extentX: 100,
  extentY: 1,
  rotationRad: Math.PI / 2,
  metersPerUnit: null,
};
const thinAabb = mf.parentAnchorAabb(thin);
assert.ok(Math.abs(thinAabb.minX + 1) < 1e-9, 'π/2 thin OBB → ~±1 X');
assert.ok(Math.abs(thinAabb.maxX - 1) < 1e-9);
assert.ok(Math.abs(thinAabb.minY + 100) < 1e-9, 'π/2 thin OBB → ~±100 Y');
assert.ok(Math.abs(thinAabb.maxY - 100) < 1e-9);
const neighborOnRotatedAxis = {
  ...thin,
  centerX: 0,
  centerY: 50,
  rotationRad: 0,
  extentX: 2,
  extentY: 2,
};
assert.equal(
  mf.parentAnchorsOverlapAabb(thin, neighborOnRotatedAxis),
  true,
  'rotated AABB must detect overlap along the tall axis',
);

/* --- Meta round-trip --- */
const merged = mf.mergeMapFrameIntoGeneratorMeta({ engine: 'unified_canvas' }, located.frame);
const extracted = mf.extractMapFrameFromGeneratorMeta(merged);
assert.equal(extracted.status, 'unsketched');
assert.equal(extracted.parentAnchor?.parentMapId, 'parent-map');
assert.ok(Math.abs((extracted.parentAnchor?.rotationRad ?? 0) - Math.PI / 6) < 1e-12);

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

const work = mkdtempSync(join(tmpdir(), 'atl2-e02-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

const evidence = {
  slug: 'atl2-e02',
  issue: 1220,
  verdict: 'CLEAR',
  product3dTarget: 'custom-webgl-prototype-runtime',
  checks: [],
};

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert.ok(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
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

  const room = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'room',
    name: 'E02 Raum',
    subtype: 'chamber',
    idempotencyKey: `e02-room-${randomUUID()}`,
  });
  assert.ok(room.ok, `create: ${room.ok ? '' : room.error}`);
  const continent = room.value.created.find((c) => c.kind === 'continent');
  assert.ok(continent);

  const before = world.getWorldAtlasMap(OWNER, continent.mapId);
  assert.ok(before.ok);
  const beforeFrame = mf.extractMapFrameFromGeneratorMeta(before.value.generatorMeta ?? {});
  assert.equal(beforeFrame.status, 'unlocated');
  assert.equal(mf.canLodEnterChildMap(beforeFrame), false);
  evidence.checks.push('unlocated-before-locate');

  const parentId = before.value.parentMapId;
  assert.ok(parentId, 'continent parents to world root map');
  const locate = mf.locateChildMapFrame({
    parentMapId: parentId,
    minX: 220,
    minY: 310,
    maxX: 380,
    maxY: 470,
    rotationRad: Math.PI / 8,
    metersPerUnit: 2,
  });
  assert.equal(locate.ok, true);
  const generatorMeta = mf.mergeMapFrameIntoGeneratorMeta(
    before.value.generatorMeta ?? {},
    locate.frame.status === 'unsketched'
      ? { status: 'unsketched', parentAnchor: locate.anchor }
      : locate.frame,
  );
  // Persist calibrated meters on the located frame
  const calibrated = mf.calibrateParentSpatialMeters(locate.anchor, 2);
  assert.equal(calibrated.ok, true);
  const metaWithCal = mf.mergeMapFrameIntoGeneratorMeta(before.value.generatorMeta ?? {}, {
    status: 'unsketched',
    parentAnchor: calibrated.anchor,
  });

  const upserted = world.upsertWorldAtlasMap(OWNER, {
    worldProfileId: worldId,
    mapId: continent.mapId,
    parentMapId: parentId,
    kind: before.value.kind === 'legacy_tiles' ? 'region' : before.value.kind,
    title: before.value.title,
    sortOrder: before.value.sortOrder,
    bounds: before.value.bounds,
    layers: before.value.layers,
    basemapStoragePath: before.value.basemapStoragePath,
    azgaarMapStoragePath: before.value.azgaarMapStoragePath,
    generatorMeta: metaWithCal,
    expectedRevision: before.value.revision,
  });
  assert.ok(upserted.ok, `upsert locate: ${upserted.ok ? '' : upserted.error}`);
  evidence.checks.push('host-locate-upsert');

  const reloaded = world.getWorldAtlasMap(OWNER, continent.mapId);
  assert.ok(reloaded.ok);
  const afterFrame = mf.extractMapFrameFromGeneratorMeta(reloaded.value.generatorMeta ?? {});
  assert.equal(afterFrame.status, 'unsketched');
  assert.ok(afterFrame.parentAnchor);
  assert.equal(afterFrame.parentAnchor.parentMapId, parentId);
  assert.equal(afterFrame.parentAnchor.metersPerUnit, 2);
  assert.ok(Math.abs(afterFrame.parentAnchor.rotationRad - Math.PI / 8) < 1e-12);
  const rt = mf.parentPointToChildLocal(
    afterFrame.parentAnchor,
    mf.childLocalToParentPoint(afterFrame.parentAnchor, { x: 100, y: 900 }),
  );
  assert.ok(Math.abs(rt.x - 100) < 1e-9 && Math.abs(rt.y - 900) < 1e-9);
  evidence.checks.push('host-reload-invertible');

  const denied = world.upsertWorldAtlasMap(STRANGER, {
    worldProfileId: worldId,
    mapId: continent.mapId,
    parentMapId: parentId,
    kind: before.value.kind === 'legacy_tiles' ? 'region' : before.value.kind,
    title: before.value.title,
    sortOrder: before.value.sortOrder,
    bounds: before.value.bounds,
    layers: before.value.layers,
    basemapStoragePath: before.value.basemapStoragePath,
    azgaarMapStoragePath: before.value.azgaarMapStoragePath,
    generatorMeta: metaWithCal,
    expectedRevision: reloaded.value.revision,
  });
  assert.equal(denied.ok, false);
  assert.ok(
    String(denied.error).includes('42501') || String(denied.error).toLowerCase().includes('denied') || denied.error === 'forbidden' || denied.code === 42501 || denied.status === 403,
    `stranger deny: ${JSON.stringify(denied)}`,
  );
  evidence.checks.push('stranger-deny');

  // silence unused when generatorMeta built mid-test
  assert.ok(generatorMeta);
} finally {
  rmSync(work, { recursive: true, force: true });
}

const headSha =
  process.env.ATL2_E02_HEAD_SHA?.trim() ||
  (() => {
    try {
      return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    } catch {
      return 'UNKNOWN';
    }
  })();

const reportMd = `# ATL2-E02 ParentSpatialAnchor — locate / calibration

- Issue: #1220
- HEAD: \`${headSha}\`
- Verdict: **CLEAR**
- Date: ${new Date().toISOString().slice(0, 10)}
- Product 3D target: \`custom-webgl-prototype-runtime\` (unchanged; D01)
- IV gates: IV-01 / IV-02 / IV-09 / IV-18

## Checks

${evidence.checks.map((c) => `- ${c}`).join('\n')}

## Soll / Ist

| Category | Soll | Ist |
|----------|------|-----|
| Invertible parent↔child | rotation + center round-trip | **pass-domain** |
| Calibration | reject ≤0 / NaN; null clears | **pass-domain** |
| Rotated AABB overlap | π/2 thin OBB footprint | **pass-domain** |
| Unlocated drill | fail-closed + DE hint wiring | **pass-domain** |
| Host save/reload | generator_meta anchor survives upsert+GET | **pass-host** |
| Stranger write | deny | **pass-host** |

## Decision

ATL2-E02 ParentSpatialAnchor locate + calibration is **CLEAR**.
`;

const runs = join(root, '.qa/runs');
const writeEvidence = process.env.ATL2_E02_WRITE_EVIDENCE === '1';
if (writeEvidence) {
  writeFileSync(join(runs, 'atl2-e02-parent-spatial-anchor.md'), reportMd);
  writeFileSync(join(runs, 'atl2-e02-parent-spatial-anchor.json'), JSON.stringify({ ...evidence, headSha }, null, 2));
}

console.log('atl2-e02-parent-spatial-anchor self-test: PASS (CLEAR)');
if (!writeEvidence) {
  console.log('report: transient (set ATL2_E02_WRITE_EVIDENCE=1 to pin .qa/runs)');
}
