# ATL2-E05 Gate E — Phase E hierarchy acceptance design

**Issue:** #1223  
**Epic:** #1196  
**Slug:** `atl2-e05`

## Purpose

Lock CLEAR evidence that E01–E04 are productively integrated: primary maps,
ParentSpatialAnchor locate, hierarchy zoom/breadcrumb/back, and LOD/lazy loads
over the Golden Dornhain six-level world — as host + domain protocol, not a
visual-only zoom demo.

## Binding interpretation

| Ticket phrase | Gate E meaning |
| --- | --- |
| Sechs-Stufen-Hierarchie | World → continent → country → place → building → room; rooms persisted/queried via host (Schankraum + Gruftkammer) |
| Anker | ParentSpatialAnchor on **every** non-root map; unlocated stays honest |
| Zoom / Back | enterChildMap + breadcrumb + navigateBack / wheel-back (E03) |
| LOD | Semantic hierarchy bands + generation loads + fade/failure rollback (E04) |

## Evidence artifacts

- Self-test: `scripts/atl2-e05-gate-e.self-test.mjs`
- Report: `.qa/runs/atl2-e05-gate-e.md` / `.json`
- Browser: `e2e/atl2-e05-gate-e.spec.ts`
- Composition: SKIPPED (protocol lock)

## Out of scope

- Fake CSS-only zoom as product proof
- New product features beyond E01–E04 integration evidence
- Phase F narrative slices
