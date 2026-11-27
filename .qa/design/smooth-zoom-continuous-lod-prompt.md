# Auftrag: EINE Welt — Shared Chunked Terrain + Continuous-LOD Smooth-Zoom

## Kontext & Owner-Entscheidung (höchste Priorität)

Der Owner hat den aktuellen Stand auf `feat/atlas-spatial-containment` live getestet:
**„Es ist keine eine Welt — der Zoom ist nicht smooth, gefühlt hat sich nix geändert."**

Die Analyse bestätigt das und hat den **tiefsten Grund** gefunden: Der Atlas besteht aktuell aus
**mehreren getrennten Landmassen** (Kontinent = eigenes Gras-Polygon, Land = eigenes
`.realm`-Polygon, Ort = eigene Fläche), die nur **übereinander gestapelt** werden. Es gibt
**keinen einen Boden** — deshalb fühlt es sich nicht wie eine Welt an, und kein Fade der Welt
kann das kaschieren.

**Owner-Entscheidung (2026-11-26):** Ziel ist das **Google-Maps / GTA / RDR2-Modell**:
> **EINE kontinuierliche Welt auf EINEM gemeinsamen Heightfield.** Länder und Orte sind
> **Overlays auf demselben Boden** (Grenzen, Straßen, Gebäude), **keine** eigenen Landmassen.
> Beim Reinzoomen wird **derselbe Boden** feiner gesampelt und Detail blendet **weich** ein.

Konkret entschieden:
- **Ein einziges Welt-Heightfield, gechunked** (Kacheln mit LOD-Stufen) — NICHT pro Kontinent
  getrennt und NICHT als monolithisches Riesen-Array. Kontinente sind die Bereiche über dem
  Wasserpegel; der Ozean-Boden liegt im selben Raster.
- **Grobe Ebene bleibt IMMER als Basis sichtbar** (keep-coarse) — sie wird detaillierter,
  nie komplett durch Marker ersetzt.
- **Crossfade:** Detail blendet weich über dem Boden ein; kein hartes `visible = true/false`.
- **Chunk-Layout so bauen, dass Visumaxx später direkt darauf aufsetzen kann** (GPU-Culling/
  LOD auf denselben Chunks).

**Wichtig — kein Rewrite:** Dies ist ein **gezielter Umbau** der Terrain-/LOD-Pipeline.
`AtlasHeightfield` ist bereits in Welt-Koordinaten (`originX/originZ/cellSize/cols/rows`) und
damit chunk-fähig; `sampleHeightfield` kann beliebig fein sampeln. Die Bausteine existieren —
sie müssen zu **einem** geteilten, gechunkten Welt-Terrain zusammengeführt werden statt N
getrennter Heightfields. `clearRootCount === 0` und die bestehenden SWS-/SCM-Invarianten bleiben
in Kraft.

Arbeite auf demselben Branch `feat/atlas-spatial-containment` weiter. Atomare Commits,
Deutsch für UI, Englisch für Commits. **Nicht mergen.**

---

## Phase 1 — Shared Chunked Terrain (das Fundament)

**Ziel:** Es gibt EIN Welt-Heightfield (gechunked). Kontinente/Länder/Orte sind Regionen/Overlays
auf diesem einen Boden — keine eigenen Landmassen mehr.

### 1.1 Gechunktes Welt-Heightfield als Single Source of Truth
- Führe ein **Welt-Heightfield** ein, das der **Welt-Root** gehört (nicht jeder Map).
  Es liegt in Welt-Koordinaten und ist in **Chunks** (Kacheln fester Größe, z. B. 64×64 Zellen)
  aufgeteilt, jede mit LOD-Stufen.
- **Chunk-Verwaltung:** Nur Chunks in Kamera-Nähe sind geladen/hochauflösend; ferne Chunks grob
  oder entladen. Beim Reinzoomen werden feinere Chunks nachgeladen (Prefetch über
  `frustumPadRatio`). KEIN monolithisches Array der ganzen Welt im RAM.
- Der Ozean-Boden ist Teil desselben Rasters (unter `waterLevel`); Kontinente sind die Zellen
  über `waterLevel`. Die Küste entsteht dort, wo das Heightfield unter den Pegel fällt —
  **eine** physikalische Küstenlinie, keine zwei Systeme.

