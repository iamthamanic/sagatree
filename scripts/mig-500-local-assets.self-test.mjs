#!/usr/bin/env node
/**
 * mig-500-local-assets.self-test — policy-gated local assets + traversal hardening.
 * Location: scripts/mig-500-local-assets.self-test.mjs
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, existsSync, readFileSync } from 'node:fs';
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
const assetsUrl = pathToFileURL(join(root, 'server/src/assets/index.ts')).href;
const boundaryUrl = pathToFileURL(join(root, 'scripts/architecture-boundary-check.mjs')).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createAssetPorts } = await import(assetsUrl);

const work = mkdtempSync(join(tmpdir(), 'mig500-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  const db = boot.db;

  const permissions = createPermissionsPorts(db);
  const assets = createAssetPorts({
    dataDir,
    db,
    authorize: permissions.authorize,
  });

  const O = { kind: 'solo-local', actorId: 'owner-o' };
  const X = { kind: 'solo-local', actorId: 'stranger-x' };
  const payload = new TextEncoder().encode('saga-tree-asset-bytes-v1');
  const expectedChecksum = createHash('sha256').update(payload).digest('hex');

  // Fall 1 — owner publish + read OK
  const published = assets.publish(O, { bytes: payload, contentType: 'text/plain' });
  assert(published.ok, `publish: ${published.ok ? '' : published.error}`);
  assert(published.value.checksumSha256 === expectedChecksum, 'checksum matches');
  assert(typeof published.value.assetId === 'string' && published.value.assetId.length > 0, 'assetId');

  const got = assets.get(O, published.value.assetId);
  assert(got.ok, `owner get: ${got.ok ? '' : got.error}`);
  assert(got.value.checksumSha256 === expectedChecksum, 'read checksum');
  assert(Buffer.from(got.value.bytes).equals(Buffer.from(payload)), 'bytes round-trip');

  // Fall 2 — stranger denied (no payload leak)
  const denied = assets.get(X, published.value.assetId);
  assert(!denied.ok, 'stranger must fail');
  assert(denied.error === 'not-authorized', `stranger error got ${denied.error}`);
  assert(!('value' in denied && denied.value), 'no asset payload on deny');

  // Path traversal denied — caller-relative paths never resolve outside assets root
  const outside = join(work, 'outside-secret.txt');
  writeFileSync(outside, 'secret-outside\n', 'utf8');

  for (const bad of ['../outside-secret.txt', '..\\outside-secret.txt', '/etc/passwd', 'assets/../../outside-secret.txt']) {
    const trav = assets.tryResolveCallerPath(bad);
    assert(!trav.ok && trav.error === 'path-traversal-denied', `traversal denied for ${bad}`);
  }

  const badId = assets.get(O, '../outside-secret.txt');
  assert(!badId.ok, 'traversal-shaped assetId denied');

  // Symlink escape: link inside assets root pointing outside — resolve must deny
  const assetsRoot = join(dataDir, 'assets');
  const linkName = 'escape-link';
  try {
    symlinkSync(outside, join(assetsRoot, linkName));
    const viaLink = assets.tryResolveCallerPath(linkName);
    assert(!viaLink.ok && viaLink.error === 'path-traversal-denied', 'symlink escape denied');
  } catch (err) {
    // Some CI sandboxes forbid symlinks — still pass if we couldn't create one.
    if (err && (err.code === 'EPERM' || err.code === 'EACCES')) {
      console.log('NOTE: symlink test skipped (OS denied symlink)');
    } else {
      throw err;
    }
  }

  // Fall 3 — durable after reopen (metadata + checksum)
  db.close();
  const boot2 = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot2.ok, 'rebootstrap');
  const assets2 = createAssetPorts({
    dataDir,
    db: boot2.db,
    authorize: createPermissionsPorts(boot2.db).authorize,
  });
  const again = assets2.get(O, published.value.assetId);
  assert(again.ok && again.value.checksumSha256 === expectedChecksum, 'durable after reopen');
  assert(Buffer.from(again.value.bytes).equals(Buffer.from(payload)), 'bytes durable');
  assert(!assets2.get(X, published.value.assetId).ok, 'stranger still denied after reopen');
  boot2.db.close();

  // Unpublished / incomplete must not be readable: insert unpublished row without bytes
  const boot3 = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot3.ok, 'boot3');
  boot3.db
    .prepare(
      `INSERT INTO assets (id, owner_user_id, content_type, byte_size, checksum_sha256, storage_key, published, created_at)
       VALUES ('incomplete01', 'owner-o', 'text/plain', 0, '00', 'incomplete01', 0, '2026-10-22T00:00:00.000Z')`,
    )
    .run();
  const assets3 = createAssetPorts({
    dataDir,
    db: boot3.db,
    authorize: createPermissionsPorts(boot3.db).authorize,
  });
  assert(!assets3.get(O, 'incomplete01').ok, 'unpublished not visible');
  boot3.db.close();

  // Boundary: assets public barrel must not be flagged for private cross-module imports
  const { checkRegisteredHostPackages } = await import(boundaryUrl);
  const violations = checkRegisteredHostPackages(root).filter(
    (v) =>
      String(v.file).includes('src/assets') ||
      String(v.rule).includes('assets/internal') ||
      String(v.file).includes('0002_local_assets'),
  );
  assert(violations.length === 0, `boundary: ${JSON.stringify(violations)}`);

  // Ownership registry includes assets → media
  const ownership = readFileSync(join(root, 'server/src/persistence/table-ownership.ts'), 'utf8');
  assert(ownership.includes("assets: 'media'"), 'table ownership assets→media');

  assert(existsSync(join(dataDir, 'assets')), 'assets dir under dataDir');

  console.log('PASS: mig-500 local protected assets (policy + atomic publish + traversal)');
} finally {
  rmSync(work, { recursive: true, force: true });
}
