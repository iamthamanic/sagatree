# ATL2-E05 Gate E — Phase E hierarchy acceptance

- Issue: #1223
- HEAD: `1d4538c67ecb69c47f3f543039b7ca7432fdfb04`
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

- Owner ensure-starter → Dornhain atlas maps: **6**
- Titles World→…→Tavern/Crypt: yes
- Located children with ParentSpatialAnchor: **5**
- World publicId: **WO-4ER3X**

## Soll / Ist (feature categories)

| Category | Soll | Ist |
|----------|------|-----|
| Gate D + E01–E04 stack on main | squash SHAs #1259/#1261/#1264/#1272/#1275 are ancestors of HEAD | **pass-git** |
| Six hierarchy levels (domain) | ATLAS_HIERARCHY_LEVELS length 6; both room-branch breadcrumbs | **pass-domain** |
| Anchors + locate (domain) | ParentSpatialAnchor + enterChild requires located; unlocated fails closed | **pass-domain** |
| LOD / lazy load (domain) | generation load → transition → ready; failure rolls back to prior ready | **pass-domain** |
| Golden host maps | ensure-starter yields ≥6 Golden titles World→…→Tavern/Crypt | **pass-host** |
| Located child anchors (host) | child maps expose parent_map_id / parentSpatialAnchor in generator_meta | **pass-host** |
| Negative policy | stranger atlas write denied | **pass-host** |

## Host ownership

- Stranger write deny: **yes**
- Outsider atlas write status: **403**

## Residuals (non-blocking for Gate E)

- **Info**: Full interactive deep-link / reload browser matrix — protocol locked; ops soak continues.

## Decision

Phase E hierarchy foundation is **CLEAR**.
