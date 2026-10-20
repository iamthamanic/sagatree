# RPC `update_npc_creature_instance_runtime`
## VORHER
- SQL: supabase/migrations/023_npc_creature_instances.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/npc-creature/npc-creature-service.ts`

### Parameters (guess from SQL — verify)
```
p_instance_id UUID
p_runtime JSONB
```

### Returns (guess): `public.npc_creature_instances`

### Tables (guess): PUBLIC, anon, public, v_project_id, v_row

## NACHHER
- Module: `server/src/application/commands/update_npc_creature_instance_runtime.ts`
- Status: BLOCKED until GATE-01/04 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
