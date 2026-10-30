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
  const inventory = createInventoryPorts(boot.db);
  const owner = 'owner-o';
  const stranger = 'stranger-x';

  const pc = character.createOwnedCharacter(owner, {
    name: 'Bag PC',
    sheetStatus: 'draft',
  });
  assert(pc.ok, `pc: ${pc.ok ? '' : pc.error}`);

  // --- Fall 1: add/equip/consume via put + reload; foreign DENY ---
  const withSword = inventory.putOwnedInventory(owner, pc.value.id, {
    instances: {
      i1: { definitionId: 'std-sword', equipped: false, qty: 1 },
    },
    containers: { pack: ['i1'] },
  });
  assert(withSword.ok, `put add: ${withSword.ok ? '' : withSword.error}`);
  assert(withSword.value.schemaVersion === 2, 'schema v2');

  const equipped = inventory.putOwnedInventory(owner, pc.value.id, {
    instances: {
      i1: { definitionId: 'std-sword', equipped: true, qty: 1, slot: 'mainhand' },
    },
    containers: { pack: [] },
  });
  assert(equipped.ok && equipped.value.inventory.instances.i1.equipped === true, 'equip');

  const consumed = inventory.putOwnedInventory(owner, pc.value.id, {
    instances: {},
    containers: { pack: [] },
  });
  assert(consumed.ok && Object.keys(consumed.value.inventory.instances).length === 0, 'consume');

  const reloaded = inventory.getOwnedInventory(owner, pc.value.id);
  assert(reloaded.ok && reloaded.value?.schemaVersion === 2, 'reload');

  const foreignPut = inventory.putOwnedInventory(stranger, pc.value.id, {
    instances: { hack: { definitionId: 'x', qty: 1 } },
  });
  assert(foreignPut.ok === false && foreignPut.error === 'not-authorized', 'foreign put DENY');
  const foreignGet = inventory.getOwnedInventory(stranger, pc.value.id);
  assert(foreignGet.ok === false && foreignGet.error === 'not-authorized', 'foreign get DENY');

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

  // --- Fall 3: catalog origins not client-promoted ---
  inventory.seedStandardDefinitionForTests({ name: 'Iron Sword', payload: { assetKey: 'std:sword' } });
  const personal = inventory.createDefinition(owner, {
    name: 'My Dagger',
    origin: 'personal',
    payload: { assetKey: 'thumb:1', model3d: 'm:1' },
  });
  assert(personal.ok && personal.value.origin === 'personal', 'personal create');
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

  const listed = inventory.listCatalog(owner, { worldProfileId: 'world-1' });
  assert(listed.ok, 'list ok');
  assert(listed.value.some((d) => d.origin === 'standard'), 'standard visible');
  assert(listed.value.some((d) => d.id === personal.value.id), 'personal visible');
  assert(listed.value.some((d) => d.id === world.value.id), 'world visible for profile');

  const strangerList = inventory.listCatalog(stranger, { worldProfileId: 'world-1' });
  assert(
    strangerList.ok && !strangerList.value.some((d) => d.id === personal.value.id),
    'stranger cannot see personal',
  );
  assert(
    strangerList.value.some((d) => d.origin === 'standard'),
    'stranger sees standard',
  );

  const search = inventory.listCatalog(owner, { query: 'dagger' });
  assert(search.ok && search.value.every((d) => /dagger/i.test(d.name)), 'search filter');

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
