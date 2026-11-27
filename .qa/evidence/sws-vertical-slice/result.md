# SWS-04 G6 — Vertical-Slice Host Browser-E2E + Golden Visual + Perf Evidence

- **Captured at:** 2026-11-26T08:24:36Z (fail-closed verification run, without `--update-snapshots`)
- **Branch:** `feat/atlas-nested-lod-spike`
- **Command:** `PLAYWRIGHT_HARDWARE_WEBGL=1 npm run test:e2e -- e2e/sws-vertical-slice.spec.ts --project=chromium`
- **Result:** `3 passed (18.4s)` (ephemeral SQLite + Better Auth host + Vite proxy, Chromium)
- **Hardware Profile:** `target-desktop` — `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)` (`hardwareVerified: true`)
- **Opt-in `test-gate` switch:** `SAGATREE_SWS_G6_E2E=1 npm run test-gate` (default `npm run test-gate` skips live host browser E2E so offline/headless runs do not block)

---

## Acceptance Matrix (VS-01 … VS-15)

| ID | Kriterium | Nachweis-Art | Status | Messwert / Beobachtung | Evidence-Pfad |
|---|---|---|---|---|---|
| **VS-01** | Kontinuierliches Rein-/Rauszoomen ohne Doc-Swap | Host Browser E2E | **PASS** | `clearRootCount === 0` über alle 6 Ebenen (`Welt → Westmark → Nordreich → Dornhain → Taverne → Schankraum`), `activeEditorMapId` wechselt inkrementell über alle 6 Map-IDs | `.qa/evidence/sws-vertical-slice/perf.json` |
| **VS-02** | Keine Positionssprünge | Host Browser E2E | **PASS** | `maxFocusJumpWorldUnits === 0` über 51 interpolierte Zoom-Frames | `.qa/evidence/sws-vertical-slice/perf.json` |
| **VS-03** | Keine Screenshot-/Portal-Kaschierung räumlicher Übergänge | Host Browser E2E | **PASS** | `portalOverlayTriggered === false` über gesamten Zoom + 5 Zyklen | `.qa/evidence/sws-vertical-slice/perf.json` |
| **VS-04** | Konsistente Küste/Fluss/Straße/Terrain/Gebäude über Ebenen | Domain Self-Test + Golden Visual | **PASS** | Bottom-Up Geometry Ownership 0 Konflikte (`atlas-default-world.self-test.mjs`), 4-Ebenen-Golden-Screenshots fail-closed `toHaveScreenshot` PASS (`maxDiffPixelRatio = 0.08`) | `.qa/evidence/sws-vertical-slice/sws-01-world.png`, `sws-02-land-nordreich.png`, `sws-03-ort-dornhain.png`, `sws-04-raum-schankraum.png`, `golden-captures.json` |
| **VS-05** | Kontinuierliche Kameraposition ohne Reset | Host Browser E2E | **PASS** | `AtlasWorldCameraState` `maxYawDriftRad === 0`, `span` stetig `500 → 0.06` | `.qa/evidence/sws-vertical-slice/perf.json` |
| **VS-06** | 2D↔3D-Wechsel erhält Fokus/Yaw/Maßstab | Host Browser E2E | **PASS** | `diorama-oblique → ortho-topdown → perspective → diorama-oblique`: `yawPreserved: true`, `focusPreserved: true`, `spanPreserved: true`, `clearRootCount: 0` | `.qa/evidence/sws-vertical-slice/perf.json` |
| **VS-07** | MacBook Pan / Pinch / Orbit | **Manuelle Hardware-Verifizierung** | **OPEN (manual)** | **Nicht automatisiert (Playwright-Grenze für natives macOS-Trackpad-Pinch/Gesture).** Protokoll und Verifikations-Checkliste liegen bereit. | `.qa/design/sws-macbook-input-verification.md` |
| **VS-08** | Selektion auf relevanten Ebenen (Multi-Map Raycast) | Host Browser E2E | **PASS** | Multi-Map Raycast direkt von World-Root bei `span = 0.08` trifft `g.tav.table` im Schankraum (`hitOffset: [0, 0]`, `clearRootCount: 0`, 6 aktive Map-Groups) | `.qa/evidence/sws-vertical-slice/edit-persist.json` |
| **VS-09** | Objekt verschieben/bearbeiten | Host Browser E2E | **PARTIAL / PASS (active map)** | 3D-Move-Drag im Schankraum verschiebt `g.tav.table` von `(480, 480)` → `(558, 527.7)` (`91.43` lokale Einheiten); direktes Cross-Map-Writeback aus World-Root ohne aktiven Map-Kontextwechsel noch offen (siehe Finding M-1) | `.qa/evidence/sws-vertical-slice/edit-persist.json` |
| **VS-10** | Speichern/Wiederherstellen (`upsertMap` + Reload) | Host Browser E2E | **PASS** | Host `upsertMap` 200 OK bestätigt (`hostUpsertMapPersisted: true`), nach `page.reload()` exakte Position `(558, 527.7)` geladen | `.qa/evidence/sws-vertical-slice/edit-persist.json` |
| **VS-11** | Undo/Redo im 3D-Pfad | Domain/Renderer Self-Test + Host Browser E2E | **PASS** | 100-Zyklen-Self-Test (`sws-renderer-input-history.self-test.mjs`) + Browser-E2E: Undo stellt `(480, 480)` exakt wieder her, Redo stellt `(558, 527.7)` exakt wieder her | `.qa/evidence/sws-vertical-slice/edit-persist.json` |
| **VS-12** | Keine doppelten Geometrien / kein Z-Fighting | Golden Visual + Multi-Map Self-Test | **PASS (mit Randnaht-Finding)** | Replacement-Refinement (Rooms/Objects/Strokes + Terrain-Cutout) eliminiert Z-Fighting über alle 4 Golden-Visual-Ebenen; sichtbare rechteckige Wasser-Randnaht am Anker-Übergang dokumentiert (Finding M-2) | `.qa/evidence/sws-vertical-slice/golden-captures.json`, `sws-02-land-nordreich.png`, `sws-03-ort-dornhain.png`, `sws-04-raum-schankraum.png` |
| **VS-13** | Keine unkontrollierten Scene-Rebuilds | Host Browser E2E | **PASS** | `clearRootCount === 0` über gesamte Zoom-Fahrt + 5× Welt→Raum→Welt-Zyklen + 4 Golden Captures | `.qa/evidence/sws-vertical-slice/perf.json` |
| **VS-14** | Kein Speicherwachstum (≤ 10 % Drift nach 5 Zyklen) | Host Browser E2E | **PASS** | `heapSamplesMb: [117.3, 117.3, 117.3, 117.3, 117.3, 117.3]` (`heapDriftPct: 0%`) | `.qa/evidence/sws-vertical-slice/perf.json` |
| **VS-15** | Performance auf Zielhardware (A.2 / A.3) | Host Browser E2E (Apple M4 Pro Metal) | **PASS (Soft 30 FPS) / NEAR-60 FPS** | `frameP50Ms: 16.7 ms` (60 FPS), `frameP95Ms: 16.8 ms` (59.5 FPS — 0.1 ms über 16.7 ms 60-FPS-Ziel, weit unter 33.3 ms Soft-Budget), `frameMaxMs: 33.4 ms`, `avgFps: 57.7`, `maxSimultaneousActiveMaps: 6 ≤ 6` | `.qa/evidence/sws-vertical-slice/perf.json` |

