# Composition Gate — atl2-g04

- Issue: #1232
- Feature slug: atl2-g04
- HEAD_SHA: c077b0e6d2f7397cd8c7da0801c716fb5a256b77
- BASE_SHA: bd8959322b310cd7e049eecf1e11cd0fed868dc9
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none

## Event

Golden visual regression pins camera/lighting fingerprints **and** Browser E2E
Custom-WebGL pixel-diff screenshots (Playwright toHaveScreenshot) so fantasy-look
quality is reviewable without a second renderer or subjective-only sign-off.

## Hop chain

1. Scale id → `resolveAtlasGoldenVisualFixture` → canvas builder + `uiMapTitleDe`
2. Canvas + preset → diorama or dungeon look plan
3. Camera + light + materials → `buildAtlasGoldenVisualSnapshot`
4. Checklist → `evaluateAtlasGoldenArtDirection`
5. Node CI → fingerprint compare
6. Browser E2E → open product map → fixed camera → `toHaveScreenshot` (0.02)

Cardinality: one fingerprint snapshot per fixture scale; eight PNG baselines
(6 desktop + 2 mobile); one art-direction + fantasy-look review.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | GM screenshot review | same fingerprints + PNGs | pass |
| Invalid/missing | unknown fixture / missing PNG | null resolve / FAIL | pass |
| Two consumers / crash | domain + self-test + e2e | agree | pass |
| Six scales | world…room | 6 fixtures | pass |
| Lite vs high | degradable detail | facades off on lite | pass |
| Selection | Cyan vs surface | contrast ≥ 3:1 | pass |
| Pixel-diff | WebGL canvas | maxDiffPixelRatio 0.02 | pass |

## Flags

- Product 3D: custom-webgl-prototype-runtime
- R01 Three.js product path: NO-GO
