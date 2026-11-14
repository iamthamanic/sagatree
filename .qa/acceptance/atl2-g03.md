# Feature: ATL2-G03 — Adaptive atlas UX (keyboard / touch / states) (#1231)

<!-- atlas-v2-epic: #1196; slice: G03; slug: atl2-g03 -->

## Intent

Atlas Workstation bleibt auf Phone / Tablet / Desktop (inkl. schmalem Main-Pane)
bedienbar: Gesten-Disambiguierung, Tastatur, Touch-Targets, Loading-/Failure-
und reduced-motion-Fallbacks — kein zweites mobiles Kartensystem.

## Preconditions

- #1210 C05, #1218 Gate D, #1223 Gate E MERGED
- Adaptive UI contract `AU-*` + Imagination-First where relevant

## Happy Path

- [x] Domain: band composition + critical controls + keyboard shortcuts per band
- [x] Gesture disambiguation: pan vs draw (`touch-action` + DE labels)
- [x] Surface states: loading / empty / unlocated / error / webgl-fallback / reduced-motion
- [x] Workbench: `data-atlas-surface-state` + aria-live; reduced-motion media query
- [x] Chrome overflow safe at 320px floor (AU-CONTENT-WIDTH)
- [x] Touched files: zero type escape hatches

## Edge Cases

- [x] Phone: sheets chrome; critical set omits view-3d if space-constrained rule
- [x] Narrow main pane: `atlasChromeOverflowSafe` fail-closed under floor
- [x] Reduced-motion when otherwise ready → labeled modifier state

## Security Coverage

- No new write surface; party projection remains G01 host path

## Imagination-First (IV)

- [x] **IV-01** Fallbacks do not invent map geometry
- [x] Atmospheric chrome only (labels / motion)

## Adaptive UI (AU)

- [x] **AU-CONTENT-WIDTH** / phone–tablet–desktop bands
- [x] Touch target floor 44px for critical chrome budget
- [x] No hover-only primary paths (interaction mode labels)

## Composition Gate

- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-atl2-g03.md`

## Implementation Notes

- Domain: `atlas-workstation-adaptive.ts` (G03 extensions)
- App: `WorldAtlasWorkbench` surface-state + live region
- Evidence: `scripts/atl2-g03-adaptive-ux.self-test.mjs`
- Non-goals: separate mobile map product; Three.js (#1267–#1270)
