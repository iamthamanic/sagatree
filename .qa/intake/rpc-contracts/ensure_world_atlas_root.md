# RPC `ensure_world_atlas_root`
## VORHER
- SQL: supabase/migrations/094_world_atlas.sql, supabase/migrations/105_atlas_worldbuilder_player_projection.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/world/world-atlas-service.ts`

### Parameters (guess from SQL — verify)
```
p_world_profile_id UUID
```

### Returns (guess): `JSONB`

### Tables (guess): PUBLIC, public, v_id

## NACHHER
- Module: `server/src/application/commands/ensure_world_atlas_root.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
