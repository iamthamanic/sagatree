/**
 * Bind `?`-placeholder SQL into a Drizzle `SQL` fragment (product query path).
 * Location: server/src/persistence/bind-sql.ts
 */
import { sql, type SQL } from 'drizzle-orm';

/**
 * Convert a SQLite `?` placeholder string + positional params into a Drizzle SQL
 * value so execution goes through the ORM session (not DatabaseSync.prepare).
 */
export function bindQuestionMarks(query: string, params: readonly unknown[]): SQL {
  const parts = query.split('?');
  if (parts.length - 1 !== params.length) {
    throw new Error(
      `SQL placeholder count mismatch: expected ${parts.length - 1} params, got ${params.length}`,
    );
  }
  if (params.length === 0) {
    return sql.raw(query);
  }
  let fragment: SQL = sql.raw(parts[0] ?? '');
  for (let i = 0; i < params.length; i += 1) {
    fragment = sql`${fragment}${params[i]}${sql.raw(parts[i + 1] ?? '')}`;
  }
  return fragment;
}
