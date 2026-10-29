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
  world_maps: 'world',
  world_atlas_maps: 'world',
  world_places: 'world',
  world_place_map_links: 'world',
  world_node_create_idempotency: 'world',
  projects: 'project',
  project_members: 'project',
  characters: 'character',
  saga_permission_keys: 'permissions',
  saga_permission_bundles: 'permissions',
  saga_permission_bundle_keys: 'permissions',
  project_member_saga_grants: 'permissions',
  project_member_saga_bundles: 'permissions',
  saga_asset_bindings: 'permissions',
  assets: 'media',
  asset_upload_sessions: 'media',
  session_runtime: 'session',
  session_members: 'session',
  command_idempotency: 'session',
  session_events: 'session',
  play_sessions: 'session',
  session_recaps: 'session',
  session_outcome_promotions: 'session',
  npc_creature_definitions: 'npc-creature',
  npc_creature_controller_assignments: 'npc-creature',
  npc_creature_instances: 'npc-creature',
  session_invites: 'session',
  session_players: 'session',
  rulesets: 'rulesets',
  saga_definitions: 'saga',
  saga_definition_versions: 'saga',
  user_ai_provider_credentials: 'ai',
  ai_provider_credential_rate_limits: 'ai',
  look_profiles: 'look',
  look_profile_versions: 'look',
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
