# RPC `copy_native_saga_definition`
## VORHER
- SQL: supabase/migrations/064_saga_editor_v1.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/saga/saga-definition-service.ts`

### Parameters (guess from SQL — verify)
```
p_source_saga_id UUID
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, public, v_pub, v_src

## NACHHER
- Module: `server/src/application/commands/copy_native_saga_definition.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
