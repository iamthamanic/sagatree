# Feature: ATL2-C01 — 2D area / path / road / river / terrain tools (#1206)

<!-- atlas-v2-epic: #1196; slice: C01; slug: atl2-c01 -->

## Intent

GM kann Welt-, Land- und Ort-Karten mit Polygonen, Pinsel und editierbaren
Pfadpunkten gestalten — eine kanonische Schreibspur über MapEditOperation.

## Preconditions

- #1205 Gate B CLEAR.
- Existing Fläche tool + UnifiedCanvasDoc.

## Happy Path

- [ ] Welt/Kontinent/Land: Fläche, Gelände, Weg/Fluss erlaubt und speichern Punkte
- [ ] Selbstschneidende / leere Polygone abgelehnt (DE-Hinweis)
- [ ] Add/Move/Erase (Fläche, Stroke, Vertex) über MapEditOps; Save/Reload-identisch
- [ ] Brush-Radius clamped; Snap an Draft/Grid
- [ ] Touched files: zero type escape hatches

## Edge Cases

- [ ] Konkave Polygone: Hit-Test point-in-polygon bleibt gültig
- [ ] Letztes Stroke/Room löschen → leeres Array, kein Ghost
- [ ] Road + Material wasser = Fluss-Stroke

## Security Coverage

- Writes remain canEdit + host upsert; no new auth surface

## Composition Gate

SKIPPED — single-actor authoring geometry; existing upsert hop
(see `.qa/runs/composition-gate-atl2-c01.md`)

## Implementation Notes

- Domain: `canvas-polygon.ts`, `map-edit-ops.ts`, `atlas-tool-registry.ts`
- Editor: `UnifiedAtlasEditor.tsx`
- Self-test: `scripts/atl2-c01-2d-tools.self-test.mjs`
