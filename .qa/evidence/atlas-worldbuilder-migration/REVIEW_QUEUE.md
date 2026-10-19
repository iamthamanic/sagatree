# Migration review queue (#723)

World: WO-9FFK6
Generated: 2026-10-19T07:52:10.095Z

## Summary

```json
{
  "keep": 4,
  "compatRead": 0,
  "addPlaceholders": 38,
  "ensurePrimaryMap": 0,
  "reviewQueue": 2,
  "skip": 0
}
```

## Needs review

- `place` `sample:dungeon` kind=`dungeon` — Usually building.dungeon subtype, not a hierarchy level
- `place` `sample:site` kind=`site` — Outdoor site vs building entrance — review queue

## Restore plan

- 1. Stop writers / disable atlas_wb_migration_gates.enabled for the world.
- 2. Restore Postgres from `.qa/evidence/atlas-worldbuilder-evidence/backups/` dump (see #713 restore log).
- 3. Re-run dry-run; compare place/map UUIDs, saga bindings, and storage paths.
- 4. Do not delete world_places / world_atlas_maps / public_ids during rollback.
