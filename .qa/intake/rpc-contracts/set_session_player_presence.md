# RPC `set_session_player_presence`
## VORHER
- SQL: supabase/migrations/041_session_runtime_state.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/session/session-runtime-service.ts`

### Parameters (guess from SQL — verify)
```
p_session_id UUID
p_is_online BOOLEAN
p_expected_revision BIGINT DEFAULT NULL
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, audits, p_expected_revision, public, v_session

## NACHHER
- Module: `server/src/application/commands/set_session_player_presence.ts`
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
