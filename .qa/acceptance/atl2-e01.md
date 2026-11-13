# Feature: ATL2-E01 — Primary maps & WorldNode links (six levels) (#1219)

<!-- atlas-v2-epic: #1196; slice: E01; slug: atl2-e01 -->

## Intent

Stabilize World→Continent→Country→Place→Building→Room: each level has a primary
map, stable IDs, and correct parent links — enforced by domain + SQLite host.

## Preconditions

- #1211 Gate C CLEAR (2D authoring SoT).
- World hierarchy kernel + `createWorldNodeWithMaps` already on `main` (#712+).

## Happy Path

- [ ] Domain: `planWorldNodeCreate('room')` yields five steps each `needsPrimaryMap`
- [ ] Domain: `assertHierarchyEdge` rejects skips / self-parent; allows legal edges
- [ ] Host SQLite: create room → full ancestor chain + one primary link per node
- [ ] Host: list/reload places + atlas maps; rename keeps immutable place/map IDs
- [ ] Host: reject skip parent, cycle, cross-world parent (`23514`)
- [ ] Gate report `.qa/runs/atl2-e01-primary-maps.md` CLEAR
- [ ] Touched files: zero type escape hatches

## Non-Goals

- Seventh `region` hierarchy level / new DB
- ParentSpatialAnchor locate (ATL2-E02)
- Zoom/breadcrumb UX (ATL2-E03+)

## Security Coverage

- Owner create/rename; stranger denied
- Cross-world parent rejected fail-closed

## Composition Gate

SKIPPED — stabilize/evidence lock; no new hop
(see `.qa/runs/composition-gate-atl2-e01.md`)

## Implementation Notes

- Protocol: `scripts/atl2-e01-primary-maps.self-test.mjs`
- Reuses hierarchy domain + world create/rename ports (no FE→server import)
