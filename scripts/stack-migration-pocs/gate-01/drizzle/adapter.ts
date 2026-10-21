import SQLite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { CommandError, validateStatus, validateUpdate, type AdapterHandle, type ApplicationPort, type FaultHook } from '../domain/contracts.js';
import * as tables from './schema.js';
import { PolicyService } from './policy-service.js';

export function createAdapter(file: string, fault?: FaultHook): AdapterHandle {
  const sqlite = new SQLite(file);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('synchronous = FULL');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema: tables });
  const app = Object.freeze<ApplicationPort>({
    async listMaps(context) {
      const projection = new PolicyService(db).mapProjection(context);
      return db.select(projection.fields).from(tables.maps).where(projection.where).orderBy(tables.maps.id).all();
    },
    async getMap(mapId, context) {
      const projection = new PolicyService(db).mapProjection(context);
      return db.select(projection.fields).from(tables.maps)
        .where(and(projection.where, eq(tables.maps.id, mapId))).get() ?? null;
    },
    async updateMapTitle(request, actor) {
      validateUpdate(request);
      return db.transaction((tx) => {
        const userId = new PolicyService(tx).assertMapEditor(request.mapId, actor);
        const id = JSON.stringify([userId, request.mapId, request.idempotencyKey]);
        const digest = createHash('sha256').update(JSON.stringify([request.mapId, request.title, request.expectedRevision])).digest('hex');
        const receipt = tx.select().from(tables.receipts).where(eq(tables.receipts.id, id)).get();
        if (receipt) {
          if (receipt.requestDigest !== digest) throw new CommandError('IDEMPOTENCY_MISMATCH');
          return { id: request.mapId, title: receipt.resultTitle, revision: receipt.resultRevision };
        }
        const updated = tx.update(tables.maps).set({ title: request.title, revision: sql`${tables.maps.revision} + 1` })
          .where(and(eq(tables.maps.id, request.mapId), eq(tables.maps.revision, request.expectedRevision)))
          .returning({ id: tables.maps.id, title: tables.maps.title, revision: tables.maps.revision }).get();
        if (!updated) throw new CommandError('CONFLICT');
        fault?.('after-map-update');
        tx.insert(tables.receipts).values({
          id, mapId: request.mapId, actorUserId: userId, requestDigest: digest,
          resultTitle: updated.title, resultRevision: updated.revision,
        }).run();
        return updated;
      }, { behavior: 'immediate' });
    },
    async setSessionStatus(sessionId, status, context) {
      validateStatus(status);
      return db.transaction((tx) => {
        new PolicyService(tx).assertSessionGm(sessionId, context);
        const updated = tx.update(tables.sessions).set({ status, revision: sql`${tables.sessions.revision} + 1` })
          .where(eq(tables.sessions.id, sessionId)).returning().get();
        if (!updated) throw new CommandError('DENIED');
        return updated;
      }, { behavior: 'immediate' });
    },
  });
  return { app, async close() { sqlite.close(); } };
}
