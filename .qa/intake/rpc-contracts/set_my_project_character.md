# RPC `set_my_project_character`
## VORHER
- SQL: supabase/migrations/004_project_membership_security.sql, supabase/migrations/032_incomplete_sheet_blocks_adventure_join.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/project/project-member-service.ts`

### Parameters (guess from SQL — verify)
```
p_project_id UUID
p_character_id UUID DEFAULT NULL
```

### Returns (guess): `UUID`

### Tables (guess): PUBLIC, anon, public, v_member_id

## NACHHER
- Module: `server/src/application/commands/set_my_project_character.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
