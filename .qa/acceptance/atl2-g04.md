# Feature: ATL2-G04 — Golden visual regression (fantasy look) (#1232)

<!-- atlas-v2-epic: #1196; slice: G04; slug: atl2-g04 -->

## Intent

Karten bleiben sichtbar hochwertig und lesbar: nachprüfbare Material-/Kontrast-/
Detail-Kriterien und deterministische Visual-Regression über feste Fixtures —
keine reine Geschmacksfreigabe.

## Preconditions

- #1218 Gate D, #1228 Gate F MERGED
- Custom-WebGL product target (R01 NO-GO; never Three.js #1267–#1270)

## Happy Path

- [x] Fixtures world/country/city/tavern/crypt/room with fixed camera + lighting
- [x] Art-direction checklist measurable (materials, selection ≥3:1, detail degradable)
- [x] No unsolicited canonical world objects (IV-01); themes atmospheric (IV-02)
- [x] Deterministic content fingerprints vs committed `ATLAS_GOLDEN_VISUAL_BASELINES`
- [x] Spatial geometry in fingerprints; full-field compare (light/look/selection)
- [x] Material variety: ≥2 canvas materials OR ≥2 look albedos (separate counts)
- [x] CI mode `fingerprint-exact` + documented pixel tolerance
- [x] Touched files: zero type escape hatches

## Edge Cases

- [x] Lite room fixture uses degraded detail path in checklist
- [x] Theme swap keeps geometry fingerprint (indoor)
- [x] Fingerprint mismatch fails compare fail-closed

## Security Coverage

- No new write surface; crypt secrets remain G01 host projection

## Imagination-First (IV)

- [x] **IV-01** Fixtures visualize Dornhain golden / starter geometry only
- [x] **IV-02** Dungeon themes / selection chrome atmospheric

## Adaptive UI (AU)

- N/A chrome — visual regression domain (Cyan selection tokens)

## Composition Gate

- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-atl2-g04.md`

## Implementation Notes

- Domain: `src/domains/world/atlas/atlas-golden-visual.ts`
- Evidence: `scripts/atl2-g04-golden-visual.self-test.mjs`
- Non-goals: subjective taste sign-off; Three.js product path
