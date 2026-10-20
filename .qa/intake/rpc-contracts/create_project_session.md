# RPC `create_project_session`
## VORHER
- SQL: supabase/migrations/061_session_recaps_and_handover.sql, supabase/migrations/039_public_resource_ids_and_session_numbers.sql, supabase/migrations/040_session_join_code_security.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/project/project-service.ts`

### Parameters (guess from SQL — verify)
```
p_project_id UUID
p_name TEXT DEFAULT NULL
p_notes TEXT DEFAULT NULL
```

### Returns (guess): `public.sessions`

### Tables (guess): PUBLIC, created, is_member, most, persisted, public, v_adv, v_knowledge, v_project, v_role

## NACHHER
- Module: `server/src/application/commands/create_project_session.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
