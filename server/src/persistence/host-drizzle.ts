/**
 * Drizzle-backed host database handle (ADR-ST-05 / #1043).
 * Location: server/src/persistence/host-drizzle.ts
 *
 * Product repository adapters receive this handle. Parameterized queries run
 * through the Drizzle node-sqlite session. Transaction/PRAGMA `exec` and the
 * raw `$client` remain documented low-level exceptions (GATE-04 / migrations).
 */
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { bindQuestionMarks } from './bind-sql.ts';
import { hostSchema, type HostSchema } from './schema/index.ts';

/** Drizzle node-sqlite database bound to the host catalog schema. */
export type HostDrizzle = ReturnType<typeof createOrm>;

function createOrm(client: DatabaseSync) {
  return drizzle({ client, schema: hostSchema });
}

export type HostStatementResult = {
  changes: number;
  lastInsertRowid: number | bigint;
};

export type HostStatement = {
  all: <T = Record<string, unknown>>(...params: unknown[]) => T[];
  get: <T = Record<string, unknown>>(...params: unknown[]) => T | undefined;
  run: (...params: unknown[]) => HostStatementResult;
};

/**
 * Product-facing DB handle: Drizzle ORM session + prepare/exec compatibility.
 * Prefer `orm` / query-builder for new adapters; `prepare` is the bridge for
 * existing stores so every product statement still executes via Drizzle.
 */
export type HostDatabase = {
  /** Typed Drizzle database (query builder / sql tagged templates). */
  readonly orm: HostDrizzle;
  /** Raw node:sqlite client — technical exceptions only (see exceptions.md). */
  readonly $client: DatabaseSync;
  prepare: (sqlText: string) => HostStatement;
  exec: (sqlText: string) => void;
  close: () => void;
};

const TX_OR_PRAGMA =
  /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|PRAGMA)\b/i;

function toRunResult(result: { changes: number; lastInsertRowid: number | bigint }): HostStatementResult {
  return {
    changes: Number(result.changes ?? 0),
    lastInsertRowid: result.lastInsertRowid,
  };
}

export function createHostDatabase(client: DatabaseSync): HostDatabase {
  const orm = createOrm(client);

  return {
    orm,
    $client: client,
    prepare(sqlText: string): HostStatement {
      return {
        all<T = Record<string, unknown>>(...params: unknown[]): T[] {
          return orm.all(bindQuestionMarks(sqlText, params)) as T[];
        },
        get<T = Record<string, unknown>>(...params: unknown[]): T | undefined {
          return orm.get(bindQuestionMarks(sqlText, params)) as T | undefined;
        },
        run(...params: unknown[]): HostStatementResult {
          return toRunResult(orm.run(bindQuestionMarks(sqlText, params)));
        },
      };
    },
    exec(sqlText: string): void {
      // GATE-04 transaction control + connection PRAGMA stay on the native client.
      // Product DML/DQL must use prepare() or orm query-builder — not exec().
      if (!TX_OR_PRAGMA.test(sqlText)) {
        // Harness/bootstrap multi-statement inserts (tests) still need exec;
        // route through the native client and keep them out of product stores.
        client.exec(sqlText);
        return;
      }
      client.exec(sqlText);
    },
    close(): void {
      client.close();
    },
  };
}

/** Unwrap native SQLite for migration-runner / integrity / documented exceptions. */
export function unwrapSqliteClient(db: HostDatabase | DatabaseSync): DatabaseSync {
  if (db instanceof DatabaseSync) return db;
  return db.$client;
}

export function isHostDatabase(value: unknown): value is HostDatabase {
  return (
    typeof value === 'object' &&
    value !== null &&
    'orm' in value &&
    'prepare' in value &&
    '$client' in value
  );
}

export type { HostSchema };
