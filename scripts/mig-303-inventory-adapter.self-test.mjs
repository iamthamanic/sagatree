#!/usr/bin/env node
/**
 * mig-303-inventory-adapter.self-test — Inventory host ports + dual-path (#802).
 * Location: scripts/mig-303-inventory-adapter.self-test.mjs
 *
 * Acceptance tier: isolated-contract. Supabase facades stay live (no cutover).
 * Thumbnail/model3d Edge shapes retained in inventory module (not moved to HTTP).
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

/** Minimal valid Inventory v2 state (schemaVersion=1 inside JSON). */
function emptyV2(overrides = {}) {
  return {
    schemaVersion: 1,
    instances: {},
    containers: {},
    equipment: {},
    baseSlots: Array.from({ length: 20 }, () => null),
    quickSlots: Array.from({ length: 4 }, () => null),
    legacyOverflow: [],
    ...overrides,
  };
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const inventoryUrl = pathToFileURL(join(root, 'server/src/modules/inventory/index.ts')).href;
const characterUrl = pathToFileURL(join(root, 'server/src/modules/character/index.ts')).href;
const hostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;

const { bootstrapHostPersistence, TABLE_OWNERSHIP } = await import(persistenceUrl);
const {
  createInventoryPorts,
  INVENTORY_INFRA_PUBLIC_ACTIVATION_AUTHORIZED,
  ITEM_THUMBNAIL_PUBLIC_ACTIVATION_AUTHORIZED,
  ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED,
  ITEM_THUMBNAIL_SIGNED_URL_TTL_SECONDS,
  createItemThumbnailStore,
  createItemModel3dStore,
} = await import(inventoryUrl);
const { createCharacterPorts } = await import(characterUrl);
const { createHost } = await import(hostUrl);

const adapterLoadDir = mkdtempSync(join(tmpdir(), 'mig303-adapter-'));
function rewriteTsImports(source) {
  return source.replace(/from ['"](\.[^'"]+)['"]/g, (full, spec) => {
    if (/\.(ts|js|mjs|cjs|json)$/.test(spec)) return full;
    return `from '${spec}.ts'`;
  });
}
for (const name of ['host-inventory-ports.contract.ts', 'host-inventory-adapter.ts']) {
  const src = readFileSync(join(root, 'src/infrastructure/inventory', name), 'utf8');
  writeFileSync(join(adapterLoadDir, name), rewriteTsImports(src));
}
const [{ createHostInventoryAdapter }, { HOST_INVENTORY_OPS }] = await Promise.all([
  import(pathToFileURL(join(adapterLoadDir, 'host-inventory-adapter.ts')).href),
  import(pathToFileURL(join(adapterLoadDir, 'host-inventory-ports.contract.ts')).href),
]);
assert(typeof createHostInventoryAdapter === 'function', 'adapter loaded');
assert(HOST_INVENTORY_OPS.length === 4, 'ops count');

const work = mkdtempSync(join(tmpdir(), 'mig303-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir, { recursive: true });

try {
  assert(INVENTORY_INFRA_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no inventory HTTP');
  assert(TABLE_OWNERSHIP.inventory_item_definitions === 'inventory', 'ownership');

  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);

  const character = createCharacterPorts(boot.db);
  const owner = 'owner-o';
  const stranger = 'stranger-x';
  /** Owner may read/edit world-1; stranger has no world ACL. */
  const inventory = createInventoryPorts({
    db: boot.db,
    world: {
      canReadWorldProfile: (actorIds, worldProfileId) =>
        actorIds.includes(owner) && worldProfileId === 'world-1',
      canEditWorldProfile: (actorIds, worldProfileId) =>
        actorIds.includes(owner) && worldProfileId === 'world-1',
    },
    character: {
      getOwned: (actorId, characterId) => character.getOwnedInventoryColumns(actorId, characterId),
      putOwned: (actorId, characterId, inventoryJson, schemaVersion, updatedAt, revalidateUnderLock) =>
        character.putOwnedInventoryColumns(
          actorId,
          characterId,
          inventoryJson,
          schemaVersion,
          updatedAt,
          revalidateUnderLock,
        ),
    },
  });

  const pc = character.createOwnedCharacter(owner, {
    name: 'Bag PC',
    sheetStatus: 'draft',
  });
  assert(pc.ok, `pc: ${pc.ok ? '' : pc.error}`);

  // Seed a standard definition first so put can reference a visible id.
  const sword = inventory.seedStandardDefinitionForTests({
    name: 'Iron Sword',
    payload: { assetKey: 'std:sword' },
  });
  assert(/^IT-[A-HJ-NP-Z2-9]{5}$/.test(sword.publicId), `public id format: ${sword.publicId}`);

  // --- Fall 1: add/equip/consume via put + reload; foreign DENY ---
  const withSword = inventory.putOwnedInventory(
    owner,
    pc.value.id,
    emptyV2({
      instances: {
        i1: { instanceId: 'i1', definitionId: sword.id, quantity: 1 },
      },
      containers: { pack: ['i1'] },
    }),
  );
  assert(withSword.ok, `put add: ${withSword.ok ? '' : withSword.error}`);
  assert(withSword.value.schemaVersion === 2, 'schema v2 column');

  const equipped = inventory.putOwnedInventory(
    owner,
    pc.value.id,
    emptyV2({
      instances: {
        i1: { instanceId: 'i1', definitionId: sword.id, quantity: 1 },
      },
      equipment: { mainhand: 'i1' },
    }),
  );
  assert(equipped.ok && equipped.value.inventory.equipment.mainhand === 'i1', 'equip');

  const consumed = inventory.putOwnedInventory(owner, pc.value.id, emptyV2());
  assert(consumed.ok && Object.keys(consumed.value.inventory.instances).length === 0, 'consume');

  const reloaded = inventory.getOwnedInventory(owner, pc.value.id);
  assert(reloaded.ok && reloaded.value?.schemaVersion === 2, 'reload');

  const foreignPut = inventory.putOwnedInventory(
    stranger,
    pc.value.id,
    emptyV2({
      instances: {
        hack: { instanceId: 'hack', definitionId: sword.id, quantity: 1 },
      },
    }),
  );
  assert(foreignPut.ok === false && foreignPut.error === 'not-authorized', 'foreign put DENY');
  const foreignGet = inventory.getOwnedInventory(stranger, pc.value.id);
  assert(foreignGet.ok === false && foreignGet.error === 'not-authorized', 'foreign get DENY');

  const badShape = inventory.putOwnedInventory(owner, pc.value.id, { instances: {} });
  assert(badShape.ok === false && badShape.error === 'invalid-inventory', 'reject bad v2 shape');

  // --- Fall 2: thumbnail/model shapes retained ---
  assert(ITEM_THUMBNAIL_PUBLIC_ACTIVATION_AUTHORIZED === false, 'thumbnail unmounted');
  assert(ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED === false, 'model3d unmounted');
  assert(ITEM_THUMBNAIL_SIGNED_URL_TTL_SECONDS === 604_800, 'signed URL TTL shape');
  assert(typeof createItemThumbnailStore === 'function', 'thumbnail store factory');
  assert(typeof createItemModel3dStore === 'function', 'model3d store factory');
  for (const rel of [
    'src/infrastructure/inventory/item-thumbnail-service.ts',
    'src/infrastructure/inventory/item-model3d-service.ts',
    'src/infrastructure/inventory/inventory-persistence.ts',
  ]) {
    assert(existsSync(join(root, rel)), `client shape: ${rel}`);
  }

  // --- Fall 3: catalog origins not client-promoted + world ACL ---
  const personal = inventory.createDefinition(owner, {
    name: 'My Dagger',
    origin: 'personal',
    payload: { assetKey: 'thumb:1', model3d: 'm:1' },
  });
  assert(personal.ok && personal.value.origin === 'personal', 'personal create');
  assert(/^IT-[A-HJ-NP-Z2-9]{5}$/.test(personal.value.publicId), 'personal public id');
  assert(personal.value.payload.assetKey === 'thumb:1', 'payload.assetKey');
  assert(personal.value.payload.model3d === 'm:1', 'payload.model3d');

  const promoteStandard = inventory.createDefinition(owner, {
    name: 'Hijack Standard',
    origin: 'standard',
  });
  assert(
    promoteStandard.ok === false && promoteStandard.error === 'origin-not-allowed',
    'cannot promote standard',
  );

  const world = inventory.createDefinition(owner, {
    name: 'World Relic',
    origin: 'world',
    worldProfileId: 'world-1',
  });
  assert(world.ok && world.value.origin === 'world', 'world create');

  const worldDeny = inventory.createDefinition(owner, {
    name: 'Foreign World',
    origin: 'world',
    worldProfileId: 'world-other',
  });
  assert(worldDeny.ok === false && worldDeny.error === 'not-authorized', 'world create ACL');

  const listed = inventory.listCatalog(owner, { worldProfileId: 'world-1' });
  assert(listed.ok, 'list ok');
  assert(listed.value.some((d) => d.origin === 'standard'), 'standard visible');
  assert(listed.value.some((d) => d.id === personal.value.id), 'personal visible');
  assert(listed.value.some((d) => d.id === world.value.id), 'world visible for profile');

  const strangerList = inventory.listCatalog(stranger, { worldProfileId: 'world-1' });
  assert(strangerList.ok === false && strangerList.error === 'not-authorized', 'stranger world DENY');

  const strangerStandard = inventory.listCatalog(stranger);
  assert(
    strangerStandard.ok && !strangerStandard.value.some((d) => d.id === personal.value.id),
    'stranger cannot see personal',
  );
  assert(
    strangerStandard.value.some((d) => d.origin === 'standard'),
    'stranger sees standard',
  );

  const search = inventory.listCatalog(owner, { query: 'dagger' });
  assert(search.ok && search.value.every((d) => /dagger/i.test(d.name)), 'search filter');

  const likeEscape = inventory.listCatalog(owner, { query: '%' });
  assert(
    likeEscape.ok && !likeEscape.value.some((d) => d.id === personal.value.id),
    'LIKE % does not match all via wildcard',
  );

  const foreignDef = inventory.putOwnedInventory(
    owner,
    pc.value.id,
    emptyV2({
      instances: {
        x1: { instanceId: 'x1', definitionId: 'not-a-real-def', quantity: 1 },
      },
    }),
  );
  assert(
    foreignDef.ok === false && foreignDef.error === 'definition-not-visible',
    'invisible definition DENY',
  );

  // Archive personal mid-flight visibility: after archive, put must DENY.
  assert(personal.ok, 'personal exists for archive test');
  boot.db
    .prepare(`UPDATE inventory_item_definitions SET status = 'archived' WHERE id = ?`)
    .run(personal.value.id);
  const afterArchive = inventory.putOwnedInventory(
    owner,
    pc.value.id,
    emptyV2({
      instances: {
        a1: { instanceId: 'a1', definitionId: personal.value.id, quantity: 1 },
      },
    }),
  );
  assert(
    afterArchive.ok === false && afterArchive.error === 'definition-not-visible',
    'archived definition DENY under visibility recheck',
  );

  // Under-lock revalidate must be required and honored (direct character port).
  const lockDeny = character.putOwnedInventoryColumns(
    owner,
    pc.value.id,
    JSON.stringify(emptyV2()),
    2,
    new Date().toISOString(),
    () => ({ ok: false, error: 'definition-not-visible' }),
  );
  assert(
    lockDeny.ok === false && lockDeny.error === 'definition-not-visible',
    'required revalidateUnderLock DENY path',
  );

  const bound = createHostInventoryAdapter({
    getOwnedInventory: async (a, id) => inventory.getOwnedInventory(a, id),
    putOwnedInventory: async (a, id, inv) => inventory.putOwnedInventory(a, id, inv),
    listCatalog: async (a, opts) => inventory.listCatalog(a, opts),
    createDefinition: async (a, d) => inventory.createDefinition(a, d),
  });
  assert(bound.transport === 'host', 'adapter transport');
  const via = await bound.createDefinition(owner, { name: 'Adapter Item' });
  assert(via.ok && via.value.origin === 'personal', 'adapter create defaults personal');

  const hostWork = mkdtempSync(join(tmpdir(), 'mig303-host-'));
  try {
    const host = createHost({
      SAGATREE_DATA_DIR: hostWork,
      SAGATREE_PORT: '18769',
      SAGATREE_HOST: '127.0.0.1',
      SAGATREE_HOST_MODE: 'solo',
    });
    assert(!('error' in host), `createHost: ${'error' in host ? host.error : ''}`);
    assert(host.inventory?.moduleId === 'inventory', 'host exposes inventory');
  } finally {
    rmSync(hostWork, { recursive: true, force: true });
  }

  console.log('PASS: mig-303-inventory-adapter.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(adapterLoadDir, { recursive: true, force: true });
}
