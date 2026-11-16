# Composition Gate — atl3-v01-visual-contract

- Issue: #1295
- Feature slug: atl3-v01-visual-contract
- HEAD_SHA: 603a9b7c805c6ba94345106b9b6037d1dd38cbdf
- BASE_SHA: 7fe51524bc73b231df4598851dcc94f6dcd083bd
- Date: 2026-11-15
- Verdict: CLEAR
- Acceptance tier: browser-host (product data + quality switch + capture evidence)
- Deferred integration: none

## Event

Round 2 (Ben's decisions on PR #1302): Golden Dornhain gets a canonical heightfield, the
golden Krypta becomes a committed Dungeon-Forge crypt, and the 3D view gets a product
quality switch (high/balanced/lite). The same stored maps feed G04, V01 and the product renderer.

Round 3 (Ben's open visual points): existing worlds get an idempotent golden upgrade (untouched golden
content only), forge props keep a real-world size independent of unitScale, corridors are floor rects with
edge walls (no centerline bars), torches have a distance falloff per quality profile, and the lite
Canvas2D path orders ground before standing geometry.

## Hop chain

1. Golden domain builders (`dornhain-golden-hierarchy.ts`): `buildGoldenDornhainHeightfield`,
   `GOLDEN_KRYPTA_FORGE_PARAMS` → generateDungeon → rasterize → `commitDungeonFeaturesToDoc`
   + confirmed `generatorMeta.dungeon`.
2. Host seed (`server/src/bootstrap/dornhain-golden-hierarchy-seed.ts`) mirrors the same data via the
   generated `dornhain-golden-krypta-forge.ts` (parity script in test-gate; self-test `host-seed-parity`).
3. `ensure-starter` persists the maps (when missing/other seed) and, per golden map, upgrades an untouched
   superseded golden canvas (`isUntouchedLegacyGoldenCanvas`, content signature) to the current one
   (canvas + `generatorMeta.dungeon`, revision +1); user-edited canvases never match.
4. Host API `/api/v1/worlds/:id/atlas/maps` → product Atlas → Custom-WebGL runtime (heightfield mesh,
   dungeon look/torch) — e2e checks stored fingerprint = contract. Domain light profile → `atlas-native-3d-look`
   (`torchRadiusCells`, `maxTorchLights`) → runtime torch lights (WebGL per pixel, lite per face).
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
| Two consumers / crash | FE builder + host seed both produce the crypt | parity script + self-test agree (3ec9b21f…, a44b49a7…) | pass |
| Existing world | ensure-starter on a world with untouched old golden maps (pre-V01 crypt, Dornhain w/o heightfield, also in editor re-persist form) | upgraded once (revision +1), second ensure no-op | pass (DB self-test) |
| Existing world, edited | ensure-starter on a user-edited golden map (old crypt with moved prop, tavern with added room) | byte-identical, revision unchanged | pass (DB self-test) |
| Real pre-V01 data | main's golden Dornhain/crypt canvases | recognised as legacy; unchanged golden maps (tavern, country) not | pass (one-off check vs origin/main) |
| Unit scale | forge props at unitScale 1…40 | constant real size (torch 1.2 cells, chest 0.9 cells) | pass |
| Profile switch | high → lite → balanced | runtime remount, host attribute reflects preset | pass |
| Repeat capture | re-capture against the round-3 baseline | 0 drift, repeat diff 0 | pass |
| Stale matrix | status disagrees with evidence / new baseline | self-test FAIL (verified by mutation) | pass |

## Flags

- Product 3D: custom-webgl-prototype-runtime (round 3: torch falloff + lite ordering; no new renderer)
- No Three.js, no GO/NO-GO (R01B #1296)
- Perf numbers: software-rendering (SwiftShader) only; reference devices binding, device runs pending
