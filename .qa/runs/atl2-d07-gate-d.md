# ATL2-D07 Gate D — Phase D product 3D acceptance

- Issue: #1218
- HEAD: `a260606ed0854c841431eae3c09dbb0ebae06694`
- Verdict: **CLEAR**
- Date: 2026-11-13
- Product 3D target: `custom-webgl-prototype-runtime` (ticket “Three.js” = product 3D)

## PR stack on main

| PR | Issue | Squash SHA | Present |
|----|-------|------------|---------|
| #1253 | #1212 | `1ef4ac7cc3` ATL2-D01 renderer decision | yes |
| #1254 | #1213 | `79737863ef` ATL2-D02 canonical 3D geometry | yes |
| #1255 | #1214 | `bce74cab28` ATL2-D03 product camera modes | yes |
| #1256 | #1215 | `46288e2faf` ATL2-D04 heightfield terrain | yes |
| #1257 | #1216 | `b6542cfa7f` ATL2-D05 terrain mesh / LOD | yes |
| #1258 | #1217 | `a260606ed0` ATL2-D06 diorama look | yes |

## Hierarchy travel (host)

- Owner ensure-starter → Dornhain atlas maps: **6**
- Titles World→…→Krypta: yes
- World publicId: **WO-4F5RE**

## Soll / Ist (feature categories)

| Category | Soll | Ist |
|----------|------|-----|
| D01–D06 PR stack on main | squash SHAs #1253–#1258 are ancestors of HEAD | **pass-git** |
| Product 3D target lock | custom-webgl-prototype-runtime; Native3d only; no SpatialViewport chrome | **pass-domain** |
| Camera modes | ortho / diorama / perspective cycle + clamp | **pass-domain** |
| Terrain + diorama geometry | heightfield mesh plan + Golden diorama batches from Saved-map canvas | **pass-domain** |
| 2D↔3D delete parity (canonical doc) | remove_object clears SoT; bridge sync does not invent ghosts | **pass-domain** |
| Hierarchy travel (World→Krypta) | ensure-starter yields ≥6 Golden map titles | **pass-host** |
| Persist / Reload (canvas + heightfield) | unifiedCanvas+heightfield survive upsert + GET | **pass-host** |
| Negative policy | stale rev 40001; stranger 42501 | **pass-host** |

## Host CAS / ownership

- Persist + reload canvas objects: **yes**
- Heightfield reload: **yes**
- Stale tab revision → 40001: **yes**
- Stranger write deny: **yes**
- Outsider atlas write status: **403**

## Residuals (non-blocking for Gate D)

- **Low**: Interactive FPS/draw-call soak on device matrix — Structural Lite3D + preset contracts locked; device soak deferred to ops.

## Decision

Phase D product 3D foundation is **CLEAR**. Phase E may open after merge.
