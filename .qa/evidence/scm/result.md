# SCM — Spatial Containment Model Abnahme-Nachweis (SCM-01 … SCM-08)

- **Branch:** `feat/atlas-spatial-containment` (Basis `b620246ba`)
- **Datum:** 2026-11-26
- **Spezifikation:** `.qa/design/sws-containment-model.md` (3 Beziehungstypen, 6 Invarianten INV-1..6, Auto-Grow mit Bestätigung, Soft-Kaskade mit Bestätigung, 2 persistente Preferences, Zoom-Layer-Anzeige)
- **Host Browser-E2E:** `PLAYWRIGHT_HARDWARE_WEBGL=1 npm run test:e2e -- e2e/scm-spatial-containment.spec.ts --project=chromium` → **2 passed (8.2 s)**
- **Opt-in `test-gate` Schalter:** `SAGATREE_SCM_E2E=1 npm run test-gate` (alle 3 Domain-Self-Tests laufen standardmäßig immer in `npm run test-gate`)

---

## Abnahmematrix (SCM-01 … SCM-08)

| ID | Kriterium | Domain-/UI-Dateien | Test(s) | Status | Evidence |
|---|---|---|---|---|---|
| **SCM-01** | Haus über Stadtgrenze (CONTAINED, Grow) — nur Stadt wächst, Land unverändert, Bestätigung + 1 Undo | `atlas-spatial-containment.ts`, `atlas-spatial-propagation.ts`, `SpatialOperationConfirmDialog.tsx`, `WorldAtlasWorkbench.tsx` | `scripts/scm-propagation.self-test.mjs` + `e2e/scm-spatial-containment.spec.ts` | **PASS** | `.qa/evidence/scm/scm-01-grow-confirm-dialog.png`, `.qa/evidence/scm/scm-e2e-summary.json` |
| **SCM-02** | Stadt an Küste (Grow-Kette) — Stadt → Landmasse → Kontinent atomar + 1 Undo | `atlas-spatial-propagation.ts`, `atlas-world-operation-history.ts` | `scripts/scm-propagation.self-test.mjs` | **PASS** | `scm-propagation.self-test.mjs` (`5/5 PASS`) |
| **SCM-03** | Haus im Berg (CARVED) — Aushöhlung ohne Außenkontur-Änderung; äußere Kontur erst bei Durchbruch | `atlas-spatial-containment.ts`, `atlas-spatial-propagation.ts` | `scripts/scm-propagation.self-test.mjs` | **PASS** | `scm-propagation.self-test.mjs` (`5/5 PASS`) |
| **SCM-04** | Fluss durch Land (FLOWING) — Re-Routing / Kappen bei Topografie-Änderung, niemals Löschen, niemals Topografie-Wachstum (INV-5) | `atlas-spatial-propagation.ts`, `atlas-three-multimap.ts` (Liang-Barsky M-2) | `scripts/scm-propagation.self-test.mjs`, `scripts/scm-invariants.self-test.mjs` | **PASS** | `scm-propagation.self-test.mjs` (`5/5 PASS`), `scm-invariants.self-test.mjs` (`9/9 PASS`) |
| **SCM-05** | Landmasse entfernen mit Inhalt (Soft-Kaskade) — Dialog listet Inhalt, Kinder verwaist/archiviert (rückholbar via `restore` & 1 Undo), Fluss gekappt | `atlas-spatial-propagation.ts`, `atlas-world-operation-history.ts`, `SpatialOperationConfirmDialog.tsx` | `scripts/scm-cascade-prefs.self-test.mjs` + `e2e/scm-spatial-containment.spec.ts` | **PASS** | `.qa/evidence/scm/scm-05-cascade-confirm-dialog.png`, `.qa/evidence/scm/scm-e2e-summary.json` |
| **SCM-06** | Bestätigungs-Preferences (`spatialEdit.confirmGrow` / `confirmCascade`, Default `true`) — „Nicht mehr nachfragen“ + Werkzeug-Einstellung persistent (`localStorage` `sagatree.atlas.spatialEditPrefs.v1`), bei `false` weiterhin atomar + undo-fähig (100 Zyklen) | `atlas-spatial-edit-prefs.ts`, `useSpatialEditPreferences.ts`, `SpatialOperationConfirmDialog.tsx` | `scripts/scm-cascade-prefs.self-test.mjs` + `e2e/scm-spatial-containment.spec.ts` | **PASS** | `.qa/evidence/scm/scm-e2e-summary.json` (Reload-Persistenz bestätigt) |
| **SCM-07** | Zoom-getriebene Layer-Anzeige — aktive Ebene markiert (`data-atlas-zoom-active="true"`, Cyan) über Welt → Kontinent → Land → Ort → Gebäude → Raum, Baum bleibt offen, `clearRootCount === 0` | `atlas-zoom-layer-state.ts`, `atlas-three-runtime.ts`, `AtlasThreeWorkstation.tsx` | `scripts/scm-cascade-prefs.self-test.mjs` + `e2e/scm-spatial-containment.spec.ts` | **PASS** | `.qa/evidence/scm/scm-07-zoom-layer-schankraum.png`, `.qa/evidence/scm/scm-07-zoom-trace.json` |
| **SCM-08** | Invarianten-Bruch fail-closed abgelehnt (INV-1..6, Zyklus, Scherung, Topografie-Inversion, Post-Invarianten-Rollback) | `atlas-spatial-containment.ts`, `atlas-spatial-propagation.ts` | `scripts/scm-invariants.self-test.mjs` + `e2e/scm-spatial-containment.spec.ts` | **PASS** | `scm-invariants.self-test.mjs` (`9/9 PASS`), `.qa/evidence/scm/scm-e2e-summary.json` |

