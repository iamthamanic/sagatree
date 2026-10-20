# RPC `list_saga_bindings`
## VORHER
- SQL: supabase/migrations/096_donalu_place_map_link_rpc.sql, supabase/migrations/075_saga_permission_grants.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/project/saga-permission-service.ts`

### Parameters (guess from SQL — verify)
```
p_public_id TEXT
p_asset_kind TEXT DEFAULT NULL
```

### Returns (guess): `JSONB`

### Tables (guess): public, v_project_id

## NACHHER
- Module: `server/src/application/commands/list_saga_bindings.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
