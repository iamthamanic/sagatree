# ATL2-G04 — Semi-realistic fantasy look review (#1232)

- Product 3D target: `custom-webgl-prototype-runtime` (R01 NO-GO — no Three.js product path)
- Capture matrix: Desktop 1280×800 (all six fixtures) + Mobile 390×844 (world, tavern)
- Pixel gate: Playwright `toHaveScreenshot` · `maxDiffPixelRatio: 0.02`
- Fingerprint gate: `ATLAS_GOLDEN_VISUAL_TOLERANCE.ciMode = fingerprint-and-screenshot`

## Scenes (product Dornhain maps)

| Fixture | UI map title | Expected visible content |
|---------|--------------|--------------------------|
| world | Welt | Terrain / continent scale; atmospheric, not full simulation |
| country | Land Westmark | Region terrain materials distinct from world |
| city | Dornhain | Settlement buildings / stamps readable |
| tavern | Taverne Zum Flüstern | Indoor dungeon materials (grim theme) |
| crypt | Krypta unter dem Hügel | Indoor ancient theme; no client secret dump |
| room | Taverne (room camera) | Lite detail / degradable props |

## IV contract check (Imagination-First)

| Gate | Verdict | Notes |
|------|---------|-------|
| IV-01 | PASS | Fixtures use Dornhain golden / starter geometry only — no unsolicited canonical objects |
| IV-02 | PASS | Dungeon themes + Cyan selection chrome are atmospheric, not exhaustive simulation |
| Show enough / leave enough | PASS | Semi-realistic fantasy look; detail degradable (`lite` room) |

## Theme / styleguide

- Selection outline `#06B6D4` vs surface `#1E293B` contrast ≥ 3:1 (domain checklist)
- No second productive renderer; Custom WebGL only

## Evidence

- Browser: `e2e/atl2-g04-golden-visual.spec.ts`
- Raw captures: `.qa/evidence/atl2-g04-golden-visual/raw-*.png`
- Snapshots: `e2e/atl2-g04-golden-visual.spec.ts-snapshots/`
- Node: `scripts/atl2-g04-golden-visual.self-test.mjs`
