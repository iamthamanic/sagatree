# Acceptance — browser-host-FE-HOST-11 (#1116)

## SLICE DONE

Dornhain atlas/map/places seed on host ensure-starter so the map editor is
not empty for a fresh Dornhain world (FE-HOST-10 ownership model).

## Checks

- [x] `ensureDornhainDefaultCatalog` seeds ≥1 `world_atlas_maps` root and ≥2
      `world_places` (+ map links) for the owned Dornhain world (idempotent).
- [x] `scripts/fe-host-07-product-auth.self-test.mjs` asserts atlas maps ≥1 and
      places ≥2 after ensure-starter.
- [x] Seeds use owner-scoped catalog ids (no cross-owner elevation).

## Deferred

- Project write residual DENY → FE-HOST-12 (#1117)
- Saga definition HTTP → FE-HOST-13 (#1118)
- AI/Meshy residuals → FE-HOST-14 (#1119)

## Security Coverage

- Atlas/places rows bound to the owning actor's Dornhain `world_profile_id`.
- Scoped ids prevent INSERT collisions across admin/player copies.
- All severities reviewed for this slice (Critical→Info): none beyond
  owner-scoped seed hygiene above.
