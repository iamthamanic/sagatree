import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const worlds = sqliteTable('worlds', {
  id: text('id').primaryKey(), ownerUserId: text('owner_user_id').notNull(),
});
export const maps = sqliteTable('maps', {
  id: text('id').primaryKey(), worldId: text('world_id').notNull().references(() => worlds.id),
  title: text('title').notNull(), revision: integer('revision').notNull().default(0),
  gmOnly: integer('gm_only', { mode: 'boolean' }).notNull().default(false),
  body: text('body').notNull(), layers: text('layers').notNull(), gmNotes: text('gm_notes'),
});
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(), worldId: text('world_id').notNull().references(() => worlds.id),
  gmUserId: text('gm_user_id').notNull(),
});
export const members = sqliteTable('project_members', {
  projectId: text('project_id').notNull().references(() => projects.id),
  userId: text('user_id').notNull(), role: text('role').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull(),
}, (t) => [primaryKey({ columns: [t.projectId, t.userId] })]);
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull().references(() => projects.id),
  status: text('status').notNull(), revision: integer('revision').notNull().default(0),
});
export const reveals = sqliteTable('map_reveals', {
  projectId: text('project_id').notNull().references(() => projects.id),
  mapId: text('map_id').notNull().references(() => maps.id), playerUserId: text('player_user_id').notNull(),
}, (t) => [primaryKey({ columns: [t.projectId, t.mapId, t.playerUserId] })]);
export const receipts = sqliteTable('command_receipts', {
  id: text('id').primaryKey(), mapId: text('map_id').notNull().references(() => maps.id),
  actorUserId: text('actor_user_id').notNull(), requestDigest: text('request_digest').notNull(),
  resultTitle: text('result_title').notNull(), resultRevision: integer('result_revision').notNull(),
});
