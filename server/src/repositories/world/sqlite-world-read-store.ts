/**
 * SQLite adapter for world read store (MIG-012).
 * Location: server/src/repositories/world/sqlite-world-read-store.ts
 *
 * Wired only from the host composition root — not imported by other modules.
 */
import type { HostDatabase } from '../../persistence/open-database.ts';
import type { WorldReadStore, WorldStoredRow } from '../../modules/world/index.ts';

type WorldsSqlRow = {
  id: string;
  owner_user_id: string;
  title: string;
  created_at: string;
};

function mapRow(row: WorldsSqlRow): WorldStoredRow {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    createdAt: row.created_at,
  };
}

export function createSqliteWorldReadStore(db: HostDatabase): WorldReadStore {
  return {
    listByOwner(ownerUserId: string): readonly WorldStoredRow[] {
      const rows = db
        .prepare(
          `SELECT id, owner_user_id, title, created_at
           FROM worlds
           WHERE owner_user_id = ?
           ORDER BY created_at DESC, id ASC`,
        )
        .all(ownerUserId) as WorldsSqlRow[];
      return rows.map(mapRow);
    },
    findById(worldId: string): WorldStoredRow | null {
      const row = db
        .prepare(`SELECT id, owner_user_id, title, created_at FROM worlds WHERE id = ?`)
        .get(worldId) as WorldsSqlRow | undefined;
      return row ? mapRow(row) : null;
    },
  };
}
