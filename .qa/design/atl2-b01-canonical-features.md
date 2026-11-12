# ATL2-B01 — Canonical Atlas feature types, heights, assets, authority

**Status:** Normative for Atlas V2 Phase B (#1201)  
**Slug:** `atl2-b01`  
**Epic:** #1196  
**Code:** `src/domains/world/atlas/atlas-canonical-features.ts`  
**Wire (unchanged):** `sagatree-unified-atlas-v1` in `unified-canvas-doc.ts`  
**Related:** `map-frame.ts` (`AtlasFeatureOwner`), `map-edit-ops.ts`, `webgl-runtime-bridge.ts`

---

## Schema decision (V1 wire / V2 catalog)

| Layer | Decision |
|---|---|
| **Persistierte Wire-Format-ID** | Remain `sagatree-unified-atlas-v1` until **B02** ships a versioned adapter. |
| **Canonical feature catalog (this ticket)** | Additive TypeScript discriminated union + classifiers over existing `strokes` / `rooms` / `walls` / `objects` / layer toggles / map-frame / optional heightfield / raster refs. |
| **Silent rewrite** | **Forbidden.** No auto-reclassification of coast polygons into political borders or WorldNodes. |

B02 consumes this catalog for lossless round-trips. B04 retires dual WebGL write paths.

---

## Discriminated feature kinds

| Kind | Meaning | Canonical authority | Typical V1 slot |
|---|---|---|---|
| `terrain_area` | Landmass / biome fill (physical) | terrain | `rooms[]` + material ≠ political |
| `political_area` | Realm / border polygon | political | *not* auto-inferred from V1 rooms |
| `path_way` | Road / trail stroke | terrain (cartographic) | `strokes[]` material pflaster/erde/… |
| `path_river` | River / watercourse | terrain | `strokes[]` material `wasser` |
| `building_footprint` | Building outline on map | room_geometry / terrain | stamp `haus`/`turm` or future polygon |
| `floor_plan_room` | Drawn chamber / hall polygon or AABB on a map | room_geometry | `rooms[]` on building/room maps |
| `wall` | Structural wall segment | room_geometry | `walls[]` |
| `door` | Opening / door (future C02) | room_geometry | *gap* — not in V1 arrays yet |
| `prop_object` | Stamp/prop (tree, furniture, …) | room_geometry / atmospheric | `objects[]` |
| `heightfield` | Elevation grid / sample set | terrain | `generator_meta` (optional; absent = flat) |
| `layer_toggle` | View visibility only | *view* — never world fact | `layers.*` |
| `raster_reference` | Imported image / basemap underlay | atmospheric / suggestive | `basemapStoragePath` / azgaar |
| `world_node_ref` | Hierarchy identity link (not geometry) | WorldNode / Policy | `world_places` / host nodes |

### Drawn room ≠ WorldNode(room)

- `floor_plan_room` is **map geometry** on some primary map.
- `WorldNode` kind `room` is a **hierarchy identity** with its own primary map.
- Creating a dungeon chamber stroke/room polygon **must not** auto-create a WorldNode.
- Linking geometry → node is an explicit later op (E/F tickets).

---

## ID rules

1. Feature IDs are opaque non-empty strings; stable across 2D/3D/reload.
2. Golden seeds use dotted mnemonics (`w.west-core`, `s.obj.crypt`) — **not** authorization.
3. New editor IDs SHOULD be UUIDs (or host-allocated); do not invent elevated origins.
4. ID uniqueness is per-map document (across strokes/rooms/walls/objects).
5. WorldNode / map UUIDs stay in host tables; canvas IDs never impersonate them.

---

## Local vs world coordinates

- Map document coordinates are **local** to the map frame (`0…bounds`, abstract until calibrated).
- Parent placement uses `ParentSpatialAnchor` (`map-frame.ts`): center/extent in **parent** local units.
- `metersPerUnit == null` ⇒ UI must not claim meters/kilometers (honest uncalibrated).
- Object `z` / `height` are local elevation / extrusion hints — not geodetic height until a heightfield + calibration says so.
- Renderers project local → view; they must not invent world facts (IV contract).

---

## Render suggestion vs canonical vs raster

| Class | May invent detail? | Persist as fiction? | Examples |
|---|---|---|---|
| **Canonical** | No | Yes (owner write) | strokes, rooms, walls, stamps, anchors, heightfield samples |
| **Suggestive** | Decoration / LOD only | No as new entities | coast mesh smoothing, stamp meshes |
| **Atmospheric** | Yes (lighting, fog) | No | sky, postFX |
| **Raster reference** | N/A (pixels) | Asset path only | basemap image, Azgaar underlay |

Imported AI images are **raster_reference** only — never auto-vectorized into canonical polygons in MVP.

---

## Heights & assets

| Concern | Authority |
|---|---|
| Heightfield samples | terrain owner; optional meta until B/D tickets land |
| Prop `z` / `height` | local extrusion; suggestive in 3D if missing |
| Building stamp size | prop_object; not a WorldNode |
| Heavy meshes / textures | host asset store + authorized URLs |
| Dual WebGL props (`webgl-runtime-bridge`) | **compatibility mirror** — product SoT remains UnifiedCanvasDoc (B04 write-retire) |

---

## Required edit operations (inventory)

Present in `MapEditOperation` today:

- objects: `add` / `move` / `transform` / `remove`
- rooms: `add` / `move` / `resize` / `remove`
- walls: `add` / `move` / `remove`
- `replace_scene` (dungeon commit)

Deferred (C01/C02 — must not pretend complete):

- dedicated river/road tools beyond stroke material
- door entities
- political-area tool distinct from terrain area
- heightfield paint ops

---

## Migration / fallback matrix

| Source | Disposition | Notes |
|---|---|---|
| Valid V1 UnifiedCanvasDoc | **Keep** | Classify in-memory; no rewrite |
| Empty / missing unifiedCanvas | empty doc + `demoSeed` policy of caller | No invented coasts |
| `rooms[]` rect ocean / land | classify `terrain_area` when material water/land on world seed | Golden west/east polygons |
| `rooms[]` without owner hint | `legacy_area_ambiguous` | B02 review queue — no silent political |
| Stroke `wasser` | `path_river` | |
| Stroke other | `path_way` | |
| Wall | `wall` | |
| Object haus/turm | `building_footprint` (stamp) | Still not WorldNode |
| Object other | `prop_object` | `secret` preserved |
| `layers.*` false | view toggle only | |
| Basemap / Azgaar path | `raster_reference` | |
| Legacy WebGL localStorage | read-only import path | Never SoT |
| Dual `webglRuntime` props | sync from canvas | B04 stops write-back as authority |
| Unknown format string | reject parse (existing) | Caller keeps prior revision |
| WorldNode tree | unchanged | Out of B01 rewrite scope |

---

## Renderer dependency rule

One editable document → Canvas2D authoring + Three.js projection + legacy WebGL bridge (read/migrate).  
No second competing geometry store for product edits after B04.

---

## Validation against Golden data

Dornhain unified v4 (`buildDornhainUnifiedCanvasDoc`):

- Oceans / coast polygons → terrain_area (not WorldNode)
- Rivers → path_river
- Roads → path_way
- Settlement stamps → building_footprint / prop_object
- Crypt stamp `secret: true` → remains secret
- No row classified as `political_area` without explicit owner hint
