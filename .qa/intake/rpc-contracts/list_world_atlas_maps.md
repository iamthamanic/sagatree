# RPC `list_world_atlas_maps`
## VORHER
- SQL: supabase/migrations/094_world_atlas.sql, supabase/migrations/105_atlas_worldbuilder_player_projection.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/world/world-atlas-service.ts`

### Parameters (verified against `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`)
```
p_world_profile_id UUID
p_player_view BOOLEAN DEFAULT false
p_saga_public_id TEXT DEFAULT NULL
```
The player view requires a resolved Saga project; missing/invalid saga scope must fail closed and never return a private atlas catalog.

### Returns (verified): `JSONB`

### Source relations and guards: `world_atlas_maps`, `atlas_wb_resolve_saga_project`, `atlas_wb_party_revealed_map_ids`, `current_user_can_read_world_profile`, `current_user_can_edit_world_profile`. Verify all dependent tables and policies before the port.

## NACHHER
- Module: `server/src/application/commands/list_world_atlas_maps.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
