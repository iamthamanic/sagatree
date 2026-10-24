/**
 * Table → owning host module registry (host-modular-monolith §2 / §4).
 * Location: server/src/persistence/table-ownership.ts
 */
export type HostModuleId =
  | 'ops'
  | 'world'
  | 'project'
  | 'identity'
  | 'permissions'
  | 'saga'
  | 'session'
  | 'character'
  | 'inventory'
  | 'look'
  | 'media'
  | 'npc-creature'
  | 'marketplace'
  | 'rulesets'
  | 'ai'
  | 'user-profile';

/** Every persisted table in the approved bootstrap catalog maps to exactly one module. */
export const TABLE_OWNERSHIP: Readonly<Record<string, HostModuleId>> = Object.freeze({
  schema_migrations: 'ops',
  worlds: 'world',
  projects: 'project',
  project_members: 'project',
  assets: 'media',
  session_runtime: 'session',
  session_members: 'session',
  command_idempotency: 'session',
  session_events: 'session',
  play_sessions: 'session',
  session_invites: 'session',
  session_players: 'session',
});

export function owningModuleForTable(table: string): HostModuleId | null {
  return TABLE_OWNERSHIP[table] ?? null;
}

export function assertUniqueTableOwnership(): void {
  const seen = new Set<string>();
  for (const table of Object.keys(TABLE_OWNERSHIP)) {
    if (seen.has(table)) {
      throw new Error(`duplicate table ownership entry: ${table}`);
    }
    seen.add(table);
  }
}
