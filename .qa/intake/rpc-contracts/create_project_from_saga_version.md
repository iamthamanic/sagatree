# RPC `create_project_from_saga_version`
## VORHER
- SQL: supabase/migrations/063_saga_definitions.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/saga/saga-definition-service.ts`

### Parameters (guess from SQL — verify)
```
p_saga_id UUID
p_version_id UUID
p_name TEXT DEFAULT NULL
```

### Returns (guess): `public.projects`

### Tables (guess): PUBLIC, actor, created, public, v_def, v_ver

## NACHHER
- Module: `server/src/application/commands/create_project_from_saga_version.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
