#!/usr/bin/env node
/**
 * mig-013-policy-service.self-test — deny-by-default matrix + durable SQLite grants.
 * Location: scripts/mig-013-policy-service.self-test.mjs
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
const facadeUrl = pathToFileURL(join(root, 'server/src/permissions/index.ts')).href;
const boundaryUrl = pathToFileURL(join(root, 'scripts/architecture-boundary-check.mjs')).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const facade = await import(facadeUrl);

const work = mkdtempSync(join(tmpdir(), 'mig013-'));
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
    INSERT INTO worlds (id, owner_user_id, title, created_at)
    VALUES ('world-o', 'owner-o', 'Owner World', '2026-10-21T00:00:00.000Z');
    INSERT INTO projects (id, world_id, gm_user_id, title, created_at)
    VALUES ('proj-1', 'world-o', 'gm-g', 'Saga', '2026-10-21T00:00:00.000Z');
    INSERT INTO project_members (project_id, user_id, role, active, joined_at) VALUES
      ('proj-1', 'gm-g', 'gm', 1, '2026-10-21T00:00:00.000Z'),
      ('proj-1', 'player-p1', 'player', 1, '2026-10-21T00:00:00.000Z'),
      ('proj-1', 'player-inactive', 'player', 0, '2026-10-21T00:00:00.000Z');
  `);

  const permissions = createPermissionsPorts(db);
  const O = { kind: 'solo-local', actorId: 'owner-o' };
  const G = { kind: 'solo-local', actorId: 'gm-g' };
  const P1 = { kind: 'solo-local', actorId: 'player-p1' };
  const X = { kind: 'solo-local', actorId: 'stranger-x' };

  assert(permissions.authorize('world.edit', O, { worldId: 'world-o' }).allow, 'O may edit world');
  assert(!permissions.authorize('world.edit', G, { worldId: 'world-o' }).allow, 'G may not edit world');
  assert(permissions.authorize('session.gm', G, { projectId: 'proj-1' }).allow, 'G may session.gm');
  assert(!permissions.authorize('session.gm', O, { projectId: 'proj-1' }).allow, 'O without GM role denied');
  assert(permissions.authorize('player.project.read', P1, { projectId: 'proj-1' }).allow, 'P1 may read');
  assert(permissions.authorize('player.project.read', O, { projectId: 'proj-1' }).allow, 'owner may read');
  assert(!permissions.authorize('player.project.read', X, { projectId: 'proj-1' }).allow, 'stranger denied');

  assert(!permissions.authorize('totally.unknown', O, {}).allow, 'unknown op denied');
  assert(permissions.authorize('world.edit', null, { worldId: 'world-o' }).reason === 'missing-actor', 'missing actor');
  assert(
    !permissions.authorize('player.project.read', { kind: 'solo-local', actorId: 'player-inactive' }, { projectId: 'proj-1' })
      .allow,
    'inactive membership denied',
  );
  assert(!permissions.authorize('world.edit', O, { worldId: 'other-world' }).allow, 'foreign world denied');
  assert(!permissions.authorize('player.project.read', P1, { projectId: '' }).allow, 'empty filter no widen');

  db.close();
  const boot2 = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot2.ok, 're-bootstrap');
  const permissions2 = createPermissionsPorts(boot2.db);
  assert(permissions2.authorize('world.edit', O, { worldId: 'world-o' }).allow, 'persisted after reopen');
  assert(!permissions2.authorize('world.edit', G, { worldId: 'world-o' }).allow, 'deny persisted');
  boot2.db.close();

  assert(typeof facade.createPermissionsPorts === 'function', 'permissions facade');

  const { checkRegisteredHostPackages } = await import(boundaryUrl);
  const violations = checkRegisteredHostPackages(root).filter((v) => String(v.rule).includes('permissions'));
  assert(violations.length === 0, `boundary: ${JSON.stringify(violations)}`);

  const worldIndex = readFileSync(join(root, 'server/src/modules/world/index.ts'), 'utf8');
  assert(!worldIndex.includes('permissions/internal'), 'no private permissions import');

  console.log('PASS: mig-013 policy service deny-by-default');
} finally {
  rmSync(work, { recursive: true, force: true });
}
