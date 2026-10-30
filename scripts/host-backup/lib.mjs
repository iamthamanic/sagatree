/**
 * Host SQLite/WAL/asset snapshot + restore helpers (MIG-603 / #848).
 * Location: scripts/host-backup/lib.mjs
 *
 * Snapshots are staged under <backupRoot>/.staging/<id>, verified, then
 * atomically published to <backupRoot>/<id>. Failed staging never becomes
 * a restore point; the last published snapshot stays usable.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { finished } from 'node:stream/promises';

export const SNAPSHOT_FORMAT_VERSION = 1;
export const HOST_BACKUP_MANIFEST = 'manifest.json';
export const HOST_SQLITE = 'host.sqlite';
export const AUTH_SQLITE = 'auth.sqlite';
export const ASSETS_DIR = 'assets';

/** Single-segment snapshot ids only (no path traversal). */
const SAFE_SNAPSHOT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * @typedef {{
 *   formatVersion: number,
 *   snapshotId: string,
 *   createdAt: string,
 *   hostVersion: string,
 *   schemaVersion: number,
 *   writeLockHeldMs: number,
 *   durationMs: number,
 *   files: Record<string, { sha256: string, bytes: number }>,
 *   assetCount: number,
 *   eventRevisionLinks: Array<{ sessionId: string, maxEventSequence: number, runtimeRevision: number }>,
 * }} SnapshotManifest
 */

/** @param {string} parent @param {string} child */
function isPathInside(parent, child) {
  const root = resolve(parent);
  const target = resolve(child);
  return target === root || target.startsWith(`${root}${sep}`);
}

/** @param {string} snapshotId */
export function isSafeSnapshotId(snapshotId) {
  return SAFE_SNAPSHOT_ID.test(snapshotId);
}

/** Main DB file plus WAL/SHM sidecars. @param {string} baseName */
function sqliteSidecarNames(baseName) {
  return [baseName, `${baseName}-wal`, `${baseName}-shm`];
}

/** @param {string} filePath */
export async function sha256File(filePath) {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  stream.on('data', (chunk) => hash.update(chunk));
  await finished(stream);
  return hash.digest('hex');
}

/** @param {Uint8Array | Buffer | string} data */
export function sha256Bytes(data) {
  return createHash('sha256').update(data).digest('hex');
}

/** @param {string} dir */
function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

/**
 * Copy durable asset files. Skips transient `.tmp` and `.uploads` trees.
 * @param {string} srcDir @param {string} destDir
 */
function copyTree(srcDir, destDir) {
  if (!existsSync(srcDir)) return;
  ensureDir(destDir);
  for (const name of readdirSync(srcDir)) {
    if (name === '.tmp' || name === '.uploads') continue;
    const src = join(srcDir, name);
    const dest = join(destDir, name);
    const st = statSync(src);
    if (st.isDirectory()) {
      copyTree(src, dest);
    } else if (st.isFile()) {
      copyFileSync(src, dest);
    }
  }
}

/**
 * Recursively hash durable files under assets/ into the manifest map.
 * @param {string} assetsRoot
 * @param {Record<string, { sha256: string, bytes: number }>} files
 * @returns {Promise<number>}
 */
async function hashAssetTree(assetsRoot, files) {
  let count = 0;
  /** @param {string} dir @param {string} relPrefix */
  async function walk(dir, relPrefix) {
    for (const name of readdirSync(dir)) {
      if (name === '.tmp' || name === '.uploads') continue;
      const abs = join(dir, name);
      const rel = relPrefix ? `${relPrefix}/${name}` : name;
      const st = statSync(abs);
      if (st.isDirectory()) {
        await walk(abs, rel);
      } else if (st.isFile()) {
        count += 1;
        files[`${ASSETS_DIR}/${rel}`] = {
          sha256: await sha256File(abs),
          bytes: st.size,
        };
      }
    }
  }
  await walk(assetsRoot, '');
  return count;
}

