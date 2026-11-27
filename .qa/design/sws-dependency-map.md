# SWS — Dependency Map

- **Status:** Planungsartefakt. ✅ verifiziert · 🧩 Schlussfolgerung
- **Zweck:** Zeigt, welche bestehenden Module von der Shared-World-Space-Migration betroffen sind und in welcher Reihenfolge sie angegangen werden müssen.

---

## 1. Modul-Abhängigkeiten (Ist, aus Imports abgeleitet)

```mermaid
graph TD
  subgraph Persistenz
    SQL["0020_world_atlas.sql<br/>world_atlas_maps / parent_map_id"]
    Store["world-atlas-store.ts / world-map-store.ts (Legacy)"]
  end
  subgraph Domain
    Types["world-atlas.types.ts"]
    Frame["map-frame.ts<br/>(Anchor, 1-Ebenen-Transform, AABB)"]
    Doc["unified-canvas-doc.ts<br/>(UnifiedCanvasDoc)"]
    Nav["atlas-hierarchy-nav.ts<br/>(Breadcrumb, enterChildMap)"]
    LOD["atlas-hierarchy-lod.ts<br/>(State, Cache, Prefetch)"]
    Zoom["atlas-continuous-zoom.ts"]
    Hist["atlas-edit-history.ts"]
    Pins["atlas-map-pins.ts"]
    Perf["atlas-perf-budgets.ts"]
    Golden["dornhain-golden-hierarchy.ts"]
    Party["party-map-projection.ts"]
    Adapter["atlas-map-doc-adapter.ts (V1↔V2)"]
  end
  subgraph Infra
    ThreeRT["atlas-three-runtime.ts (Single-Doc)"]
    ThreeCam["atlas-three-camera.ts"]
    ThreeScene["atlas-three-scene.ts"]
    Service["world-atlas-service.ts"]
  end
  subgraph App
    Editor["useWorldAtlasEditor.ts (einziger Writer)"]
    Workbench["WorldAtlasWorkbench.tsx"]
    Unified["UnifiedAtlasEditor.tsx (2D)"]
    Native3d["AtlasNative3dEditor.tsx"]
    ThreeWS["AtlasThreeWorkstation.tsx"]
    Overlay["AtlasPortalTransitionOverlay.tsx"]
  end

  SQL --> Store --> Service
  Frame --> Nav & LOD & Zoom
  Doc --> Frame & Hist & Adapter & Golden
  Nav --> Editor
  LOD --> Editor
  Service --> Editor
  Editor --> Workbench --> Unified & Native3d
  Native3d --> ThreeWS --> ThreeRT
  ThreeRT --> ThreeCam & ThreeScene
  ThreeWS --> Overlay
  Doc --> ThreeRT
```

---

## 2. Betroffenheits-Matrix (welche Root Cause trifft welches Modul)

| Modul | RC-1 Scene | RC-2 Transform | RC-3 Geometry | RC-4 LOD | RC-5 Cam/Input | Änderungsaufwand |
|---|:-:|:-:|:-:|:-:|:-:|---|
| `map-frame.ts` | — | **hoch** (Rekursion, Scherung, Zyklus-Guard) | mittel (Ownership-Hints durchsetzen) | — | — | mittel |
| `unified-canvas-doc.ts` | — | — | **hoch** (Ownership-Marker) | — | — | mittel |
| `atlas-hierarchy-nav.ts` | hoch (kein Doc-Swap mehr) | mittel | — | hoch (Breadcrumb entkoppeln) | — | hoch |
| `atlas-hierarchy-lod.ts` | hoch | mittel | — | **hoch** (SSE statt Breadcrumb) | — | hoch |
| `atlas-continuous-zoom.ts` | mittel | mittel | — | **hoch** (kontinuierlich statt diskret) | mittel | hoch |
| `atlas-edit-history.ts` | mittel (Multi-Map) | — | — | — | **hoch** (3D-Verdrahtung fehlt) | mittel |
| `atlas-three-runtime.ts` | **hoch** (Multi-Map-Graph) | mittel (Anchor anwenden) | mittel | hoch | — | **sehr hoch** |
| `atlas-three-camera.ts` | — | — | — | — | **hoch** (Unified State) | mittel |
| `useWorldAtlasEditor.ts` | hoch (kein Single-Doc) | mittel | mittel | hoch | mittel | hoch |
| `AtlasThreeWorkstation.tsx` | hoch | — | — | mittel | **hoch** (Trackpad, Yaw) | hoch |
| `AtlasPortalTransitionOverlay.tsx` | hoch (entfällt für räumliche Übergänge) | — | — | — | — | niedrig (Deprecation) |
| `UnifiedAtlasEditor.tsx` (2D) | — | — | — | — | **hoch** (gemeinsamer Cam-State) | mittel |
| `dornhain-golden-hierarchy.ts` | — | — | **hoch** (Konflikt-Auflösung) | — | — | mittel (manuell) |
| `world-atlas-store.ts` | — | mittel (Schreib-Zyklus-Guard) | mittel | — | — | niedrig |
| `party-map-projection.ts` | — | mittel (Projektion im World Space) | — | — | — | niedrig |

---

## 3. Kritischer Pfad (Reihenfolge)

```mermaid
graph LR
  A["1. map-frame<br/>rekursive Transform<br/>+ Zyklus-Guard + Scherungs-Regel"] --> B["2. Geometry Ownership<br/>+ Golden-Konflikt-Auflösung"]
  B --> C["3. AtlasWorldScenePlan<br/>(Domain-Datenstruktur)"]
  C --> D["4. Multi-Map-Scene-Graph<br/>(atlas-three-runtime)"]
  A --> E["UnifiedCameraState"]
  E --> D
  D --> F["5. Continuous LOD<br/>(SSE + Hysterese)"]
  D --> G["UnifiedInputController<br/>Trackpad"]
  D --> H["Undo/Redo 3D-Verdrahtung"]
  F --> I["6. Vertical Slice<br/>Donalu→…→Objekt"]
  G --> I
  H --> I
```

🧩 **Bottleneck:** Schritt 1 (rekursive Transformation) und Schritt 2 (Geometry Ownership) sind **Voraussetzung** für alles
Weitere und können **parallel** laufen. Schritt 4 (Multi-Map-Scene-Graph) ist der größte Einzelaufwand und hängt von 1+2+3 ab.

---

## 4. Was unverändert bleibt (Wiederverwendung)

✅ `parentAnchorFromParentRect`, `childLocalToParentPoint`, `parentPointToChildLocal`, `parentAnchorAabb`, `parentAnchorsOverlapAabb`
✅ `atlas-hierarchy-lod` Cache/Prefetch/State-Machine (Basis, wird erweitert nicht ersetzt)
✅ `atlas-perf-budgets` Schwellen + `AtlasGpuResourceSession`
✅ `atlas-edit-history` Snapshot-Logik (nur Verdrahtung im 3D-Pfad neu)
✅ `dungeon-generator` / `dungeon-forge-workflow` (prozeduraler Infill = Top-Down-Ausnahme)
✅ Three.js PBR/Materialien/PostFX aus Gemini-Branch (als Renderer-Bausteine)
✅ SQLite-Schema `world_atlas_maps` (nur erweitert, nicht ersetzt)
