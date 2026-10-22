import SQLite from 'better-sqlite3';
import { ZenStackClient } from '@zenstackhq/orm';
import { SqliteDialect } from '@zenstackhq/orm/dialects/sqlite';
import { PolicyPlugin } from '@zenstackhq/plugin-policy';
import { schema } from './schema.js';
import type { ViewContext } from '../domain/contracts.js';

export function openPolicyClient(file: string) {
  const sqlite = new SQLite(file);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = FULL');
  sqlite.pragma('busy_timeout = 5000');
  const raw = new ZenStackClient(schema, { dialect: new SqliteDialect({ database: sqlite }) });
  const protectedClient = raw.$use(new PolicyPlugin());
  return {
    forContext(context: ViewContext) {
      return protectedClient.$setAuth(context.actor ? {
        userId: context.actor.userId, sagaId: context.sagaId ?? null,
      } : undefined);
    },
    async close() { await protectedClient.$disconnect(); },
  };
}
