# RPC `save_world_map`
## VORHER
- SQL: supabase/migrations/068_world_maps.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/world/world-map-service.ts`

### Parameters (guess from SQL — verify)
```
p_world_profile_id UUID
p_expected_revision BIGINT
p_map_data JSONB
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, jsonb_array_elements, public, v_row

## NACHHER
- Module: `server/src/application/commands/save_world_map.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure
- expectedRevision conflict

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
