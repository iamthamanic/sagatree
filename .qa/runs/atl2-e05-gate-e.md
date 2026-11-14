# ATL2-E05 Gate E — Phase E hierarchy acceptance

- Issue: #1223
- HEAD: `1644a13df401163865b94e388669dd0c2d9f5c98`
- Verdict: **CLEAR**
- Date: 2026-11-14

## PR stack on main

| PR | Issue | Squash SHA | Present |
|----|-------|------------|---------|
| #1259 | #1218 | `0f5875fe7d` ATL2-D07 Gate D | yes |
| #1261 | #1219 | `4688528940` ATL2-E01 primary maps | yes |
| #1264 | #1220 | `4bfbac4fa5` ATL2-E02 ParentSpatialAnchor | yes |
| #1272 | #1221 | `95d0d8d48a` ATL2-E03 hierarchy nav | yes |
| #1275 | #1222 | `1d4538c67e` ATL2-E04 hierarchy LOD | yes |

## Hierarchy travel (host)

- Owner ensure-starter → Dornhain atlas maps: **8**
- Titles World→…→Tavern/Crypt + rooms: yes (Schankraum, Gruftkammer)
- Non-root maps: **7**; all located: **7**
- Host room chains: `Welt→Kontinent Westmark→Land Westmark→Dornhain→Taverne Zum Flüstern→Schankraum` ; `Welt→Kontinent Westmark→Land Westmark→Dornhain→Krypta unter dem Hügel→Gruftkammer`
- World publicId: **WO-MPY7Q**

## Soll / Ist (feature categories)

| Category | Soll | Ist |
|----------|------|-----|
| Gate D + E01–E04 stack on main | squash SHAs #1259/#1261/#1264/#1272/#1275 are ancestors of HEAD | **pass-git** |
| Six hierarchy levels (domain) | ATLAS_HIERARCHY_LEVELS length 6; both room-branch breadcrumbs | **pass-domain** |
| Anchors + locate (domain) | ParentSpatialAnchor + enterChild requires located; unlocated fails closed | **pass-domain** |
| LOD / lazy load (domain) | generation load → transition → ready; failure rolls back to prior ready | **pass-domain** |
| Golden host maps | ensure-starter yields ≥6 Golden titles World→…→Tavern/Crypt; rooms persisted via host | **pass-host** |
| Located child anchors (host) | every non-root map (Golden + rooms) has parent_map_id + ready ParentSpatialAnchor | **pass-host** |
| Host room chains | Schankraum + Gruftkammer host breadcrumbs cover six-level Building/Room branches | **pass-host** |
| Negative policy | stranger atlas write denied | **pass-host** |

## Host ownership

- Stranger write deny: **yes**
- Outsider atlas write status: **403**

## Residuals (non-blocking for Gate E)

- **Info**: Full interactive deep-link / reload browser matrix — protocol locked; ops soak continues.

## Decision

Phase E hierarchy foundation is **CLEAR**.
