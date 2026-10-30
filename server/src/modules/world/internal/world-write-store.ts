/**
 * World insert/update/delete store via Drizzle (ADR-ST-05 / #1043).
 * Private — import only from world public API.
 * Location: server/src/modules/world/internal/world-write-store.ts
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import { worlds, worldMaps } from '../../../persistence/schema/world.ts';

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
  /** Drop legacy tile-map row so world delete is not blocked by world_maps FK. */
  readonly deleteWorldMapRow: (worldId: string) => void;
};

export function createSqliteWorldWriteStore(db: HostDatabase): WorldWriteStore {
  const orm = db.orm;
  return {
    insertOwned(input) {
      orm
        .insert(worlds)
        .values({
          id: input.id,
          ownerUserId: input.ownerUserId,
          title: input.title,
          createdAt: input.createdAt,
        })
        .run();
    },
    updateOwnedTitle(input) {
      const ids = input.ownerUserIds.filter((id) => typeof id === 'string' && id.length > 0);
      if (ids.length === 0) return 0;
      const result = orm
        .update(worlds)
        .set({ title: input.title })
        .where(and(eq(worlds.id, input.id), inArray(worlds.ownerUserId, ids)))
        .run();
      return Number(result.changes ?? 0);
    },
    deleteOwned(input) {
      const ids = input.ownerUserIds.filter((id) => typeof id === 'string' && id.length > 0);
      if (ids.length === 0) return 0;
      const result = orm
        .delete(worlds)
        .where(and(eq(worlds.id, input.id), inArray(worlds.ownerUserId, ids)))
        .run();
      return Number(result.changes ?? 0);
    },
    deleteWorldMapRow(worldId) {
      orm.delete(worldMaps).where(eq(worldMaps.worldId, worldId)).run();
    },
  };
}
