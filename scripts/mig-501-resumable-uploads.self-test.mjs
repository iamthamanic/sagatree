#!/usr/bin/env node
/**
 * mig-501-resumable-uploads.self-test — optional tus-style uploads → MIG-500 publish (#842).
 * Location: scripts/mig-501-resumable-uploads.self-test.mjs
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
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
const uploadsUrl = pathToFileURL(join(root, 'server/src/assets/uploads/index.ts')).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createAssetPorts } = await import(assetsUrl);
const { createResumableUploadPorts } = await import(uploadsUrl);

const work = mkdtempSync(join(tmpdir(), 'mig501-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 6, `schemaVersion>=6 got ${boot.schemaVersion}`);
  const db = boot.db;
  const permissions = createPermissionsPorts(db);
  const assets = createAssetPorts({
    dataDir,
    db,
    authorize: permissions.authorize,
  });
  const uploadsOn = createResumableUploadPorts({
    dataDir,
    db,
    authorize: permissions.authorize,
    assets,
    enabled: true,
  });
  const uploadsOff = createResumableUploadPorts({
    dataDir,
    db,
    authorize: permissions.authorize,
    assets,
    enabled: false,
  });

  const O = { kind: 'solo-local', actorId: 'owner-o' };
  const X = { kind: 'solo-local', actorId: 'stranger-x' };

  // --- Fall 1: resume at confirmed offset → one published asset + checksum ---
  const part1 = new TextEncoder().encode('saga-tree-upload-part-A-');
  const part2 = new TextEncoder().encode('and-resumed-part-B-ok');
  const full = new Uint8Array(part1.length + part2.length);
  full.set(part1, 0);
  full.set(part2, part1.length);
  const expectedChecksum = createHash('sha256').update(full).digest('hex');

  const created = uploadsOn.create(O, {
    uploadLength: full.byteLength,
    contentType: 'text/plain',
  });
  assert(created.ok, `create: ${created.ok ? '' : created.error}`);
  assert(created.value.offset === 0, 'create offset 0');

  const mid = uploadsOn.patch(O, {
    uploadId: created.value.uploadId,
    offset: 0,
    bytes: part1,
  });
  assert(mid.ok && mid.value.complete === false, `mid patch: ${mid.ok ? JSON.stringify(mid.value) : mid.error}`);
  assert(mid.value.offset === part1.length, 'mid offset');

  // Simulate reconnect: HEAD then resume
  const head = uploadsOn.head(O, created.value.uploadId);
  assert(head.ok && head.value.offset === part1.length, 'head after interrupt');

  const done = uploadsOn.patch(O, {
    uploadId: created.value.uploadId,
    offset: head.value.offset,
    bytes: part2,
  });
  assert(done.ok && done.value.complete === true, `finalize: ${done.ok ? JSON.stringify(done.value) : done.error}`);
  assert(done.value.asset, 'asset published');
  assert(done.value.asset.checksumSha256 === expectedChecksum, 'checksum via MIG-500');

  const got = assets.get(O, done.value.asset.assetId);
  assert(got.ok, `owner get: ${got.ok ? '' : got.error}`);
  assert(Buffer.from(got.value.bytes).equals(Buffer.from(full)), 'bytes round-trip');

  // --- Fall 2: wrong offset / foreign actor / oversize — no incomplete publish ---
  const created2 = uploadsOn.create(O, { uploadLength: 8, contentType: 'application/octet-stream' });
  assert(created2.ok, 'create2');
  const badOffset = uploadsOn.patch(O, {
    uploadId: created2.value.uploadId,
    offset: 3,
    bytes: new Uint8Array([1, 2]),
  });
  assert(!badOffset.ok && badOffset.error === 'offset-mismatch', `bad offset: ${badOffset.error}`);

  const foreign = uploadsOn.patch(X, {
    uploadId: created2.value.uploadId,
    offset: 0,
    bytes: new Uint8Array([1, 2]),
  });
  assert(!foreign.ok && foreign.error === 'not-authorized', `foreign: ${foreign.error}`);

  const oversize = uploadsOn.create(O, {
    uploadLength: 65 * 1024 * 1024,
    contentType: 'application/octet-stream',
  });
  assert(!oversize.ok && oversize.error === 'bytes-too-large', `oversize create: ${oversize.error}`);

  // Session still incomplete — no asset row for this upload
  const still = uploadsOn.head(O, created2.value.uploadId);
  assert(still.ok && still.value.offset === 0, 'incomplete session unchanged');

  // --- Fall 3: capability off — small publish OK; large create explained deny ---
  const small = new TextEncoder().encode('small-direct-publish');
  const published = assets.publish(O, { bytes: small, contentType: 'text/plain' });
  assert(published.ok, `small publish with uploads off wiring: ${published.ok ? '' : published.error}`);

  const deniedCreate = uploadsOff.create(O, {
    uploadLength: 1024,
    contentType: 'text/plain',
  });
  assert(
    !deniedCreate.ok && deniedCreate.error === 'capability-disabled',
    `capability deny: ${deniedCreate.error}`,
  );
  assert(uploadsOff.largeUploadsEnabled === false, 'flag false');

  db.close();
  console.log('PASS mig-501-resumable-uploads.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
