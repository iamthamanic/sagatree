/**
 * Persistence-facing store contract for world reads (implemented by repositories/world).
 * Private to the world module — adapters are wired only at the composition root.
 * Location: server/src/modules/world/internal/world-read-store.ts
 */
export type WorldStoredRow = {
  readonly id: string;
  readonly ownerUserId: string;
  readonly title: string;
  readonly createdAt: string;
  readonly publicId: string | null;
};

export type WorldReadStore = {
  readonly listByOwner: (ownerUserId: string) => readonly WorldStoredRow[];
  readonly findById: (worldId: string) => WorldStoredRow | null;
  /** CUT-10 — resolve by WO- public id (case-normalized by caller). */
  readonly findByPublicId: (publicId: string) => WorldStoredRow | null;
};
