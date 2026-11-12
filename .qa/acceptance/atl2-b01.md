# Feature: ATL2-B01 — Canonical Atlas feature types (#1201)

<!-- atlas-v2-epic: #1196; slice: B01; slug: atl2-b01 -->

## Intent

Versionierter Feature-Vertrag: Terrainfläche, politische Fläche, Weg, Fluss,
Gebäude, Raum-Grundriss, Wand, Tür, Objekt, Heightfield, Layer und Weltknoten
sind unterscheidbar; Autorität und Renderer-Abhängigkeiten sind dokumentiert;
gezeichneter Raum ≠ WorldNode(room).

## Preconditions

- Gate A (#1200) merged.
- Normative: `.qa/design/atlas-worldbuilder-contract.md`, Epic #1196 Design.
- Existing V1 wire: `UNIFIED_CANVAS_FORMAT = sagatree-unified-atlas-v1`.

## Happy Path

- [ ] Discriminated feature kinds + authority matrix published
- [ ] Drawn floor/coast rooms separated from WorldNode(room) in contract + types
- [ ] V1 wire kept; V2 catalog is additive classification (B02 owns persistence adapter)
- [ ] Edit-ops inventory for required geometry mutations documented
- [ ] Golden Dornhain v4 doc classifies without silent reclassification
- [ ] Migration/fallback matrix covers empty, legacy, ambiguous, dual-webgl

## Edge Cases

- [ ] Empty / demoSeed document → no invented features
- [ ] Ambiguous `rooms[]` polygons stay `legacy_area_ambiguous` (no auto political/terrain)
- [ ] Secret stamps remain GM-authority; player redaction unchanged
- [ ] Uncalibrated map frame (`metersPerUnit: null`) → heights not claimed as meters

## Security Coverage

- Owner-/world-scoped maps remain host-authoritative (no client elevation)
- Feature `secret` is GM-only; classification must not invent reveal
- Out of scope: new HTTP routes (B03)

## Composition Gate

SKIPPED — domain catalog + design docs; no new producer→consumer hop
(see `.qa/runs/composition-gate-atl2-b01.md`)

## Implementation Notes

- Design: `.qa/design/atl2-b01-canonical-features.md`
- Domain: `src/domains/world/atlas/atlas-canonical-features.ts`
- Self-test: `scripts/atl2-b01-canonical-features.self-test.mjs`
