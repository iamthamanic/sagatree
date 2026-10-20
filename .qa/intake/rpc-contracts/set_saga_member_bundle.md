# RPC `set_saga_member_bundle`
## VORHER
- SQL: supabase/migrations/075_saga_permission_grants.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/project/saga-permission-service.ts`

### Parameters (guess from SQL — verify)
```
p_project_id UUID
p_member_id UUID
p_bundle_id TEXT
```

### Returns (guess): `JSONB`

### Tables (guess): GM, PUBLIC, SET, public, v_governance_left, v_member, v_row

## NACHHER
- Module: `server/src/application/commands/set_saga_member_bundle.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
