# RPC `spawn_npc_creature_instance`
## VORHER
- SQL: supabase/migrations/023_npc_creature_instances.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/npc-creature/npc-creature-service.ts`

### Parameters (guess from SQL — verify)
```
p_project_id UUID
p_definition_id TEXT
p_instance_kind TEXT
p_snapshot JSONB
p_runtime JSONB
p_display_name TEXT
p_sequence_number INTEGER
p_session_id UUID DEFAULT NULL
```

### Returns (guess): `public.npc_creature_instances`

### Tables (guess): PUBLIC, anon, p_project_id, public, v_row, v_session_project

## NACHHER
- Module: `server/src/application/commands/spawn_npc_creature_instance.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
