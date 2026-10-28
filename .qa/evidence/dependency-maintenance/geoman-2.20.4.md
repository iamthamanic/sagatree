# Dependency maintenance — @geoman-io/leaflet-geoman-free 2.20.2 → 2.20.4

- PR: #980
- Kind: patch
- Consumer: `src/app/world/atlas/WorldAtlasLeafletMap.tsx` (draw/edit free tier)
- License: MIT (unchanged per `.qa/design/world-atlas-editor.md`)

## Compatibility notes

- Semver patch within `^2.20.2` range; lockfile pins `2.20.4`.
- No public API break expected for Geoman free-tier draw controls used by Atlas Leaflet map.
- Kodus ignores `package.json` / `package-lock.json`; this evidence file is the reviewable surface for the upgrade rationale and verification.

## Verification

- [ ] `npm ci`
- [ ] `npm run test-gate` (or scoped Test Gate on PR)
- [ ] Browser E2E / Atlas journey checks on PR CI
- [ ] Manual smoke: Atlas map loads; Geoman draw tools still attach without console errors

## Non-claims

No major upgrade, no `--legacy-peer-deps`, no production cutover.
