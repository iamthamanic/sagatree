# RPC `get_my_saga_permissions`
## VORHER
- SQL: supabase/migrations/075_saga_permission_grants.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/project/saga-permission-service.ts`

### Parameters (guess from SQL — verify)
```
p_public_id TEXT
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, public, v_bundle, v_keys, v_project, v_project_id

## NACHHER
- Module: `server/src/application/commands/get_my_saga_permissions.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
