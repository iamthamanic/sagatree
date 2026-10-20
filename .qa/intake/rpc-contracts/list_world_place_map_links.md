# RPC `list_world_place_map_links`
## VORHER
- SQL: supabase/migrations/097_donalu_player_place_projection.sql, supabase/migrations/095_donalu_world_places.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/world/world-place-service.ts`

### Parameters (guess from SQL — verify)
```
p_world_profile_id UUID
p_player_view BOOLEAN DEFAULT false
p_saga_public_id TEXT DEFAULT NULL
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, generator_meta, jsonb, public, v_layers, v_project, v_row, v_rows

## NACHHER
- Module: `server/src/application/commands/list_world_place_map_links.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
