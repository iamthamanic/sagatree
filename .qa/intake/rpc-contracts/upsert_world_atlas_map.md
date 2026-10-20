# RPC `upsert_world_atlas_map`
## VORHER
- SQL: supabase/migrations/094_world_atlas.sql
- SECURITY DEFINER: `True`
- Call sites:
  - `src/infrastructure/world/world-atlas-service.ts`

### Parameters (guess from SQL — verify)
```
p_world_profile_id UUID
p_map_id UUID
p_parent_map_id UUID
p_kind TEXT
p_title TEXT
p_sort_order INT
p_bounds JSONB
p_layers JSONB
p_basemap_storage_path TEXT
p_azgaar_map_storage_path TEXT
p_generator_meta JSONB
p_expected_revision BIGINT
```

### Returns (guess): `JSONB`

### Tables (guess): public, v_id

## NACHHER
- Module: `server/src/application/commands/upsert_world_atlas_map.ts`
- Status: BLOCKED until GATE-01 + per-command design review
- Must preserve authz fail-closed; no client-elevated owner fields

## TESTS
- Happy path parity vs current RPC on fixture DB
- Authz negative: wrong owner/GM/player
- Transaction rollback on mid-failure
- expectedRevision conflict

## GRENZEN
- No schema redesign without ADR
- No dropping SECURITY DEFINER semantics without Policy Service equivalent
