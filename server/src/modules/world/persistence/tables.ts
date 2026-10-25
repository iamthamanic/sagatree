/**
 * world module owned tables (catalog mirror). Private — do not import across modules.
 * Location: server/src/modules/world/persistence/tables.ts
 *
 * Owned: worlds, world_maps. Drizzle adapters land in follow-on tickets (GATE-01); SQL catalog is source applied by MIG-011 runner.
 */
export const WORLD_OWNED_TABLES = ['worlds', 'world_maps'] as const;
