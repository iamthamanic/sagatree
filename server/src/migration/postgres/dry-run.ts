/**
 * Idempotent Postgres→SQLite dry-run transfer with integrity report.
 * Synthetic fixtures only — never connects to production Postgres.
 * Location: server/src/migration/postgres/dry-run.ts
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HostDatabase } from '../../persistence/open-database.ts';
import { bootstrapHostPersistence, runIntegrityCheck } from '../../persistence/index.ts';
import { canonicalTableChecksum } from './checksum.ts';
import { KNOWN_LEGACY_PERMISSION_DEVIATIONS, type LegacyPermissionDeviation } from './deviations.ts';
import {
  findUnmappedTables,
  isMappedTable,
  MAPPED_TABLE_NAMES,
  MAPPED_TABLES,
  type MappedTableName,
  typeMappingsForTable,
} from './table-map.ts';
import { mapPgValueToSqlite, type ColumnTypeMapping } from './type-mappings.ts';
import type { PgFixtureSnapshot } from './synthetic-fixture.ts';

export type TableTransferReport = {
  readonly name: MappedTableName;
  readonly rowCount: number;
  readonly checksumSha256: string;
  readonly typeMappings: readonly ColumnTypeMapping[];
  readonly fkErrors: readonly string[];
};

export type OwnerProjectionCheck = {
  readonly worldOwnerMatches: boolean;
  readonly projectGmMatches: boolean;
  readonly activeMembers: readonly string[];
  readonly inactiveMembers: readonly string[];
  readonly strangerHasNoMembership: boolean;
  readonly secretLabelDocumentedOnly: boolean;
};

export type DryRunReport = {
  readonly ok: boolean;
  readonly snapshotId: string;
  readonly status: 'complete' | 'rolled_back' | 'blocked_unmapped' | 'failed';
  readonly tables: readonly TableTransferReport[];
  readonly unmappedTables: readonly string[];
  readonly fkErrors: readonly string[];
  readonly deviations: readonly LegacyPermissionDeviation[];
  readonly ownerProjection: OwnerProjectionCheck | null;
  readonly error: string | null;
};

export type DryRunOptions = {
  readonly dataDir: string;
  readonly migrationsDir: string;
  readonly fixture: PgFixtureSnapshot;
  /**
   * When set, throw after inserting this many rows (within the transfer transaction)
   * to simulate mid-transfer abort. Target must roll back.
   */
  readonly abortAfterRows?: number;
};

type RunMeta = {
  readonly snapshotId: string;
  readonly status: 'incomplete' | 'complete';
  readonly appliedAt: string;
};

function metaPath(dataDir: string): string {
  return join(dataDir, 'mig503-dry-run-meta.json');
}

