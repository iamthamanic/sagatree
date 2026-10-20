# RPC `resolve_session_invite`
## VORHER
- SQL: supabase/migrations/055_session_invites.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/session/session-service.ts`

### Parameters (guess from SQL — verify)
```
p_token TEXT
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, public, v_already_member, v_character_public_id, v_invite, v_saga_public_id, v_session

## NACHHER
- Module: `server/src/application/commands/resolve_session_invite.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
