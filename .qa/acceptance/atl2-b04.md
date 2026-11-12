# Feature: ATL2-B04 — Retire webglRuntimeV3 geometry write path (#1204)

<!-- atlas-v2-epic: #1196; slice: B04; slug: atl2-b04 -->

## Intent

`unifiedCanvas` / V2 is alone authoritative for persisted geometry.
`webglRuntimeV3` remains a documented legacy **read** adapter (+ ephemeral 3D seed)
and must not store a contradictory geometry shadow after product save.

## Preconditions

- #1202 / #1203 merged.
- Bridge + controlled 3D mount (#721 / #749) present.

## Happy Path

- [ ] Delete in 2D/3D stays deleted after remount, reload, and alt-format migrate
- [ ] Product save writes geometry only into `unifiedCanvas` (no props/walls/strokes/rooms in sidecar)
- [ ] Legacy meta with only `webglRuntimeV3` geometry imports into canvas once (dirty until save)
- [ ] Geometry backup enables rollback of stripped sidecar
- [ ] Touched files: zero type escape hatches

## Edge Cases

- [ ] Empty canvas + empty runtime → no invented geometry
- [ ] Stale sidecar with ghosts + canonical canvas without them → persist keeps canvas, strips sidecar
- [ ] Non-geometry extras (layers / placeNames) survive strip

## Security Coverage

- No new auth surface; upsert remains owner/editor gated
- Player projection unchanged (redact path already on host)

## Composition Gate

SKIPPED — domain persist contract + editor save/load wiring on existing atlas upsert hop
(see `.qa/runs/composition-gate-atl2-b04.md`)

## Implementation Notes

- Domain: `src/domains/world/atlas/atlas-webgl-write-retire.ts`
- Editor: `src/app/world/atlas/useWorldAtlasEditor.ts` (`mergeCanonicalAtlasGeometryForPersist`)
- Inventory: `.qa/design/atl2-b04-webgl-write-retire.md`
- Self-test: `scripts/atl2-b04-webgl-write-retire.self-test.mjs`
