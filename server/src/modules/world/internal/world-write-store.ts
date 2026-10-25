/**
 * World insert store for provision-owned world rows (#873).
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
};

export function createSqliteWorldWriteStore(db: HostDatabase): WorldWriteStore {
  return {
    insertOwned(input) {
      db.prepare(
        `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
      ).run(input.id, input.ownerUserId, input.title, input.createdAt);
    },
  };
}
