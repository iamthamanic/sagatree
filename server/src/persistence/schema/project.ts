/**
 * Drizzle schema for project-owned catalog tables (ADR-ST-05).
 * Location: server/src/persistence/schema/project.ts
 */
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  worldId: text('world_id').notNull(),
  gmUserId: text('gm_user_id').notNull(),
  title: text('title').notNull(),
  createdAt: text('created_at').notNull(),
  sagaId: text('saga_id'),
});

export const projectMembers = sqliteTable(
  'project_members',
  {
    projectId: text('project_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role').notNull(),
    active: integer('active').notNull(),
    joinedAt: text('joined_at'),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);
