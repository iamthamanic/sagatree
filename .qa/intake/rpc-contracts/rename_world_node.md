# RPC `rename_world_node`
## VORHER
- SQL: supabase/migrations/104_atlas_worldbuilder_mutations.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/world/world-place-service.ts`

### Parameters (guess from SQL — verify)
```
p_world_profile_id UUID
p_place_id UUID
p_name TEXT
```

### Returns (guess): `JSONB`

### Tables (guess): public, v_parent, v_row

## NACHHER
- Module: `server/src/application/commands/rename_world_node.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