/** @param {string} sqlPath */
function escapeSqlPath(sqlPath) {
  return sqlPath.replace(/'/g, "''");
}

/**
 * Open host.sqlite with WAL + foreign_keys for ops tooling.
 * @param {string} dbPath
 */
function openOpsDb(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys=ON');
  db.exec('PRAGMA busy_timeout=5000');
  return db;
}

/**
 * VACUUM INTO a consistent single-file snapshot (handles WAL).
 * @param {string} sourceDbPath
 * @param {string} destDbPath
 */
function vacuumSqliteInto(sourceDbPath, destDbPath) {
  const db = openOpsDb(sourceDbPath);
  try {
    db.exec('BEGIN IMMEDIATE');
    db.exec('COMMIT');
    try {
      db.exec('PRAGMA wal_checkpoint(PASSIVE)');
    } catch {
      /* non-WAL DBs still vacuum cleanly */
    }
    db.exec(`VACUUM INTO '${escapeSqlPath(destDbPath)}'`);
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Move live SQLite main + WAL/SHM aside (or remove if dest omitted).
 * @param {string} dataDir
 * @param {string} baseName
 * @param {string | null} previousDir
 */
function relocateSqliteLiveFiles(dataDir, baseName, previousDir) {
  for (const name of sqliteSidecarNames(baseName)) {
    const live = join(dataDir, name);
    if (!existsSync(live)) continue;
    if (previousDir) {
      renameSync(live, join(previousDir, name));
    } else {
      rmSync(live, { force: true });
    }
  }
}

/**
 * @param {DatabaseSync} db
 * @returns {number}
 */
function readSchemaVersion(db) {
  const has = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'`)
    .get();
  if (!has) return 0;
  const row = db.prepare(`SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations`).get();
  return Number(row?.version ?? 0);
}

/**
 * @param {DatabaseSync} db
 */
function readEventRevisionLinks(db) {
  const hasEvents = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='session_events'`)
    .get();
  const hasRuntime = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='session_runtime'`)
    .get();
  if (!hasEvents || !hasRuntime) return [];

  const rows = db
    .prepare(
      `SELECT e.session_id AS sessionId,
              COALESCE(MAX(e.event_sequence), 0) AS maxEventSequence,
              COALESCE(r.revision, 0) AS runtimeRevision
       FROM session_events e
       LEFT JOIN session_runtime r ON r.session_id = e.session_id
       GROUP BY e.session_id`,
    )
    .all();
  return rows.map((r) => ({
    sessionId: String(r.sessionId),
    maxEventSequence: Number(r.maxEventSequence),
    runtimeRevision: Number(r.runtimeRevision),
  }));
}

/**
 * Integrity + asset-hash consistency for a data directory.
 * @param {string} dataDir
 */
export function verifyDataDirConsistency(dataDir) {
  const dbPath = join(dataDir, HOST_SQLITE);
  if (!existsSync(dbPath)) {
    return { ok: false, error: 'missing-host-sqlite' };
  }
  let db;
  try {
    db = openOpsDb(dbPath);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'open-failed' };
  }
  try {
    try {
      const ik = db.prepare('PRAGMA integrity_check').get();
      const integrity = ik && typeof ik === 'object' ? Object.values(ik)[0] : null;
      if (integrity !== 'ok') {
        return { ok: false, error: `integrity_check=${String(integrity)}` };
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'integrity-check-failed',
      };
    }

    const hasAssets = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='assets'`)
      .get();
    if (hasAssets) {
      const assets = db
        .prepare(
          `SELECT id, storage_key, checksum_sha256, published FROM assets WHERE published = 1`,
        )
        .all();
      for (const row of assets) {
        const key = String(row.storage_key);
        if (key.includes('..') || key.includes('/') || key.includes('\\')) {
          return { ok: false, error: `unsafe-storage-key:${key}` };
        }
        const filePath = join(dataDir, ASSETS_DIR, key);
        if (!existsSync(filePath)) {
          return { ok: false, error: `missing-asset-bytes:${key}` };
        }
        const bytes = readFileSync(filePath);
        const digest = sha256Bytes(bytes);
        if (digest !== String(row.checksum_sha256)) {
          return { ok: false, error: `asset-checksum-mismatch:${key}` };
        }
      }
    }

    const links = readEventRevisionLinks(db);
    for (const link of links) {
      if (link.maxEventSequence > 0 && link.runtimeRevision < 1) {
        return { ok: false, error: `event-without-runtime:${link.sessionId}` };
      }
    }

    const authPath = join(dataDir, AUTH_SQLITE);
    if (existsSync(authPath)) {
      let authDb;
      try {
        authDb = openOpsDb(authPath);
        const ik = authDb.prepare('PRAGMA integrity_check').get();
        const integrity = ik && typeof ik === 'object' ? Object.values(ik)[0] : null;
        if (integrity !== 'ok') {
          return { ok: false, error: `auth-integrity_check=${String(integrity)}` };
        }
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? `auth-verify:${err.message}` : 'auth-verify-failed',
        };
      } finally {
        try {
          authDb?.close();
        } catch {
          /* ignore */
        }
      }
    }

    return {
      ok: true,
      schemaVersion: readSchemaVersion(db),
      eventRevisionLinks: links,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'verify-failed' };
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Create a published snapshot under backupRoot.
 * `failAfterStage` aborts before publish (test injection only).
 * @param {{
 *   dataDir: string,
 *   backupRoot: string,
 *   hostVersion?: string,
 *   snapshotId?: string,
 *   failAfterStage?: 'sqlite' | 'assets' | 'manifest',
 * }} options
 */
export async function createHostSnapshot(options) {
  const started = Date.now();
  const dataDir = resolve(options.dataDir);
  const backupRoot = resolve(options.backupRoot);
  const snapshotId = options.snapshotId ?? `snap-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  if (!isSafeSnapshotId(snapshotId)) {
    return { ok: false, error: 'unsafe-snapshot-id', snapshotId };
  }
  const hostVersion = options.hostVersion ?? 'dev';
  const stagingRoot = resolve(backupRoot, '.staging', snapshotId);
  const publishedRoot = resolve(backupRoot, snapshotId);
  if (
    !isPathInside(join(backupRoot, '.staging'), stagingRoot) ||
    !isPathInside(backupRoot, publishedRoot) ||
    publishedRoot === backupRoot
  ) {
    return { ok: false, error: 'unsafe-snapshot-id', snapshotId };
  }

  ensureDir(backupRoot);

  if (existsSync(publishedRoot)) {
    return { ok: false, error: 'snapshot-id-exists', snapshotId };
  }

  rmSync(stagingRoot, { recursive: true, force: true });
  ensureDir(stagingRoot);

  const sourceDbPath = join(dataDir, HOST_SQLITE);
  if (!existsSync(sourceDbPath)) {
    rmSync(stagingRoot, { recursive: true, force: true });
    return { ok: false, error: 'missing-host-sqlite', snapshotId };
  }

  let writeLockHeldMs = 0;
  const lockStarted = Date.now();
  try {
    // Serialize writers briefly; VACUUM INTO cannot run inside a transaction.
    vacuumSqliteInto(sourceDbPath, join(stagingRoot, HOST_SQLITE));
    writeLockHeldMs = Math.max(1, Date.now() - lockStarted);
  } catch (err) {
    rmSync(stagingRoot, { recursive: true, force: true });
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'vacuum-failed',
      snapshotId,
      writeLockHeldMs: Date.now() - lockStarted,
    };
  }

  if (options.failAfterStage === 'sqlite') {
    rmSync(stagingRoot, { recursive: true, force: true });
    return {
      ok: false,
      error: 'aborted-after-sqlite',
      snapshotId,
      writeLockHeldMs,
      published: false,
    };
  }

  const authSrc = join(dataDir, AUTH_SQLITE);
  if (existsSync(authSrc)) {
    try {
      vacuumSqliteInto(authSrc, join(stagingRoot, AUTH_SQLITE));
    } catch (err) {
      rmSync(stagingRoot, { recursive: true, force: true });
      return {
        ok: false,
        error: err instanceof Error ? `auth-vacuum:${err.message}` : 'auth-vacuum-failed',
        snapshotId,
        writeLockHeldMs,
        published: false,
      };
    }
  }

  const assetsSrc = join(dataDir, ASSETS_DIR);
  if (existsSync(assetsSrc)) {
    copyTree(assetsSrc, join(stagingRoot, ASSETS_DIR));
  }

  if (options.failAfterStage === 'assets') {
    rmSync(stagingRoot, { recursive: true, force: true });
    return {
      ok: false,
      error: 'aborted-after-assets',
      snapshotId,
      writeLockHeldMs,
      published: false,
    };
  }

  const consistency = verifyDataDirConsistency(stagingRoot);
  if (!consistency.ok) {
    rmSync(stagingRoot, { recursive: true, force: true });
    return {
      ok: false,
      error: `staging-inconsistent:${consistency.error}`,
      snapshotId,
      writeLockHeldMs,
      published: false,
    };
  }

  /** @type {Record<string, { sha256: string, bytes: number }>} */
  const files = {};
  const hostStaged = join(stagingRoot, HOST_SQLITE);
  files[HOST_SQLITE] = {
    sha256: await sha256File(hostStaged),
    bytes: statSync(hostStaged).size,
  };
  const authStaged = join(stagingRoot, AUTH_SQLITE);
  if (existsSync(authStaged)) {
    files[AUTH_SQLITE] = {
      sha256: await sha256File(authStaged),
      bytes: statSync(authStaged).size,
    };
  }

  let assetCount = 0;
  const assetsStaged = join(stagingRoot, ASSETS_DIR);
  if (existsSync(assetsStaged)) {
    assetCount = await hashAssetTree(assetsStaged, files);
  }

  /** @type {SnapshotManifest} */
  const manifest = {
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    snapshotId,
    createdAt: new Date().toISOString(),
    hostVersion,
    schemaVersion: consistency.schemaVersion,
    writeLockHeldMs,
    durationMs: Date.now() - started,
    files,
    assetCount,
    eventRevisionLinks: consistency.eventRevisionLinks,
  };

  writeFileSync(join(stagingRoot, HOST_BACKUP_MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);

  if (options.failAfterStage === 'manifest') {
    rmSync(stagingRoot, { recursive: true, force: true });
    return {
      ok: false,
      error: 'aborted-after-manifest',
      snapshotId,
      writeLockHeldMs,
      published: false,
    };
  }

  // Atomic publish: rename staging → published. Never leave a half-published id.
  // On race loss: clean only our staging; never delete a publishedRoot we did not create.
  try {
    ensureDir(dirname(publishedRoot));
    renameSync(stagingRoot, publishedRoot);
  } catch (err) {
    rmSync(stagingRoot, { recursive: true, force: true });
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'publish-rename-failed',
      snapshotId,
      writeLockHeldMs,
      published: false,
    };
  }

  // Clean empty .staging parent if possible
  try {
    const stagingParent = join(backupRoot, '.staging');
    if (existsSync(stagingParent) && readdirSync(stagingParent).length === 0) {
      rmSync(stagingParent, { recursive: true, force: true });
    }
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    snapshotId,
    path: publishedRoot,
    manifest,
    writeLockHeldMs,
    durationMs: Date.now() - started,
    published: true,
  };
}

/**
 * List published snapshot ids (excludes .staging).
 * @param {string} backupRoot
 */
export function listPublishedSnapshots(backupRoot) {
  const root = resolve(backupRoot);
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => name !== '.staging')
    .filter((name) => existsSync(join(root, name, HOST_BACKUP_MANIFEST)))
    .sort();
}

