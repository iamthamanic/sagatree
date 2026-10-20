# RPC `publish_saga_definition_version`
## VORHER
- SQL: supabase/migrations/064_saga_editor_v1.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/saga/saga-definition-service.ts`

### Parameters (guess from SQL — verify)
```
p_saga_id UUID
p_expected_revision INTEGER
```

### Returns (guess): `JSONB`

### Tables (guess): COALESCE, PUBLIC, public, v_def, v_new, v_next_num, v_pub, v_src, v_user

## NACHHER
- Module: `server/src/application/commands/publish_saga_definition_version.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure
- expectedRevision conflict

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
