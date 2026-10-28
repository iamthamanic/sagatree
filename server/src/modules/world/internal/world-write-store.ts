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
    readonly ownerUserId: string;
    readonly title: string;
  }) => number;
  readonly deleteOwned: (input: { readonly id: string; readonly ownerUserId: string }) => number;
};

export function createSqliteWorldWriteStore(db: HostDatabase): WorldWriteStore {
  return {
    insertOwned(input) {
      db.prepare(
        `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
      ).run(input.id, input.ownerUserId, input.title, input.createdAt);
    },
    updateOwnedTitle(input) {
      const result = db
        .prepare(`UPDATE worlds SET title = ? WHERE id = ? AND owner_user_id = ?`)
        .run(input.title, input.id, input.ownerUserId);
      return Number(result.changes ?? 0);
    },
    deleteOwned(input) {
      const result = db
        .prepare(`DELETE FROM worlds WHERE id = ? AND owner_user_id = ?`)
        .run(input.id, input.ownerUserId);
      return Number(result.changes ?? 0);
    },
  };
}
