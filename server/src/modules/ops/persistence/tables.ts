/**
 * ops module owned tables (catalog mirror). Private — do not import across modules.
 * Location: server/src/modules/ops/persistence/tables.ts
 *
 * Owned: schema_migrations (migration journal).
 */
export const OPS_OWNED_TABLES = ['schema_migrations'] as const;
