# Feature: ATL2-E05 Gate E — Hierarchy travel, anchors, zoom, LOD (#1223)

<!-- atlas-v2-epic: #1196; slice: E05; slug: atl2-e05 -->

## Intent

Independent host + browser evidence that Phase E (E01–E04) delivers a complete,
spatially linked Golden-Welt journey: six hierarchy levels, ParentSpatialAnchor
locate, breadcrumb/back zoom, and semantic LOD/lazy loads — without a fake zoom demo.

## Preconditions

- #1218 Gate D MERGED
- #1219 / #1220 / #1221 / #1222 MERGED to `main`
- Host Better Auth available for Browser E2E (`browser-e2e-with-host`)

## Happy Path

- [ ] PR stack Gate D + E01–E04 present on `main` (documented SHAs)
- [ ] Host ensure-starter yields Golden titles World→…→Tavern/Crypt (≥6 maps)
- [ ] Host persists/queries room maps Schankraum + Gruftkammer with full parent chains
- [ ] Every non-root map carries ParentSpatialAnchor / parent_map_id (located drill)
- [ ] Domain + host breadcrumbs cover both Building/Room branches (Schankraum + Gruftkammer)
- [ ] Domain LOD bands + load generation + failure rollback proven
- [ ] Gate report `.qa/runs/atl2-e05-gate-e.md` CLEAR with Soll/Ist table
- [ ] Browser wrapper opens Dornhain atlas workstation (2D or 3D)
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout)
- [ ] **IV-01/02/09**: Saved anchors + honest unlocated; no invented detail maps
- [ ] **AU-CONTENT-WIDTH**: hierarchy chrome readable in narrow main pane (prior E03)

## Edge Cases

- [ ] Unlocated child: no scale-true drill / no pretend prefetch
- [ ] Missing map / load fail: parent remains navigable
- [ ] Cache race / stale generation: cancelled loads ignored
- [ ] Stranger atlas write denied (owner-scoped)

## Security Coverage

- No new write surface beyond existing owner-scoped atlas host APIs
- Gate host session proves stranger deny on atlas upsert
- SC-01/02/03/06: N/A for acceptance protocol; launch SC N/A

## Composition Gate

SKIPPED — acceptance protocol / evidence lock; no new hop
(see `.qa/runs/composition-gate-atl2-e05-gate-e.md`)

## Implementation Notes

- Protocol: `scripts/atl2-e05-gate-e.self-test.mjs` → `.qa/runs/atl2-e05-gate-e.md`
- Browser wrapper: `e2e/atl2-e05-gate-e.spec.ts`
- Design: `.qa/design/atl2-e05-gate-e.md`