/**
 * @param {string} snapshotPath
 */
export async function verifySnapshot(snapshotPath) {
  const root = resolve(snapshotPath);
  const manifestPath = join(root, HOST_BACKUP_MANIFEST);
  if (!existsSync(manifestPath)) {
    return { ok: false, error: 'missing-manifest' };
  }
  /** @type {SnapshotManifest} */
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return { ok: false, error: 'invalid-manifest' };
  }
  if (manifest.formatVersion !== SNAPSHOT_FORMAT_VERSION) {
    return { ok: false, error: `unsupported-format:${manifest.formatVersion}` };
  }
  for (const [rel, meta] of Object.entries(manifest.files ?? {})) {
    if (rel.includes('..')) return { ok: false, error: `path-traversal:${rel}` };
    const p = join(root, rel);
    if (!existsSync(p)) return { ok: false, error: `missing-file:${rel}` };
    const digest = await sha256File(p);
    if (digest !== meta.sha256) return { ok: false, error: `checksum-mismatch:${rel}` };
    if (statSync(p).size !== meta.bytes) return { ok: false, error: `size-mismatch:${rel}` };
  }
  const consistency = verifyDataDirConsistency(root);
  if (!consistency.ok) {
    return { ok: false, error: consistency.error };
  }
  return { ok: true, manifest, consistency };
}

