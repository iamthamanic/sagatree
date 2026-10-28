/**
 * World insert/update/delete store for owned world rows (#873 / MIG-313).
 * Private — import only from world public API.
 * Location: server/src/modules/world/internal/world-write-store.ts
 */
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type WorldWriteStore = {
  readonly insertOwned: (input: {
    readonly id: string;
    readonly ownerUserId: string;
    readonly title: string;
    readonly createdAt: string;
  }) => void;
  readonly updateOwnedTitle: (input: {
    readonly id: string;
    readonly ownerUserIds: readonly string[];
    readonly title: string;
  }) => number;
  readonly deleteOwned: (input: {
    readonly id: string;
    readonly ownerUserIds: readonly string[];
  }) => number;
  /** True when a project row still references this world (blocks delete). */
  readonly hasProjectRefs: (worldId: string) => boolean;
  /** Drop legacy tile-map row so world delete is not blocked by world_maps FK. */
  readonly deleteWorldMapRow: (worldId: string) => void;
};

export function createSqliteWorldWriteStore(db: HostDatabase): WorldWriteStore {
  return {
    insertOwned(input) {
      db.prepare(
        `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
      ).run(input.id, input.ownerUserId, input.title, input.createdAt);
    },
    updateOwnedTitle(input) {
      const ids = input.ownerUserIds.filter((id) => typeof id === 'string' && id.length > 0);
      if (ids.length === 0) return 0;
      const placeholders = ids.map(() => '?').join(', ');
      const result = db
        .prepare(
          `UPDATE worlds SET title = ? WHERE id = ? AND owner_user_id IN (${placeholders})`,
        )
        .run(input.title, input.id, ...ids);
      return Number(result.changes ?? 0);
    },
    deleteOwned(input) {
      const ids = input.ownerUserIds.filter((id) => typeof id === 'string' && id.length > 0);
      if (ids.length === 0) return 0;
      const placeholders = ids.map(() => '?').join(', ');
      const result = db
        .prepare(`DELETE FROM worlds WHERE id = ? AND owner_user_id IN (${placeholders})`)
        .run(input.id, ...ids);
      return Number(result.changes ?? 0);
    },
    hasProjectRefs(worldId) {
      const row = db
        .prepare(`SELECT 1 AS ok FROM projects WHERE world_id = ? LIMIT 1`)
        .get(worldId) as { ok: number } | undefined;
      return Boolean(row);
    },
    deleteWorldMapRow(worldId) {
      db.prepare(`DELETE FROM world_maps WHERE world_id = ?`).run(worldId);
    },
  };
}
