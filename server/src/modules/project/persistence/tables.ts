/**
 * project module owned tables (catalog mirror). Private — do not import across modules.
 * Location: server/src/modules/project/persistence/tables.ts
 *
 * Owned: projects, project_members.
 */
export const PROJECT_OWNED_TABLES = ['projects', 'project_members'] as const;