### 1.2 Migration der Default-Welt auf das eine Terrain
- `atlas-default-world.ts`: Höre auf, pro Kontinent/Land/Ort **eigene** Landmassen-Polygone
  (`g.land.*`, `.realm`) und separate Heightfields zu erzeugen. Stattdessen:
  - **Ein** Welt-Heightfield, das die Kontinent-Landmasse(n) als Höhenrelief enthält
    (Kontinent-Hüllen werden zu Höhen > waterLevel, Ozean zu Höhen < waterLevel).
  - Länder werden zu **politischen Overlays** (Grenz-Polylinien/Regionen auf dem einen Boden),
    NICHT zu eigenen Landmassen.
  - Orte bleiben Punkte/Flächen **auf** dem Boden; ihr Terrain kommt aus dem Welt-Heightfield,
    das an dieser Stelle feiner gesampelt wird.
- Die bisherigen `deriveCoarseRoomFromChild`-„Landmasse"-Ableitungen entfallen für Terrain;
  sie dürfen weiterhin **Marker/Labels/Straßen** ableiten, aber nicht mehr den **Boden**.

### 1.3 Renderer sampelt das eine Terrain statt N Heightfields
- `atlas-three-scene.ts` (Z. 963–967) nutzt aktuell `doc.heightfield ?? syntheticRelief` **pro
  Map**. Umstellen auf: **das geteilte Welt-Heightfield**, das an der Welt-Position der Map
  gesampelt wird (Zoom-abhängige Chunk-Auflösung).
- `atlas-three-multimap.ts` (Z. 330–338): das Terrain-Mesh kommt aus dem **einen** Welt-Terrain
  (Chunk-basiert), nicht mehr aus einem pro-Map `plan.terrain`. Die Replacement-Refinement-
  Cutouts (die bisher Kind-Footprints aus der Eltern-Landmasse stanzten) werden für das
  **Terrain** überflüssig — es gibt nur noch einen Boden, der feiner wird. Cutouts dürfen
  weiterhin für **Overlay-Strokes** gelten (M-2-Liang-Barsky bleibt).
- `atlas-terrain-mesh.ts` / `atlas-heightfield.ts`: um Chunk-LOD-Sampling erweitern
  (`heightfieldMeshTriangles` auf Chunk-Subset + LOD-Stufe), sodass nahe Chunks fein, ferne
  grob trianguliert werden.

**Abnahme Phase 1:**
- Auf Welt-Ebene: beide Kontinente + Ozean sind **ein** zusammenhängendes Relief aus einem
  Heightfield (keine zwei getrennten Landmassen + separater Ozean-Ebene).
- Auf Kontinent-Ebene (Westmark): Nordreich/Südmark/Dornhain liegen auf **demselben** Boden —
  kein eigenes Land-„Insel"-Terrain mehr.
- Beim Reinzoomen auf Dornhain wird **derselbe Boden** feiner, keine neue Landmasse.
- `clearRootCount === 0` über den Zoom-Verlauf; SWS-/SCM-Self-Tests bleiben grün (ggf. an das
  neue Terrain-Modell anpassen, ohne Invarianten zu verwässern).

---

## Phase 2 — Continuous-LOD Crossfade (auf dem einen Boden)

**Ziel:** Detail (Grenzen, Straßen, Gebäude, Konturen) blendet **weich** über dem einen Terrain
ein; die grobe Form bleibt immer sichtbar.

### 2.1 `detailWeight` endlich rendern (war bisher ungenutzt)
- `atlas-world-scene-plan.ts` berechnet bereits `detailWeight` (0..1) pro Entry (Z. 342).
  **Diesen im Renderer konsumieren** (wurde bisher ignoriert → harter 0→100%-Sprung).
- In `atlas-three-multimap.ts` `sync()`: Opacity der **Overlay-/Detail-Meshes** = `detailWeight`,
  stetig bei jeder Kamera-Änderung aktualisiert (kein Rebuild der Geometrie, `clearRootCount`
  bleibt 0). Optional 150–250 ms zeitbasierte Dämpfung für weiches Einblenden.
- **Materialien pro Gruppe klonen** (aktuell geteilt über `getMaterial`/`waterMaterial`), damit
  `material.opacity` nur die jeweilige Gruppe betrifft; `transparent = true` wenn `detailWeight
  < 1`; Dispose in `disposeGroupNode`.

### 2.2 keep-coarse: grobe Form bleibt als Basis
- Die grobe Terrain-Form (aus dem einen Heightfield, grobe LOD-Stufe) bleibt **immer** sichtbar;
  Detail blendet **darüber** ein. Tiefe Zoomstufen zeigen die Terrain-Farbe als Hintergrund —
  **nicht** nur Ozean + Marker.
- `maxActiveMaps` darf Detail-Maps deckeln, aber **Träger-Maps auf dem Pfad zum Kamera-Fokus**
  (World → … → aktiv) haben Vorrang und werden nicht verworfen.