---

## Behobene Defekte (durch G6 belegt & separat committed)

1. **`fix(atlas): wire multi-map scene graph, deep-zoom camera & read-only E2E bridge getters` (`a0acc56fe`):**
   - `WorldAtlasWorkbench.tsx`: Async-Hydration lokalisierter Kind-Maps in `worldSceneGraph` verdrahtet.
   - `atlas-three-camera.ts` / `atlas-three-runtime.ts`: Deep-Zoom `minSpan` (`0.02`), dynamische Near-Plane & `eyeLift`, Multi-Map-Pickable-Priorisierung, `clearRootCount` zählt nur echte Szenen-Wipes, Read-Only-Bridge-Getter ergänzt.
2. **`fix(atlas): map canonical room/country/place kinds & cut parent terrain under child maps`:**
   - `src/domains/world/hierarchy/legacy-kind-map.ts`: Kanonische `WorldPlaceKind`-Werte (`country`, `place`, `room`) in `PLACE_ROWS` ergänzt — zuvor fiel `Schankraum` (`kind: 'room'`) auf `world`/`outdoor` zurück (blauer Ozean-Rand + unsichtbare Möbel im Einzel-Editor, Gras-Terrain im Multi-Map-Schankraum).
   - `src/infrastructure/world/atlas-three/atlas-three-multimap.ts`: `applyTerrainCutoutFilter` ergänzt — Replacement-Refinement schneidet überlappende Eltern-Terrain-Dreiecke im aktiven Kind-Cutout aus, damit Nordreichs Höhenfeld Dornhain nicht mehr verdeckt.

