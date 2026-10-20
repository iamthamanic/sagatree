# RPC `upsert_world_place`
## VORHER
- SQL: supabase/migrations/095_donalu_world_places.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/world/world-place-service.ts`

### Parameters (guess from SQL — verify)
```
p_world_profile_id UUID
p_place_id UUID
p_parent_place_id UUID
p_kind TEXT
p_name TEXT
p_description TEXT
p_status TEXT
p_seed_key TEXT
p_sort_order INT
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, public, v_row

## NACHHER
- Module: `server/src/application/commands/upsert_world_place.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
