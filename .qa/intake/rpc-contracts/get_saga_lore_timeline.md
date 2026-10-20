# RPC `get_saga_lore_timeline`
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

### Tables (guess): jsonb_array_elements, public, v_payload, v_project

## NACHHER
- Module: `server/src/application/commands/get_saga_lore_timeline.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
