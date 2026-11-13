# Feature: ATL2-C06 Gate C — 2D map editor acceptance (#1211)

<!-- atlas-v2-epic: #1196; slice: C06; slug: atl2-c06 -->

## Intent

Independent host + browser evidence that Phase C (C01–C05) delivers a complete
2D authoring source: geometry tools, layers/locks, undo/autosave, adaptive
workstation chrome — before Phase D Three.js work.

## Preconditions

- #1206 / #1207 / #1208 / #1209 / #1210 merged to `main`.
- Host Better Auth available for Browser E2E (`browser-e2e-with-host`).

## Happy Path

- [ ] PR stack #1247 / #1248 / #1249 / #1250 / #1251 present on `main` (documented SHAs)
- [ ] Feature categories (area/path, room/wall/door/object, layers, undo/redo, adaptive)
      proven via domain + host persist/reload
- [ ] Golden hierarchy travel World→…→Krypta titles present after ensure-starter
- [ ] Gate report `.qa/runs/atl2-c06-gate-c.md` CLEAR with Soll/Ist table
- [ ] Browser wrapper exercises product UI chrome (tools / undo / layers / bands)

## Edge Cases

- [ ] Stale `expectedRevision` → 40001
- [ ] Non-owner write → 42501
- [ ] Delete last wall/door/object leaves empty arrays (no ghost)

## Security Coverage

- Owner CAS + stranger deny on atlas upsert
- Writes remain host/policy bound; editor UI is not authority

## Composition Gate

SKIPPED — acceptance protocol / evidence lock; no new hop
(see `.qa/runs/composition-gate-atl2-c06-gate-c.md`)

## Implementation Notes

- Protocol: `scripts/atl2-c06-gate-c.self-test.mjs` → `.qa/runs/atl2-c06-gate-c.md`
- Browser wrapper: `e2e/atl2-c06-gate-c.spec.ts`
- Depends on C01–C05 domain + UnifiedAtlasEditor / WorldAtlasWorkbench
