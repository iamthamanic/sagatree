# Feature: ATL2-G04 — Golden visual regression (fantasy look) (#1232)

<!-- atlas-v2-epic: #1196; slice: G04; slug: atl2-g04 -->

## Intent

Karten bleiben sichtbar hochwertig und lesbar: nachprüfbare Material-/Kontrast-/
Detail-Kriterien **und** echte Custom-WebGL-Screenshots mit Pixel-Diff —
keine reine Geschmacksfreigabe und kein Auto-PASS nur über Domain-Fingerprints.

## Preconditions

- #1218 Gate D, #1228 Gate F MERGED
- Custom-WebGL product target (R01 NO-GO; never Three.js #1267–#1270)

## Happy Path

- [x] Fixtures world/country/city/tavern/crypt/room with fixed camera + lighting
- [x] Art-direction checklist measurable (materials, selection ≥3:1, detail degradable)
- [x] No unsolicited canonical world objects (IV-01); themes atmospheric (IV-02)
- [x] Deterministic content fingerprints (`fingerprint` half of `fingerprint-and-screenshot`)
- [x] **Real browser screenshots** of productive Custom WebGL (`data-atlas-ready`, mode=webgl)
- [x] Reproducible scenes: Welt, Land, Stadt, Taverne, Krypta, Raum (fixture ids)
- [x] Fixed camera / lighting / viewport (`ATLAS_GOLDEN_VISUAL_VIEWPORTS` + fixture cameras)
- [x] **Actual screenshot pixel-diff** via Playwright `toHaveScreenshot` with
      `maxDiffPixelRatio: 0.02` — missing baseline = FAIL (never auto-PASS)
- [x] Visible materials / terrain / buildings / dungeons / selection chrome (checklist + captures)
- [x] Desktop (1280×800) all fixtures + mobile (390×844) world+tavern
- [x] Semi-realistic fantasy look reviewed vs IV contract (`.qa/runs/atl2-g04-fantasy-look-review.md`)
- [x] Touched files: zero type escape hatches

## Edge Cases

- [x] Lite room fixture uses degraded detail path in checklist
- [x] Theme swap keeps geometry fingerprint (indoor)
- [x] Fingerprint mismatch fails compare fail-closed
- [x] Pixel-diff mismatch / missing PNG baseline fails Browser E2E fail-closed

## Security Coverage

- No new write surface; crypt secrets remain G01 host projection

## Imagination-First (IV)

- [x] **IV-01** Fixtures visualize Dornhain golden / starter geometry only
- [x] **IV-02** Dungeon themes / selection chrome atmospheric

## Adaptive UI (AU)

- Capture matrix: Desktop + Mobile viewports (AU device bands); chrome N/A beyond viewport

## Composition Gate

- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-atl2-g04.md`

## Implementation Notes

- Domain: `src/domains/world/atlas/atlas-golden-visual.ts`
- Node evidence: `scripts/atl2-g04-golden-visual.self-test.mjs`
- Browser evidence: `e2e/atl2-g04-golden-visual.spec.ts` +
  `e2e/atl2-g04-golden-visual.spec.ts-snapshots/` +
  `.qa/evidence/atl2-g04-golden-visual/`
- Non-goals: subjective taste sign-off; Three.js product path; dual renderer
