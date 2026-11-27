# SWS — Root-Cause-Analyse

- **Status:** Analyse, keine Implementierung. Baut auf `sws-architecture-snapshot.md` auf.
- **Kennzeichnung:** ✅ verifiziert · 🧩 Schlussfolgerung · ❓ Annahme · 🔴 offene Entscheidung

---

## 0. Symptom → Ursache (Mapping auf Bens ursprüngliche Meldung)

| Gemeldetes Symptom | Oberflächliche Hypothese | **Tatsächliche Root Cause** ✅ |
|---|---|---|
| „Übergang nicht smooth wie Google Maps" | Animation zu kurz / kein Easing | **Kein geometrischer Übergang existiert.** Map-Wechsel ist ein `setActiveMapId`-Doc-Swap + `clearRoot()`-Rebuild. Der „Übergang" ist ein 500 ms `<img>`-Fade (`AtlasPortalTransitionOverlay`), der die Szene nicht interpoliert. |
| „Ort ist nicht Teil des Landes" | Kindkarte falsch positioniert | **Keine Shared Geometry.** Jede Map zeichnet ihre Geometrie unabhängig (`buildGoldenCountryCanvas` ≠ Ausschnitt aus `buildGoldenContinentCanvas`). Es gibt keine gemeinsame geometrische Wahrheit, nur einen Anchor-**Punkt**. |
| „Ansichten-Switch weird" | CSS-/Layout-Bug | `switchCameraMode` setzt `yawRad` bei `ortho-topdown` hart auf 0 (`AtlasThreeWorkstation.tsx:622`) → Orientierungsverlust. Zusätzlich sind 2D (Canvas) und 3D (Three/Custom) **getrennte Renderer** ohne gemeinsamen Kamerazustand. |
| „MacBook Pinch/Orbit geht nicht" | Fehlendes Event-Binding | Kein `gesturestart`/`ctrlKey+wheel`-Handler (`grep gesture` = 0). Orbit nur via Rechtsklick/Shift/Alt; **kein** Zwei-Finger-Drag-Orbit. |

🧩 **Kernaussage:** Alle vier Symptome sind **keine isolierten Bugs**, sondern Konsequenzen **einer** architektonischen Entscheidung: der Atlas ist als *Sammlung verlinkter Dokumente mit Single-Active-Doc-Renderer* gebaut, nicht als *eine verschachtelte Welt mit kontinuierlicher Kamera*.

---

## 1. Die fünf eigentlichen Root Causes

### RC-1 — Single-Active-Doc-Rendering (der zentrale strukturelle Blocker) ✅

```520:565:src/infrastructure/world/atlas-three/atlas-three-runtime.ts
private doc: UnifiedCanvasDoc | null = null;  // genau EIN Doc
private readonly root = new THREE.Group();     // nur die aktive Map
```

`ensureScene()` ruft bei jedem Map-/LOD-/Preset-Wechsel `clearRoot()` (dispose + rebuild). Der Scene Graph kann **per Konstruktion** nur eine Map gleichzeitig enthalten. Der `ParentSpatialAnchor` wird im Renderer **nicht ausgewertet** (`grep parentAnchor` = 0 Treffer).

**Folge:** Selbst mit perfekter Anchor-Mathematik könnte der Renderer Kind- und Parent-Geometrie **nicht gleichzeitig** darstellen. Jede „Verschachtelung" ist damit ausgeschlossen, egal wie gut die Transformation ist.

### RC-2 — Fehlende rekursive Welt-Transformation ✅

`childLocalToParentPoint` transformiert **genau eine** Ebene. Es gibt keine Funktion `localToWorld(mapId, point)`, die die Anchor-Kette bis zur World-Root komponiert. Damit existiert **kein globaler Koordinatenraum**, in dem ein Objekt auf zwei Ebenen dieselbe Position hätte.

**Nebenbefund (Verzerrung):** `extentX ≠ extentY` erlaubt nicht-uniforme Skalierung; kombiniert mit Rotation entsteht Scherung (§1.8 Snapshot). Eine naive Rekursion würde diese Verzerrungen **multiplizieren**. → Die Transformation braucht ein konsistentes Skalierungs-/Rotationsmodell, bevor sie rekursiv komponiert wird.

### RC-3 — Keine Geometry Ownership / Source of Truth ✅

Terrain, Küsten, Flüsse, Straßen werden **pro Map unabhängig** gezeichnet. `AtlasFeatureOwner` existiert nur als **Deklaration** ohne Durchsetzung. Es gibt:
- keine Ableitung grober Geometrie aus detaillierter,
- keine Verfeinerung grober Geometrie zu detaillierter,
- keine Konflikterkennung bei widersprüchlichen Bestands-Geometrien,
- keine automatische Mitnahme von Kindern bei Parent-Feature-Verschiebung (Anchor ist absoluter Punkt, nicht relativ zu Parent-Features).

🧩 **Das ist neben RC-1 die schwerwiegendste Ursache** und — wichtig — **orthogonal zum Rendering.** Selbst ein perfekter Multi-Map-Renderer (RC-1 gelöst) würde weiterhin widersprüchliche Küsten/Flüsse anzeigen, weil die Daten selbst widersprüchlich sind. Nested Rendering allein **kaschiert** RC-3 nur.

