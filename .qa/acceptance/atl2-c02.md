# Feature: ATL2-C02 — Room / wall / door / building footprints (#1207)

<!-- atlas-v2-epic: #1196; slice: C02; slug: atl2-c02 -->

## Intent

GM kann Dungeon-/Gebäude-Grundrisse mit Raum, Wand, Tür und Footprint
bearbeiten — kanonisch über MapEditOperation, ohne automatischen WorldNode.

## Preconditions

- #1206 ATL2-C01 CLEAR.

## Happy Path

- [ ] Raum/Wand über MapEditOps hinzufügen, selektieren, verschieben/ändern, löschen
- [ ] Tür auf Wand setzen (`add_door`); Wand-Löschen entfernt Türen
- [ ] Raum drehen / Footprint drehen; Resize an Raumecke
- [ ] Wand-Endpunkte snappen an Raumecken/andere Wände
- [ ] UI-Hinweis: Geometrie ≠ WorldNode
- [ ] Touched files: zero type escape hatches

## Edge Cases

- [ ] Legacy docs ohne `doors` → parse als `[]`
- [ ] `replace_scene` leert Türen
- [ ] Door auf fehlender Wall → no-op

## Security Coverage

- Writes remain canEdit + host upsert

## Composition Gate

SKIPPED — same atlas upsert hop; geometry ops only
(see `.qa/runs/composition-gate-atl2-c02.md`)

## Implementation Notes

- Domain: doors on UnifiedCanvasDoc; pickWall/Door; snapStructurePoint
- Editor: UnifiedAtlasEditor room/wall/door tools
- Self-test: `scripts/atl2-c02-room-wall-door.self-test.mjs`
