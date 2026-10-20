# RPC `apply_session_runtime_command`
## VORHER
- SQL: supabase/migrations/051_session_director_runtime.sql, supabase/migrations/050_session_adventure_runtime.sql, supabase/migrations/044_session_combat_encounter.sql, supabase/migrations/048_session_knowledge_reveals.sql, supabase/migrations/049_session_death_lifecycle.sql, supabase/migrations/043_session_shared_scene_presentation.sql, supabase/migrations/042_session_shared_rolls.sql, supabase/migrations/041_session_runtime_state.sql, supabase/migrations/047_session_program_presentation.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/session/session-runtime-service.ts`

### Parameters (guess from SQL — verify)
```
p_session_id UUID
p_expected_revision BIGINT
p_kind TEXT
p_payload JSONB DEFAULT '{}'::jsonb
p_idempotency_key TEXT DEFAULT NULL
```

### Returns (guess): `JSONB`

### Tables (guess): p_expected_revision, public, v_existing, v_session

## NACHHER
- Module: `server/src/application/commands/apply_session_runtime_command.ts`
- Status: BLOCKED until GATE-01/04 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure
- expectedRevision conflict
- idempotencyKey replay

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
