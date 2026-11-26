# SWS — Architekturdiagramme (Current / Target)

- **Status:** Planungsartefakt zu `sws-adr-shared-world-space.md`. Mermaid.
- **Kennzeichnung:** ✅ verifiziert (aus Code abgeleitet) · 🧩 Zielbild

---

## 1. Current-State (verifiziert)

### 1.1 Daten- und Navigationsfluss beim Reinzoomen (Ist)

```mermaid
sequenceDiagram
  participant U as User (Wheel)
  participant W as AtlasThreeWorkstation
  participant Z as resolveContinuousZoomTransition
  participant WB as WorldAtlasWorkbench
  participant ED as useWorldAtlasEditor
  participant RT as AtlasThreeRuntime
  participant OV as AtlasPortalTransitionOverlay

  U->>W: wheel (deltaY)
  W->>RT: zoomAtScreen()
  W->>Z: {centerX,centerY,span,pins}
  Z-->>W: enter-child (pin)
  W->>WB: onNavSelect(placeId,mapId)
  WB->>ED: enterChildMap / setActiveMapId
  ED->>ED: beginAtlasMapLoad(generation++)
  ED->>ED: worldAtlasService.getMap(childId)
  Note over W,OV: Portal-Overlay (500ms img-Fade) kaschiert
  ED->>RT: neues UnifiedCanvasDoc
  RT->>RT: clearRoot() + dispose + rebuild
  Note over RT: NUR die neue Map im Scene Graph
```

🧩 Der Fade (OV) läuft **parallel** zum Doc-Swap — er interpoliert **nicht** die Geometrie, sondern verdeckt den Cut.

### 1.2 Current Scene Graph (Single-Active-Doc)

```mermaid
graph TD
  Scene --> root["root: THREE.Group"]
  Scene --> skyDome & ocean & meadow & grid
  root --> M1["mesh atlas3:sheet"]
  root --> M2["mesh atlas3:water"]
  root --> M3["mesh atlas3:terrain"]
  root --> M4["instanced trees/props"]
  Note[root enthält NUR die aktive Map<br/>doc = EIN UnifiedCanvasDoc<br/>parentAnchor ungenutzt]
```

---

## 2. Target-State (Zielbild)

### 2.1 Target Scene Graph (Multi-Map, Anchor-verschachtelt)

```mermaid
graph TD
  Scene --> WorldGroup["Group Welt (Wurzel)"]
  WorldGroup --> ContGroup["Group Westmark<br/>T=anchor(260,420,160,220)"]
  ContGroup --> CtryGroup["Group Nordreich<br/>T=anchor(430,400,110,100)"]
  CtryGroup --> PlaceGroup["Group Dornhain<br/>T=anchor(360,510,55,55)"]
  PlaceGroup --> TavGroup["Group Taverne<br/>T=anchor(328,528,24,24)"]
  PlaceGroup --> CryptGroup["Group Krypta<br/>T=anchor(406,462,28,28)"]
  TavGroup --> Props["rooms/walls/möbel (additiv)"]
  LOD["Continuous LOD Controller<br/>(SSE + Hysterese + Culling)"] -.steuert Sichtbarkeit.-> ContGroup & CtryGroup & PlaceGroup & TavGroup
  Plan["AtlasWorldScenePlan (Domain)"] -.konkrete Datenstruktur.-> Scene
```

### 2.2 Target Datenfluss beim Reinzoomen (Soll)

```mermaid
sequenceDiagram
  participant U as User (Pinch/Wheel)
  participant IC as UnifiedInputController
  participant CC as UnifiedCameraController
  participant LOD as ContinuousLODController
  participant SG as SpatialSceneGraph
  participant Dom as Domain (localToWorld)

  U->>IC: pinch / wheel(ctrlKey)
  IC->>CC: zoomTo(cursorWorld, delta)
  CC->>CC: span interpolieren (kein Reset)
  CC->>LOD: neuer view.span + focusWorld
  LOD->>Dom: localToWorld für sichtbare Anchors
  LOD->>SG: SSE > threshold → refine (additiv/replacement)
  SG->>SG: Kind-Group einblenden, Parent grob ausstanzen
  Note over SG: KEIN clearRoot, KEIN Doc-Swap<br/>Parent & Kind gleichzeitig sichtbar
```

### 2.3 Coordinate-Space-Komposition

```mermaid
graph LR
  subgraph Lokal
    P1["Tisch lokal (360,360)"]
  end
  P1 -->|"childLocalToParentPoint<br/>tavern anchor"| P2["(321.28,521.28) Dornhain"]
  P2 -->|"dornhain anchor"| P3["Nordreich"]
  P3 -->|"country anchor"| P4["Westmark"]
  P4 -->|"continent anchor"| P5["Welt (World Space)"]
  Note["Rekursion mit Zyklus-Guard<br/>Weltkoordinate = abgeleitet, nicht persistiert"]
```

### 2.4 Schichtentrennung (Renderer-Unabhängigkeit)

```mermaid
graph TD
  subgraph Domain["src/domains/world/atlas (rein)"]
    Anchors["ParentSpatialAnchor + Validierung + Zyklus-Guard"]
    Transform["localToWorld / worldToLocal (rekursiv)"]
    Ownership["GeometryOwnership + derived-cache"]
    LODPlan["ContinuousLOD → AtlasWorldScenePlan"]
    CamState["AtlasWorldCameraState"]
  end
  subgraph Infra["src/infrastructure (Renderer)"]
    Three["atlas-three Runtime (präferiert, Gate-Vorbehalt)"]
    WebGL["Custom WebGL (nur bei belegter Notwendigkeit)"]
  end
  subgraph App["src/app/world/atlas"]
    Editor["Editor / useWorldAtlasEditor"]
    Input["UnifiedInputController"]
  end
  Domain -->|"AtlasWorldScenePlan (Daten)"| Infra
  CamState --> Editor & Input
  Editor --> Domain
```

🧩 **Wichtig:** `AtlasWorldScenePlan` ist eine **konkrete Datenstruktur**, kein generisches Renderer-Interface — erfüllt
Renderer-Unabhängigkeit ohne spekulative Abstraktion (Owner-Vorgabe).

---

## 3. Renderer-Evaluationsrahmen (Gemini-Branch, offen)

🔴 Der Gemini-Branch (`feat/atlas-phase0-forge-tools-and-adr11`) mountet `AtlasThreeWorkstation` produktiv innerhalb
`AtlasNative3dEditor`. Bewertung gegen ST-11-Gates:

| Kriterium | Befund |
|---|---|
| Nutzt Three.js | ✅ ja |
| Single-Active-Doc | ⚠️ ja — **kein** Multi-Map-Scene-Graph (RC-1 unverändert) |
| Geometry Ownership | ❌ nein — Golden weiterhin unabhängig gezeichnet |
| Undo/Redo im 3D-Pfad | ❌ nein (`AtlasThreeWorkstation` ohne `atlas-edit-history`) |
| Trackpad Pinch/Orbit | ❌ nein |
| ST-11 R02–R05 Gate-Zuordnung | 🔴 nicht dokumentiert — produktiv vor R04 (#1269) |

🧩 **Schlussfolgerung:** Der Gemini-Branch liefert wertvolle Three.js-**Rendering**-Bausteine (PBR, Scene/Camera-Runtime,
Perf-Integration), löst aber **keine** der Root Causes RC-1/2/3. Er ist **Material-Lieferant** für den Three.js-Renderer,
**nicht** Grundlage der Shared-World-Space-Architektur. Übernahme nur nach ST-11-Gate-Zuordnung und RC-Auflösung.
