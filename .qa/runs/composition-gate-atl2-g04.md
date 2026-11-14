# Composition Gate — atl2-g04

- Issue: #1232
- Feature slug: atl2-g04
- HEAD_SHA: 3a6a6840dd664a16dabb4d5a91379787dd1bfb15
- BASE_SHA: bd8959322b310cd7e049eecf1e11cd0fed868dc9
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none

## Event

Golden visual regression fixtures pin camera/lighting and measurable
art-direction checks so fantasy-look quality is reviewable without a second
renderer or subjective-only sign-off.

## Hop chain

1. Scale id → `resolveAtlasGoldenVisualFixture` → canvas builder
2. Canvas + preset → diorama or dungeon look plan
3. Camera + light + materials → `buildAtlasGoldenVisualSnapshot`
4. Checklist → `evaluateAtlasGoldenArtDirection`
5. CI → fingerprint compare (`ATLAS_GOLDEN_VISUAL_TOLERANCE.ciMode`)

Cardinality: one snapshot per fixture scale; one art-direction report per gate.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | GM screenshot review | same fingerprints | pass |
| Invalid/missing | unknown fixture id | null resolve | pass |
| Two consumers / crash | domain + self-test | agree | pass |
| Six scales | world…room | 6 fixtures | pass |
| Lite vs high | degradable detail | facades off on lite | pass |
| Selection | Cyan vs surface | contrast ≥ 3:1 | pass |

## Flags

| Tag | Severity | Hops | Why | Fix |
|-----|----------|------|-----|-----|
| (none) | — | — | — | — |
