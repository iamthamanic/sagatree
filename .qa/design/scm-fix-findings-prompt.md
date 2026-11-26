# Auftrag: SCM Findings schließen (M-1, M-2, L-1, L-2) — Branch `feat/atlas-spatial-containment`

## Kontext & Voraussetzung (WICHTIG — Reihenfolge)

**Dieser Auftrag kommt NACH `smooth-zoom-continuous-lod-prompt.md`.** Arbeite ihn erst an,
wenn der Shared-Chunked-Terrain-/Smooth-Zoom-Umbau (Phase 1–3) abgeschlossen ist. Die dort
eingeführte **eine gemeinsame Welt-Terrain-Quelle** (gechunktes Welt-Heightfield) ist die
Grundlage, auf der diese Findings zu schließen sind — nicht das alte Modell mit getrennten
Landmassen pro Ebene.

Das Spatial Containment Model (SCM) ist auf `feat/atlas-spatial-containment` implementiert;
vier Findings blieben offen und müssen geschlossen werden, bevor der Owner das Feature per Maus
testen kann. Arbeite **auf demselben Branch weiter** (nicht von `main` neu abzweigen),
atomare Commits, Deutsch für UI, Englisch für Commits.

**Bezug zum neuen Terrain-Modell:** Beim Ziehen eines Objekts (M-1) und bei Undo/Redo (M-2)
wird jetzt gegen das **eine** Welt-Terrain geprüft/persistiert. Containment-Grenzen sind
**politische Overlay-Regionen** auf dem einen Boden (keine eigenen Landmassen mehr). Auto-Grow
einer Region (z. B. Stadt) bedeutet: ihre **Overlay-Grenze** wächst auf dem gemeinsamen Terrain —
das Terrain selbst wird dabei nicht dupliziert.

**Verbindliche Begriffe (Owner-Entscheid, siehe `.qa/design/world-model-terminology.md`):**
- Der Routing-Typ heißt **`freeland`** (NICHT mehr `FLOWING`). UI-Texte, Kommentare und
  neue Symbolnamen verwenden `freeland`. Bestehende Code-Symbole `FLOWING` /
  `SpatialRelationKind` dürfen als deprecated Alias mit `@deprecated` kurz bestehen bleiben,
  aber alle **neuen** Stellen und alle **User-facing Strings** nutzen `freeland`.
- Betretbarer Room-Komplex = **Dungeon** (Oberbegriff), Einzelraum = **Room**,
  Hülle = **Building**, frei begehbares Gelände ohne Rooms = **Exterior / freeland**.

---

## Finding M-1 (Medium) — Maus-Drag-Hook an SCM-Pipeline anschließen

**Problem:** In `src/app/world/atlas/unified/AtlasThreeWorkstation.tsx` (ca. Zeile 1266,
`drag.kind === 'move-object'`) wird beim Ziehen eines Kind-Objekts direkt
`applyMapEdit(docRef.current, { op: 'move_object', ... })` + `onCommitDocRef.current(...)`
aufgerufen — **ohne** die SCM-Pipeline. Ein Drag über eine Eltern-/Anker-Grenze löst daher
**keinen** `resize_or_move`-Intent, keinen Bestätigungs-Dialog und kein Auto-Grow aus.

**Ziel:** Wenn ein Kind-Objekt per Maus-Drag so bewegt/skalierbar wird, dass es eine
Containment-Grenze seines Trägers überschreitet, muss die bestehende SCM-Pipeline
(`planIntent` → Bestätigungs-Dialog → `commitPlan`) ausgelöst werden.

**Vorgehen:**
1. Ermittele während `move-object` (und analog `scale-object`, `transform_object` mit
   Geometrie-Änderung) die **neue Welt-AABB** des gezogenen Objekts.
2. Prüfe gegen die Containment-Grenzen im `SpatialWorldModel` (über den vorhandenen
   `AtlasSpatialContainmentAdapter`, der der Workbench bereits injiziert wird). Die Grenzen
   sind jetzt **Overlay-Regionen auf dem einen Welt-Terrain** — die Prüfung bleibt geometrisch
   (AABB gegen Region), nur ohne getrennte Landmassen pro Ebene.
