# SWS — Performance-Konzept, Vertical-Slice-Spezifikation & Test-/Acceptance-Matrix

- **Status:** Planungsartefakt zu ADR-SWS-01. ✅ verifiziert · 🧩 Schlussfolgerung · 🔴 offene Entscheidung · ❓ Annahme

---

## A. Performance-Konzept

### A.1 Bestehende Budgets (verifiziert, `atlas-perf-budgets.ts`)

```80:90:src/domains/world/atlas/atlas-perf-budgets.ts
frameP95MsSoft: 33.3, coldPlanMsMax: 250,
maxInstancesHigh: 2048, maxInstancesBalanced: 1024, maxInstancesLite: 256,
maxDrawBatchesLarge: 48, mapSwitchCycles: 8, maxLiveGpuHandlesAfterTeardown: 0,
```

⚠️ Diese messen **Domain-Plan-Kosten** (CI/headless), **nicht** den Three.js-Runtime und **kein** Multi-Map-Szenario.

### A.2 Neue Multi-Map-Budgets (Vorschlag, messbar)

| Metrik | Zielwert | Messung |
|---|---|---|
| Gleichzeitig geladene Maps (Vertical Slice Tiefe 5) | ≤ 6 | Scene-Graph-Zählung |
| Gesamt-Instanzen über alle Groups (balanced) | ≤ 1024 (bestehend) | `measureAtlasPerfPlan` aggregiert |
| Frame P95 auf Zielhardware | ≤ 33.3 ms (30 FPS min), Ziel 16.7 (60 FPS) | Browser-Trace, echt |
| Scene-Update bei Zoom (kein Rebuild) | ≤ 4 ms inkrementell | Performance-Mark um `ensureScene`-Äquivalent |
| `clearRoot()`-Aufrufe während Vertical-Slice-Navigation | **0** | Instrumentation |
| Live-GPU-Handles nach Teardown | 0 (bestehend) | `AtlasGpuResourceSession` |
| JS-Heap nach 5× Welt→Raum→Welt-Zyklus | kein monotones Wachstum (>10 % Drift = FAIL) | `performance.memory` / CDP-Heap |

### A.3 Hardware-/Szenen-Profile 🔴

| Profil | Hardware | Erwartung |
|---|---|---|
| **target-desktop** | Apple M4 Pro (✅ ST-11-Referenz) | 60 FPS, full PBR |
| **min-desktop** | älteres Intel-MacBook / Mittelklasse-PC | ≥ 30 FPS, balanced |
| **software-ci** | SwiftShader (CI) | nur Funktions-/Korrektheitsgates, **nie** Perf-Beweis |

🧩 Software-WebGL-Zahlen werden (wie in ST-11) als `software`/`unverified` gelabelt und sind **kein** Hardware-Nachweis.

### A.4 Techniken (nur wo nötig, YAGNI)

- Instanced Rendering (✅ Gemini liefert InstancedMesh-Bäume), Frustum-Culling pro Group, Textur-Reuse (`AtlasPbrTextureLibrary` ✅),
  asynchrones Nachladen + Prefetch, adaptive Schatten-/Auflösung (Presets ✅), optionale PostFX.
- **Floating Origin:** ❌ nicht präventiv; nur bei gemessenem Vertex-Jitter (ADR §3.4).

---

## B. Vertical-Slice-Spezifikation (Golden)

### B.1 Navigationskette (referenziert `dornhain-golden-hierarchy.ts`)

```
Donalu (Welt)
 → Westmark (Kontinent)      anchor 260,420 ext 160,220
   → Nordreich (Land)        anchor 430,400 ext 110,100
     → Dornhain (Ort)        anchor 360,510 ext 55,55
       → Taverne Zum Flüstern anchor 328,528 ext 24,24
         → Schankraum → Tisch (Objekt, lokal 360,360)
```

### B.2 Verbindliche Acceptance Criteria