---

## Offene Findings (alle Severities)

| ID | Severity | Bereich | Beschreibung |
|---|---|---|---|
| **M-1** | **Medium** | Multi-Map Edit Writeback (`WorldAtlasWorkbench.tsx`) | Multi-Map-Raycast trifft Kind-Objekte (`g.tav.table`) direkt vom World-Root (VS-08 PASS), aber das Verschieben/Persistieren (`onCommitDoc` → `upsertMap`) ist aktuell an die aktive Editor-Map gebunden (Test wechselt dafür in `Schankraum`). Direktes Cross-Map-Edit-Routing aus World-Root ohne aktiven Map-Wechsel ist als SWS-08-Folgearbeit offen. |
| **M-2** | **Medium** | Multi-Map Randnaht & Straßen-Clipping (`atlas-three-multimap.ts` / `atlas-three-scene.ts`) | In `sws-02-land-nordreich.png` und `sws-03-ort-dornhain.png` entsteht durch die Kombination aus Parent-Terrain-Cutout und dem 5-%-Unterwasser-Edge-Taper der Kind-Maps eine sichtbare rechteckige Wasser-Naht am Anker-Rand; zudem ragt eine abgeleitete Nordreich-Straße leicht in die NO-Ecke von Dornhain, weil `applyLocalCutoutFilter` Strokes nur verwirft, wenn *alle* Punkte im Cutout liegen (Segment-Clipping fehlt). |
| **L-1** | **Low** | Perf 60-FPS-Ziel (`perf.json`) | Auf Apple M4 Pro liegt `frameP50Ms = 16.7 ms` (60 FPS), `frameP95Ms = 16.8 ms` (0.1 ms über dem strikten 16.7-ms-Ziel) und `frameMaxMs = 33.4 ms` (1 Frame-Drop beim ersten Nachladen einer Kind-Gruppe). Soft-Budget (33.3 ms) ist klar erfüllt. |
| **L-2** | **Low** | E2E Hardware- vs. CI-Baseline (`playwright.config.ts`) | Die committeten PNG-Baselines (`e2e/sws-vertical-slice.spec.ts-snapshots/*-chromium.png`) wurden mit `PLAYWRIGHT_HARDWARE_WEBGL=1` (Metal ANGLE) erzeugt; bei SwiftShader-CI-Läufen kann `maxDiffPixelRatio: 0.08` knapp werden und sollte ggf. pro Backend verifiziert werden. |
| **I-1** | **Info** | VS-07 Manuelle Hardware-Prüfung | MacBook Trackpad Pinch/Pan/Orbit ist per Definition eine manuelle Hardware-Verifizierung (`.qa/design/sws-macbook-input-verification.md`) und bleibt bis zur manuellen Ausführung auf echtem Trackpad explizit `OPEN`. |
| **I-2** | **Info** | `browser-e2e-with-host.mjs` Port-Auswahl | `scripts/browser-e2e-with-host.mjs` und `playwright.config.ts` weichen jetzt automatisch auf einen freien Ephemeral-Port aus, wenn `localhost:3004` lokal bereits durch einen Dev-Server belegt ist (CI mit freiem Port 3004 unverändert). |