function readRunMeta(dataDir: string): RunMeta | null {
  const path = metaPath(dataDir);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as RunMeta;
    if (
      typeof parsed.snapshotId !== 'string' ||
      (parsed.status !== 'complete' && parsed.status !== 'incomplete')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeRunMeta(dataDir: string, meta: RunMeta): void {
  writeFileSync(metaPath(dataDir), JSON.stringify(meta, null, 2), 'utf8');
}

function clearRunMeta(dataDir: string): void {
  const path = metaPath(dataDir);
  if (existsSync(path)) unlinkSync(path);
}

function clearMappedData(db: HostDatabase): void {
  db.exec('DELETE FROM project_members');
  db.exec('DELETE FROM projects');
  db.exec('DELETE FROM worlds');
}

function mapRow(
  table: MappedTableName,
  row: Record<string, unknown>,
): Record<string, string | number | null> {
  const spec = MAPPED_TABLES[table];
  const out: Record<string, string | number | null> = {};
  for (const col of spec.columns) {
    out[col.name] = mapPgValueToSqlite(col.pgType, row[col.name]);
  }
  return out;
}

function insertMappedRow(
  db: HostDatabase,
  table: MappedTableName,
  mapped: Record<string, string | number | null>,
): void {
  const cols = MAPPED_TABLES[table].columns.map((c) => c.name);
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
  db.prepare(sql).run(...cols.map((c) => mapped[c]));
}

function readSqliteRows(db: HostDatabase, table: MappedTableName): Record<string, unknown>[] {
  return db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
}

function buildOwnerProjection(db: HostDatabase, fixture: PgFixtureSnapshot): OwnerProjectionCheck {
  const v = fixture.visibilityContract;
  const world = db.prepare(`SELECT owner_user_id FROM worlds WHERE id = ?`).get(v.worldId) as
    | { owner_user_id: string }
    | undefined;
  const project = db.prepare(`SELECT gm_user_id FROM projects WHERE id = ?`).get(v.projectId) as
    | { gm_user_id: string }
    | undefined;
  const members = db
    .prepare(`SELECT user_id, role, active FROM project_members WHERE project_id = ?`)
    .all(v.projectId) as { user_id: string; role: string; active: number }[];

  const activeMembers = members
    .filter((m) => m.active === 1)
    .map((m) => m.user_id)
    .sort();
  const inactiveMembers = members
    .filter((m) => m.active === 0)
    .map((m) => m.user_id)
    .sort();
  const strangerRow = members.find((m) => m.user_id === v.strangerUserId);

  return {
    worldOwnerMatches: world?.owner_user_id === v.ownerUserId,
    projectGmMatches: project?.gm_user_id === v.gmUserId,
    activeMembers,
    inactiveMembers,
    strangerHasNoMembership: !strangerRow,
    secretLabelDocumentedOnly:
      typeof v.secretLabel === 'string' &&
      v.secretLabel.length > 0 &&
      !JSON.stringify(readSqliteRows(db, 'worlds')).includes(v.secretLabel),
  };
}

function buildTableReports(db: HostDatabase): TableTransferReport[] {
  const integrity = runIntegrityCheck(db);
  const globalFk = integrity.ok ? [] : [...integrity.errors];

  return MAPPED_TABLE_NAMES.map((name) => {
    const rows = readSqliteRows(db, name);
    const fkErrors = globalFk.filter(
      (e) => e.includes(name) || e.includes('foreign key') || e.includes('orphan'),
    );
    return {
      name,
      rowCount: rows.length,
      checksumSha256: canonicalTableChecksum(rows),
      typeMappings: typeMappingsForTable(name),
      fkErrors,
    };
  });
}

/**
 * Run an idempotent dry-run transfer of a synthetic Postgres-like fixture into SQLite.
 */
export function runPgSqliteDryRun(options: DryRunOptions): DryRunReport {
  const { fixture, dataDir, migrationsDir, abortAfterRows } = options;
  const tableNames = Object.keys(fixture.tables);
  const unmapped = findUnmappedTables(tableNames);

  if (unmapped.length > 0) {
    return {
      ok: false,
      snapshotId: fixture.snapshotId,
      status: 'blocked_unmapped',
      tables: [],
      unmappedTables: unmapped,
      fkErrors: [],
      deviations: KNOWN_LEGACY_PERMISSION_DEVIATIONS,
      ownerProjection: null,
      error: `incomplete table mapping — blocked: ${unmapped.join(', ')}`,
    };
  }

  const boot = bootstrapHostPersistence({ dataDir, migrationsDir });
  if (!boot.ok) {
    return {
      ok: false,
      snapshotId: fixture.snapshotId,
      status: 'failed',
      tables: [],
      unmappedTables: [],
      fkErrors: [],
      deviations: KNOWN_LEGACY_PERMISSION_DEVIATIONS,
      ownerProjection: null,
      error: boot.error,
    };
  }

  const db = boot.db;
  const prior = readRunMeta(dataDir);

  // Idempotent retry / incomplete isolation: clear mapped rows for this snapshot, then re-apply.
  if (prior && prior.snapshotId === fixture.snapshotId) {
    clearMappedData(db);
    clearRunMeta(dataDir);
  }

  let inserted = 0;
  try {
    writeRunMeta(dataDir, {
      snapshotId: fixture.snapshotId,
      status: 'incomplete',
      appliedAt: new Date().toISOString(),
    });

    db.exec('BEGIN IMMEDIATE');

    for (const table of MAPPED_TABLE_NAMES) {
      if (!isMappedTable(table)) continue;
      const rows = fixture.tables[table] ?? [];
      for (const row of rows) {
        if (abortAfterRows !== undefined && inserted >= abortAfterRows) {
          throw new Error(`abort-simulated-after-${abortAfterRows}-rows`);
        }
        insertMappedRow(db, table, mapRow(table, row as Record<string, unknown>));
        inserted += 1;
      }
    }

    db.exec('COMMIT');
    writeRunMeta(dataDir, {
      snapshotId: fixture.snapshotId,
      status: 'complete',
      appliedAt: new Date().toISOString(),
    });
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    // Leave incomplete meta so a retry sees isolation; mapped rows are rolled back.
    writeRunMeta(dataDir, {
      snapshotId: fixture.snapshotId,
      status: 'incomplete',
      appliedAt: new Date().toISOString(),
    });
    const message = err instanceof Error ? err.message : String(err);
    const rolled = buildTableReports(db);
    const worldCount = (db.prepare('SELECT COUNT(*) AS c FROM worlds').get() as { c: number }).c;
    db.close();
    return {
      ok: false,
      snapshotId: fixture.snapshotId,
      status: 'rolled_back',
      tables: rolled,
      unmappedTables: [],
      fkErrors: [],
      deviations: KNOWN_LEGACY_PERMISSION_DEVIATIONS,
      ownerProjection: null,
      error:
        worldCount === 0
          ? message
          : `${message}; unexpected residual rows after rollback (worlds=${worldCount})`,
    };
  }

  const integrity = runIntegrityCheck(db);
  const tables = buildTableReports(db);
  const ownerProjection = buildOwnerProjection(db, fixture);
  const fkErrors = integrity.ok ? [] : [...integrity.errors];

  const projectionOk =
    ownerProjection.worldOwnerMatches &&
    ownerProjection.projectGmMatches &&
    ownerProjection.strangerHasNoMembership &&
    ownerProjection.secretLabelDocumentedOnly &&
    ownerProjection.activeMembers.includes(fixture.visibilityContract.gmUserId) &&
    ownerProjection.activeMembers.includes(fixture.visibilityContract.playerUserId) &&
    ownerProjection.inactiveMembers.includes(fixture.visibilityContract.inactiveUserId);

  const ok = integrity.ok && projectionOk && fkErrors.length === 0;
  db.close();

  return {
    ok,
    snapshotId: fixture.snapshotId,
    status: ok ? 'complete' : 'failed',
    tables,
    unmappedTables: [],
    fkErrors,
    deviations: KNOWN_LEGACY_PERMISSION_DEVIATIONS,
    ownerProjection,
    error: ok
      ? null
      : !integrity.ok
        ? `integrity: ${fkErrors.join('; ')}`
        : 'owner projection contract failed',
  };
}

/** Path helper for self-tests. */
export function sqlitePathForDataDir(dataDir: string): string {
  return join(dataDir, 'host.sqlite');
}
