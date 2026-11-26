# SWS — Unified Atlas Architecture Snapshot (verifiziert, erweitert)

- **Status:** Rein lesender technischer Befund — keine Implementierung, keine Architekturentscheidung.
- **Branch/HEAD:** `feat/atlas-nested-lod-spike` = `feat/atlas-phase0-forge-tools-and-adr11` @ `31e8a5093`
- **Zweck:** Entscheidungsgrundlage für Shared World Space + Continuous LOD (Epic-Neuaufstellung).
- **Kennzeichnung:** ✅ verifiziert (Code gelesen/gemessen) · 🧩 Schlussfolgerung · ❓ Annahme · 🔴 offene Entscheidung · ⚠️ Risiko/Blocker

Dieses Dokument ersetzt den ersten Entwurf des Snapshots. Korrekturen gegenüber dem Entwurf sind in §0 gesammelt.

---

## 0. Korrekturen zum vorherigen Snapshot-Entwurf

| # | Entwurf-Behauptung | Verifikationsergebnis |
|---|---|---|
| K1 | „Tisch landet bei ≈ `(325.9, 524.9)`" | ❌ **Falsch (mein Rechenfehler).** ✅ Tatsächlich `(321.28, 521.28)` — siehe §1.6 mit ausführlicher Rechnung. |
| K2 | „`CHECK parent_map_id <> id` verhindert Hierarchie-Zyklen" | ⚠️ **Nur Selbst-Zyklen.** Die Constraint verhindert `parent = self`, aber **keine** mehrstufigen Zyklen (A→B→A). Siehe §1.7. |
| K3 | „Transformation erzeugt keine Verzerrung" | ⚠️ **Differenzieren.** Die vorhandene 2D-Transformation nutzt **getrennte** `extentX/extentY` → **nicht-uniforme Skalierung** ist möglich und erzeugt Scherung in Kombination mit Rotation. Siehe §1.8. |

---

## 1. Datenmodell und räumliche Hierarchie

### 1.1 Persistenz ✅

**Zwei getrennte Map-Tabellen** (SQL-Katalog = applied Source of Truth):

- `world_atlas_maps` (`server/migrations/0020_world_atlas.sql`) — **aktive Atlas-Hierarchie**.
  Spalten: `id`, `world_profile_id → worlds.id`, `parent_map_id → world_atlas_maps.id ON DELETE SET NULL`,
  `kind` (`world/region/settlement/scene/legacy_tiles`), `title`, `sort_order`,
  `bounds` (TEXT JSON, default `{"minX":0,"minY":0,"maxX":1000,"maxY":1000}`),
  `layers` (GeoJSON FeatureCollection), `basemap_storage_path`, `azgaar_map_storage_path`,
  `generator_meta` (TEXT JSON), `revision` (CHECK ≥ 0), `created_at`, `updated_at`.
  Indexe: `(world_profile_id, sort_order, title)`, `(parent_map_id)`.
- `world_maps` (`server/migrations/0011_world_maps.sql`) — **Legacy-RPC-Pfad** (`world-map-store.ts`).
  Spalten: `world_id`, `revision`, `map_data`, `updated_at`. Drizzle-Mirror `worldMaps` in `server/src/persistence/schema/world.ts`.
- `world_places` + `world_place_map_links` (0020) — semantische Orte + Place↔Map-Verknüpfung (`usage ∈ primary/overview/detail`).

🧩 Die räumliche Verankerung liegt **nicht in SQL-Spalten**, sondern als JSON in `generator_meta.mapFrame.parentAnchor`.

### 1.2 Hierarchie-Ebenen ✅

`kind` ist nur `world/region/settlement/scene/legacy_tiles` (`world-atlas.types.ts`). Die semantischen **6 LOD-Bänder**
(`world/continent/country/place/building/room`, `atlas-hierarchy-lod.ts:14`) sind ein **separates** Konzept und werden
aktiv über **Breadcrumb-Tiefe** bestimmt (`lodBandFromBreadcrumbDepth`), nicht über `kind`.

⚠️ **Risiko:** Breadcrumb-Tiefe als LOD-Treiber koppelt die Render-Detailtiefe an die Navigationshistorie statt an die tatsächliche Kameradistanz.

### 1.3 `parent_map_id` vs. `ParentSpatialAnchor` ✅

- `parent_map_id` (SQL): **semantische** Parent-Beziehung, `ON DELETE SET NULL`.
- `ParentSpatialAnchor` (JSON): **räumliche** Verankerung im Parent-Koordinatenraum.

