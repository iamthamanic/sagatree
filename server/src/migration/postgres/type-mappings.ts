/**
 * Postgres→SQLite column type mappings (MIG-011 / MIG-503).
 * Location: server/src/migration/postgres/type-mappings.ts
 */

export type PgScalarType = 'uuid' | 'timestamptz' | 'jsonb' | 'boolean' | 'text' | 'integer';

export type SqliteAffinity = 'TEXT' | 'INTEGER';

/** Canonical host mappings from approved bootstrap catalog. */
export const PG_TO_SQLITE_TYPE_MAP: Readonly<Record<PgScalarType, SqliteAffinity>> = Object.freeze({
  uuid: 'TEXT',
  timestamptz: 'TEXT',
  jsonb: 'TEXT',
  boolean: 'INTEGER',
  text: 'TEXT',
  integer: 'INTEGER',
});

export type ColumnTypeMapping = {
  readonly column: string;
  readonly pgType: PgScalarType;
  readonly sqliteType: SqliteAffinity;
};

/**
 * Convert a Postgres-like fixture value into the SQLite host representation.
 * Fail closed on unknown types / non-canonical shapes.
 */
export function mapPgValueToSqlite(pgType: PgScalarType, value: unknown): string | number | null {
  if (value === null || value === undefined) return null;

  switch (pgType) {
    case 'uuid':
    case 'text': {
      if (typeof value !== 'string') {
        throw new Error(`expected string for ${pgType}, got ${typeof value}`);
      }
      return value;
    }
    case 'timestamptz': {
      if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (Number.isNaN(parsed)) {
          throw new Error(`invalid timestamptz string: ${value}`);
        }
        return new Date(parsed).toISOString();
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      throw new Error(`expected Date or ISO string for timestamptz, got ${typeof value}`);
    }
    case 'jsonb': {
      if (typeof value === 'string') {
        JSON.parse(value); // validate
        return value;
      }
      return JSON.stringify(value);
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (value === 0 || value === 1) return value;
      throw new Error(`expected boolean for boolean column, got ${typeof value}`);
    }
    case 'integer': {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new Error(`expected integer, got ${typeof value}`);
      }
      return value;
    }
    default: {
      const _exhaustive: never = pgType;
      throw new Error(`unmapped pg type: ${String(_exhaustive)}`);
    }
  }
}
