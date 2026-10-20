# RPC `get_session_runtime_snapshot`
## VORHER
- SQL: supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/048_session_knowledge_reveals.sql, supabase/migrations/041_session_runtime_state.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/session/session-runtime-service.ts`

### Parameters (guess from SQL — verify)
```
p_session_id UUID
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, public, v_character_id, v_roster, v_session

## NACHHER
- Module: `server/src/application/commands/get_session_runtime_snapshot.ts`
- Status: BLOCKED until GATE-01/04 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
