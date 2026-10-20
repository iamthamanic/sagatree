# RPC `duplicate_saga_playthrough`
## VORHER
- SQL: supabase/migrations/082_duplicate_saga_playthrough.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/saga/saga-definition-service.ts`

### Parameters (guess from SQL — verify)
```
p_project_id UUID
p_mode TEXT DEFAULT 'fresh'
```

### Returns (guess): `TABLE (id UUID, public_id TEXT)`

### Tables (guess): PUBLIC, SET, actor, created, public, src, v_ver

## NACHHER
- Module: `server/src/application/commands/duplicate_saga_playthrough.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