### RC-4 — Breadcrumb-getriebene statt kameragetriebene LOD ✅

`lodBandFromBreadcrumbDepth` bestimmt die semantische Detailstufe aus der **Navigationshistorie**, nicht aus der Kameradistanz. `resolveContinuousZoomTransition` nutzt zwar `span`-Schwellen, feuert dann aber einen **diskreten** `enter-child`/`exit-parent`-Wechsel (Doc-Swap), keinen kontinuierlichen LOD-Übergang.

**Folge:** LOD ist an „welche Karte ist offen" gekoppelt statt an „wie nah ist die Kamera an welcher Weltregion".

### RC-5 — Fragmentierter Kamera-/Input-Stack ✅

- **Kamera:** `AtlasThreeCameraView` (span/yaw/pitch/mode) existiert, aber 2D-Canvas (`AtlasCamera` in `UnifiedAtlasEditor`) und 3D teilen **keinen** Zustand. `switchCameraMode` verwirft Yaw.
- **Input:** kein Trackpad-Pinch (`ctrlKey+wheel`/`gesturestart`), kein Zwei-Finger-Orbit, Orbit an Maus-Modifier gebunden.
- **Undo/Redo:** nur im 2D-Canvas (`atlas-edit-history` via `UnifiedAtlasEditor`), **nicht** im Three.js-Pfad (verifiziert: `AtlasThreeWorkstation.tsx` importiert keine History).

---

## 2. Was NICHT die Root Cause ist (Widerlegung falscher Fährten)

| Verführerische Erklärung | Warum falsch ✅ |
|---|---|
| „Wir brauchen nur eine bessere Zoom-Animation" | RC-1/RC-3 bleiben: selbst perfekte Animation zeigt widersprüchliche Geometrie und swapped das Doc. |
| „Wir müssen den Renderer wechseln (Custom WebGL → Three.js)" | Renderer-Wahl ist **orthogonal**. RC-1/2/3 existieren in **beiden** Renderern. ADR-ST-11 löst Materialien/Licht, nicht Weltverschachtelung. |
| „Wir brauchen einen Tile-Server / Cesium / Unreal" | YAGNI. Die Anchor-Bausteine existieren; es fehlt ihre **Komposition**, nicht externe Infrastruktur. |
| „`parent_map_id` ist kaputt" | Semantische Hierarchie funktioniert. Es fehlt die **räumliche** Dimension und deren Durchsetzung. |

---

## 3. Kausalkette (Abhängigkeit der Root Causes)

```
RC-3 (Geometry Ownership)          RC-2 (rekursive Transform)
   │ unabhängige Geometrien            │ kein globaler Raum
   ▼                                  ▼
   └──────────────┬───────────────────┘
                  ▼
        RC-1 (Single-Active-Doc)  ← struktureller Blocker
                  ▼
        RC-4 (Breadcrumb-LOD)     ← hängt an RC-1
                  ▼
        RC-5 (Kamera/Input-Fragmentierung)
                  ▼
        ═══ Sichtbare Symptome (Bens Meldung) ═══
```

🧩 **Reihenfolgen-Implikation für den Migrationsplan:**
- **RC-2 + RC-3 sind Voraussetzung** für sinnvolles Multi-Map-Rendering. Ohne globalen Raum (RC-2) und konsistente Geometrie (RC-3) produziert RC-1-Lösung nur „mehrere widersprüchliche Karten gleichzeitig".
- **RC-1** ist der Render-Blocker, der nach RC-2/RC-3 gelöst werden muss.
- **RC-4/RC-5** sind darauf aufbauende Verfeinerungen.

---

## 4. Verifikations-Notizen

- RC-1, RC-2, RC-4, RC-5: durch direktes Code-Reading + `grep` verifiziert (Snapshot §1–§4).
- RC-3: durch Vergleich `buildGoldenContinentCanvas` (Westmark-Polygon) vs. `buildGoldenCountryCanvas` (unabhängiges Gras-Rechteck) verifiziert — geometrisch nicht abgeleitet.
- Tisch-Rechnung numerisch ausgeführt: `(360,360)`→`(321.28,521.28)`, Roundtrip exakt.
- Undo/Redo-Lücke: `AtlasThreeWorkstation.tsx` hat keinen `atlas-edit-history`-Import (verifiziert).

## 5. Offene Risiken / Blocker

⚠️ **R1 — Bestandsgeometrie-Konflikte:** Golden-Welt ist geometrisch selbst widersprüchlich (Kontinent-Polygon vs. Nordreich-Rechteck). Geometry-Ownership-Migration muss entscheiden, welche Quelle gewinnt. → manuelle Entscheidung, nicht automatisierbar.

⚠️ **R2 — Scherung bei Rekursion:** Bestehende nicht-uniforme Anchors müssen vor rekursiver Komposition normalisiert werden (uniforme Skalierung oder explizites Scherungs-Modell).

🔴 **R3 — Undo/Redo-Parität 3D:** Vor Vertical-Slice-Abnahme muss History im 3D-Pfad verdrahtet sein.

🔴 **R4 — Renderer-Gate:** ADR-ST-11 erlaubt produktives Three.js erst nach R04 (#1269). Shared-World-Space-Zielarchitektur muss renderer-unabhängig sein (Domain), damit sie nicht an diesen Gate-Status gekoppelt ist.
