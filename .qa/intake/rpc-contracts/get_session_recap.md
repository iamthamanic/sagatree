# RPC `get_session_recap`
## VORHER
- SQL: supabase/migrations/061_session_recaps_and_handover.sql, supabase/migrations/062_session_recap_ai_summary.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/session/session-recap-service.ts`

### Parameters (guess from SQL — verify)
```
p_session_id UUID
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, SET, public, v_recap, v_session

## NACHHER
- Module: `server/src/application/commands/get_session_recap.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
