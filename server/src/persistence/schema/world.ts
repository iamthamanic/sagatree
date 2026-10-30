/**
 * Drizzle schema for world-owned bootstrap tables used by typed adapters (ADR-ST-05).
 * Location: server/src/persistence/schema/world.ts
 *
 * SQL catalog in server/migrations remains the applied source of truth.
 * Additional world tables keep using the Drizzle session `prepare` bridge until
 * their column mirrors land with their owning adapters.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const worlds = sqliteTable('worlds', {
  id: text('id').primaryKey(),
  ownerUserId: text('owner_user_id').notNull(),
  title: text('title').notNull(),
  createdAt: text('created_at').notNull(),
});

export const worldMaps = sqliteTable('world_maps', {
  worldId: text('world_id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  mapData: text('map_data').notNull().default('{}'),
  updatedAt: text('updated_at'),
});