---

## Findings (alle Severities)

| ID | Severity | Bereich | Befund |
|---|---|---|---|
| — | **Critical** | — | Keine offenen Critical-Findings. |
| — | **High** | — | Keine offenen High-Findings. |
| **M-1** | **Medium** | Direkte 3D-Canvas-Drag-Anbindung an SCM-Intents (`AtlasThreeWorkstation.tsx`) | Die SCM-Pipeline (Planung → Bestätigungs-Dialog → atomares Multi-Map-Commit → `upsertMap` → Undo) ist vollständig produktiv verdrahtet und über `WorldAtlasWorkbench` / `AtlasThreeWorkstation` aktiv; das direkte Drag-Handle-Auslösen von `requestSpatialIntent` beim Ziehen von Objekten *über* Kind-Map-Grenzen im Multi-Map-Canvas (statt Einzel-Map-Drag) ist noch als direkter Pointer-Hook-Ausbau offen. |
| **M-2** | **Medium** | Persistenz bei `undoSpatial` / `redoSpatial` (`WorldAtlasWorkbench.tsx`) | `commitPlan` persistiert alle betroffenen Maps atomar via `worldAtlasService.upsertMap`; `undo()` / `redo()` rollen das In-Memory-`SpatialWorldModel` atomar zurück (1 Schritt), lösen aber noch keinen erneuten Multi-Map-`upsertMap`-Rückschrieb für alle betroffenen Maps aus (Folge-Hardening). |
| **L-1** | **Low** | Kontrast im aktiven Zoom-Knoten (`scm-07-zoom-layer-schankraum.png`) | Im Screenshot `scm-07-zoom-layer-schankraum.png` ist der aktive Cyan-Button (`Schankraum`) gut lesbar, aber die dunkle `text-primary-foreground`-Schriftfarbe auf Cyan verdient einen WCAG-AA-Kontrast-Check gegen `#06B6D4` (ggf. `#0F172A` / `font-bold` schärfen). |
| **L-2** | **Low** | Soft-Kaskade-Hinweisbox bei Grow-Dialog (`scm-01-grow-confirm-dialog.png`) | Wenn eine Bereichserweiterung zusätzlich 2 kreuzende Flüsse/Straßen umleitet (`reroutedFlowingIds.length > 0`), trägt die zweite Box im Grow-Dialog aktuell die Überschrift „Soft-Kaskade (archiviert & rückholbar)“, obwohl nichts archiviert wird — Überschrift sollte bei reinem `FLOWING`-Re-Routing „Fließende Strukturen (umgeleitet/gekappt)“ lauten. |
| **I-1** | **Info** | Behobener M-2-Defekt aus SWS G6 (`atlas-three-multimap.ts`) | `applyLocalCutoutFilter` nutzt jetzt Liang-Barsky-Segment-Clipping (`clipPolylineOutsideRects`), sodass abgeleitete Eltern-Straßen/Flüsse nicht mehr über aktive Kind-Cutouts hinausragen (verifiziert in `scm-invariants.self-test.mjs` Test #9). |
| **I-2** | **Info** | Behobener E2E-Defekt in `atlas-zoom-layer-state.ts` & `WorldAtlasWorkbench.tsx` | Beim E2E-Lauf wurden 2 echte Defekte entdeckt und direkt behoben: (1) Unter-Landmarks wie `Whisper Road` überschrieben ihren Map-Owner `Dornhain` in `byPrimaryMapId`; (2) synchrone Back-to-Back-`undo()`-Calls lasen einen veralteten React-Ref vor dem Re-Render. |
