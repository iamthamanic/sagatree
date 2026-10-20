# RPC `set_session_status`
## VORHER
- SQL: supabase/migrations/061_session_recaps_and_handover.sql, supabase/migrations/040_session_join_code_security.sql, supabase/migrations/041_session_runtime_state.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/session/session-service.ts`

### Parameters (guess from SQL — verify)
```
p_session_id UUID
p_status TEXT
```

### Returns (guess): `public.sessions`

### Tables (guess): PUBLIC, is_member, latest, most, public, v_adv, v_knowledge, v_session

## NACHHER
- Module: `server/src/application/commands/set_session_status.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
