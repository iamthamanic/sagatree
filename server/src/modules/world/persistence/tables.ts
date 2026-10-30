/**
 * world module owned tables (catalog mirror). Private — do not import across modules.
 * Location: server/src/modules/world/persistence/tables.ts
 *
 * Owned: worlds, world_maps (+ atlas/places tables in later migrations).
 * Typed Drizzle mirrors: server/src/persistence/schema/world.ts (composition).
 * SQL catalog remains the applied source (MIG-011 runner).
 */
export const WORLD_OWNED_TABLES = ['worlds', 'world_maps'] as const;
