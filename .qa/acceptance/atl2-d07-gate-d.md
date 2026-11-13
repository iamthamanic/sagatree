# Feature: ATL2-D07 Gate D — Product 3D Phase D acceptance (#1218)

<!-- atlas-v2-epic: #1196; slice: D07; slug: atl2-d07 -->

## Intent

Independent host + browser evidence that Phase D (D01–D06) delivers a complete
**product 3D** view of the same canonical Atlas maps: locked custom-WebGL target,
camera modes, heightfield terrain, LOD meshes, diorama look — before Phase E.

Epic/ticket wording “Three.js” means **product 3D geometry from Saved Maps** on
the D01-locked custom WebGL runtime (see `.qa/design/atl2-renderer-architecture-audit.md`).
No library swap is required for Gate D CLEAR.

## Preconditions

- #1212 / #1213 / #1214 / #1215 / #1216 / #1217 merged to `main`.
- Host Better Auth available for Browser E2E (`browser-e2e-with-host`).

## Happy Path

- [ ] PR stack #1253–#1258 present on `main` (documented SHAs)
- [ ] Productive 3D target remains `custom-webgl-prototype-runtime`; Native3d mounts
      prototype-runtime; `AtlasSpatialViewport` not used in product chrome
- [ ] Camera modes ortho / diorama / perspective cycle and clamp
- [ ] Heightfield + terrain mesh plan + diorama instance batches proven domain-side
- [ ] Golden hierarchy + persist/reload of canvas+heightfield via host
- [ ] Gate report `.qa/runs/atl2-d07-gate-d.md` CLEAR with Soll/Ist table
- [ ] Browser wrapper exercises product 3D surface + camera chrome
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout)

## Imagination-First (IV)

- [ ] **IV-01** Authority: 3D visualizes canonical cartography / heightfield SoT
- [ ] **IV-18** Canonical linkage: host `generator_meta` / UnifiedCanvasDoc — no localStorage SoT

## Edge Cases

- [ ] Stale `expectedRevision` → 40001
- [ ] Non-owner write → 42501
- [ ] Lite graphics preset prefers software fallback without inventing geometry
- [ ] Parallel Three viewport remains inventory-only (retire in ATL2-H)

## Security Coverage

- Owner CAS + stranger deny on atlas upsert
- 3D writes remain host/policy bound; renderer UI is not authority

## Composition Gate

SKIPPED — acceptance protocol / evidence lock; no new hop
(see `.qa/runs/composition-gate-atl2-d07-gate-d.md`)

## Implementation Notes

- Protocol: `scripts/atl2-d07-gate-d.self-test.mjs` → `.qa/runs/atl2-d07-gate-d.md`
- Browser wrapper: `e2e/atl2-d07-gate-d.spec.ts`
- Architecture: `.qa/design/atl2-d07-gate-d.md` + renderer audit
