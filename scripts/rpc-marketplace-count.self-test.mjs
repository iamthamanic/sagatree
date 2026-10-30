#!/usr/bin/env node
/**
 * rpc-marketplace-count.self-test — increment_marketplace_downloads (#878).
 * Location: scripts/rpc-marketplace-count.self-test.mjs
 *
 * Acceptance tier: isolated-contract. Host succeeds optional SQL scripts;
 * FE has no client counter write fallback (#675).
 */
import { readFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
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
  return {
    kind: 'remote-account',
    actorId: id,
    sessionId: `auth-${id}`,
    email: null,
    linkedSoloActorIds: [],
  };
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const marketplaceUrl = pathToFileURL(join(root, 'server/src/modules/marketplace/index.ts')).href;
const cmdUrl = pathToFileURL(
  join(root, 'server/src/application/commands/increment_marketplace_downloads.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const {
  createMarketplaceCountPorts,
  MARKETPLACE_COUNT_HOST_SUCCEEDS_OPTIONAL_SQL,
  MARKETPLACE_COUNT_PUBLIC_ACTIVATION_AUTHORIZED,
  MARKETPLACE_MAP_IS_DURABLE_MARKETPLACE_ITEMS,
  MARKETPLACE_PUBLIC_ACTIVATION_AUTHORIZED,
} = await import(marketplaceUrl);
const { increment_marketplace_downloads } = await import(cmdUrl);

const work = mkdtempSync(join(tmpdir(), 'rpc-mkt-count-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  // RT1 — deployment decision: host succeeds optional SQL install scripts
  assert(
    MARKETPLACE_COUNT_HOST_SUCCEEDS_OPTIONAL_SQL === true,
    'host succeeds optional marketplace SQL',
  );
  assert(
    MARKETPLACE_COUNT_PUBLIC_ACTIVATION_AUTHORIZED === false,
    'no public HTTP activation for count',
  );
  assert(
    MARKETPLACE_MAP_IS_DURABLE_MARKETPLACE_ITEMS === false,
    'quarantine Map is not durable items',
  );
  assert(MARKETPLACE_PUBLIC_ACTIVATION_AUTHORIZED === false, 'quarantine stays unmounted');

  const addSql = readFileSync(join(root, 'src/supabase/add_marketplace_rpc.sql'), 'utf8');
  const deploySql = readFileSync(join(root, 'src/supabase/deploy_marketplace.sql'), 'utf8');
  assert(addSql.includes('increment_marketplace_downloads'), 'add script has RPC');
  assert(deploySql.includes('increment_marketplace_downloads'), 'deploy script has RPC');
  // Optional scripts are outside server/migrations — documented dual install sources
  const migChain = readFileSync(join(root, 'server/migrations/0029_marketplace_items.sql'), 'utf8');
  assert(migChain.includes('marketplace_items'), 'host migration installs durable table');

  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 29, `schema>=29 got ${boot.schemaVersion}`);

  const ports = createMarketplaceCountPorts(boot.db);
  const increment = increment_marketplace_downloads(ports);

  const GM = actor('author-a');
  const Player = actor('player-b');
  const itemId = '11111111-1111-4111-8111-111111111111';

  ports.insertItemForTests({
    id: itemId,
    authorId: GM.actorId,
    title: 'Counted item',
    downloads: 0,
  });
  assert(ports.readDownloadsForTests(itemId) === 0, 'seed downloads 0');

  // RT2 — existing item +1 atomic; unknown no-op
  const r1 = increment(Player, itemId);
  assert(r1.ok === true && r1.mutated === true && r1.downloads === 1, `inc1 ${JSON.stringify(r1)}`);
  const r2 = increment(Player, itemId);
  assert(r2.ok === true && r2.downloads === 2, `inc2 ${JSON.stringify(r2)}`);
  // Non-author may increment (legacy: no actor/author check beyond authenticated)
  assert(ports.readDownloadsForTests(itemId) === 2, 'counter persisted');

  const missing = increment(Player, '00000000-0000-4000-8000-000000000000');
  assert(
    missing.ok === true && missing.mutated === false && missing.downloads === null,
    `unknown no-op ${JSON.stringify(missing)}`,
  );

  // Empty item id → typed error
  const empty = increment(Player, '  ');
  assert(empty.ok === false && empty.error === '22023', `empty id ${JSON.stringify(empty)}`);

  // RT3 — ACL legacy decisions explicit: authenticated ok; unauthenticated DENY
  // Host requires verified Actor (not PUBLIC/anon SQL EXECUTE). Solo/remote both ok.
  const solo = { kind: 'solo-local', actorId: 'solo-1' };
  const soloInc = increment(solo, itemId);
  assert(soloInc.ok === true && soloInc.downloads === 3, `solo inc ${JSON.stringify(soloInc)}`);

  const deny = ports.incrementDownloads(
    /** @type {any} */ ({ kind: 'remote-account', actorId: '', sessionId: 'x', email: null }),
    itemId,
  );
  assert(deny.ok === false && deny.error === '42501', `empty actor DENY ${JSON.stringify(deny)}`);

  // RT4 — FE has no client write fallback (#675)
  const fe = readFileSync(join(root, 'src/infrastructure/marketplace/marketplace-service.ts'), 'utf8');
  assert(fe.includes('increment_marketplace_downloads'), 'FE calls RPC');
  assert(
    fe.includes('no client counter write') || fe.includes('no client write fallback'),
    'FE documents no client counter write',
  );
  assert(!/from\(['"]marketplace_items['"]\)[\s\S]{0,200}downloads/.test(fe.split('incrementDownloads')[1] ?? ''), 'incrementDownloads path does not UPDATE marketplace_items');

  // RT5/6/7 — legacy defects documented as regressions, not silently treated as secure
  const contract = readFileSync(
    join(root, '.qa/intake/rpc-contracts/increment_marketplace_downloads.md'),
    'utf8',
  );
  assert(contract.includes('RPC-DEPLOY-OPTIONAL-MARKETPLACE'), 'deploy optional finding retained');
  assert(contract.includes('RPC-ACL-MARKETPLACE-DEFINER'), 'ACL definer finding retained');
  assert(
    !migChain.toLowerCase().includes('security definer'),
    'host path is not SECURITY DEFINER SQL',
  );

  console.log('PASS: rpc-marketplace-count.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
