#!/usr/bin/env node
/**
 * mig-305-marketplace-adapter.self-test — Marketplace host ports + dual-path seam (#804).
 * Location: scripts/mig-305-marketplace-adapter.self-test.mjs
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
function assert(cond, msg) {
  if (!cond) { console.error(`FAIL: ${msg}`); process.exit(1); }
}
function actor(id) {
  return { kind: 'remote-account', actorId: id, sessionId: `auth-${id}`, email: null };
}

const { bootstrapHostPersistence, TABLE_OWNERSHIP } = await import(pathToFileURL(join(root, 'server/src/persistence/index.ts')).href);
const {
  createMarketplacePorts,
  MARKETPLACE_INFRA_PUBLIC_ACTIVATION_AUTHORIZED,
  MARKETPLACE_COUNT_PUBLIC_ACTIVATION_AUTHORIZED,
  MARKETPLACE_LEGACY_CLIENT_COUNTER_FALLBACK_SUPERSEDED,
  MARKETPLACE_SEARCH_USES_PARAMETERIZED_LIKE,
  escapeMarketplaceLikePattern,
} = await import(pathToFileURL(join(root, 'server/src/modules/marketplace/index.ts')).href);
const { createHost } = await import(pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href);

const adapterLoadDir = mkdtempSync(join(tmpdir(), 'mig305-adapter-'));
function rewriteTsImports(source) {
  return source.replace(/from ['"](\.[^'"]+)['"]/g, (full, spec) => {
    if (/\.(ts|js|mjs|cjs|json)$/.test(spec)) return full;
    return `from '${spec}.ts'`;
  });
}
for (const name of ['host-marketplace-ports.contract.ts', 'host-marketplace-adapter.ts']) {
  writeFileSync(join(adapterLoadDir, name), rewriteTsImports(readFileSync(join(root, 'src/infrastructure/marketplace', name), 'utf8')));
}
const [{ createHostMarketplaceAdapter }, { HOST_MARKETPLACE_OPS }] = await Promise.all([
  import(pathToFileURL(join(adapterLoadDir, 'host-marketplace-adapter.ts')).href),
  import(pathToFileURL(join(adapterLoadDir, 'host-marketplace-ports.contract.ts')).href),
]);
assert(typeof createHostMarketplaceAdapter === 'function', 'adapter loaded');
assert(HOST_MARKETPLACE_OPS.length === 8, 'ops count');

const work = mkdtempSync(join(tmpdir(), 'mig305-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir, { recursive: true });
try {
  assert(MARKETPLACE_INFRA_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no HTTP');
  assert(MARKETPLACE_COUNT_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no count HTTP');
  assert(MARKETPLACE_LEGACY_CLIENT_COUNTER_FALLBACK_SUPERSEDED === true, 'legacy superseded');
  assert(MARKETPLACE_SEARCH_USES_PARAMETERIZED_LIKE === true, 'LIKE parameterized');
  assert(TABLE_OWNERSHIP.marketplace_items === 'marketplace', 'ownership');
  assert(escapeMarketplaceLikePattern('a%b_c') === 'a\\%b\\_c', 'escape');

  const boot = bootstrapHostPersistence({ dataDir, migrationsDir: join(root, 'server/migrations') });
  assert(boot.ok, 'bootstrap');
  const marketplace = createMarketplacePorts({ db: boot.db });
  const owner = actor('owner-o');
  const stranger = actor('stranger-x');

  const createdA = marketplace.createItem(owner, { type: 'world', title: 'Alpha World', description: 'first desc', data: { biome: 'forest' }, price: 0, tags: ['alpha'] });
  assert(createdA.ok, `create A ${createdA.error||''}`);
  const author = createdA.value.authorId ?? createdA.value.author_id;
  assert(author === owner.actorId, 'author from actor');

  const createdB = marketplace.createItem(owner, { type: 'item', title: 'Beta Blade', description: 'sharp %_literal', data: { dmg: 3 }, price: 5 });
  assert(createdB.ok, 'create B');

  const incA = marketplace.incrementDownloads(owner, createdA.value.id);
  assert(incA.ok && incA.mutated === true && incA.downloads === 1, 'increment A');
  marketplace.incrementDownloads(owner, createdA.value.id);
  marketplace.incrementDownloads(owner, createdB.value.id);

  // Support both port shapes: listItems(filters) OR listItems(actor, filters)
  const list = (filters) => {
    const r = marketplace.listItems.length >= 2 ? marketplace.listItems(null, filters) : marketplace.listItems(filters);
    return r;
  };
  const get = (id) => {
    if (typeof marketplace.getItemById === 'function') return marketplace.getItemById(id);
    return marketplace.getItem(null, id);
  };
  const featured = () => {
    if (marketplace.listFeatured.length >= 1) {
      try { return marketplace.listFeatured(null); } catch { return marketplace.listFeatured(); }
    }
    return marketplace.listFeatured();
  };

  const listedDefault = list();
  assert(listedDefault.ok && listedDefault.value.length === 2, 'list all');
  assert(listedDefault.value[0].id === createdA.value.id, 'sort downloads desc');
  assert(list({ type: 'item' }).value.length === 1, 'type filter');
  assert(list({ maxPrice: 0 }).value.length === 1, 'maxPrice');
  assert(list({ searchQuery: 'Beta' }).value.length === 1, 'search');

  const feat = featured();
  assert(feat.ok && feat.value.length === 2, 'featured');

  assert(get('does-not-exist').value === null, 'missing');
  const bad = get('  ');
  assert(!bad.ok, 'empty id');

  assert(!marketplace.incrementDownloads({ kind:'remote-account', actorId:'', sessionId:'x', email:null }, createdA.value.id).ok, 'inc deny');
  assert(marketplace.incrementDownloads(owner, 'missing-item-id').mutated === false, 'unknown noop');
  assert(get(createdA.value.id).value.downloads === 2, 'reload');

  const privileged = marketplace.createItem(owner, { type: 'item', title: 'Evil', data: {}, author_id: 'attacker' });
  assert(!privileged.ok, 'no client author');

  const foreignUpdate = marketplace.updateItem(stranger, createdA.value.id, { title: 'Hijacked' });
  assert(!foreignUpdate.ok && foreignUpdate.error === 'not-authorized', 'foreign update');
  const foreignDelete = marketplace.deleteItem(stranger, createdA.value.id);
  const foreignDeleteDenied = foreignDelete === false || (foreignDelete && foreignDelete.ok === false);
  assert(foreignDeleteDenied, 'foreign delete');

  assert(marketplace.updateItem(owner, createdA.value.id, { title: 'Alpha Renamed' }).ok, 'owner update');
  const ownerDelete = marketplace.deleteItem(owner, createdB.value.id);
  const ownerDeleteOk = ownerDelete === true || (ownerDelete && ownerDelete.ok === true);
  assert(ownerDeleteOk, 'owner delete');
  assert(get(createdB.value.id).value === null, 'gone');

  const feService = readFileSync(join(root, 'src/infrastructure/marketplace/marketplace-service.ts'), 'utf8');
  assert(/increment_marketplace_downloads/.test(feService), 'FE RPC');
  assert(!/\.update\(\s*\{[^}]*downloads/.test(feService), 'no client counter write');

  const lit = marketplace.createItem(owner, { type: 'character', title: 'Percent % underscore _', description: 'needle %_literal here', data: {} });
  assert(lit.ok, 'literal create');
  assert(list({ searchQuery: '%_literal' }).value.some((r) => r.id === lit.value.id), 'escaped search');
  const catalogSrc = readFileSync(join(root, 'server/src/modules/marketplace/internal/marketplace-catalog-store.ts'), 'utf8');
  assert(/LIKE \? ESCAPE/.test(catalogSrc), 'ESCAPE');

  // Dual-path: bind to whatever FE contract currently exports
  const ports = {
    listItems: async (...args) => list(args.length === 1 ? args[0] : args[1]),
    getItemById: async (id) => get(id),
    getItem: async (_a, id) => get(id),
    listFeatured: async (...args) => featured(),
    listByAuthor: async (...args) => {
      const authorId = args.length === 1 ? args[0] : args[1];
      return marketplace.listByAuthor.length >= 2
        ? marketplace.listByAuthor(null, authorId)
        : marketplace.listByAuthor(authorId);
    },
    createItem: async (actorId, draft) => marketplace.createItem(actor(actorId), draft),
    updateItem: async (actorId, id, patch) => marketplace.updateItem(actor(actorId), id, patch),
    deleteItem: async (actorId, id) => {
      const r = marketplace.deleteItem(actor(actorId), id);
      if (typeof r === 'boolean') return { ok: true, value: r };
      return r;
    },
    incrementDownloads: async (actorId, id) => marketplace.incrementDownloads(actor(actorId), id),
  };
  const bound = createHostMarketplaceAdapter(ports);
  assert(bound.transport === 'host', 'transport');
  const via = await bound.createItem(owner.actorId, { type: 'ruleset', title: 'Adapter Rules', data: { v: 1 } });
  assert(via.ok, 'adapter create');
  assert((await bound.incrementDownloads(owner.actorId, via.value.id)).ok, 'adapter inc');

  const hostWork = mkdtempSync(join(tmpdir(), 'mig305-host-'));
  try {
    const host = createHost({ SAGATREE_DATA_DIR: hostWork, SAGATREE_PORT: '18769', SAGATREE_HOST: '127.0.0.1', SAGATREE_HOST_MODE: 'solo' });
    assert(!('error' in host), 'createHost');
    assert(host.marketplace?.moduleId === 'marketplace', 'host marketplace');
  } finally { rmSync(hostWork, { recursive: true, force: true }); }

  assert(/from '\.\.\/\.\.\/lib\/supabase'/.test(feService), 'supabase default');
  assert(/createHostMarketplaceAdapter/.test(readFileSync(join(root, 'src/infrastructure/marketplace/index.ts'), 'utf8')), 'barrel');
  assert(!/marketplace-items|mountMarketplace|marketplaceRoutes/i.test(readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8')), 'no HTTP mount');

  for (const rel of [
    'server/src/modules/marketplace/index.ts',
    'server/src/modules/marketplace/internal/marketplace-catalog-store.ts',
    'src/infrastructure/marketplace/host-marketplace-adapter.ts',
    'src/infrastructure/marketplace/host-marketplace-ports.contract.ts',
  ]) {
    assert(!/\bas any\b|\bas unknown as\b|@ts-ignore|@ts-expect-error/.test(readFileSync(join(root, rel), 'utf8')), `typed-strict ${rel}`);
  }
  console.log('PASS mig-305-marketplace-adapter.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(adapterLoadDir, { recursive: true, force: true });
}