| ID | Kriterium | Nachweis |
|---|---|---|
| VS-01 | Kontinuierliches Rein-/Rauszoomen **ohne** Doc-Swap | Runtime-Instrumentation: `setActiveMapId`-wechseln nur Editor-Kontext; `clearRoot`=0 |
| VS-02 | **Keine** Positionssprünge | Kamera-focusWorld ist stetige Funktion der Zeit (Trace) |
| VS-03 | **Keine** Screenshot-/Portal-Kaschierung räumlicher Übergänge | `AtlasPortalTransitionOverlay` feuert nicht auf Welt→…→Raum |
| VS-04 | Konsistente Küste/Fluss/Straße/Terrain/Gebäude über Ebenen | Geometry-Ownership: derselbe Fluss identisch auf Land + Ort (Fingerprint) |
| VS-05 | Kontinuierliche Kameraposition | `AtlasWorldCameraState` ohne Reset |
| VS-06 | 2D↔3D-Wechsel erhält Fokus/Yaw/Maßstab | Kamera-State vor/nach Switch identisch (außer Projektion) |
| VS-07 | MacBook Pan/Pinch/Orbit | **Hardware-Test** (Playwright unzureichend ❓) |
| VS-08 | Selektion auf relevanten Ebenen | Raycast im Multi-Map-Graph trifft Tisch im Raum |
| VS-09 | Objekt verschieben/bearbeiten | Edit im World Space → korrekt in Local persistiert |
| VS-10 | Speichern/Wiederherstellen | `upsertMap`+Reload reproduziert exakte Position |
| VS-11 | Undo/Redo | ≥100 Zyklen (`ATLAS_EDIT_HISTORY_LIMIT`), im 3D-Pfad |
| VS-12 | Keine doppelten Geometrien | Replacement-Refinement: keine zwei Küsten am selben Ort (Z-Fighting-Check) |
| VS-13 | Keine unkontrollierten Scene-Rebuilds | `clearRoot`=0 während Navigation |
| VS-14 | Kein Speicherwachstum | A.2 Heap-Kriterium |
| VS-15 | Performance auf Zielhardware | A.2/A.3 |

### B.3 Nachweis-Arten

- **Runtime-Tests** (Playwright + Host): VS-01,04,05,06,08,09,10,11,12,13.
- **Screenshots** (Golden-Visual-Baselines): VS-04,12.
- **Performance-Messung** (Browser-Trace auf target-desktop): VS-15.
- **Hardware-Verifizierung MacBook:** VS-07 — manueller/skriptgestützter Test auf echtem Trackpad, dokumentiert.

---

## C. Test- und Acceptance-Matrix

| Testschicht | Tooling | Abdeckung |
|---|---|---|
| **Domain-Unit** (rein) | `node:test` Self-Tests | rekursive Transform (Roundtrip n Ebenen), Zyklus-Guard, Scherungs-Regel, Ownership-Ableitung, SSE-Schwellen + Hysterese |
| **Spatial-Integrity** | `sws-spatial-integrity.self-test.mjs` | Welt ohne Zyklen, valide Anchors, Ownership-Vollständigkeit |
| **Scene-Graph-Unit** | Three.js headless (mock GL) | Group-Platzierung = Anchor, Disposal-Ownership, kein Rebuild |
| **Persistenz-Contract** | Host-Store-Tests | `upsertMap` lehnt Zyklen ab, `expectedRevision` intakt |
| **E2E Runtime** | Playwright + ephemeral Host | Vertical Slice VS-01…VS-14 |
| **Golden Visual** | Screenshot-Baselines | Küsten/Fluss-Konsistenz, kein Z-Fighting |
| **Performance** | Browser-Trace (target/min/software) | A.2-Metriken |
| **Hardware manuell** | MacBook Trackpad | VS-07 |
| **Regression** | `npm run test-gate` | bestehende ATL2-Gates A–H bleiben grün |

### C.1 Roundtrip-Test (Beispiel, Domain)

```text
p_local = (360,360) in Taverne
w = localToWorld(taverne, p_local)     # über 4 Ebenen
back = worldToLocal(taverne, w)
assert |back - p_local| < 1e-9
```

### C.2 Zyklus-Test

```text
upsertMap(A.parent = B); upsertMap(B.parent = A)  → zweiter Aufruf MUSS fehlschlagen
buildMapBreadcrumb bleibt dennoch terminierend (Bestand)
```

---

## D. Offene Punkte (aus ADR übernommen)

🔴 D1 Ableitungsrichtung (Bottom-Up empfohlen) · 🔴 D2 Höhenmodell · 🔴 D4 Kalibrierung · 🔴 D6 Scherungs-Bestandsdaten ·
🔴 D7 2D-Renderer-Ersatz erst nach Parität · ❓ Trackpad-Automatisierbarkeit (Playwright-Grenze)
