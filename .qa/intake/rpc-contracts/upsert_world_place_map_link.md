# RPC `upsert_world_place_map_link`
## VORHER
- SQL: supabase/migrations/096_donalu_place_map_link_rpc.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/world/world-place-service.ts`

### Parameters (guess from SQL — verify)
```
p_world_profile_id UUID
p_place_id UUID
p_map_id UUID
p_usage TEXT
p_feature_id TEXT DEFAULT NULL
p_anchor JSONB DEFAULT '{}'::jsonb
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, SET, public, v_project_id, v_row

## NACHHER
- Module: `server/src/application/commands/upsert_world_place_map_link.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
