#!/usr/bin/env node
/**
 * mig-603-host-backup.self-test — SQLite/WAL/asset backup + restore drills (#848).
 * Location: scripts/mig-603-host-backup.self-test.mjs
 *
 * Isolated-contract: exercises scripts/host-backup against a temp host dataDir.
 * Does not touch production data.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createHostSnapshot,
  listPublishedSnapshots,
  restoreHostSnapshot,
  runRollbackDrill,
  verifyDataDirConsistency,
  verifySnapshot,
} from './host-backup/lib.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const { bootstrapHostPersistence } = await import(persistenceUrl);

const work = mkdtempSync(join(tmpdir(), 'mig603-'));
const dataDir = join(work, 'data');
const backupRoot = join(work, 'backups');
const restoreHost = join(work, 'restore-host');
mkdirSync(dataDir);
mkdirSync(backupRoot);
mkdirSync(restoreHost);

const OWNER = 'owner-mig603';
const now = new Date().toISOString();

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  const db = boot.db;

  const worldId = randomUUID();
  const projectId = randomUUID();
  const sessionId = randomUUID().replace(/-/g, '').slice(0, 32);
  const assetId = randomUUID().replace(/-/g, '').slice(0, 24);
  const bytes = Buffer.from('mig603-asset-bytes');
  const checksum = createHash('sha256').update(bytes).digest('hex');

  db.prepare(`INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`).run(
    worldId,
    OWNER,
    'Backup World',
    now,
  );
  db.prepare(
    `INSERT INTO projects (id, world_id, gm_user_id, title, created_at, saga_id) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(projectId, worldId, OWNER, 'Backup Project', now, null);
  db.prepare(
    `INSERT INTO play_sessions (
       session_id, project_id, public_id, join_code, status, created_at,
       session_number, name, notes, world_state, runtime_revision, updated_at
     ) VALUES (?, ?, ?, ?, 'active', ?, 1, 'Backup Session', NULL, '{}', 1, ?)`,
  ).run(sessionId, projectId, `SE-${sessionId.slice(0, 8)}`, `JC${sessionId.slice(0, 6)}`, now, now);
  db.prepare(
    `INSERT INTO session_runtime (session_id, project_id, revision, state_json, updated_at)
     VALUES (?, ?, 1, '{}', ?)`,
  ).run(sessionId, projectId, now);
  db.prepare(
    `INSERT INTO session_events (
       session_id, event_sequence, revision, actor_user_id, idempotency_key, payload_json
     ) VALUES (?, 1, 1, ?, ?, ?)`,
  ).run(sessionId, OWNER, `seed:${sessionId}`, JSON.stringify({ kind: 'seed' }));

  db.prepare(
    `INSERT INTO assets
     (id, owner_user_id, content_type, byte_size, checksum_sha256, storage_key, published, created_at)
     VALUES (?, ?, 'application/octet-stream', ?, ?, ?, 1, ?)`,
  ).run(assetId, OWNER, bytes.byteLength, checksum, assetId, now);

  mkdirSync(join(dataDir, 'assets'), { recursive: true });
  writeFileSync(join(dataDir, 'assets', assetId), bytes);

  db.close();

  // --- Fall 1: snapshot → restore on new host preserves integrity / events / assets ---
  const snap1 = await createHostSnapshot({
    dataDir,
    backupRoot,
    hostVersion: 'mig603-test',
    snapshotId: 'good-v1',
  });
  assert(snap1.ok === true, `create good snapshot: ${snap1.error ?? ''}`);
  assert(existsSync(join(backupRoot, 'good-v1', 'manifest.json')), 'published manifest exists');
  assert(!existsSync(join(backupRoot, '.staging', 'good-v1')), 'staging cleaned after publish');

  const verified = await verifySnapshot(join(backupRoot, 'good-v1'));
  assert(verified.ok === true, `verify snapshot: ${verified.error ?? ''}`);
  assert(verified.manifest.schemaVersion >= 1, 'schema version recorded');
  assert(
    verified.manifest.eventRevisionLinks.some((l) => l.sessionId === sessionId),
    'event/revision link recorded',
  );

  const restored = await restoreHostSnapshot({
    snapshotPath: join(backupRoot, 'good-v1'),
    targetDataDir: restoreHost,
  });
  assert(restored.ok === true, `restore: ${restored.error ?? ''}`);
  const restoredOk = verifyDataDirConsistency(restoreHost);
  assert(restoredOk.ok === true, `restored consistency: ${restoredOk.error ?? ''}`);
  assert(
    readFileSync(join(restoreHost, 'assets', assetId)).equals(bytes),
    'asset bytes match after restore',
  );

  const { openHostDatabase } = await import(
    pathToFileURL(join(root, 'server/src/persistence/open-database.ts')).href
  );
  const opened = openHostDatabase(join(restoreHost, 'host.sqlite'));
  assert(opened.ok, 'open restored db');
  const world = opened.db
    .prepare(`SELECT title FROM worlds WHERE id = ?`)
    .get(worldId);
  assert(world?.title === 'Backup World', 'world row restored');
  const ev = opened.db
    .prepare(`SELECT event_sequence, revision FROM session_events WHERE session_id = ?`)
    .get(sessionId);
  assert(Number(ev?.event_sequence) === 1 && Number(ev?.revision) === 1, 'event/revision intact');
  const rt = opened.db
    .prepare(`SELECT revision FROM session_runtime WHERE session_id = ?`)
    .get(sessionId);
  assert(Number(rt?.revision) === 1, 'runtime revision intact');
  opened.db.close();

  // --- Fall 2: aborted backup does not publish; last good snapshot remains ---
  const before = listPublishedSnapshots(backupRoot);
  assert(before.includes('good-v1'), 'good-v1 listed before abort');

  const aborted = await createHostSnapshot({
    dataDir,
    backupRoot,
    snapshotId: 'poison-abort',
    failAfterStage: 'assets',
  });
  assert(aborted.ok === false, 'aborted snapshot fails');
  assert(aborted.published === false, 'aborted snapshot not published');
  assert(!existsSync(join(backupRoot, 'poison-abort')), 'poison id not published');
  assert(!existsSync(join(backupRoot, '.staging', 'poison-abort')), 'staging removed on abort');

  const afterAbort = listPublishedSnapshots(backupRoot);
  assert(JSON.stringify(afterAbort) === JSON.stringify(before), 'published set unchanged');
  const stillGood = await verifySnapshot(join(backupRoot, 'good-v1'));
  assert(stillGood.ok === true, 'last good snapshot still verifies');

  const abortedRestore = await restoreHostSnapshot({
    snapshotPath: join(backupRoot, 'good-v1'),
    targetDataDir: restoreHost,
    failBeforePublish: true,
  });
  assert(abortedRestore.ok === false, 'aborted restore fails');
  assert(abortedRestore.published === false, 'aborted restore not published');
  assert(
    verifyDataDirConsistency(restoreHost).ok === true,
    'previous restore host still consistent after abort',
  );

  // --- Fall 3: rollback drill reports duration, write lock, schema, checksums ---
  const drillData = join(work, 'drill-data');
  mkdirSync(drillData);
  // Fresh bootstrap for drill
  const drillBoot = bootstrapHostPersistence({
    dataDir: drillData,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(drillBoot.ok, `drill bootstrap: ${drillBoot.ok ? '' : drillBoot.error}`);
  drillBoot.db
    .prepare(`INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`)
    .run(randomUUID(), OWNER, 'Drill World', now);
  drillBoot.db.close();

  const drill = await runRollbackDrill({
    dataDir: drillData,
    backupRoot: join(work, 'drill-backups'),
    hostVersion: '1.0.0-drill',
    mutate(dir) {
      writeFileSync(join(dir, 'host.sqlite'), Buffer.from('NOT-A-SQLITE-FILE'));
    },
  });
  assert(drill.ok === true, `rollback drill: ${drill.error ?? ''}`);
  assert(typeof drill.report.measuredDurationMs === 'number', 'report has duration');
  assert(typeof drill.report.writeLockHeldMs === 'number', 'report has write lock');
  assert(typeof drill.report.schemaVersion === 'number', 'report has schema version');
  assert(drill.report.hostVersion === '1.0.0-drill', 'report has host version');
  assert(drill.report.fileChecksums['host.sqlite']?.sha256, 'report has restored checksums');
  assert(verifyDataDirConsistency(drillData).ok === true, 'drill data restored consistent');

  // Runbook docs present
  const backupDoc = readFileSync(join(root, 'docs/ops/host/backup-restore.md'), 'utf8');
  const updateDoc = readFileSync(join(root, 'docs/ops/host/update-rollback.md'), 'utf8');
  assert(backupDoc.includes('VACUUM INTO'), 'backup runbook documents VACUUM INTO');
  assert(backupDoc.includes('/backups'), 'backup runbook references backup mount');
  assert(updateDoc.includes('writeLockHeldMs'), 'rollback runbook documents write lock');
  assert(updateDoc.includes('rollback-drill'), 'rollback runbook references drill CLI');

  console.log('mig-603-host-backup.self-test: PASS');
} finally {
  rmSync(work, { recursive: true, force: true });
}
