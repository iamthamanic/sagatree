/**
 * Drizzle schema for ops-owned migration journal (ADR-ST-05).
 * Location: server/src/persistence/schema/ops.ts
 *
 * Journal writes stay on DatabaseSync via migration-runner (documented exception).
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const schemaMigrations = sqliteTable('schema_migrations', {
  version: integer('version').primaryKey(),
  id: text('id').notNull(),
  appliedAt: text('applied_at').notNull(),
});
