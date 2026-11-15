# Composition Gate — atl3-v01-visual-contract

- Issue: #1295
- Feature slug: atl3-v01-visual-contract
- HEAD_SHA: 182d138a44c6f283043c73a293166c801e6c1bf8
- BASE_SHA: 07f3c4bc65868726f2144ed557f146ed03bb2b1c
- Date: 2026-11-15
- Verdict: CLEAR
- Acceptance tier: browser-host (product data + quality switch + capture evidence)
- Deferred integration: none

## Event

Round 2 (Ben's decisions on PR #1302): Golden Dornhain gets a canonical heightfield, the
golden Krypta becomes a committed Dungeon-Forge crypt, and the 3D view gets a product
quality switch (high/balanced/lite). The same stored maps feed G04, V01 and the product renderer.

## Hop chain

1. Golden domain builders (`dornhain-golden-hierarchy.ts`): `buildGoldenDornhainHeightfield`,
   `GOLDEN_KRYPTA_FORGE_PARAMS` → generateDungeon → rasterize → `commitDungeonFeaturesToDoc`
   + confirmed `generatorMeta.dungeon`.
2. Host seed (`server/src/bootstrap/dornhain-golden-hierarchy-seed.ts`) mirrors the same data via the
   generated `dornhain-golden-krypta-forge.ts` (parity script in test-gate; self-test `host-seed-parity`).
3. `ensure-starter` persists the maps (only when missing/other seed — existing worlds keep old data until reset).
4. Host API `/api/v1/worlds/:id/atlas/maps` → product Atlas → Custom-WebGL runtime (heightfield mesh,
   dungeon look/torch) — e2e checks stored fingerprint = contract.
5. Quality select → `useAtlasGraphicsPreset` (localStorage, strict parse) → `AtlasNative3dEditor`
   `graphicsPresetId` → runtime remount (lite = AtlasLite3D fallback).
6. Captures → manifest v2 → committed baseline → self-test (evidence rules + baseline digest) and
   browser drift check against the baseline.

Cardinality: 2 golden scenes × 1 stored map each; 1 preset per device; 36 baseline captures.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner/GM sees the same stored maps in every profile | same fingerprints across 3 profiles | pass |
| Invalid/missing | unknown stored preset value / missing baseline file | falls back to balanced / drift entry FAIL | pass |
| Two consumers / crash | FE builder + host seed both produce the crypt | parity script + self-test agree (3ec9b21f…, aa520e6f…) | pass |
| Existing world | ensure-starter on a world with old golden maps | no re-seed (documented, reset needed) | pass |
| Profile switch | high → lite → balanced | runtime remount, host attribute reflects preset | pass |
| Repeat capture | 3 consecutive runs | 42/42 pixel-identical | pass |
| Stale matrix | status disagrees with evidence / new baseline | self-test FAIL (verified by mutation) | pass |

## Flags

- Product 3D: custom-webgl-prototype-runtime (renderer code unchanged)
- No Three.js, no GO/NO-GO (R01B #1296)
- Perf numbers: software-rendering (SwiftShader) only; reference devices binding, device runs pending
