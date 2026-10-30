/**
 * Drizzle adapter for world read store (MIG-012 / #1043 GATE-01 follow-up).
 * Location: server/src/repositories/world/sqlite-world-read-store.ts
 *
 * Wired only from the host composition root — not imported by other modules.
 * Executes through Drizzle query builder inside the persistence session.
 */
import { desc, asc, eq } from 'drizzle-orm';
import type { HostDatabase } from '../../persistence/open-database.ts';
import { worlds } from '../../persistence/schema/world.ts';
import type { WorldReadStore, WorldStoredRow } from '../../modules/world/index.ts';

function mapRow(row: {
  id: string;
  ownerUserId: string;
  title: string;
  createdAt: string;
}): WorldStoredRow {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    title: row.title,
    createdAt: row.createdAt,
  };
}

export function createSqliteWorldReadStore(db: HostDatabase): WorldReadStore {
  const orm = db.orm;
  return {
    listByOwner(ownerUserId: string): readonly WorldStoredRow[] {
      const rows = orm
        .select({
          id: worlds.id,
          ownerUserId: worlds.ownerUserId,
          title: worlds.title,
          createdAt: worlds.createdAt,
        })
        .from(worlds)
        .where(eq(worlds.ownerUserId, ownerUserId))
        .orderBy(desc(worlds.createdAt), asc(worlds.id))
        .all();
      return rows.map(mapRow);
    },
    findById(worldId: string): WorldStoredRow | null {
      const row = orm
        .select({
          id: worlds.id,
          ownerUserId: worlds.ownerUserId,
          title: worlds.title,
          createdAt: worlds.createdAt,
        })
        .from(worlds)
        .where(eq(worlds.id, worldId))
        .get();
      return row ? mapRow(row) : null;
    },
  };
}
