# RPC `get_native_saga_definition_by_slug`
## VORHER
- SQL: supabase/migrations/063_saga_definitions.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/saga/saga-definition-service.ts`

### Parameters (guess from SQL — verify)
```
p_slug TEXT
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, actor, created, public, v_def, v_ver, v_ver_id

## NACHHER
- Module: `server/src/application/commands/get_native_saga_definition_by_slug.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