**Abnahme Phase 2:**
- Kontinuierlicher Zoom (span 530 → 25) zeigt **stetige** Opacity-Änderung der Detail-Layer
  (kein Sprung in einem Frame). Zoom-Trace (span + detailWeight/Opacity) in `.qa/evidence/`.
- Grobe Landmasse bleibt auf jeder Stufe sichtbar; Screenshot-Vergleich vorher/nachher.
- `clearRootCount === 0`.

---

## Phase 3 — Ebenen-Anzeige an die Kamera koppeln

**Ziel:** Die Weltstruktur-/Ebenen-Anzeige markiert live die Ebene, in die man zoomt.

- `activeEditorMapId` = **tiefste Map, die den Kamera-Fokus enthält** (nicht die Root).
  `atlas-zoom-layer-state.ts`: der aktive Knoten (`data-atlas-zoom-active`) folgt diesem —
  Zoom auf Dornhain markiert „Dornhain", auf Nordreich „Nordreich". Baum bleibt offen.
- Breadcrumb (`activeBreadcrumbPlaceIds`) zeigt World → … → aktive Ebene.

**Abnahme Phase 3:**
- Beim Zoom auf Dornhain ist „Dornhain" markiert, beim Rauszoomen auf Nordreich „Nordreich" —
  Screenshot je Ebene. Live-`getState().zoomLayer.activeLabelDe` ändert sich mit der Ebene.

---

## Visumaxx-Anschlussfähigkeit (verbindlich)

- Das Chunk-Layout (Kachel-IDs, Welt-Position, LOD-Stufe, Bounding-Box) muss **als Datenstruktur
  zugänglich** sein (z. B. über die Bridge/einen Chunk-Descriptor), damit Visumaxx später
  GPU-Culling/LOD auf **denselben** Chunks fahren kann, ohne die Terrain-Pipeline erneut
  umzubauen.
- Dokumentiere in `.qa/design/` kurz das Chunk-Format und die LOD-Stufen als Visumaxx-Vertrag.

---

## Gesamt-Abnahme & Verifikation

1. `npm run test-gate` PASS (inkl. architecture-boundary-check, atl2-h01-cleanup, lint, typecheck,
   build, alle SWS-/SCM-Self-Tests — an neues Terrain-Modell angepasst wo nötig).
2. `PLAYWRIGHT_HARDWARE_WEBGL=1 npm run test:e2e -- e2e/scm-spatial-containment.spec.ts
   --project=chromium` PASS (an Fade/Terrain-Verhalten angepasst, Assertions nicht verwässern).
3. **Neuer E2E-Schritt:** assertiert (a) dass Länder/Orte auf demselben Boden liegen (kein
   zweites Land-„Insel"-Terrain), (b) Opacity-Stetigkeit über den Zoom, (c) Ebenen-Markierung
   folgt der Kamera (nicht nur „irgendein data-atlas-zoom-active").
4. Evidence unter `.qa/evidence/` (Zoom-Trace, Vorher/Nachher-Screenshots der Landmasse,
   Ebenen-Markierung, `clearRootCount`).
5. Atomare Commits, z. B.:
   - `feat(atlas): shared chunked world heightfield — single terrain source of truth`
   - `feat(atlas): migrate default world to shared terrain, countries/places as overlays`
   - `feat(atlas): continuous-LOD crossfade consuming detailWeight, per-group materials`
   - `feat(atlas): zoom-driven layer indicator follows camera focus`
6. **Nicht mergen.** Melde pro Phase: was geändert, Dateien, Tests grün, Evidence-Pfade.
   Liste **alle** Severities.

---

## Nicht-Ziele (out of scope)
- Keine Portal-/Eingangs-Animationen (separater Folge-Task).
- Kein Visumaxx-Modul selbst bauen — nur das Terrain **anschlussfähig** machen.
- Die SCM-Findings M-1 (Drag-Hook) und M-2 (Undo-Persistenz) sind **separat** und kommen danach
  (`scm-fix-findings-prompt.md`) — nicht hier mischen.
- Keine Schwellen-Kosmetik an `sseRefinePx`/`sseCoarsenPx` als Ersatz für den echten Umbau.
- Kein Rewrite von React/App-Slices; der Umbau betrifft Terrain + LOD + Renderer-Sync.

## Verbindliche Begriffe
- `freeland` (NICHT `FLOWING`) für Routing/frei begehbares Gelände.
- Dungeon = betretbarer Room-Komplex; Room = Einzelraum; Building = Hülle (betretbar → Dungeon);
  Exterior/freeland = kontinuierliches Gelände ohne Rooms.
- Siehe `.qa/design/world-model-terminology.md`.
