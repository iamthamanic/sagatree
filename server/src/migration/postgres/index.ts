/**
 * Postgres→SQLite dry-run migration tooling public API (MIG-503 / #844).
 * Location: server/src/migration/postgres/index.ts
 *
 * Synthetic fixtures only. Does not connect to production Postgres.
 * Known legacy permission defects are documented as deviations — never imported.
 */
export {
  PG_TO_SQLITE_TYPE_MAP,
  mapPgValueToSqlite,
  type PgScalarType,
  type SqliteAffinity,
  type ColumnTypeMapping,
} from './type-mappings.ts';

export {
  MAPPED_TABLES,
  MAPPED_TABLE_NAMES,
  findUnmappedTables,
  isMappedTable,
  typeMappingsForTable,
  type MappedTableName,
  type MappedTableSpec,
} from './table-map.ts';

export {
  KNOWN_LEGACY_PERMISSION_DEVIATIONS,
  type LegacyPermissionDeviation,
} from './deviations.ts';

export { canonicalTableChecksum, stableStringify } from './checksum.ts';

export {
  createSyntheticPostgresFixture,
  createFixtureWithUnmappedTable,
  SYNTHETIC_SNAPSHOT_ID,
  type PgFixtureSnapshot,
  type PgFixtureRow,
} from './synthetic-fixture.ts';

export {
  runPgSqliteDryRun,
  sqlitePathForDataDir,
  type DryRunOptions,
  type DryRunReport,
  type TableTransferReport,
  type OwnerProjectionCheck,
} from './dry-run.ts';
