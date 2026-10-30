/**
 * Bind `?`-placeholder SQL into a Drizzle `SQL` fragment (product query path).
 * Location: server/src/persistence/bind-sql.ts
 *
 * Placeholder `?` inside single-quoted SQL string literals are not treated as binds
 * (SQLite escape is `''` inside a literal).
 */
import { sql, type SQL } from 'drizzle-orm';

/** Split on bind `?` while ignoring `?` characters inside `'…'` string literals. */
export function splitQuestionMarkPlaceholders(query: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inString = false;
  for (let i = 0; i < query.length; i += 1) {
    const ch = query[i]!;
    if (inString) {
      current += ch;
      if (ch === "'") {
        // SQL escaped quote: ''
        if (query[i + 1] === "'") {
          current += query[i + 1]!;
          i += 1;
        } else {
          inString = false;
        }
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === '?') {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

/**
 * Convert a SQLite `?` placeholder string + positional params into a Drizzle SQL
 * value so execution goes through the ORM session (not DatabaseSync.prepare).
 */
export function bindQuestionMarks(query: string, params: readonly unknown[]): SQL {
  const parts = splitQuestionMarkPlaceholders(query);
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
