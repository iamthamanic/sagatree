/**
 * Approved Postgres→SQLite dry-run table map (host bootstrap catalog).
 * Incomplete mapping fails closed — unmapped fixture tables block the run.
 * Location: server/src/migration/postgres/table-map.ts
 */
import {
  PG_TO_SQLITE_TYPE_MAP,
  type ColumnTypeMapping,
  type PgScalarType,
} from './type-mappings.ts';

export type MappedTableName = 'worlds' | 'projects' | 'project_members';

export type TableColumnSpec = {
  readonly name: string;
  readonly pgType: PgScalarType;
  readonly primaryKey?: boolean;
};

export type MappedTableSpec = {
  readonly name: MappedTableName;
  readonly columns: readonly TableColumnSpec[];
  /** INSERT column order (FK-safe parent before child). */
  readonly insertOrder: number;
};

export const MAPPED_TABLES: Readonly<Record<MappedTableName, MappedTableSpec>> = Object.freeze({
  worlds: {
    name: 'worlds',
    insertOrder: 1,
    columns: [
      { name: 'id', pgType: 'uuid', primaryKey: true },
      { name: 'owner_user_id', pgType: 'uuid' },
      { name: 'title', pgType: 'text' },
      { name: 'created_at', pgType: 'timestamptz' },
    ],
  },
  projects: {
    name: 'projects',
    insertOrder: 2,
    columns: [
      { name: 'id', pgType: 'uuid', primaryKey: true },
      { name: 'world_id', pgType: 'uuid' },
      { name: 'gm_user_id', pgType: 'uuid' },
      { name: 'title', pgType: 'text' },
      { name: 'created_at', pgType: 'timestamptz' },
    ],
  },
  project_members: {
    name: 'project_members',
    insertOrder: 3,
    columns: [
      { name: 'project_id', pgType: 'uuid', primaryKey: true },
      { name: 'user_id', pgType: 'uuid', primaryKey: true },
      { name: 'role', pgType: 'text' },
      { name: 'active', pgType: 'boolean' },
      { name: 'joined_at', pgType: 'timestamptz' },
    ],
  },
});

export const MAPPED_TABLE_NAMES: readonly MappedTableName[] = Object.freeze(
  (Object.keys(MAPPED_TABLES) as MappedTableName[]).sort(
    (a, b) => MAPPED_TABLES[a].insertOrder - MAPPED_TABLES[b].insertOrder,
  ),
);

export function isMappedTable(name: string): name is MappedTableName {
  return Object.prototype.hasOwnProperty.call(MAPPED_TABLES, name);
}

export function typeMappingsForTable(table: MappedTableName): readonly ColumnTypeMapping[] {
  return MAPPED_TABLES[table].columns.map((col) => ({
    column: col.name,
    pgType: col.pgType,
    sqliteType: PG_TO_SQLITE_TYPE_MAP[col.pgType],
  }));
}

/**
 * Fail closed: every fixture table name must be in the approved map.
 * Returns unmapped names (empty ⇒ ok).
 */
export function findUnmappedTables(fixtureTableNames: readonly string[]): readonly string[] {
  return fixtureTableNames.filter((name) => !isMappedTable(name)).sort();
}