```28:43:src/domains/world/atlas/map-frame.ts
export type ParentSpatialAnchor = {
  readonly parentMapId: string;
  readonly centerX: number;   // Parent-Map-Einheiten
  readonly centerY: number;
  readonly extentX: number;   // Halbbreite in Parent-Einheiten
  readonly extentY: number;
  readonly rotationRad: number;
  readonly metersPerUnit: number | null;  // null = unkalibriert
};
```

### 1.4 Koordinaten / Einheiten / Maßstab ✅

- Default-Bounds `{0,0,1000,1000}` pro Map (`DEFAULT_ATLAS_BOUNDS`).
- **Abstrakte Einheiten** bis `metersPerUnit` gesetzt. Kopfkommentar `map-frame.ts`: *„Abstract 0…1000 is not meters until calibrated."*
- UI unterdrückt m/km-Anzeige solange unkalibriert (`atlasZoomCaption`).
- Rotation `rotationRad` im Parent-Plan, Default 0.

### 1.5 Lokale→Parent-Transformation (eine Ebene) ✅

`childLocalToParentPoint` / `parentPointToChildLocal` (`map-frame.ts:330–372`) sind implementiert, invertierbar und rotationsfähig.
Zusätzlich `parentAnchorAabb` (rotationsbehandelte OBB→AABB) und `parentAnchorsOverlapAabb`.

❌ **Keine rekursive Komposition** über n Ebenen (Child→…→World-Root) existiert.

### 1.6 Konkretes Beispiel — Golden Dornhain-Kette ✅ (korrigiert)

`dornhain-golden-hierarchy.ts:316` — alle Kinder `bounds 0…1000`, `metersPerUnit = null`, `rotationRad = 0`:

| Map (seedKey) | Parent | centerX | centerY | extentX | extentY |
|---|---|---|---|---|---|
| `continent.westmark` | (Welt-Root) | 260 | 420 | 160 | 220 |
| `country.westmark` (Nordreich) | continent.westmark | 430 | 400 | 110 | 100 |
| `place.dornhain` | country.westmark | 360 | 510 | 55 | 55 |
| `loc.tavern` (Zum Flüstern) | place.dornhain | 328 | 528 | 24 | 24 |
| `loc.crypt` (Krypta) | place.dornhain | 406 | 462 | 28 | 28 |

**Tavernen-Tisch `g.tav.table` @ lokal `(360,360)` → Dornhain-Koordinaten** (numerisch ausgeführt):

```
midX=500, midY=500, halfW=500, halfH=500
nx = (360-500)/500 = -0.28 ; ny = (360-500)/500 = -0.28
dx = -0.28*24 = -6.72 ; dy = -6.72   (rotationRad=0)
x = 328 + (-6.72) = 321.28
y = 528 + (-6.72) = 521.28
```
✅ Ergebnis `(321.28, 521.28)`. Roundtrip `parentPointToChildLocal(321.28,521.28)` → `(360,360)` (float-Exaktheit bis 1e-13).
🧩 Weitere Hochrechnung Taverne→Welt erfordert die (nicht existierende) Komposition Dornhain→Nordreich→Westmark→Welt.

### 1.7 Zyklus-Absicherung ✅/⚠️

- `CHECK (parent_map_id IS NULL OR parent_map_id <> id)` verhindert **nur Selbstreferenz**.
- ✅ `buildMapBreadcrumb` (`atlas-hierarchy-nav.ts:80`) hat einen **`guard: Set`**-Walk, der Zyklen beim **Lesen** abbricht (kein Infinite-Loop).
- ❌ **Kein Schreib-Guard:** `upsertMap` kann einen mehrstufigen Zyklus (A→B→C→A) persistieren; erst der Lese-Breadcrumb bricht ihn still ab.
- ❌ `assertIndependentBranches` prüft nur Ancestor-Linien zweier Tips, nicht globale Zyklen.

⚠️ **Risiko:** Persistenz erlaubt Zyklen, die erst zur Laufzeit still „gekappt" werden — Datenintegrität nicht durch Schema erzwungen.

### 1.8 Skalierung / Rotation / Verzerrung ✅/⚠️

