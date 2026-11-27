# SWS — Review-Checkliste (Umsetzungs-Kontrolle)

- **Zweck:** Wenn Gemini auf `feat/atlas-nested-lod-spike` weitercommitted, prüfe ich die Umsetzung gegen diese Kriterien.
- **Basis-Commit (mein Stand):** `0c3ea247f` (SWS-01 recursive world-space transforms, committed).
- **Bezug:** `sws-adr-shared-world-space.md`, `sws-epic-issue-plan.md`, `sws-vertical-slice-and-testing.md`.

## A. Fundament (Domain, renderer-unabhängig)

- [ ] **A1** `localToWorld`/`worldToLocal` komponieren die Anchor-Kette über n Ebenen (nicht nur 1).
- [ ] **A2** Roundtrip n-Ebenen exakt (< 1e-9), inkl. rotierter uniformer Anchors.
- [ ] **A3** Zyklus-Guard ist **schreibend** (upsertMap lehnt Zyklen ab), nicht nur lesend.
- [ ] **A4** Scherungs-Regel: `rotationRad≠0` erzwingt `extentX==extentY`; Verletzung rejected.
- [ ] **A5** Unverortete Kinder → honest fail, **kein** erfundener Drill (IV-*).
- [ ] **A6** Domain bleibt rein: kein React/Three.js/Host-Import in `src/domains/**`.

## B. Geometry Ownership (SWS-02)

- [ ] **B1** Jede physische Struktur (landmass/river/road/terrain/political/forest/building/room) hat **genau eine** autoritative Map.
- [ ] **B2** Bottom-Up: grobe Ebenen (Land/Kontinent/Welt) werden aus der feinsten **abgeleitet** — nicht separat gezeichnet.
- [ ] **B3** Derselbe Fluss/dieselbe Küste ist auf allen Ebenen identisch (Fingerprint-Vergleich).
- [ ] **B4** Keine bidirektionale Sync gleichberechtigter Quellen.
- [ ] **B5** Dungeon/Scatter = top-down (prozeduraler Infill), nicht gemischt mit bottom-up pro Struktur.
- [ ] **B6** `findGeometryOwnershipConflicts` detektiert Mehrfach-Ownership fail-closed.

## C. Neue Default-Welt

- [ ] **C1** 2 Kontinente × 2 Länder × 2–3 Orte (~8–12 Orte).
- [ ] **C2** Genau ein Referenz-Ort tief (Ort → Gebäude → Raum → Objekt).
- [ ] **C3** Dungeons prozedural via Dungeon-Forge (Seed).
- [ ] **C4** Bestehende Item-IDs (baum/tanne/fels/haus/turm/tisch/stuhl/fass/bett/kiste/lampe/teppich) bleiben; kein neuer Pflicht-Katalog.
- [ ] **C5** Welt ist von Tag 1 kalibriert (`metersPerUnit` gesetzt) ODER bewusst abstrakt (UI zeigt dann kein m/km).
- [ ] **C6** Neue Welt ersetzt die alte Dornhain-Golden-Referenz; alte Oracles regeneriert/aktualisiert, keine dauerhafte Parallel-Welt.

## D. Renderer (SWS-04) — nur falls Gemini das anfasst

- [ ] **D1** Multi-Map-Scene-Graph: Kind-Map als Group am `ParentSpatialAnchor`, Parent+Kind gleichzeitig sichtbar.
- [ ] **D2** `clearRoot()` feuert **nicht** bei gewöhnlichem Zoom/Navigation (kein Doc-Swap).
- [ ] **D3** Kein `AtlasPortalTransitionOverlay`-Fade als Kaschierung räumlicher Übergänge (nur echte Portale).
- [ ] **D4** Replacement-Refinement: keine doppelte Geometrie / kein Z-Fighting im Anchor-Rect.
- [ ] **D5** `activeMapId` = Editor-Kontext, nicht mehr „welche eine Welt gerendert wird".

## E. Kamera / Input

- [ ] **E1** Ein geteilter `AtlasWorldCameraState` für 2D + 3D; kein getrennter 2D-Kamerazustand.
- [ ] **E2** Mode-Wechsel erhält Fokus/Yaw/Span (`switchCameraMode` setzt Yaw NICHT mehr hart auf 0).
- [ ] **E3** Trackpad-Pinch: `ctrlKey+wheel` (Chromium) + `gesturestart/change` (Safari) → Zoom zum Cursor.
- [ ] **E4** Zwei-Finger-Drag = Pan; Orbit via Shift+Drag / Rechts-Drag.
- [ ] **E5** Delta-Normalisierung (`deltaMode`), passive Listener + preventDefault gegen Browser-Zoom.
- [ ] **E6** Hardware-Verifizierung MacBook dokumentiert (Playwright allein reicht nicht für Pinch).

## F. Undo/Redo (SWS-08)

- [ ] **F1** 3D-Edits (move/rotate/scale/stamp/height/biome) erzeugen History-Batches.
- [ ] **F2** `atlas-edit-history` im Three.js-Pfad verdrahtet (fehlte bisher komplett).
- [ ] **F3** ≥100 Edit/Undo/Redo-Zyklen; Parität 2D/3D.

## G. Qualitätsgates

- [ ] **G1** `node scripts/atlas-world-space.self-test.mjs` grün (10/10).
- [ ] **G2** Neuer Geometry-Ownership-Self-Test grün.
- [ ] **G3** `node scripts/architecture-boundary-check.mjs` PASS (keine Layer-Verletzung, keine `src/modules|components`).
- [ ] **G4** `npm run test-gate` grün.
- [ ] **G5** `npm run build` grün.
- [ ] **G6** Vertical-Slice-Nachweis (E2E + Screenshots + Perf) sofern Renderer-Änderungen.

## Prüf-Vorgehen

1. `git log 0c3ea247f..HEAD --oneline` — welche Commits hat Gemini hinzugefügt.
2. `git diff 0c3ea247f..HEAD --stat` — Umfang; betroffene Module gegen Dependency-Map.
3. Jeden Commit gegen A–G mappen; jede Zeile oben abhaken oder als Finding markieren.
4. Gates G1–G5 ausführen.
5. Findings nach Severity (Critical→Info) listen — **alle** Severities, keine weggelassen.
