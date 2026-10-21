# RPC `create_play_session`
## VORHER
- SQL: supabase/migrations/040_session_join_code_security.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/session/session-service.ts`

### Parameters (verified against `supabase/migrations/040_session_join_code_security.sql`)
```
p_project_id UUID
p_name TEXT DEFAULT NULL
```

### Returns (verified): `public.sessions`

### Actual write: `INSERT INTO public.sessions(project_id, session_number, name, status, code)`; allocates session number and unique join code. Only authenticated GM for the given project may execute (`public.is_project_gm`). Errors include `42501` for no auth/GM and `22023` for null project id. Preserve atomic allocation and code uniqueness.

## NACHHER
- Module: `server/src/application/commands/create_play_session.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