- `extentX ≠ extentY` ist erlaubt (z. B. Kontinent `160/220`). → **nicht-uniforme Skalierung**.
- `childLocalToParentPoint` skaliert `nx*extentX`, `ny*extentY` **getrennt**, dann Rotation. Bei `extentX≠extentY` **und** `rotationRad≠0` entsteht eine **Scherung** (nicht-orthogonale Achsen nach Transform).
- ✅ Für die Golden-Daten ist `rotationRad=0` und damit die Transform eine reine Achsen-Skalierung (keine Scherung, aber Seitenverhältnis-Verzerrung möglich).
- ❌ Höhenkoordinaten (Z) sind **nicht** Teil des Anchor-Modells — Anchor ist rein 2D (`centerX/centerY`). Heightfield-Höhen sind map-lokal, nicht world-relativ.

---

## 2. Geometrie und Terrain

### 2.1 Source of Truth ❌

Jede Map besitzt ein unabhängiges `UnifiedCanvasDoc` (`unified-canvas-doc.ts`): `rooms[]`, `strokes[]`, `objects[]`, `walls[]`, optional `heightfield`.

- **Terrain/Küsten/Flüsse/Straßen:** `rooms` (Polygone, Material), `strokes` (Material+Breite), `objects` (Stamps).
- **Gebäude/Innenräume:** `rectRoom` + `walls`.
- **Dungeon:** prozedural `dungeon-generator.ts` → rasterize → commit.

### 2.2 Kindkarten-Ableitung ❌

`buildGolden*Canvas()` erzeugt jedes Doc unabhängig (mit eigener `g.ocean`-Grundfläche).
Beispiel: Kontinent zeichnet Westmark als Polygon `[(120,180)…]`; Nordreich zeichnet ein **neues, anderes** Gras-Rechteck `(180,180,640,640)` — **nicht** als Ausschnitt des Kontinent-Polygons abgeleitet. Verbindung ist nur der Anchor-Punkt.

### 2.3 Geo-Synchronisation ❌

Kein Mechanismus. `AtlasFeatureOwner` (`political/terrain/room_geometry`) ist nur eine **Deklaration** mit `featureOwnerHints`-Hint, ohne Durchsetzung.

### 2.4 Widersprüche / Overlap / Parent-Verschiebung ⚠️

- **Overlap:** `parentAnchorsOverlapAabb` detektiert, erzwingt aber nichts (Golden nutzt es nur als Seed-Validierung).
- **Parent-Verschiebung:** Anchor ist absoluter Parent-Space-Punkt → Kinder folgen **nicht** automatisch einer Verschiebung von Parent-*Features*.
- **Widersprüche:** nicht erkannt.

### 2.5 Map vs. räumliches Objekt ✅

- **Map** = `world_atlas_maps`-Row.
- **Räumliches Objekt** = nur Stamp/Polygon **innerhalb** eines Docs. Kein eigenes persistiertes Entity mit globaler Identität.

---

## 3. Rendering-Architektur

### 3.1 Renderer-Verhältnis ✅ (mit ADR-Kontext)

