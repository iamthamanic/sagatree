# ATL2-E02 — ParentSpatialAnchor & locate persistence

- Issue: #1220
- HEAD: `46885289400b6a091f1d6b6b39e7fc9ebdef8ddb`
- Verdict: **CLEAR**
- Date: 2026-11-13

## Soll / Ist

| Category | Soll | Ist |
|----------|------|-----|
| Domain locate + invert | rect→anchor; round-trip w/ rotation | **pass-domain** |
| Calibration honesty | neg/zero mpu → null; caption abstract | **pass-domain** |
| Unlocated LOD gate | no scale-true drill | **pass-domain** |
| Host save/reload | locate persists on getMap | **pass-host** |
| Security | stranger upsert denied | **pass-host** |

## Host evidence

- Locate save/reload: **yes**
- Unlocated LOD denied: **yes**
- Stranger denied: **yes**

## Residuals

- **Low**: E03 owns breadcrumb / camera fly-to across levels.

## Decision

ATL2-E02 ParentSpatialAnchor locate is **CLEAR**. E03 may open.
