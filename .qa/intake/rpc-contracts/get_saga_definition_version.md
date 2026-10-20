# RPC `get_saga_definition_version`
## VORHER
- SQL: supabase/migrations/063_saga_definitions.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/saga/saga-definition-service.ts`

### Parameters (guess from SQL — verify)
```
p_version_id UUID
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, public, v_def, v_is_gm, v_member, v_ver, v_ver_id

## NACHHER
- Module: `server/src/application/commands/get_saga_definition_version.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
