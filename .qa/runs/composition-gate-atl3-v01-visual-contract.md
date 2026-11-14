# Composition Gate — atl3-v01-visual-contract

- Issue: #1295
- Feature slug: atl3-v01-visual-contract
- HEAD_SHA: a42fc2df5b146e4c912aaa6ca58011b1fc1d0f90
- BASE_SHA: 9009014e3881249ec295cc8dc265108f08c13d04
- Date: 2026-11-14
- Verdict: SKIPPED
- Acceptance tier: browser-host (contract + evidence)
- Deferred integration: none

## Skip reason

No producer→consumer hop changes: V01 adds a QA contract (design, fixture JSON, acceptance), a self-test, a Host-Browser capture spec and committed baseline evidence. No `src/`, no renderer, no data model, no API or persistence change (gate output: single-hop application diff without downstream side-effect path).

## Event

Golden scene contract → stored Dornhain/Krypta maps → product Custom-WebGL runtime → canvas screenshots + manifest → self-test oracle.

## Hop chain

1. `golden-scenes.json` pins map seeds, stored-data fingerprints, cameras, zoom levels, light profiles, budgets, criteria.
2. self-test re-derives fingerprints/lights/camera clamps from the domain builders (`dornhain-golden-hierarchy.ts`, `atlas-diorama-look.ts`, `atlas-dungeon-look.ts`, `atlas-product-camera.ts`).
3. Host E2E: `ensure-starter` → stored maps via `/api/v1/worlds/:id/atlas/maps` (fingerprint check) → DB nav → `#zoom`/`#coords` + bridge `setCameraMode`/`setYaw` → canvas screenshot.
4. Manifest (`capture-manifest.json`) → committed baseline → self-test validates names, SHA, fingerprints, repeat diff, measurement class.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| Stored data drift | fingerprint ≠ contract → FAIL | e2e + self-test compare | pass |
| Camera mode remount | yaw/zoom re-applied within tolerance | retry loop + snapshot check | pass |
| Repeat capture | diff ≤ 0.08 | diff 0 (both scenes) | pass |
| Tablet/phone | canvas usable, overflowX ≤ 1 | 730×912 / 366×604, 0 | pass |
| G04 baselines | unchanged, not relabelled | self-test guard | pass |

## Flags

- Product 3D: custom-webgl-prototype-runtime (unchanged)
- No Three.js, no GO/NO-GO (R01B #1296)
- Perf numbers: software-rendering (SwiftShader) only
