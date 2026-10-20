# RPC `get_world_atlas_map`
## VORHER
- SQL: supabase/migrations/102_world_atlas_player_redaction_force.sql, supabase/migrations/097_donalu_player_place_projection.sql, supabase/migrations/094_world_atlas.sql, supabase/migrations/105_atlas_worldbuilder_player_projection.sql, supabase/migrations/105_atlas_worldbuilder_player_projection.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/world/world-atlas-service.ts`

### Parameters (guess from SQL — verify)
```
p_map_id UUID
p_player_view BOOLEAN DEFAULT false
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, jsonb_array_elements, public, v_layers, v_row

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
