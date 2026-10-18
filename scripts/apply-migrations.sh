#!/usr/bin/env bash
# Apply SagaTree SQL migrations to the self-host Postgres container (sagatree-db).
# Documented path: README_SELFHOST + README.md migration order. Not cloud.
# Legacy container name sagadrive-db still accepted if an old stack is running.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${SAGATREE_DB_CONTAINER:-${SAGADRIVE_DB_CONTAINER:-}}"
if [[ -z "$CONTAINER" ]]; then
  if docker ps --format '{{.Names}}' | grep -qx 'sagatree-db'; then
    CONTAINER='sagatree-db'
  elif docker ps --format '{{.Names}}' | grep -qx 'sagadrive-db'; then
    CONTAINER='sagadrive-db'
  else
    CONTAINER='sagatree-db'
  fi
fi
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-postgres}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container '$CONTAINER' is not running. Start it with: docker compose up -d supabase-db" >&2
  exit 1
fi

migrations=(
  001_initial.sql
  002_character_trait_arrays.sql
  003_character_lore_rate_limits.sql
  004_project_membership_security.sql
  005_character_ruleset_metadata.sql
  006_character_portrait_storage.sql
  007_sagadrive_character_profile.sql
  008_world_profiles.sql
  009_character_adventure_arcs.sql
  010_characters_v3_columns.sql
  011_seed_local_admin.sql
  012_character_presets.sql
  013_character_presets_rls_hardening.sql
  014_character_abilities_emotion_profiles.sql
  015_inventory_item_definitions.sql
  016_character_inventory_v2.sql
  017_item_thumbnail_assets.sql
  018_item_model3d_assets.sql
  019_world_profiles_read_for_adventure.sql
  020_user_ai_provider_credentials.sql
  021_npc_creature_definitions.sql
  022_npc_creature_controller_assignments.sql
  023_npc_creature_instances.sql
  024_character_avatar_import.sql
  025_character_avatar_export.sql
  026_character_avatar_meshy_jobs.sql
  027_character_avatar_meshy_generation_mode.sql
  028_character_avatar_meshy_glb_budget.sql
  029_character_sheet_status.sql
  030_character_avatar_meshy_rig_task.sql
  031_character_avatar_meshy_jobs_no_client_write.sql
  032_incomplete_sheet_blocks_adventure_join.sql
  033_character_avatar_generation_settings.sql
  034_character_avatars_150mb.sql
  035_guard_sheet_status_complete.sql
  036_character_avatar_artifacts.sql
  037_character_avatar_analysis_result.sql
  038_character_avatar_body_profile.sql
  039_public_resource_ids_and_session_numbers.sql
  040_session_join_code_security.sql
  041_session_runtime_state.sql
  042_session_shared_rolls.sql
  043_session_shared_scene_presentation.sql
  044_session_combat_encounter.sql
  045_character_avatar_meshy_pending_glb.sql
  046_look_profiles.sql
  047_session_program_presentation.sql
  048_session_knowledge_reveals.sql
  049_session_death_lifecycle.sql
  050_session_adventure_runtime.sql
  051_session_director_runtime.sql
  052_projects_look_settings.sql
  053_sessions_look_override.sql
  054_characters_personal_look_override.sql
  055_session_invites.sql
  059_saga_state_column_privileges.sql
  060_saga_overview.sql
  061_session_recaps_and_handover.sql
  062_session_recap_ai_summary.sql
  063_saga_definitions.sql
  064_saga_editor_v1.sql
  065_saga_simulation_ops.sql
  066_saga_between_sessions_bote.sql
  067_ensure_native_starter_project.sql
  068_world_maps.sql
  069_party_location_overview.sql
  070_saga_promote_session_outcomes.sql
  071_restore_authenticated_project_session_writes.sql
  072_dornhain_seed_and_character_rls.sql
  073_sagatree_schema_rename_compat.sql
  074_seed_local_player.sql
  075_saga_permission_grants.sql
  076_dornhain_full_catalog_seed.sql
  077_dornhain_default_all_accounts.sql
  079_drop_sagadrive_aliases.sql
  080_rename_local_auth_emails_sagatree.sql
  081_user_profiles_and_avatars.sql
  082_duplicate_saga_playthrough.sql
  083_world_profiles_public_id.sql
  084_look_profiles_public_id.sql
  085_fix_function_bodies_sagatree.sql
  086_rls_rulesets_world_graphs.sql
  087_ai_gm_rate_limits.sql
  088_gm_earthspirit_presence_character.sql
  089_gm_presence_character_type.sql
  090_dornhain_basic_world_map.sql
  091_saga_overview_world_profile_id.sql
  092_fix_projects_rls_recursion.sql
  093_fix_saga_overview_shared_adventure.sql
  094_world_atlas.sql
  095_donalu_world_places.sql
  096_donalu_place_map_link_rpc.sql
  097_donalu_player_place_projection.sql
)

only="${1:-}"

apply_one() {
  local file="$1"
  local path="$ROOT/supabase/migrations/$file"
  if [[ ! -f "$path" ]]; then
    echo "Missing migration: $path" >&2
    exit 1
  fi
  echo "→ applying $file"
  # Prefer in-container /migrations mount; fall back to stdin.
  if docker exec "$CONTAINER" test -f "/migrations/$file"; then
    docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -f "/migrations/$file"
  else
    docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <"$path"
  fi
}

if [[ -n "$only" ]]; then
  apply_one "$only"
else
  for file in "${migrations[@]}"; do
    apply_one "$file"
  done
fi

echo "✓ migrations applied on $CONTAINER"
