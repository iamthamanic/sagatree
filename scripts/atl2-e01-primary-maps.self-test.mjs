#!/usr/bin/env node
/**
 * ATL2-E01 — Primary maps & WorldNode links for six hierarchy levels.
 * Location: scripts/atl2-e01-primary-maps.self-test.mjs
 *
 * Evidence lock for #1219 — reuses hierarchy domain + host create/rename ports.
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

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-e01.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-e01-primary-maps.md'), 'utf8');
const gateSrc = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
assert.ok(acceptance.includes('atl2-e01'));
assert.ok(acceptance.includes('#1219'));
assert.ok(design.includes('six-level'));
assert.ok(gateSrc.includes('atl2-e01-primary-maps.self-test.mjs'));

const hier = jiti(join(root, 'src/domains/world/hierarchy/index.ts'));
const types = jiti(join(root, 'src/domains/world/hierarchy/world-node.types.ts'));

assert.deepEqual([...types.WORLD_NODE_KINDS], [
  'continent',
  'country',
  'place',
  'building',
  'room',
]);

const roomPlan = hier.planWorldNodeCreate({ childKind: 'room', childName: 'Thronsaal' });
assert.equal(roomPlan.ok, true);
assert.equal(roomPlan.steps.length, 5);
assert.ok(roomPlan.steps.every((s) => s.needsPrimaryMap === true));
assert.deepEqual(
  roomPlan.steps.map((s) => s.kind),
  ['continent', 'country', 'place', 'building', 'room'],
);

assert.equal(hier.assertHierarchyEdge('country', 'continent').ok, true);
assert.equal(hier.assertHierarchyEdge('room', 'building').ok, true);
assert.equal(hier.assertHierarchyEdge('place', 'continent').ok, false); // skip
assert.equal(hier.assertHierarchyEdge('continent', 'continent').ok, false); // self
assert.equal(hier.isAllowedParent('building', 'place'), true);
assert.equal(hier.isAllowedParent('building', 'country'), false);

assert.equal(
  hier.wouldCreateReparentCycle({
    childId: 'a',
    newParentId: 'b',
    childDescendantIds: ['b', 'c'],
  }),
  true,
);
assert.equal(
  hier.wouldCreateReparentCycle({
    childId: 'a',
    newParentId: 'z',
    childDescendantIds: ['b', 'c'],
  }),
  false,
);

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
const renameCmd = pathToFileURL(
  join(root, 'server/src/application/commands/rename_world_node.ts'),
).href;
const reparentCmd = pathToFileURL(
  join(root, 'server/src/application/commands/reparent_world_node.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createProjectPorts } = await import(projectUrl);
const { createWorldPorts, createSqliteWorldWriteStore } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(worldReadUrl);
const { create_world_node_with_maps } = await import(createCmd);
const { rename_world_node } = await import(renameCmd);
const { reparent_world_node } = await import(reparentCmd);

const work = mkdtempSync(join(tmpdir(), 'atl2-e01-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

const hostEvidence = {
  chainKinds: [],
  primaryLinks: 0,
  placeCount: 0,
  rootMaps: 0,
  readPortsOk: false,
  immutableIds: false,
  cycleRejected: false,
  skipRejected: false,
  crossWorldRejected: false,
  strangerDenied: false,
};

const sollIst = [
  { category: 'Domain six-level plan', soll: 'room plan = 5 steps w/ primary', ist: 'pass-domain' },
  { category: 'Domain edge matrix', soll: 'legal edges ok; skip/self rejected', ist: 'pass-domain' },
  { category: 'Host create chain', soll: 'room → 5 places + 5 primaries + world root', ist: 'pending' },
  { category: 'Host read ports', soll: 'listPlaces/links/maps reload hierarchy', ist: 'pending' },
  { category: 'Immutable IDs', soll: 'rename keeps placeId + mapId', ist: 'pending' },
  { category: 'Negatives', soll: 'cycle/skip/cross-world/stranger fail-closed', ist: 'pending' },
];

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert.equal(boot.ok, true, `bootstrap ${boot.ok ? '' : boot.error}`);
  assert.ok(boot.schemaVersion >= 22, `schema>=22 got ${boot.schemaVersion}`);
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
  const renameNode = rename_world_node(world);
  const reparentNode = reparent_world_node(world);

  const OWNER = actor('owner-e01');
  const STRANGER = actor('stranger-e01');
  const worldId = 'world-e01';
  const otherWorld = 'world-e01-other';
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(worldId, OWNER.actorId, 'E01 World', now);
  db.prepare(
    `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
  ).run(otherWorld, OWNER.actorId, 'Other World', now);

  const roomKey = `e01-room-${randomUUID()}`;
  const room = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'room',
    name: 'Schankraum',
    idempotencyKey: roomKey,
  });
  assert.equal(room.ok, true, `create room: ${room.ok ? '' : room.error}`);
  assert.equal(room.value.created.length, 5);
  hostEvidence.chainKinds = room.value.created.map((c) => c.kind);
  assert.deepEqual(hostEvidence.chainKinds, [
    'continent',
    'country',
    'place',
    'building',
    'room',
  ]);
  assert.ok(room.value.created.every((c) => c.placeId && c.mapId));
  assert.ok(room.value.created.every((c) => c.mapId !== c.placeId));

  hostEvidence.placeCount = db
    .prepare(`SELECT COUNT(*) AS n FROM world_places WHERE world_profile_id = ?`)
    .get(worldId).n;
  assert.equal(hostEvidence.placeCount, 5);

  hostEvidence.primaryLinks = db
    .prepare(
      `SELECT COUNT(*) AS n FROM world_place_map_links WHERE world_profile_id = ? AND usage = 'primary'`,
    )
    .get(worldId).n;
  assert.equal(hostEvidence.primaryLinks, 5);

  hostEvidence.rootMaps = db
    .prepare(
      `SELECT COUNT(*) AS n FROM world_atlas_maps
       WHERE world_profile_id = ? AND kind = 'world' AND parent_map_id IS NULL`,
    )
    .get(worldId).n;
  assert.equal(hostEvidence.rootMaps, 1);
  sollIst[2].ist = 'pass-host';

  // Parent chain: each child points at previous (except continent → null / world)
  const places = db
    .prepare(
      `SELECT id, kind, parent_place_id FROM world_places WHERE world_profile_id = ? ORDER BY created_at`,
    )
    .all(worldId);
  const byKind = Object.fromEntries(places.map((p) => [p.kind, p]));
  assert.equal(byKind.continent.parent_place_id, null);
  assert.equal(byKind.country.parent_place_id, byKind.continent.id);
  assert.equal(byKind.place.parent_place_id, byKind.country.id);
  assert.equal(byKind.building.parent_place_id, byKind.place.id);
  assert.equal(byKind.room.parent_place_id, byKind.building.id);

  // Host read ports — acceptance requires list/reload, not SQL-only counts
  const listedPlaces = world.listWorldPlaces(OWNER, worldId, false, null);
  assert.equal(listedPlaces.ok, true, `listWorldPlaces: ${listedPlaces.ok ? '' : listedPlaces.error}`);
  assert.equal(listedPlaces.value.length, 5);
  const listedByKind = Object.fromEntries(listedPlaces.value.map((p) => [p.kind, p]));
  assert.equal(listedByKind.continent.parentPlaceId, null);
  assert.equal(listedByKind.country.parentPlaceId, listedByKind.continent.id);
  assert.equal(listedByKind.place.parentPlaceId, listedByKind.country.id);
  assert.equal(listedByKind.building.parentPlaceId, listedByKind.place.id);
  assert.equal(listedByKind.room.parentPlaceId, listedByKind.building.id);
  for (const created of room.value.created) {
    assert.ok(
      listedPlaces.value.some((p) => p.id === created.placeId && p.kind === created.kind),
      `place ${created.kind}/${created.placeId} missing from listWorldPlaces`,
    );
  }

  const listedLinks = world.listWorldPlaceMapLinks(OWNER, worldId, false, null);
  assert.equal(listedLinks.ok, true, `listWorldPlaceMapLinks: ${listedLinks.ok ? '' : listedLinks.error}`);
  const primaryFromPort = listedLinks.value.filter((l) => l.usage === 'primary');
  assert.equal(primaryFromPort.length, 5);
  for (const created of room.value.created) {
    const hit = primaryFromPort.find(
      (l) => l.placeId === created.placeId && l.mapId === created.mapId,
    );
    assert.ok(hit, `primary link ${created.placeId}→${created.mapId} missing from listWorldPlaceMapLinks`);
  }

  const listedMaps = world.listWorldAtlasMaps(OWNER, worldId, false, null);
  assert.equal(listedMaps.ok, true, `listWorldAtlasMaps: ${listedMaps.ok ? '' : listedMaps.error}`);
  assert.ok(listedMaps.value.length >= 6, `expected ≥6 maps (5 node + world root), got ${listedMaps.value.length}`);
  const worldRoots = listedMaps.value.filter(
    (m) => m.kind === 'world' && (m.parentMapId ?? null) == null,
  );
  assert.equal(worldRoots.length, 1);
  for (const created of room.value.created) {
    assert.ok(
      listedMaps.value.some((m) => m.id === created.mapId),
      `map ${created.mapId} missing from listWorldAtlasMaps`,
    );
  }
  hostEvidence.readPortsOk = true;
  sollIst[3].ist = 'pass-host';

  // Immutable IDs on rename
  const target = room.value.created[4];
  const renamed = renameNode(OWNER, {
    worldProfileId: worldId,
    placeId: target.placeId,
    name: 'Großer Schankraum',
  });
  assert.equal(renamed.ok, true, `rename: ${renamed.ok ? '' : renamed.error}`);
  assert.equal(renamed.value.name, 'Großer Schankraum');
  const afterRename = db
    .prepare(`SELECT id, name FROM world_places WHERE id = ?`)
    .get(target.placeId);
  assert.equal(afterRename.id, target.placeId);
  assert.equal(afterRename.name, 'Großer Schankraum');
  const link = db
    .prepare(
      `SELECT map_id FROM world_place_map_links WHERE place_id = ? AND usage = 'primary'`,
    )
    .get(target.placeId);
  assert.equal(link.map_id, target.mapId);
  // Reload via read ports after rename — place/map IDs stay immutable
  const placesAfterRename = world.listWorldPlaces(OWNER, worldId, false, null);
  assert.equal(placesAfterRename.ok, true);
  const renamedViaPort = placesAfterRename.value.find((p) => p.id === target.placeId);
  assert.ok(renamedViaPort);
  assert.equal(renamedViaPort.name, 'Großer Schankraum');
  hostEvidence.immutableIds = true;
  sollIst[4].ist = 'pass-host';

  // Host cycle rejection via reparent_world_node (not domain helper alone)
  const descCycle = reparentNode(OWNER, {
    worldProfileId: worldId,
    placeId: byKind.continent.id,
    newParentPlaceId: byKind.room.id,
    confirmRelocate: true,
  });
  assert.equal(descCycle.ok, false, 'descendant cycle must fail');
  assert.equal(descCycle.error, '23514', `cycle error ${descCycle.error}`);
  const selfCycle = reparentNode(OWNER, {
    worldProfileId: worldId,
    placeId: byKind.room.id,
    newParentPlaceId: byKind.room.id,
    confirmRelocate: true,
  });
  assert.equal(selfCycle.ok, false, 'self cycle must fail');
  assert.equal(selfCycle.error, '23514', `self cycle error ${selfCycle.error}`);
  // Parent chain unchanged after rejected cycles
  const still = world.listWorldPlaces(OWNER, worldId, false, null);
  assert.equal(still.ok, true);
  const stillByKind = Object.fromEntries(still.value.map((p) => [p.kind, p]));
  assert.equal(stillByKind.country.parentPlaceId, stillByKind.continent.id);
  assert.equal(stillByKind.room.parentPlaceId, stillByKind.building.id);
  hostEvidence.cycleRejected = true;

  // Invalid edge / skip: place cannot hang under room tip (rank too deep; no fillable chain)
  const skip = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'place',
    name: 'Skip Place',
    parentPlaceId: byKind.room.id,
    idempotencyKey: `e01-skip-${randomUUID()}`,
  });
  assert.equal(skip.ok, false, 'skip/invalid edge must fail');
  assert.equal(skip.error, '23514', `skip error ${skip.error}`);
  hostEvidence.skipRejected = true;

  // Cross-world: create node in other world, then reparent attempt via create under foreign parent
  const otherContinent = createNode(OWNER, {
    worldProfileId: otherWorld,
    kind: 'continent',
    name: 'Otherland',
    idempotencyKey: `e01-other-${randomUUID()}`,
  });
  assert.equal(otherContinent.ok, true);
  const foreignParent = otherContinent.value.targetPlaceId;
  const cross = createNode(OWNER, {
    worldProfileId: worldId,
    kind: 'country',
    name: 'Cross Country',
    parentPlaceId: foreignParent,
    idempotencyKey: `e01-cross-${randomUUID()}`,
  });
  assert.equal(cross.ok, false, 'cross-world must fail');
  assert.ok(String(cross.error).includes('23514') || String(cross.error).includes('world'));
  hostEvidence.crossWorldRejected = true;

  const stranger = createNode(STRANGER, {
    worldProfileId: worldId,
    kind: 'continent',
    name: 'Hacked',
    idempotencyKey: `e01-stranger-${randomUUID()}`,
  });
  assert.equal(stranger.ok, false, 'stranger must fail');
  hostEvidence.strangerDenied = true;
  sollIst[5].ist = 'pass-host';
} finally {
  rmSync(work, { recursive: true, force: true });
}

const evidence = {
  gate: 'atl2-e01',
  issue: 1219,
  head,
  host: hostEvidence,
  sollIst,
  verdict: 'CLEAR',
  residuals: [
    {
      severity: 'Low',
      note: 'Golden Dornhain seed still omits room WorldNodes (tavern/crypt as building); API path proven here for room+chain.',
    },
  ],
};

const sollRows = sollIst
  .map((r) => `| ${r.category} | ${r.soll} | **${r.ist}** |`)
  .join('\n');

const report = `# ATL2-E01 — Primary maps & six-level WorldNode links

- Issue: #1219
- HEAD: \`${head}\`
- Verdict: **${evidence.verdict}**
- Date: ${new Date().toISOString().slice(0, 10)}

## Soll / Ist

| Category | Soll | Ist |
|----------|------|-----|
${sollRows}

## Host evidence

- Chain kinds: **${hostEvidence.chainKinds.join(' → ')}**
- Places / primary links / world root maps: **${hostEvidence.placeCount} / ${hostEvidence.primaryLinks} / ${hostEvidence.rootMaps}**
- Host read ports (listPlaces/links/maps): **${hostEvidence.readPortsOk ? 'yes' : 'no'}**
- Immutable IDs on rename: **${hostEvidence.immutableIds ? 'yes' : 'no'}**
- Cycle rejected (reparent_world_node): **${hostEvidence.cycleRejected ? 'yes' : 'no'}**
- Skip rejected: **${hostEvidence.skipRejected ? 'yes' : 'no'}**
- Cross-world rejected: **${hostEvidence.crossWorldRejected ? 'yes' : 'no'}**
- Stranger denied: **${hostEvidence.strangerDenied ? 'yes' : 'no'}**

## Residuals

- **Low**: Golden seed room WorldNodes deferred — create path covers room+ancestors.

## Decision

ATL2-E01 primary-map / hierarchy links are **${evidence.verdict}**. E02 may open.
`;

const writeEvidence = process.env.ATL2_E01_WRITE_EVIDENCE === '1';
const outDir = writeEvidence ? join(root, '.qa/runs') : mkdtempSync(join(tmpdir(), 'atl2-e01-out-'));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'atl2-e01-primary-maps.md'), report);
writeFileSync(join(outDir, 'atl2-e01-primary-maps.json'), `${JSON.stringify(evidence, null, 2)}\n`);

const committedPath = join(root, '.qa/runs/atl2-e01-primary-maps.md');
let committed;
try {
  committed = readFileSync(committedPath, 'utf8');
} catch {
  committed = null;
}
if (committed) {
  assert.match(committed, /Verdict: \*\*CLEAR\*\*/);
  assert.match(committed, /continent/);
} else {
  assert.equal(writeEvidence, true, 'seed with ATL2_E01_WRITE_EVIDENCE=1');
}

console.log(`atl2-e01-primary-maps self-test: PASS (${evidence.verdict})`);
console.log(`report: ${join(outDir, 'atl2-e01-primary-maps.md')}${writeEvidence ? '' : ' (transient)'}`);
