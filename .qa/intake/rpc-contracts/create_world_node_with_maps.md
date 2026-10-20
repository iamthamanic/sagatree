# RPC `create_world_node_with_maps`
## VORHER
- SQL: supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/world/world-place-service.ts`

### Parameters (guess from SQL — verify)
```
p_world_profile_id UUID
p_kind TEXT
p_name TEXT
p_idempotency_key TEXT
p_subtype TEXT DEFAULT NULL
p_parent_place_id UUID DEFAULT NULL
p_description TEXT DEFAULT NULL
```

### Returns (guess): `JSONB`

### Tables (guess): public, v_cached, v_parent_kind, v_parent_map, v_place

## NACHHER
- Module: `server/src/application/commands/create_world_node_with_maps.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure
- idempotencyKey replay

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
