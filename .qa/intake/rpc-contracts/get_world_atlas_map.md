# RPC `get_world_atlas_map`
## VORHER
- SQL: supabase/migrations/102_world_atlas_player_redaction_force.sql, supabase/migrations/097_donalu_player_place_projection.sql, supabase/migrations/094_world_atlas.sql, supabase/migrations/105_atlas_worldbuilder_player_projection.sql, supabase/migrations/105_atlas_worldbuilder_player_projection.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/world/world-atlas-service.ts`

### Parameters (verified against live three-argument SQL signature in migration 105)
```
p_map_id UUID
p_player_view BOOLEAN DEFAULT false
p_saga_public_id TEXT DEFAULT NULL
```
A two-argument compatibility overload delegates to the three-argument function with NULL saga. The player projection must resolve the saga and enforce its revealed-map set before returning content.

### Returns (verified): `JSONB`

### Source relations and guards: `world_atlas_maps`, `atlas_wb_resolve_saga_project`, `atlas_wb_party_revealed_map_ids`, `current_user_can_read_world_profile`, `current_user_can_edit_world_profile`. Full SQL effect/relationship audit remains required.

## NACHHER
- Module: `server/src/application/commands/get_world_atlas_map.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
