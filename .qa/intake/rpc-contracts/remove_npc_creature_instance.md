# RPC `remove_npc_creature_instance`
## VORHER
- SQL: supabase/migrations/023_npc_creature_instances.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/npc-creature/npc-creature-service.ts`

### Parameters (guess from SQL — verify)
```
p_instance_id UUID
```

### Returns (guess): `UUID`

### Tables (guess): OF, PUBLIC, anon, public, v_project_id, v_row

## NACHHER
- Module: `server/src/application/commands/remove_npc_creature_instance.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
