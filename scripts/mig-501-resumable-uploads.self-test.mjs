#!/usr/bin/env node
/**
 * mig-501-resumable-uploads.self-test — optional tus-style uploads → MIG-500 publish (#842).
 * Location: scripts/mig-501-resumable-uploads.self-test.mjs
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
  assert(boot.schemaVersion >= 9, `schemaVersion>=9 got ${boot.schemaVersion}`);
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

  // --- #938: lost final response → retry returns same asset, no duplicate ---
  const body938 = new TextEncoder().encode('finalize-retry-idempotent-body');
  const c938 = uploadsOn.create(O, {
    uploadLength: body938.byteLength,
    contentType: 'text/plain',
  });
  assert(c938.ok, '938 create');
  const firstFinalize = uploadsOn.patch(O, {
    uploadId: c938.value.uploadId,
    offset: 0,
    bytes: body938,
  });
  assert(firstFinalize.ok && firstFinalize.value.complete, `938 first finalize: ${firstFinalize.ok ? '' : firstFinalize.error}`);
  const assetId938 = firstFinalize.value.asset.assetId;

  // Client lost response: HEAD then re-PATCH last chunk (same offset 0) or empty finalize.
  const head938 = uploadsOn.head(O, c938.value.uploadId);
  assert(head938.ok && head938.value.complete === true, '938 head complete after finalize');
  assert(head938.value.assetId === assetId938, '938 head exposes assetId');

  const retryLastChunk = uploadsOn.patch(O, {
    uploadId: c938.value.uploadId,
    offset: 0,
    bytes: body938,
  });
  assert(retryLastChunk.ok && retryLastChunk.value.complete, `938 retry last chunk: ${retryLastChunk.ok ? '' : retryLastChunk.error}`);
  assert(retryLastChunk.value.asset.assetId === assetId938, '938 retry same asset id');

  const emptyFinalize = uploadsOn.patch(O, {
    uploadId: c938.value.uploadId,
    offset: body938.byteLength,
    bytes: new Uint8Array(0),
  });
  assert(emptyFinalize.ok && emptyFinalize.value.asset.assetId === assetId938, '938 empty finalize retry');

  // Foreign actor cannot head/retry finalized session
  const foreignHead = uploadsOn.head(X, c938.value.uploadId);
  assert(!foreignHead.ok && foreignHead.error === 'not-authorized', '938 foreign head denied');

  // Crash between publish and markFinalized: session full + pending id + published
  // asset, but finalized_asset_id still NULL and staging file restored.
  const bodyCrash = new TextEncoder().encode('crash-between-publish-and-mark');
  const cCrash = uploadsOn.create(O, {
    uploadLength: bodyCrash.byteLength,
    contentType: 'text/plain',
  });
  assert(cCrash.ok, 'crash create');
  const crashPatch = uploadsOn.patch(O, {
    uploadId: cCrash.value.uploadId,
    offset: 0,
    bytes: bodyCrash,
  });
  assert(crashPatch.ok && crashPatch.value.complete, 'crash initial finalize');
  const crashAssetId = crashPatch.value.asset.assetId;
  const sessionRow = db
    .prepare(`SELECT storage_key, pending_asset_id FROM asset_upload_sessions WHERE id = ?`)
    .get(cCrash.value.uploadId);
  assert(sessionRow.pending_asset_id === crashAssetId, 'pending bound before finalize');
  db.prepare(`UPDATE asset_upload_sessions SET finalized_asset_id = NULL WHERE id = ?`).run(
    cCrash.value.uploadId,
  );
  // Restage bytes as if markFinalized never deleted the upload file.
  const stagePath = join(dataDir, 'assets', '.uploads', sessionRow.storage_key);
  writeFileSync(stagePath, bodyCrash);
  const afterCrash = uploadsOn.patch(O, {
    uploadId: cCrash.value.uploadId,
    offset: bodyCrash.byteLength,
    bytes: new Uint8Array(0),
  });
  assert(afterCrash.ok && afterCrash.value.asset.assetId === crashAssetId, `crash retry: ${afterCrash.ok ? afterCrash.value.asset.assetId : afterCrash.error}`);
  const publishedCount = db
    .prepare(`SELECT COUNT(*) AS n FROM assets WHERE owner_user_id = ? AND checksum_sha256 = ? AND published = 1`)
    .get(O.actorId, crashPatch.value.asset.checksumSha256);
  assert(publishedCount.n === 1, `exactly one published asset for crash payload, got ${publishedCount.n}`);

  db.close();
  console.log('PASS mig-501-resumable-uploads.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