/**
 * Restore a published snapshot into targetDataDir.
 * Stages into target/.restore-staging, verifies, then swaps in.
 * @param {{
 *   snapshotPath: string,
 *   targetDataDir: string,
 *   failBeforePublish?: boolean,
 * }} options
 */
export async function restoreHostSnapshot(options) {
  const started = Date.now();
  const snapshotPath = resolve(options.snapshotPath);
  const targetDataDir = resolve(options.targetDataDir);
  const verified = await verifySnapshot(snapshotPath);
  if (!verified.ok) {
    return { ok: false, error: `snapshot-invalid:${verified.error}`, durationMs: Date.now() - started };
  }

  const staging = join(targetDataDir, '.restore-staging');
  rmSync(staging, { recursive: true, force: true });
  ensureDir(staging);

  copyFileSync(join(snapshotPath, HOST_SQLITE), join(staging, HOST_SQLITE));
  if (existsSync(join(snapshotPath, AUTH_SQLITE))) {
    copyFileSync(join(snapshotPath, AUTH_SQLITE), join(staging, AUTH_SQLITE));
  }
  if (existsSync(join(snapshotPath, ASSETS_DIR))) {
    copyTree(join(snapshotPath, ASSETS_DIR), join(staging, ASSETS_DIR));
  }

  const stagedOk = verifyDataDirConsistency(staging);
  if (!stagedOk.ok) {
    rmSync(staging, { recursive: true, force: true });
    return {
      ok: false,
      error: `restore-staging-inconsistent:${stagedOk.error}`,
      durationMs: Date.now() - started,
      published: false,
    };
  }

  if (options.failBeforePublish) {
    rmSync(staging, { recursive: true, force: true });
    return {
      ok: false,
      error: 'aborted-before-restore-publish',
      durationMs: Date.now() - started,
      published: false,
    };
  }

  // Replace live files: move aside previous (incl. WAL/SHM), then promote staging.
  const previous = join(targetDataDir, `.pre-restore-${Date.now()}`);
  ensureDir(targetDataDir);
  ensureDir(previous);

  /** Roll live tree back from `previous` (SQLite sidecars included). */
  const rollbackLiveFromPrevious = () => {
    for (const base of [HOST_SQLITE, AUTH_SQLITE]) {
      relocateSqliteLiveFiles(targetDataDir, base, null);
      for (const name of sqliteSidecarNames(base)) {
        const prev = join(previous, name);
        if (existsSync(prev)) renameSync(prev, join(targetDataDir, name));
      }
    }
    const brokenAssets = join(targetDataDir, ASSETS_DIR);
    const prevAssets = join(previous, ASSETS_DIR);
    if (existsSync(brokenAssets)) rmSync(brokenAssets, { recursive: true, force: true });
    if (existsSync(prevAssets)) renameSync(prevAssets, brokenAssets);
  };

  try {
    relocateSqliteLiveFiles(targetDataDir, HOST_SQLITE, previous);
    relocateSqliteLiveFiles(targetDataDir, AUTH_SQLITE, previous);
    const liveAssets = join(targetDataDir, ASSETS_DIR);
    if (existsSync(liveAssets)) {
      renameSync(liveAssets, join(previous, ASSETS_DIR));
    }

    for (const name of [HOST_SQLITE, AUTH_SQLITE, ASSETS_DIR]) {
      const staged = join(staging, name);
      if (existsSync(staged)) {
        renameSync(staged, join(targetDataDir, name));
      }
    }
    // Drop any leftover WAL/SHM that could shadow restored main files.
    for (const base of [HOST_SQLITE, AUTH_SQLITE]) {
      for (const side of [`${base}-wal`, `${base}-shm`]) {
        const leftover = join(targetDataDir, side);
        if (existsSync(leftover)) rmSync(leftover, { force: true });
      }
    }
    rmSync(staging, { recursive: true, force: true });
  } catch (err) {
    try {
      rollbackLiveFromPrevious();
    } catch {
      /* best-effort */
    }
    rmSync(staging, { recursive: true, force: true });
    return {
      ok: false,
      error: err instanceof Error ? `restore-swap-failed:${err.message}` : 'restore-swap-failed',
      durationMs: Date.now() - started,
      published: false,
    };
  }

  const finalOk = verifyDataDirConsistency(targetDataDir);
  if (!finalOk.ok) {
    try {
      rollbackLiveFromPrevious();
    } catch {
      /* best-effort */
    }
    return {
      ok: false,
      error: `restore-final-inconsistent:${finalOk.error}`,
      durationMs: Date.now() - started,
      published: false,
    };
  }

  rmSync(previous, { recursive: true, force: true });

  return {
    ok: true,
    durationMs: Date.now() - started,
    schemaVersion: finalOk.schemaVersion,
    eventRevisionLinks: finalOk.eventRevisionLinks,
    manifest: verified.manifest,
    published: true,
  };
}