3. Überschreitet die neue Geometrie eine Grenze: erzeuge einen `SpatialEditIntent`
   (`resize_or_move`) und rufe `planIntent(intent)` statt des direkten `applyMapEdit`.
   Der vorhandene Bestätigungs-Dialog (`SpatialOperationConfirmDialog`) und
   `commitPlan` übernehmen den Rest inkl. Auto-Grow-Kette und Undo.
4. Liegt die Bewegung **innerhalb** der Grenzen: behalte den performanten Direktpfad
   (`applyMapEdit`) bei — kein Dialog, kein Plan. Kein Overhead für Normal-Bewegungen.
5. Der Live-Drag (Pointer-Move) darf **nicht** bei jedem Frame einen Dialog öffnen:
   plane/bestätige erst bei `onPointerUp` (Drag-Ende) mit der finalen Position.
   Während des Drags nur visuelles Feedback (z. B. Grenz-Highlight).

**Abnahme:**
- Haus wird per Maus über die Stadtgrenze gezogen → Bestätigungs-Dialog „erweitert die Stadt"
  erscheint bei Drag-Ende; nach Bestätigen wächst nur die Stadt (nicht das Land), 1 Undo-Schritt.
- Bewegung innerhalb der Grenzen → kein Dialog, direkter Commit wie bisher.
- Bestehender Host-Browser-E2E `e2e/scm-spatial-containment.spec.ts` bleibt grün;
  ergänze einen E2E-Schritt, der den **Drag über die Grenze** auslöst (nicht nur den
  programmatischen Intent).

---

## Finding M-2 (Medium) — Undo/Redo muss nach SQLite zurückschreiben

**Problem:** In `src/app/world/atlas/WorldAtlasWorkbench.tsx` rollen `undo()` (ca. Z. 670) und
`redo()` (ca. Z. 680) das `SpatialWorldModel` nur **In-Memory** zurück
(`setSpatialWorld`/`setSpatialHistory`). Sie rufen **nicht** `persistProjectedMapUpdates`,
sodass nach Undo + Reload der SQLite-Stand dem sichtbaren Stand widerspricht.

**Root cause:** `undoSpatialWorldOperation` / `redoSpatialWorldOperation`
(`src/domains/world/atlas/atlas-world-operation-history.ts`) liefern nur
`world`/`history`/`affectedMapIds` zurück — **nicht** den `WorldOperationPlan`, den
`persistProjectedMapUpdates(nextWorld, plan)` als 2. Argument benötigt. Der History-Snapshot
(`SpatialWorldHistorySnapshot`) speichert nur `worldJson`, `summaryDe`, `affectedMapIds`.

**Ziel:** Nach `undo()`/`redo()` müssen alle betroffenen Maps atomar über
`editor.persistMapMeta` (Single-App-Writer, ATL2-H01) nach SQLite geschrieben werden — analog
zu `commitPlan`.

**Vorgehen (eine der beiden Varianten, bevorzugt A):**
- **Variante A (bevorzugt):** Erweitere `SpatialWorldHistorySnapshot` um den ursprünglichen
  `plan: WorldOperationPlan`. `undo`/`redo` geben diesen Plan mit zurück; die Workbench ruft
  danach `await persistProjectedMapUpdates(undone.world, undone.plan)` (bzw. `redone`).
  Für Undo ist der „inverse" Effekt bereits im zurückgegebenen `world` enthalten —
  `persistProjectedMapUpdates` projiziert die Map-Mutations aus `world` + `plan`; stelle
  sicher, dass die Projektion für den rückgängig gemachten Zustand die korrekten
  `nextDoc`/`nextParentAnchor` liefert (ggf. ein `direction: 'undo' | 'redo'`-Flag am Plan
  oder ein separates Projektions-Helper, das aus dem Ziel-`world` die Dokumente ableitet).
- **Variante B:** Falls die Projektion aus `world`+`plan` für Undo nicht korrekt umkehrbar ist,
  speichere im Snapshot zusätzlich die **bereits projizierten Map-Updates** (die bei
  `commitPlan` ohnehin erzeugt werden) und schreibe bei Undo/Redo genau diese zurück.

**Wichtig:** Single-App-Writer einhalten — der SQLite-Schreibzugriff läuft ausschließlich über
`useWorldAtlasEditor.ts` / `editor.persistMapMeta`. Kein direkter `worldAtlasService.upsertMap`
in der Workbench.

