#!/usr/bin/env node
/**
 * mig-012-world-read-port.self-test — policy-guarded world read port + SQLite adapter.
 * Location: scripts/mig-012-world-read-port.self-test.mjs
 */
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
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
const permissionsUrl = pathToFileURL(join(root, 'server/src/modules/permissions/index.ts')).href;
const worldUrl = pathToFileURL(join(root, 'server/src/modules/world/index.ts')).href;
const storeUrl = pathToFileURL(join(root, 'server/src/repositories/world/sqlite-world-read-store.ts')).href;
const boundaryUrl = pathToFileURL(join(root, 'scripts/architecture-boundary-check.mjs')).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createWorldPorts } = await import(worldUrl);
const { createSqliteWorldReadStore } = await import(storeUrl);

const work = mkdtempSync(join(tmpdir(), 'mig012-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  const db = boot.db;

  db.exec(`
    INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES
      ('world-o', 'owner-o', 'Owner World', '2026-10-22T12:00:00.000Z'),
      ('world-o2', 'owner-o', 'Second World', '2026-10-22T11:00:00.000Z'),
      ('world-x', 'stranger-x', 'Other World', '2026-10-22T10:00:00.000Z');
  `);

  const permissions = createPermissionsPorts(db);
  const world = createWorldPorts({
    authorize: permissions.authorize,
    store: createSqliteWorldReadStore(db),
  });

  const O = { kind: 'solo-local', actorId: 'owner-o' };
  const X = { kind: 'solo-local', actorId: 'stranger-x' };

  // Fall 1 — authorized list: sort created_at DESC, ids stable, DTO shape only
  const listed = world.read.listOwnedWorlds(O);
  assert(listed.ok, `listOwnedWorlds: ${listed.ok ? '' : listed.error}`);
  assert(listed.value.length === 2, `owner list length ${listed.value.length}`);
  assert(listed.value[0].id === 'world-o' && listed.value[1].id === 'world-o2', 'sort created_at DESC');
  assert(!('ownerUserId' in listed.value[0]), 'DTO must not expose ownerUserId');
  assert(!('owner_user_id' in listed.value[0]), 'DTO must not expose owner_user_id');

  const got = world.read.getWorld(O, 'world-o');
  assert(got.ok && got.value.title === 'Owner World', 'owner getWorld');

  // Fall 2 — stranger must not see O's world; empty filter no widen
  const denied = world.read.getWorld(X, 'world-o');
  assert(!denied.ok, 'stranger getWorld must fail');
  assert(denied.error === 'not-authorized', `stranger error got ${denied.error}`);
  assert(!('value' in denied && denied.value), 'no world payload on deny');

  const emptyId = world.read.getWorld(O, '  ');
  assert(!emptyId.ok && emptyId.error === 'missing-world', 'empty worldId no widen');

  const xList = world.read.listOwnedWorlds(X);
  assert(xList.ok && xList.value.length === 1 && xList.value[0].id === 'world-x', 'X only own worlds');

  // Fall 3 — durable after reopen
  db.close();
  const boot2 = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot2.ok, 'rebootstrap');
  const world2 = createWorldPorts({
    authorize: createPermissionsPorts(boot2.db).authorize,
    store: createSqliteWorldReadStore(boot2.db),
  });
  const again = world2.read.getWorld(O, 'world-o');
  assert(again.ok && again.value.title === 'Owner World', 'durable read after reopen');
  boot2.db.close();

  // Fall 4 — no private cross-module imports from public barrels / application samples
  const { checkRegisteredHostPackages } = await import(boundaryUrl);
  const violations = checkRegisteredHostPackages(root).filter(
    (v) =>
      String(v.file).includes('modules/world') ||
      String(v.file).includes('repositories/world') ||
      String(v.rule).includes('world/internal') ||
      String(v.rule).includes('world/persistence'),
  );
  assert(violations.length === 0, `boundary: ${JSON.stringify(violations)}`);

  // Contract file exists for frontend consumers (DTO-only, no server import)
  const contract = readFileSync(join(root, 'src/infrastructure/world/host-world-read.contract.ts'), 'utf8');
  assert(!/from ['"].*server\//.test(contract), 'infra contract must not import server/');
  assert(contract.includes('HostWorldReadDto'), 'infra contract exports HostWorldReadDto');

  console.log('PASS: mig-012 world read port (policy + SQLite adapter)');
} finally {
  rmSync(work, { recursive: true, force: true });
}
