# ATL2-E01 — Primary maps & six-level WorldNode links

**Issue:** #1219  
**Epic:** #1196 Phase E  
**Slug:** `atl2-e01`

## Purpose

Prove the existing world-hierarchy kernel and host create path deliver a stable
six-level map tree with primary maps — the foundation for E02 anchors and E03 nav.

## Binding levels

| Level | Storage | Primary map |
| --- | --- | --- |
| World | `WorldProfile` (+ atlas `kind=world` root) | world root map |
| Continent…Room | `world_places` + `world_place_map_links.usage=primary` | one exclusive primary |

No seventh `region` hierarchy level. Cartographic atlas `kind=region` remains a
map-frame label, not a WorldNodeKind.

## Enforcement (already shipped; E01 evidence)

- Domain: `assertHierarchyEdge`, `planWorldNodeCreate`, `wouldCreateReparentCycle`
- Host: `createWorldNodeWithMaps`, unique primary index, `23514`/`23505` negatives
- Normative: `.qa/design/atlas-worldbuilder-contract.md`

## Out of scope

- Spatial locate / ParentSpatialAnchor (E02)
- Breadcrumb zoom UX (E03)
- LOD transitions (E04)