**Bezug zum neuen Terrain-Modell:** Nach dem Shared-Terrain-Umbau persistiert
`persistProjectedMapUpdates` die **Overlay-Regionen/Dokumente** der betroffenen Maps; das
**eine** Welt-Heightfield (gechunked) wird separat verwaltet. Stelle sicher, dass Undo/Redo
sowohl die Overlay-Dokumente **als auch** evtl. geänderte Terrain-Chunks konsistent
zurückschreibt (falls die Operation das Terrain berührte) — Reload muss denselben Boden +
dieselben Overlays zeigen wie vor dem Undo.

**Abnahme:**
- Grow ausführen → Undo → **Reload** → der rückgängig gemachte Zustand ist in SQLite
  persistiert (Stadt/Land wieder ursprünglich), kein Reload-Widerspruch.
- Soft-Kaskade → Undo (Restore) → Reload → archivierte Kinder sind wieder da.
- Redo nach Undo → Reload → erneut persistierter Vorwärts-Zustand.
- Bestehende 100-Zyklen-Undo-Tests bleiben grün; ergänze einen Persistenz-Reload-E2E-Schritt.

---

## Finding L-1 (Low) — Kontrast aktiver Zoom-Knoten

**Problem:** Der aktive Zoom-Layer-Knoten (z. B. „Schankraum", `data-atlas-zoom-active`) nutzt
`text-primary-foreground` auf Cyan `#06B6D4`. WCAG-AA-Kontrast (4.5:1 für Text) ist zu prüfen.

**Ziel:** Kontrast des aktiven Zoom-Knotens auf ≥ 4.5:1 schärfen (z. B. dunklerer Text auf dem
Cyan, oder dunkleres Cyan / Border-Kontrast), ohne die Brand-Regel „Cyan = aktiv" zu verletzen.
Siehe `src/THEME_GUIDE.md`. Nachweis: Kontrastwert im Evidence-Bericht notieren.

---

## Finding L-2 (Low) — Dialog-Untertitel bei Grow + freeland-Umleitung

**Problem:** In `SpatialOperationConfirmDialog.tsx` trägt die Hinweisbox im **Grow**-Dialog die
Überschrift „Soft-Kaskade (archiviert & rückholbar)", auch wenn gar nichts archiviert wird,
sondern nur kreuzende Wege/Flüsse (**freeland**) umgeleitet/gekappt werden.

**Ziel:** Wenn `archivedDescendantIds.length === 0` und nur `freeland`-Strukturen betroffen sind,
lautet die Überschrift **„Freiland-Strukturen (umgeleitet/gekappt)"** statt „Soft-Kaskade".
Die „Soft-Kaskade"-Überschrift erscheint nur, wenn tatsächlich Kinder archiviert werden
(`archivedDescendantIds.length > 0`). UI-Text Deutsch.

---

## Abschluss (alle vier Findings)

1. `npm run test-gate` → PASS (inkl. aller SWS-/SCM-Self-Tests, architecture-boundary-check,
   atl2-h01-cleanup, lint, typecheck, build).
2. `PLAYWRIGHT_HARDWARE_WEBGL=1 npm run test:e2e -- e2e/scm-spatial-containment.spec.ts --project=chromium`
   → PASS, inkl. der neuen Drag- (M-1) und Persistenz-Reload-Schritte (M-2).
3. Evidence unter `.qa/evidence/scm/` aktualisieren (Screenshots für M-1-Drag-Dialog,
   M-2-Reload, L-1-Kontrast, L-2-Dialogtitel; `result.md` ergänzen).
4. Atomare Commits auf `feat/atlas-spatial-containment`, z. B.:
   - `feat(atlas): SCM M-1 wire canvas pointer-drag to containment intent pipeline`
   - `fix(atlas): SCM M-2 persist undo/redo back to SQLite via single app writer`
   - `fix(atlas): SCM L-1/L-2 zoom-node contrast + freeland dialog subtitle`
5. **Nicht mergen.** Melde pro Finding: was geändert, welche Tests grün, Evidence-Pfade.
   Liste **alle** Severities in deinem Abschlussbericht (auch Low/Info).

## Nicht-Ziele (out of scope für diesen Auftrag)
- Keine Portal-/Eingangs-Animationen (separater Folge-Task).
- Kein Visumaxx / Renderer-Umbau.
- Keine neuen Struktur-Features; nur die vier gelisteten Findings schließen.
