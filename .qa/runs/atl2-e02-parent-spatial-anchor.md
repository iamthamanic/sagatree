# ATL2-E02 ParentSpatialAnchor — locate / calibration

- Issue: #1220
- HEAD: `fe652e1521b34966ba9f0df015774d5bb3b9253b`
- Verdict: **CLEAR**
- Date: 2026-11-13
- Product 3D target: `custom-webgl-prototype-runtime` (unchanged; D01)
- IV gates: IV-01 / IV-02 / IV-09 / IV-18

## Checks

- unlocated-before-locate
- host-locate-upsert
- host-reload-invertible
- stranger-deny

## Soll / Ist

| Category | Soll | Ist |
|----------|------|-----|
| Invertible parent↔child | rotation + center round-trip | **pass-domain** |
| Calibration | reject ≤0 / NaN; null clears | **pass-domain** |
| Rotated AABB overlap | π/2 thin OBB footprint | **pass-domain** |
| Unlocated drill | fail-closed + DE hint wiring | **pass-domain** |
| Host save/reload | generator_meta anchor survives upsert+GET | **pass-host** |
| Stranger write | deny | **pass-host** |

## Decision

ATL2-E02 ParentSpatialAnchor locate + calibration is **CLEAR**.
