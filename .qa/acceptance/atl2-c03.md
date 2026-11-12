# Feature: ATL2-C03 — Multi-select, layers, visibility, locks (#1208)

<!-- atlas-v2-epic: #1196; slice: C03; slug: atl2-c03 -->

## Intent

Editor hat verständliche Werkzeug-/Layer-Struktur: Multi-Select, Sichtbarkeit,
Sperre, Kontext-Inspektor — stufenspezifische Tools bleiben registry-gesteuert.

## Preconditions

- #1207 ATL2-C02 CLEAR.

## Happy Path

- [ ] Shift+Klick und Auswahl-Rahmen setzen Mehrfachauswahl
- [ ] Versteckte Ebenen: kein Hit-Test; gesperrte: kein Edit
- [ ] LayerLocks persistieren in unifiedCanvas
- [ ] Inspektor zeigt Auswahlanzahl
- [ ] Touched files: zero type escape hatches

## Edge Cases

- [ ] Legacy docs ohne layerLocks → {}
- [ ] Locked interior: room/wall/door edits blocked

## Security Coverage

- Writes remain canEdit + host upsert

## Composition Gate

SKIPPED — editor selection/layer chrome on existing upsert hop

## Implementation Notes

- Domain: `atlas-selection.ts`, `layerLocks` on UnifiedCanvasDoc
- Editor: UnifiedAtlasEditor multi-select + lock toggles
- Self-test: `scripts/atl2-c03-layers-multiselect.self-test.mjs`
