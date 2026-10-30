#!/usr/bin/env node
/**
 * gate-01-drizzle-host-persistence.self-test — Drizzle runtime path + parity (#1043).
 * Location: scripts/gate-01-drizzle-host-persistence.self-test.mjs
 */
import { mkdtempSync, rmSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
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

const drizzlePkgPathCandidates = [
  join(root, 'server/node_modules/drizzle-orm/package.json'),
  join(root, 'node_modules/drizzle-orm/package.json'),
];
const drizzlePkgPath = drizzlePkgPathCandidates.find((p) => existsSync(p));
assert(drizzlePkgPath, 'drizzle-orm installed under server/ or root node_modules');
const drizzlePkg = JSON.parse(readFileSync(drizzlePkgPath, 'utf8'));
assert(typeof drizzlePkg.version === 'string' && drizzlePkg.version.length > 0, 'drizzle-orm runtime package');
assert(
  !drizzlePkg.version.startsWith('0.0.'),
  `unexpected drizzle stub version ${drizzlePkg.version}`,
);

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const storeUrl = pathToFileURL(join(root, 'server/src/repositories/world/sqlite-world-read-store.ts')).href;
const writeUrl = pathToFileURL(
  join(root, 'server/src/modules/world/internal/world-write-store.ts'),
).href;
const permissionsUrl = pathToFileURL(join(root, 'server/src/modules/permissions/index.ts')).href;
const worldUrl = pathToFileURL(join(root, 'server/src/modules/world/index.ts')).href;

const { bootstrapHostPersistence, isHostDatabase, unwrapSqliteClient } = await import(persistenceUrl);
const { createSqliteWorldReadStore } = await import(storeUrl);
const { createSqliteWorldWriteStore } = await import(writeUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createWorldPorts } = await import(worldUrl);

const work = mkdtempSync(join(tmpdir(), 'gate01-drizzle-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(isHostDatabase(boot.db), 'bootstrap returns HostDatabase (Drizzle wrapper)');
  assert(boot.db.orm && boot.db.$client, 'orm + $client present');
  assert(unwrapSqliteClient(boot.db) === boot.db.$client, 'unwrapSqliteClient');

  const write = createSqliteWorldWriteStore(boot.db);
  write.insertOwned({
    id: 'world-o',
    ownerUserId: 'owner-o',
    title: 'Owner World',
    createdAt: '2026-10-22T12:00:00.000Z',
  });
  write.insertOwned({
    id: 'world-o2',
    ownerUserId: 'owner-o',
    title: 'Second World',
    createdAt: '2026-10-22T11:00:00.000Z',
  });
  write.insertOwned({
    id: 'world-x',
    ownerUserId: 'stranger-x',
    title: 'Other World',
    createdAt: '2026-10-22T10:00:00.000Z',
  });

  // prepare-bridge path (same semantic as legacy stores)
  const bridged = boot.db
    .prepare(`SELECT id FROM worlds WHERE owner_user_id = ? ORDER BY created_at DESC, id ASC`)
    .all('owner-o');
  assert(bridged.length === 2 && bridged[0].id === 'world-o', 'prepare bridge select');

  const changed = write.updateOwnedTitle({
    id: 'world-o',
    ownerUserIds: ['owner-o'],
    title: 'Renamed',
  });
  assert(changed === 1, 'query-builder update changes');

  const store = createSqliteWorldReadStore(boot.db);
  const found = store.findById('world-o');
  assert(found && found.title === 'Renamed', 'query-builder read after update');

  const permissions = createPermissionsPorts(boot.db);
  const world = createWorldPorts({
    authorize: permissions.authorize,
    store,
    writeStore: write,
  });
  const O = { kind: 'solo-local', actorId: 'owner-o' };
  const X = { kind: 'solo-local', actorId: 'stranger-x' };
  const listed = world.read.listOwnedWorlds(O);
  assert(listed.ok && listed.value[0].title === 'Renamed', 'policy list via drizzle adapters');
  const denied = world.read.getWorld(X, 'world-o');
  assert(!denied.ok && denied.error === 'not-authorized', 'stranger deny');

  // GATE-04 busy helper still works with wrapper
  boot.db.exec('BEGIN IMMEDIATE');
  boot.db.exec('COMMIT');

  // Durable reopen
  boot.db.close();
  const boot2 = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot2.ok, 'rebootstrap');
  const again = createSqliteWorldReadStore(boot2.db).findById('world-o');
  assert(again && again.title === 'Renamed', 'durable after reopen');
  boot2.db.close();

  // Exceptions doc present
  const exceptions = readFileSync(
    join(root, 'docs/architecture/gate-01-drizzle-host-exceptions.md'),
    'utf8',
  );
  assert(exceptions.includes('open-database.ts'), 'exceptions inventory documents open-database');
  assert(exceptions.includes('migration-runner.ts'), 'exceptions inventory documents migration-runner');

  console.log(`PASS gate-01-drizzle-host-persistence (drizzle-orm@${drizzlePkg.version})`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