⚠️ **ADR-Blocker beachten:** Die Renderer-Frage ist bereits geregelt:
- **ADR-ST-10** (#1266): produktiver 3D-SoT = **Custom WebGL** (`prototype3d/atlas-prototype-runtime.mjs` via `AtlasNative3dEditor`).
- **ADR-ST-11** (#1296): **GO (conditional, gates passed 2026-11-25)** für Three.js als **zukünftigen einzigen** Renderer; supersedes ST-10 erst nach R04 (#1269) Switch. Custom WebGL bleibt produktiv bis R04.

Aktueller Stack (Gemini-Branch):

| Renderer | Datei | Status |
|---|---|---|
| **Custom WebGL** | `unified/prototype3d/atlas-prototype-runtime.mjs` + `AtlasNative3dEditor.tsx` | produktiv (ST-10) |
| **Three.js** | `infrastructure/world/atlas-three/atlas-three-runtime.ts` + `AtlasThreeWorkstation.tsx` | Gemini-Arbeit; gemountet **innerhalb** `AtlasNative3dEditor` (Zeile 426) |
| **Canvas 2D** | `UnifiedAtlasEditor.tsx` | produktive 2D-Draufsicht |
| **Split 2D** | `AtlasSplit2dCanvas.tsx` | Begleit-2D in Split-View |
| **AtlasSpatialViewport** | `unified/AtlasSpatialViewport.tsx` | quarantäniert (nicht barrel-exportiert) |

🧩 Auf dem Gemini-Branch ist die Three.js-Workstation bereits der effektive 3D-Pfad (innerhalb `AtlasNative3dEditor`). Der Custom-WebGL-Pfad koexistiert. Das ist genau der von ST-10/ST-11 vorgesehene Übergangszustand.

### 3.2 Scene Graph & Lifecycle — Single-Active-Doc ✅

```520:565:src/infrastructure/world/atlas-three/atlas-three-runtime.ts
private readonly root = new THREE.Group();   // nur die aktive Map
private doc: UnifiedCanvasDoc | null = null;  // genau EIN Doc
```

- `ensureScene()` baut den Scene Graph bei Key-Änderung **komplett neu** (`clearRoot()` → dispose → rebuild via `buildAtlasThreeScenePlan`).
- Key = `${docRevision}|${lodBucket}|${presetId}|${cut/full}` (`ensureScene`, ~1167).
- `grep childMap|nested|parentAnchor` im Runtime: **0 Treffer** — der Anchor wird im Renderer nicht ausgewertet.
- ❌ Kein Multi-Map-Rendering, kein Nested-Map-Scene-Graph.

### 3.3 LOD — zwei nicht verbundene Modelle ✅

1. **Intra-Map-LOD:** `lodBucket far/mid/near` nach `view.span` (≥420/≥180/else) in `ensureScene`; Feature-Sichtbarkeit via `atlasSemanticFeatureVisible`.
2. **Inter-Map-LOD:** `atlas-hierarchy-lod.ts` — Load-State-Machine (`idle/prefetching/loading/transitioning/ready/error/cancelled`), Cache (`atlasMapCacheKey`), Prefetch (`decidePrefetchChildMap`), Fade-Opacity (`atlasLodTransitionOpacity`).

🧩 Diese LODs sind **nicht räumlich gekoppelt**: Map-Wechsel = Doc-Swap + Opacity-Crossfade, kein geometrischer Dive. `atlasParentGeoSuppressed` blendet Parent-Geo auf `building/room` aus.

### 3.4 Kamera & Zoom ✅

- `atlas-three-camera.ts`: `AtlasThreeCameraView` (span, yawRad, pitchRad, mode), `interpolateAtlasThreeView`, `dampAtlasThreeView`, `autoAtlasThreePitchForSpan`.
- `atlas-continuous-zoom.ts`: `resolveContinuousZoomTransition` — Schwellen `enterThreshold 145/88/50`, `exitThreshold 760/880`.
- **Ablauf:** Wheel → `zoomAtScreen` → `resolveContinuousZoomTransition` → `enter-child` → `onNavSelect` → `enterChildMap` → `setActiveMapId` → **React swapped Doc** → `clearRoot()`+Rebuild. „Smooth" nur via `AtlasPortalTransitionOverlay` (500 ms `<img>`-Scale-Fade).
- ⚠️ `switchCameraMode` (`AtlasThreeWorkstation.tsx:622`) setzt `yawRad` auf `ortho-topdown` hart auf 0 → Orientierungssprung.

### 3.5 Input ❌

- Wheel (inertia) ✅, PointerDown Orbit nur button 2 / Shift / Alt (`AtlasThreeWorkstation.tsx:709`).
- ❌ Kein `gesturestart`/`ctrlKey+wheel`/Pinch (`grep gesture` = 0). ❌ Kein Zwei-Finger-Drag-Orbit.

---

## 4. Editor- / Persistenz-Lifecycle (neu, §2-Audit)

### 4.1 State-Ownership ✅

`useWorldAtlasEditor.ts` ist der **einzige kanonische Writer**:
- State: `activeMapId`, `map` (WorldAtlasMapVm), `canvasDoc`, `webglRuntime`, `dungeonMeta`, `dirtyCanvas`, `dirtyLayers`.
- LOD-State: `lodSession` (+`lodSessionRef`), `mapCache` (+`mapCacheRef`), `prefetchedVmRef`.
- `mapCache` nutzt `putAtlasMapCacheEntry`/`isAtlasMapCacheFresh` aus `atlas-hierarchy-lod.ts`.

### 4.2 Load-Pfad ✅ (`useWorldAtlasEditor.ts:260–357`)

1. `activeMapId` ändert sich → `beginAtlasMapLoad` (generation++), `setLoading(true)`.
2. Warm-Cache-Hit (`prefetchedVmRef` + `isAtlasMapCacheFresh`) → sofort `commitVm`.
3. Sonst `worldAtlasService.getMap(id, playerView, sagaPublicId)`.
4. `commitVm` prüft `shouldApplyAtlasMapLoad(generation)` → `completeAtlasMapLoad` (→`transitioning`) → `applyLoadedMapVm`.
5. `finishLodTransition` (aus Workbench nach Fade) → `finishAtlasMapTransition` → `ready`.
6. Fehler → `failAtlasMapLoad`, Rollback auf `atlasLodFallbackActiveMapId`, **vorherige Map bleibt gemountet**.
7. Cleanup: `disposed=true`, ggf. `cancelAtlasMapLoad`.

✅ Robuste Generation-/Cancellation-Semantik. 🧩 Der `transitioning`-Zustand ist explizit an den **UI-Fade** gekoppelt (Kommentar „Codex P2"), nicht an einen geometrischen Übergang.

### 4.3 Save-Pfad ✅ (`useWorldAtlasEditor.ts:466–521`)

- `saveCanvas`: `mergeCanonicalAtlasGeometryForPersist` (strippt `webglRuntimeV3`-Geometry-Shadow, ATL2-B04) → `mergeDungeonMetaIntoGeneratorMeta` → `worldAtlasService.upsertMap({...generatorMeta, expectedRevision})`.
- Optimistic-Concurrency über `expectedRevision`.
- In-Flight-Edit-Detection (`editedDuringSave`) → bleibt dirty für nächsten Autosave.
- Nach Save: Cache-Invalidierung der Map (E04).

### 4.4 Prefetch ✅ (`useWorldAtlasEditor.ts:370+`)

`prefetchChildMap` nutzt `decidePrefetchChildMap` (nur **verortete** Kinder), schreibt in `prefetchedVmRef` + `mapCache`, **ohne** die aktive Load-Generation zu erhöhen (kein Abbruch eines laufenden Tip-Loads).

### 4.5 Undo/Redo ✅/⚠️

- `atlas-edit-history.ts`: past/future-Stacks aus **JSON-Snapshots des gesamten `UnifiedCanvasDoc`**, Limit 100, Batch-Support (`beginAtlasEditBatch`/`commitBatch`) für Gesten.
- Konsument: **`UnifiedAtlasEditor.tsx`** (Canvas 2D) — via `pushAtlasEdit` etc.
- ⚠️ `grep pushAtlasEdit|undoAtlasEdit` findet **keinen** Treffer in `AtlasThreeWorkstation.tsx` oder `useWorldAtlasEditor.ts`. 🧩 Undo/Redo ist **im 2D-Canvas-Editor** verdrahtet, nicht nachweisbar im Three.js-Workstation-Pfad. ❓ Ob die Three.js-Workstation die 2D-History mitnutzt, ist unklar (eigener `onCommitDocRef`-Pfad) — **offene Frage für das Audit.**

### 4.6 Party-Projection / Fog / Tokens ✅

- `party-map-projection.ts`: GM/Player-Redaction (strippt `secret:true` aus layers+generator_meta). `UNIFIED_SECRET_IDS` = `s.crypt`, `s.obj.crypt`. Host-seitig (fail-closed, kein CSS-Hiding).
- `secret?: boolean` auf rooms/strokes/objects (`unified-canvas-doc.ts:90/106`).
- ❌ **Kein Fog-of-War-System** im Atlas-Domain gefunden (nur secret/discovered-Flags). `discovered`-Flag existiert (`featureDiscovered`).
- ❌ **Token/Charakter-Positionen**: keine eigene räumliche Entity; Charaktere wären Stamps. `party-map-projection` projiziert nur Map-Payload, keine Live-Token-Positionen.

### 4.7 Aiberto / Tool-Registry / Import-Export

- `atlas-tool-registry.ts` (7 KB) existiert — Tool-Verträge. 🔴 Nicht im Detail auditiert (Umfang).
- `dungeon-forge-workflow.ts`: Dungeon-Preview→Commit→Reforge.
- Import/Export: `azgaar`-Import (`generatorMeta.engine='azgaar'`, `importedAt`), `atlas-map-doc-adapter.ts` (V1↔V2 lossless, `atlasMapDocBackup`-Backup-Key).

---

## 5. Performance-Budgets ✅

`atlas-perf-budgets.ts` (ATL2-G02) definiert **CI-messbare** Budgets (fail-closed, synthetische Plan-Kosten — **kein** 60-FPS-GPU-Versprechen):

```80:90:src/domains/world/atlas/atlas-perf-budgets.ts
frameP95MsSoft: 33.3, coldPlanMsMax: 250,
maxInstancesHigh: 2048, maxInstancesBalanced: 1024, maxInstancesLite: 256,
maxDrawBatchesLarge: 48, mapSwitchCycles: 8, maxLiveGpuHandlesAfterTeardown: 0,
```

- Fixtures: `small` (6 Räume, high), `medium` (16, balanced), `large` (40, balanced) mit Seed/Theme.
- `measureAtlasPerfPlan` misst `coldPlanMs`, `lookInstances`, `lookBatches`, `geometryPrimitives` + Fingerprints.
- `AtlasGpuResourceSession` trackt GPU-Handles über Map-Switch/Context-Loss (Teardown-Budget = 0).

⚠️ **Risiko:** Diese Budgets messen **Domain-Plan-Kosten**, nicht den Three.js-Runtime. Hardware-Benchmarks (ADR-ST-11) existieren nur als SwiftShader/Software-WebGL + einmaliger Apple-M4-Pro-Lauf. Kein Multi-Map-Szenario (existiert ja nicht).

---

## 6. Konsolidierte Befund-Matrix

| Bereich | Ist | Lücke zur Zielarchitektur (Shared World Space) |
|---|---|---|
| Semantische Hierarchie | ✅ `parent_map_id` | Zyklus-Guard nur lesend, nicht schreibend ⚠️ |
| Räumlicher Anchor | ✅ 2D, mit AABB/Overlap | nur 2D (kein Z), unkalibriert ⚠️ |
| 1-Ebenen-Transformation | ✅ invertierbar | nicht-uniforme Skalierung + Scherung möglich ⚠️ |
| n-Ebenen-Welt-Transformation | ❌ | **fehlt komplett** |
| Geo-Source-of-Truth | ❌ | **jede Map unabhängig**, keine Ownership-Durchsetzung |
| Geo-Sync Eltern↔Kind | ❌ | **fehlt** |
| Multi-Map-Scene-Graph | ❌ | **Single-Active-Doc**, Anchor ungenutzt |
| Kamera-Dive zwischen Ebenen | ❌ | Doc-Swap + Fade statt Dive |
| Semantic-LOD-Definition | ✅ 6 Bänder | Breadcrumb-getrieben statt kameragetrieben ⚠️ |
| Intra-Map-LOD | ✅ far/mid/near | — |
| Inter-Map-LOD-State | ✅ State-Machine+Cache+Prefetch | nur Opacity-Fade, kein geometrisches LOD |
| Kamera-Controller | ✅ span/yaw/pitch/mode | Mode-Switch verwirft Yaw ⚠️ |
| Trackpad Pinch/Orbit | ❌ | **fehlt** |
| Undo/Redo | ✅ 2D-Canvas | Three.js-Pfad unklar ❓ |
| Fog of War | ❌ | nur secret/discovered-Flags |
| Live-Token-Positionen | ❌ | keine räumliche Token-Entity |
| Perf-Budgets | ✅ Domain-Plan | kein Multi-Map/Runtime-Budget ⚠️ |
| Legacy `world_maps` | ⚠️ parallel | getrennter RPC-Pfad |

---

## 7. Offene Punkte für den externen Review

🔴 **D1 — Geo-Source-of-Truth-Strategie:** Ableitung grob-aus-fein vs. Verfeinerung grob-zu-fein vs. manuelle Ownership-Zuordnung pro Golden-Feature? (Größte fachliche Entscheidung; §2.2/2.3)

🔴 **D2 — Höhenmodell:** Anchor ist 2D. Wie werden Welt-Z (Terrain-Höhe) und Gebäude-Stockwerke im Shared Space repräsentiert?

🔴 **D3 — Renderer-Timeline:** ADR-ST-11 erlaubt Three.js erst nach R04 (#1269). Shared-World-Space-Arbeit auf dem Gemini-Branch nutzt bereits Three.js produktiv — ist das der R02–R05-Pfad oder ein Parallelpfad? Klärung mit ST-11-Gates nötig.

🔴 **D4 — Kalibrierung:** `metersPerUnit` ist überall `null`. Entweder globale Kalibrierung der Golden-Welt oder explizit abstrakt lassen (mit UI-Konsequenz).

🔴 **D5 — Undo/Redo im 3D-Pfad:** verifizieren, ob Three.js-Workstation die `atlas-edit-history` nutzt (§4.5).

⚠️ **Blocker:** Kein produktiver Multi-Map-Renderer existiert — jede Vertical-Slice-Arbeit beginnt bei §3.2 (Scene Graph).
