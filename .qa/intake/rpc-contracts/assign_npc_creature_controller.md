# RPC `assign_npc_creature_controller`
## VORHER
- SQL: supabase/migrations/022_npc_creature_controller_assignments.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/npc-creature/npc-creature-service.ts`

### Parameters (guess from SQL — verify)
```
p_project_id UUID
p_definition_id TEXT
p_controller_user_id UUID DEFAULT NULL
```

### Returns (guess): `public.npc_creature_controller_assignments`

### Tables (guess): OF, PUBLIC, SET, anon, public, v_row

## NACHHER
- Module: `server/src/application/commands/assign_npc_creature_controller.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
