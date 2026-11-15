# Design / Spike — World Atlas Editor (#702)

> **Status (ATL2-H02 #1235, 2026-11-15):** Historical. The Leaflet/Geoman path described as "kept in repo" was removed in ATL2-H01 (#1234); product 2D is Canvas2D `UnifiedAtlasEditor`. Current ATL2 architecture: `docs/architecture/atlas-v2-architecture.md` (renderer SoT ADR-ST-10). Content below is preserved as written.

Ready for /implement: YES (phased)

## Phase 1 findings

### Licenses

| Component | License | Use in SagaTree |
|-----------|---------|-----------------|
| Leaflet | BSD-2-Clause | OK — interactive viewer |
| `@geoman-io/leaflet-geoman-free` | MIT | OK — draw/edit free tier only |
| Azgaar Fantasy-Map-Generator | MIT (LICENSE file) | OK — self-host / file I/O; GitHub API shows `NOASSERTION` but repo LICENSE is MIT |
| Mapgen4 / SettleMaker | deferred | Do not block |

### Azgaar integration (real constraints)

Azgaar is a **full SPA**, not an embeddable React SDK. No official npm map-engine package.

Viable approaches (tested against public docs/wiki, not invented APIs):

1. **Self-host FMG** under SagaTree infra + iframe; exchange via download/upload of `.map` (native project format). JSON/SVG exports are **not** full round-trip project restores.
2. **File round-trip only:** SagaTree stores `.map` in Storage; user opens FMG (hosted or desktop), edits, re-imports `.map`.
3. **No postMessage API** documented as stable — do not invent one.

**Decision for Phase 4:** Prefer (1) later; ship (2) in foundation (`generator_meta` + Storage path). Never claim “Azgaar React SDK”.

### Renderer (updated 2026-10-17)

- **Primary:** Canvas 2D unified multi-scale viewport (`src/app/world/atlas/unified/**`) — continuous camera, LOD fade, brush/stamp/room/wall (HTML prototype parity).
- **Persistence:** `generator_meta.unifiedCanvas` (`sagatree-unified-atlas-v1`); `layers` remains GeoJSON FeatureCollection for RPC compatibility.
- **Demoted:** Leaflet + Geoman (kept in repo, not default UI).
- **Legacy:** `legacy_tiles` still opens tile editor.

### Leaflet / React (legacy path)

- App may still load `leaflet` + `react-leaflet` v4 + Geoman for optional GeoJSON experiments.
- Fantasy maps historically used `L.CRS.Simple`.

### Data model

Keep `world_maps` (tile JSONB) as **legacy root**. New `world_atlas_maps`:

- Many maps per `world_profile_id`
- `parent_map_id` hierarchy
- `kind`: `world | region | settlement | scene | legacy_tiles`
- `layers` GeoJSON FeatureCollection (size-capped)
- `basemap_storage_path` / `azgaar_map_storage_path` (Storage, not Base64)
- `revision` optimistic concurrency

Migration: one `legacy_tiles` root per existing `world_maps` row.

### Dual navigation

| Entry | Path |
|-------|------|
| Library | `/library/worlds/:worldPublicId/map` |
| Saga | `/sagas/:sagaPublicId/world/map` |

Shared UI: `src/app/world/atlas/WorldAtlasWorkbench.tsx`.

### World vs Saga state

| World (canonical) | Saga-scoped |
|-------------------|-------------|
| Geography, layers, hierarchy, basemap, Azgaar blob | Discovery, secrets overlay, party position (existing), reveal |

Saga must not write another saga’s discovery; world geometry writes require world-edit permission.

## Out of scope (this epic’s later phases)

- Full Azgaar iframe product chrome
- SettleMaker city gen
- PixiJS / GPU renderer
- Real uploaded child-map LOD alignment (demo nested rects are sample geometry)

## Unified canvas note

Automatic zoom-to-region **within the demo scene graph** is in scope (camera animation + fade). Discrete DB map-id switching remains for real child maps / legacy.
