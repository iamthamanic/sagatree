#!/usr/bin/env node
/**
 * mig-305-marketplace-adapter.self-test — Marketplace host ports + dual-path seam (#804).
 * Location: scripts/mig-305-marketplace-adapter.self-test.mjs
 *
 * Acceptance tier: isolated-contract. Supabase facades stay live (no cutover).
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

function actor(id) {
  return { kind: 'remote-account', actorId: id, sessionId: `auth-${id}`, email: null };
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const marketplaceUrl = pathToFileURL(join(root, 'server/src/modules/marketplace/index.ts')).href;
const hostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;

const { bootstrapHostPersistence, TABLE_OWNERSHIP } = await import(persistenceUrl);
const {
  createMarketplacePorts,
  MARKETPLACE_INFRA_PUBLIC_ACTIVATION_AUTHORIZED,
  MARKETPLACE_COUNT_PUBLIC_ACTIVATION_AUTHORIZED,
  MARKETPLACE_LEGACY_CLIENT_COUNTER_FALLBACK_SUPERSEDED,
  MARKETPLACE_SEARCH_USES_PARAMETERIZED_LIKE,
  escapeMarketplaceSearchLiteral,
} = await import(marketplaceUrl);
const { createHost } = await import(hostUrl);

const adapterLoadDir = mkdtempSync(join(tmpdir(), 'mig305-adapter-'));
function rewriteTsImports(source) {
  return source.replace(/from ['"](\.[^'"]+)['"]/g, (full, spec) => {
    if (/\.(ts|js|mjs|cjs|json)$/.test(spec)) return full;
    return `from '${spec}.ts'`;
  });
}
for (const name of ['host-marketplace-ports.contract.ts', 'host-marketplace-adapter.ts']) {
  const src = readFileSync(join(root, 'src/infrastructure/marketplace', name), 'utf8');
  writeFileSync(join(adapterLoadDir, name), rewriteTsImports(src));
}
const [{ createHostMarketplaceAdapter }, { HOST_MARKETPLACE_OPS }] = await Promise.all([
  import(pathToFileURL(join(adapterLoadDir, 'host-marketplace-adapter.ts')).href),
  import(pathToFileURL(join(adapterLoadDir, 'host-marketplace-ports.contract.ts')).href),
]);
assert(typeof createHostMarketplaceAdapter === 'function', 'createHostMarketplaceAdapter loaded');
assert(
  Array.isArray(HOST_MARKETPLACE_OPS) && HOST_MARKETPLACE_OPS.length === 8,
  'HOST_MARKETPLACE_OPS count',
);

const work = mkdtempSync(join(tmpdir(), 'mig305-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir, { recursive: true });

try {
  assert(MARKETPLACE_INFRA_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no marketplace HTTP mount');
  assert(MARKETPLACE_COUNT_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no count HTTP mount');
  assert(MARKETPLACE_LEGACY_CLIENT_COUNTER_FALLBACK_SUPERSEDED === true, 'legacy fallback superseded');
  assert(MARKETPLACE_SEARCH_USES_PARAMETERIZED_LIKE === true, 'parameterized LIKE decision');
  assert(TABLE_OWNERSHIP.marketplace_items === 'marketplace', 'marketplace_items ownership');
  assert(
    escapeMarketplaceSearchLiteral('a%b_c') === 'a\\%b\\_c',
    'escape wildcards',
  );

  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);

  const marketplace = createMarketplacePorts({ db: boot.db });
  assert(marketplace.moduleId === 'marketplace', 'module id');

  const owner = actor('owner-o');
  const stranger = actor('stranger-x');

  // --- Fall 1: list filters, sort defaults, single-read, featured ---
  const createdA = marketplace.createItem(owner, {
    type: 'world',
    title: 'Alpha World',
    description: 'first desc',
    data: { biome: 'forest' },
    price: 0,
    tags: ['alpha'],
  });
  assert(createdA.ok, `create A: ${createdA.ok ? '' : createdA.error}`);
  assert(createdA.value.authorId === owner.actorId, 'author from actor');
  assert(createdA.value.rating === 0 && createdA.value.downloads === 0, 'counters zero');

  const createdB = marketplace.createItem(owner, {
    type: 'item',
    title: 'Beta Blade',
    description: 'sharp item',
    data: { dmg: 3 },
    price: 5,
  });
  assert(createdB.ok, 'create B');

  marketplace.incrementDownloads(owner, createdA.value.id);
  marketplace.incrementDownloads(owner, createdA.value.id);
  marketplace.incrementDownloads(owner, createdB.value.id);

  const listedDefault = marketplace.listItems();
  assert(listedDefault.ok && listedDefault.value.length === 2, 'list all');
  assert(listedDefault.value[0].id === createdA.value.id, 'default sort downloads desc');

  const typed = marketplace.listItems({ type: 'world' });
  assert(typed.ok && typed.value.length === 1 && typed.value[0].id === createdA.value.id, 'type filter');

  const searched = marketplace.listItems({ searchQuery: 'Alpha' });
  assert(searched.ok && searched.value.some((row) => row.id === createdA.value.id), 'search title');

  const priced = marketplace.listItems({ maxPrice: 1 });
  assert(priced.ok && priced.value.every((row) => row.price <= 1), 'maxPrice filter');

  // Featured: seed rating for A, then expect rating≥3.5 path; clear → fallback top downloads
  boot.db
    .prepare(`UPDATE marketplace_items SET rating = 4.5 WHERE id = ?`)
    .run(createdA.value.id);
  const featuredRated = marketplace.listFeatured();
  assert(
    featuredRated.ok &&
      featuredRated.value.length >= 1 &&
      featuredRated.value.every((row) => row.rating >= 3.5),
    'featured prefers rating>=3.5',
  );
  boot.db.prepare(`UPDATE marketplace_items SET rating = 0 WHERE id = ?`).run(createdA.value.id);
  const featuredFallback = marketplace.listFeatured();
  assert(featuredFallback.ok && featuredFallback.value.length === 2, 'featured fallback top downloads');

  const missing = marketplace.getItemById('does-not-exist');
  assert(missing.ok && missing.value === null, 'single-read missing → null');
  const badId = marketplace.getItemById('  ');
  assert(!badId.ok, 'empty id error');

  // --- Fall 2 / 4: increment atomic + unauthorized ---
  const before = marketplace.getItemById(createdA.value.id);
  assert(before.ok && before.value.downloads === 2, 'downloads before reload check');
  const bumped = marketplace.incrementDownloads(owner, createdA.value.id);
  assert(bumped.ok && bumped.mutated === true && bumped.downloads === 3, 'atomic increment');
  const noActorInc = marketplace.incrementDownloads(
    { kind: 'remote-account', actorId: '', sessionId: 'x', email: null },
    createdA.value.id,
  );
  assert(!noActorInc.ok && noActorInc.error === '42501', 'increment DENY missing actor');
  const unknownInc = marketplace.incrementDownloads(owner, 'missing-item-id');
  assert(unknownInc.ok && unknownInc.mutated === false, 'unknown item no-op');
  const afterReload = marketplace.getItemById(createdA.value.id);
  assert(afterReload.ok && afterReload.value.downloads === 3, 'reload durable increment');

  // --- Fall 3: create privileged deny; update/delete foreign DENY ---
  const privileged = marketplace.createItem(owner, {
    type: 'item',
    title: 'Evil',
    data: {},
    author_id: 'attacker',
    downloads: 99,
  });
  assert(
    !privileged.ok &&
      (privileged.error === 'privileged-client-field' || privileged.error === 'invalid-draft'),
    'no client author_id',
  );

  const foreignUpdate = marketplace.updateItem(stranger, createdA.value.id, {
    title: 'Hijacked',
  });
  assert(!foreignUpdate.ok && foreignUpdate.error === 'not-authorized', 'foreign update DENY');

  const foreignDelete = marketplace.deleteItem(stranger, createdA.value.id);
  assert(
    (!foreignDelete.ok && foreignDelete.error === 'not-authorized') ||
      (foreignDelete.ok && foreignDelete.value === false),
    'foreign delete DENY/false',
  );

  const ownerUpdate = marketplace.updateItem(owner, createdA.value.id, { title: 'Alpha Renamed' });
  assert(ownerUpdate.ok && ownerUpdate.value.title === 'Alpha Renamed', 'owner update');

  const ownerDelete = marketplace.deleteItem(owner, createdB.value.id);
  assert(ownerDelete.ok && ownerDelete.value === true, 'owner delete true');
  const gone = marketplace.getItemById(createdB.value.id);
  assert(gone.ok && gone.value === null, 'deleted gone');

  const deleteMissing = marketplace.deleteItem(owner, createdB.value.id);
  assert(
    (!deleteMissing.ok && deleteMissing.error === 'not-found') ||
      (deleteMissing.ok && deleteMissing.value === false),
    'delete missing fails',
  );

  // --- Fall 5: no non-atomic client counter fallback ---
  const portsSrc = readFileSync(join(root, 'server/src/modules/marketplace/index.ts'), 'utf8');
  assert(/Atomic host path only/.test(portsSrc), 'ports document no client fallback');
  const serviceSrc = readFileSync(
    join(root, 'src/infrastructure/marketplace/marketplace-service.ts'),
    'utf8',
  );
  assert(/no client counter write/.test(serviceSrc), 'FE no client counter write (#675)');

  // --- Fall 6: search escaping ---
  const litCreate = marketplace.createItem(owner, {
    type: 'character',
    title: 'Percent % underscore _',
    description: 'needle %_literal here',
    data: {},
  });
  assert(litCreate.ok, 'literal create');
  const exactWild = marketplace.listItems({ searchQuery: '%_literal' });
  assert(
    exactWild.ok && exactWild.value.some((row) => row.id === litCreate.value.id),
    'escaped search finds literal %_',
  );
  const allRows = marketplace.listItems();
  const wildcardAll = marketplace.listItems({ searchQuery: '%' });
  assert(
    allRows.ok &&
      wildcardAll.ok &&
      allRows.value.length > wildcardAll.value.length &&
      wildcardAll.value.every((row) => `${row.title}${row.description ?? ''}`.includes('%')),
    'bare % does not match all',
  );
  const catalogSrc = readFileSync(
    join(root, 'server/src/modules/marketplace/internal/marketplace-catalog-store.ts'),
    'utf8',
  );
  assert(/ESCAPE '\\\\'/.test(catalogSrc), 'LIKE ESCAPE');
  assert(!/\.or\(\s*`title\.ilike/.test(catalogSrc), 'no PostgREST or-interpolation');

  // Dual-path adapter seam (matches HostMarketplacePorts)
  const bound = createHostMarketplaceAdapter({
    listItems: async (filters) => marketplace.listItems(filters),
    getItemById: async (itemId) => marketplace.getItemById(itemId),
    listFeatured: async () => marketplace.listFeatured(),
    listByAuthor: async (authorId) => marketplace.listByAuthor(authorId),
    createItem: async (actorId, draft) => marketplace.createItem(actor(actorId), draft),
    updateItem: async (actorId, itemId, patch) =>
      marketplace.updateItem(actor(actorId), itemId, patch),
    deleteItem: async (actorId, itemId) => marketplace.deleteItem(actor(actorId), itemId),
    incrementDownloads: async (actorId, itemId) =>
      marketplace.incrementDownloads(actor(actorId), itemId),
  });
  assert(bound.transport === 'host', 'adapter transport');
  const viaAdapter = await bound.createItem(owner.actorId, {
    type: 'ruleset',
    title: 'Adapter Rules',
    data: { v: 1 },
  });
  assert(viaAdapter.ok && viaAdapter.value.title === 'Adapter Rules', 'adapter create');
  const viaInc = await bound.incrementDownloads(owner.actorId, viaAdapter.value.id);
  assert(viaInc.ok && viaInc.mutated === true, 'adapter increment');

  const hostWork = mkdtempSync(join(tmpdir(), 'mig305-host-'));
  try {
    const host = createHost({
      SAGATREE_DATA_DIR: hostWork,
      SAGATREE_PORT: '18768',
      SAGATREE_HOST: '127.0.0.1',
      SAGATREE_HOST_MODE: 'solo',
    });
    assert(!('error' in host), `createHost: ${'error' in host ? host.error : ''}`);
    assert(host.marketplace?.moduleId === 'marketplace', 'create-host exposes marketplace');
  } finally {
    rmSync(hostWork, { recursive: true, force: true });
  }

  const indexSrc = readFileSync(join(root, 'src/infrastructure/marketplace/index.ts'), 'utf8');
  const adapterSrc = readFileSync(
    join(root, 'src/infrastructure/marketplace/host-marketplace-adapter.ts'),
    'utf8',
  );
  assert(/from '\.\.\/\.\.\/lib\/supabase'/.test(serviceSrc), 'service default remains Supabase');
  assert(/createHostMarketplaceAdapter/.test(indexSrc), 'barrel exports host adapter');
  assert(/transport: 'host'/.test(adapterSrc), 'adapter marks host transport');
  assert(!/VITE_SAGATREE_HOST_MARKETPLACE/.test(serviceSrc), 'no accidental env cutover');

  const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
  assert(
    !/marketplace-items|mountMarketplace|marketplaceRoutes/i.test(createApp),
    'no marketplace HTTP mount yet',
  );

  for (const rel of [
    'server/src/modules/marketplace/index.ts',
    'server/src/modules/marketplace/internal/marketplace-catalog-store.ts',
    'src/infrastructure/marketplace/host-marketplace-adapter.ts',
    'src/infrastructure/marketplace/host-marketplace-ports.contract.ts',
  ]) {
    const src = readFileSync(join(root, rel), 'utf8');
    assert(
      !/\bas any\b|\bas unknown as\b|@ts-ignore|@ts-expect-error/.test(src),
      `typed-strict ${rel}`,
    );
  }

  console.log('PASS: mig-305-marketplace-adapter.self-test');
} finally {
  try {
    boot?.db?.close?.();
  } catch {
    /* ignore */
  }
  rmSync(work, { recursive: true, force: true });
  rmSync(adapterLoadDir, { recursive: true, force: true });
}