/**
 * Update/rollback drill: snapshot → mutate → restore → report.
 * @param {{
 *   dataDir: string,
 *   backupRoot: string,
 *   hostVersion?: string,
 *   mutate: (dataDir: string) => void,
 * }} options
 */
export async function runRollbackDrill(options) {
  const started = Date.now();
  const snap = await createHostSnapshot({
    dataDir: options.dataDir,
    backupRoot: options.backupRoot,
    hostVersion: options.hostVersion ?? 'drill',
    snapshotId: `drill-${Date.now().toString(36)}`,
  });
  if (!snap.ok) {
    return { ok: false, error: `snapshot-failed:${snap.error}`, durationMs: Date.now() - started };
  }

  options.mutate(options.dataDir);

  const afterBreak = verifyDataDirConsistency(options.dataDir);
  // Mutation may intentionally break consistency; still restore.

  const restored = await restoreHostSnapshot({
    snapshotPath: snap.path,
    targetDataDir: options.dataDir,
  });
  if (!restored.ok) {
    return {
      ok: false,
      error: restored.error,
      durationMs: Date.now() - started,
      writeLockHeldMs: snap.writeLockHeldMs,
      brokenBeforeRestore: afterBreak.ok === false,
    };
  }

  return {
    ok: true,
    durationMs: Date.now() - started,
    writeLockHeldMs: snap.writeLockHeldMs,
    schemaVersion: restored.schemaVersion,
    snapshotId: snap.snapshotId,
    restoredChecksums: restored.manifest.files,
    hostVersion: restored.manifest.hostVersion,
    eventRevisionLinks: restored.eventRevisionLinks,
    report: {
      measuredDurationMs: Date.now() - started,
      writeLockHeldMs: snap.writeLockHeldMs,
      schemaVersion: restored.schemaVersion,
      snapshotId: snap.snapshotId,
      hostVersion: restored.manifest.hostVersion,
      fileChecksums: restored.manifest.files,
    },
  };
}
