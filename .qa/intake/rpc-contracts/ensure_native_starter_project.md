# RPC `ensure_native_starter_project`
## VORHER
- SQL: supabase/migrations/076_dornhain_full_catalog_seed.sql, supabase/migrations/077_dornhain_default_all_accounts.sql, supabase/migrations/067_ensure_native_starter_project.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/project/project-service.ts`

### Parameters (guess from SQL — verify)
```
p_slug TEXT DEFAULT 'dornhain.whisper'
```

### Returns (guess): `JSONB`

### Tables (guess): existing, public, v_def, v_ver

## NACHHER
- Module: `server/src/application/commands/ensure_native_starter_project.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
