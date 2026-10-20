# Donalu world-scoped review queue (#753)

World: WO-9FFK6
Generated: 2026-10-19T20:14:10.279Z
Read-only: true

## Summary

```json
{
  "placeCount": 6,
  "mapCount": 5,
  "linkCount": 9,
  "sagaCount": 1,
  "orphanSettlementCount": 1,
  "ambiguousReviewCount": 3,
  "placesMissingPrimaryMap": 0
}
```

## Needs review

Ambiguous kinds — no auto-promote:

- place `6f270016-a7b1-4536-a0b0-68df58ef0d8b` **Marktplatz Dornhain** kind=`site` parent=`d4cd0cd9-806e-49da-bb90-83cbaf281a7d` — Outdoor site vs building entrance — review queue
- place `d45dba1f-660e-42c5-8042-aaff832ebbcd` **Krypta unter dem Hügel** kind=`dungeon` parent=`d4cd0cd9-806e-49da-bb90-83cbaf281a7d` — Usually building.dungeon subtype, not a hierarchy level
- place `73a7b41e-57ac-47ec-8489-4c932505539b` **Banditenlager (falsche Spur)** kind=`site` parent=`d4cd0cd9-806e-49da-bb90-83cbaf281a7d` — Outdoor site vs building entrance — review queue

## Places (UUID + parent chain + primary map)

- `d4cd0cd9-806e-49da-bb90-83cbaf281a7d` Dornhain kind=`settlement` chain=[∅] primaryMap=`5523d90b-0615-402d-ae08-00541ac28f8e`
- `e8c5971a-f32e-4e23-9a48-a034797c4d75` Taverne Zum Flüstern kind=`building` chain=[d4cd0cd9-806e-49da-bb90-83cbaf281a7d] primaryMap=`5523d90b-0615-402d-ae08-00541ac28f8e`
- `6f270016-a7b1-4536-a0b0-68df58ef0d8b` Marktplatz Dornhain kind=`site` chain=[d4cd0cd9-806e-49da-bb90-83cbaf281a7d] primaryMap=`5523d90b-0615-402d-ae08-00541ac28f8e`
- `b2e9c3b3-a298-4d93-a0e4-aee9e8a89eac` Schattenwald kind=`area` chain=[d4cd0cd9-806e-49da-bb90-83cbaf281a7d] primaryMap=`76ca488e-76a4-4753-8dae-43f8b6ce6c43`
- `d45dba1f-660e-42c5-8042-aaff832ebbcd` Krypta unter dem Hügel kind=`dungeon` chain=[d4cd0cd9-806e-49da-bb90-83cbaf281a7d] primaryMap=`dec3e11b-9afc-4ac8-8cc9-2218a898f687`
- `73a7b41e-57ac-47ec-8489-4c932505539b` Banditenlager (falsche Spur) kind=`site` chain=[d4cd0cd9-806e-49da-bb90-83cbaf281a7d] primaryMap=`76ca488e-76a4-4753-8dae-43f8b6ce6c43`

## Saga bindings

- `SA-E979J` Das Flüstern unter Dornhain bindings=25 locations=5

## Restore plan

- 1. Stop writers / disable atlas_wb_migration_gates.enabled for the world.
- 2. Restore Postgres from `.qa/evidence/atlas-worldbuilder-evidence/backups/` dump (see #713 restore log).
- 3. Re-run dry-run; compare place/map UUIDs, saga bindings, and storage paths.
- 4. Do not delete world_places / world_atlas_maps / public_ids during rollback.
