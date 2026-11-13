# Feature: ATL2-E02 — ParentSpatialAnchor, Kalibrierung, Karten-Verortung (#1220)

<!-- atlas-v2-epic: #1196; slice: E02; slug: atl2-e02 -->

## Intent

Jede Kindkarte kann räumlich auf ihrer Elternkarte verortet werden und sagt
ehrlich, wenn sie unverortet ist. Explizite Anker bleiben nach Save/Reload
korrekt und haben eine invertierbare Koordinatentransformation.

## Preconditions

- #1219 ATL2-E01 CLEAR (primary maps + WorldNode links)
- Domain `map-frame.ts` + host atlas upsert already on `main`

## Happy Path

- [ ] Domain: `locateChildMapFrame` / `parentAnchorFromParentRect` produce grounded anchors
- [ ] Domain: `mapPointChildToParent` ↔ `mapPointParentToChild` round-trip (incl. rotation)
- [ ] Domain: unlocated frame → `canLodEnterChildMap` false; no scale-true drill
- [ ] Host SQLite: locate via upsert `generatorMeta.mapFrame`; reload via getMap matches
- [ ] Negative / non-positive `metersPerUnit` → uncalibrated (null); zoom caption stays abstract
- [ ] Gate report `.qa/runs/atl2-e02-parent-spatial-anchor.md` CLEAR
- [ ] Touched files: zero type escape hatches

## Edge Cases

- [ ] Zero / negative extent rejected
- [ ] Tiny positive extent accepted
- [ ] Overlapping sibling locate rects allowed
- [ ] Unlocated child never LOD-enters / WebGL drill denied

## Non-Goals

- Erfundene Meter-Skala / auto-geografie
- Zoom breadcrumb UX (ATL2-E03)

## Security Coverage

- Owner upsert locate; stranger denied (42501)
- No invented elevated origins

## Composition Gate

SKIPPED — stabilize/evidence lock on existing locate + map-frame ports
(see `.qa/runs/composition-gate-atl2-e02.md`)

## Implementation Notes

- Protocol: `scripts/atl2-e02-parent-spatial-anchor.self-test.mjs`
- Domain transforms in `src/domains/world/atlas/map-frame.ts`
