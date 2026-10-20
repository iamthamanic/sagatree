# RPC `get_saga_overview`
## VORHER
- SQL: supabase/migrations/061_session_recaps_and_handover.sql, supabase/migrations/093_fix_saga_overview_shared_adventure.sql, supabase/migrations/069_party_location_overview.sql, supabase/migrations/062_session_recap_ai_summary.sql, supabase/migrations/091_saga_overview_world_profile_id.sql, supabase/migrations/063_saga_definitions.sql, supabase/migrations/060_saga_overview.sql, supabase/migrations/066_saga_between_sessions_bote.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/project/saga-overview-service.ts`

### Parameters (guess from SQL — verify)
```
p_public_id TEXT
```

### Returns (guess): `JSONB`

### Tables (guess): jsonb_array_elements, jsonb_each, public, v_consequences, v_episodes, v_open_sessions, v_project, v_role

## NACHHER
- Module: `server/src/application/commands/get_saga_overview.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
