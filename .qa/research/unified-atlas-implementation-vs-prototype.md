# Unified Atlas — Implementierung vs. Referenzprototyp

**Datum:** 2026-10-17  
**Scope:** Analyse only (keine Produktcode-Änderungen)  
**Quellen:** aktuelle Codebasis `main`/Arbeitsbaum, Browser-Läufe (Vite `:3004`, Prototyp `127.0.0.1:8877`), Design/Acceptance unter `.qa/`, Inventar-Subagent  
**Evidence:** `.qa/evidence/unified-atlas-vs-prototype/` (Prototype-HTML-Kopie + `screenshots/`)

---

## 1. Executive Summary

SagaTree liefert bereits einen **produktiven Unified-Atlas-Pfad**: geteilte Workstation für Bibliothek und Saga, **Canvas-2D**-Multi-Scale-Editor mit cursor-verankertem Zoom, LOD-Einblendung, Zeichenwerkzeugen und Persistenz in `world_atlas_maps.generator_meta.unifiedCanvas`. Das ist **nicht** mehr der alte Scriptony-Tile-Editor als Default — Legacy-Tiles bleiben nur hinter `kind === 'legacy_tiles'`.

Der Referenzprototyp `sagatree_unified_atlas_3d_v3.html` ist ein **offline WebGL-Demo** (eigener `AtlasGL`-Renderer + Software-3D-Fallback). Er fühlt sich „magischer“ an, weil **geneigte 3D-Perspektive**, extrudierte Stadt-/Dungeon-Geometrie und ein **Dungeon-Generator** in einer ununterbrochenen Kamera sitzen. Er speichert nur `localStorage`, hat keine RLS/Saga-Rechte und keine echte Welt-DB.

**Abstand zur Unified-Atlas-Vision:** konzeptionell ~**55–65 %** (eine Kamera, LOD-Stufen, Werkzeuge, Dual-Nav). Visuell/räumlich und bei Stadt→Dungeon-Immersion ~**25–35 %** (flach 2D, Demo-LOD statt persistierter Nested Maps, kein 3D, kein Dungeon-Procgen).

**Empfehlung:** keinen Full-Rewrite auf „alles Three.js“. **Hybrid:** Canvas-2D als kanonischer Editor für Welt/Region + persistiertes Dokumentmodell behalten; optionalen **WebGL/Three-Viewer** für Settlement/Dungeon-Scenes an dieselbe Kamera-Hierarchie andocken. UX-P0 zuerst: Chrome-Dichte, sinnvolle Interior-Darstellung, echte Nested-Map-Anbindung, Imagination-First-Leerstellen.

---

## 2. Tatsächlicher Implementierungsstand SagaTree

### 2.1 Produktflächen (belegt)

| Pfad | Mount | Status |
|------|-------|--------|
| Bibliothek → Welten → `:worldPublicId/map` | `WorldAtlasScreen` → `WorldAtlasWorkbench` | Code vorhanden; in diesem Lauf **keine Welten** in der Bibliothek → Library-Journey **nicht end-to-end verifiziert** |
| Saga → Welt → Karte (`/sagas/:id/world`, `/world/map`) | `SagaWorldMapPanel` → **dieselbe** `WorldAtlasWorkbench` | **Browser-verifiziert** auf `SA-E979J` |
| Orte | Sheet-Button, kein Subtab | Belegt (`SagaWorldMapPanel.tsx`) |

Zitate: `WorldAtlasWorkbench.tsx` (Default Unified), `SagaWorldMapPanel.tsx:186–190`, Routes in `src/app/shell/routing/routes.ts`, Design `.qa/design/world-atlas-editor.md:53–60`.

### 2.2 Renderer

| Oberfläche | Technologie | Beleg |
|------------|-------------|-------|
| **Unified Atlas (Default)** | **HTML Canvas 2D** | `UnifiedAtlasEditor.tsx:298` `getContext('2d')`; transform `:320–321` |
| Legacy Tiles | Canvas 2D Tile-Grid | `WorldMapCanvas.tsx` |
| Leaflet + Geoman | Dependency + **Orphan-Komponente** | `WorldAtlasLeafletMap.tsx` — **keine Importer** in `src/` |
| Three.js | **nicht** auf Atlas-Pfad | Nur Avatar/LiveAct/Items; `rg` unter `src/app/world/` ohne `three` |

Design explizit: Primary Canvas 2D; Pixi/GPU deferred (`.qa/design/world-atlas-editor.md:28–35`, `:70–75`).

### 2.3 Kamera / Zoom / LOD

- Domain: `src/domains/world/map/atlas-camera.ts` — `atlasZoomAt` (cursor-anchored), `atlasOpacity` (smoothstep), `atlasFitCamera`, nested helpers **exportiert aber UI-unbenutzt** (`atlasLocalToRoot`, `atlasDetailActive`).
- Editor: `camRef = { center, pixelsPerUnit }`; Wheel `:650–664`; animiertes `goToRect` `:232–265`.
- LOD: hardcodierte Eldoria-Rechtecke in `eldoria-scene.ts:12–16`; Fade über `atlasOpacity(scale * rect.width, …)` `:330–333`; Stages `world→north→region→city→inn` `:66–73`.
- **Kein** DB-Child-Map-LOD: Hierarchie-Liste wechselt `activeMapId` (`WorldAtlasWorkbench`); Design: Demo-Scene-Graph vs. diskrete Map-IDs (`.qa/design/world-atlas-editor.md:77–79`).

### 2.4 Werkzeuge & Dokument

Domain `UnifiedCanvasDoc` (`unified-canvas-doc.ts`): Tools `hand|select|brush|road|room|wall|stamp|erase`; Materials; Stamps; Layers; Format `sagatree-unified-atlas-v1`.

| Tool | Status (Code) |
|------|----------------|
| Hand / Pinsel / Weg / Raum / Wand / Stempel | implementiert |
| Undo/Redo | JSON-History ~45 |
| Auswahl | nur Highlight; kein Transform |
| Radierer | Strokes + Objects; **nicht** Rooms/Walls |
| Dungeon-Generator | **fehlt** |
| 3D / Tilt / Extrusion | **fehlt** |

### 2.5 Persistenz / Security

- Tabelle `world_atlas_maps`, Blob `generator_meta.unifiedCanvas`, Soft-Cap 1 MB, Revision/Upsert via RPC (`world-atlas-service.ts`).
- Auto-Root `kind:'world'` wenn nur Legacy existiert (`useWorldAtlasEditor.ts:62–75`).
- Parallel: Legacy `world_maps` Tiles; Azgaar `.map` Storage round-trip.
- GM `canEdit` aus Saga-Overview; `playerView` Flag an RPC — **Player-View-Chrome in diesem Lauf nicht separat durchgeklickt** (markiert).

### 2.6 Dependencies (produktiv vs. unused)

| Lib | package.json | Atlas-Nutzung |
|-----|--------------|---------------|
| `three` / `@pixiv/three-vrm` | ja | Avatar/LiveAct — **nicht** Atlas |
| `leaflet` / `react-leaflet` / `@geoman-io/leaflet-geoman-free` | ja | Orphan Leaflet-Map |
| Pixi / Konva / Fabric / MapLibre | nein | — |

---

## 3. Tatsächlicher Implementierungsstand Prototyp

**Datei:** `.qa/evidence/unified-atlas-vs-prototype/sagatree_unified_atlas_3d_v3.html` (Kopie der User-Referenz).

| Aspekt | Befund |
|--------|--------|
| Shell | Welt/Saga-Tabs (UI-only), Sidebar-Hierarchie, Inspector, Floating Tools |
| Renderer | Custom **`AtlasGL` (WebGL)** + `AtlasLite3D` Canvas-Software-Fallback — **kein** Three.js-Import trotz Text „Three.js wird geladen…“ |
| Kamera | `{x,z,span}` + `tiltAngle`/`yawAngle`; Shift-Drag Orbit; Toggle „Geneigte 3D-Perspektive“ |
| LOD | `levelFromView` / `applyLod` — Map-Planes + `world3d`/`city3d`/`dungeon3d` Meshes nach Span |
| Content | Procedural Texturen Welt/Region/Stadt; **Dungeon-Procgen** (`dungeonGenerate`); 3D-Stamps (Boxes) |
| Persistenz | `localStorage` key `sagatree-atlas-webgl-v3`; PNG/JSON Export; **keine** Supabase/RLS |
| Browser | **Verifiziert** WebGL: `engineState = WEBGL · ECHTES 3D · OFFLINE`; Geometry z. B. `dungeon3d` ~17k Tris (`window.__sagatreeAtlas.getState()`) |

---

## 4. UX-Audit (Schwerpunkt)

Screenshots: `.qa/evidence/unified-atlas-vs-prototype/screenshots/`  
(`proto-*`, `sagatree-canvas-world.png`, `sagatree-fullpage-1440.png`, `sagatree-mobile-390.png`, …)

### 4.1 Navigation & Informationsarchitektur

**Gewünscht:** Bibliothek → Welten → Welt → Karte **und** Saga → Welt → Karte, gleicher Atlas.

| Check | SagaTree | Prototyp |
|-------|----------|----------|
| Dual-Entry gleicher Editor | **Ja** (Workbench) | Nur Demo-Tabs ohne echte Daten |
| Klicks bis Karte (Saga) | Home → Letzte Saga → Welt → (Karte default) ≈ **3–4** | URL öffnen ≈ **0** |
| Konkurrierende Editoren | Legacy-Tiles wenn `legacy_tiles` in Liste; Leaflet tot | eine Oberfläche |
| Breadcrumb | `Eldoria › …` + Stage-Badge | Crumb + Level-Pill + Hotspots |
| Hierarchie | Demo-Nodes + separate DB-Kartenliste | Level-Nodes = Kameraziele |

**Browser-Beobachtung:** Unter Saga `SA-E979J` erscheint Unified mit Demo-Badge und Tools. Bibliothek → Welten war leer → Library-Pfad **nicht verifiziert**.

**Ursache Abweichung:** Produktentscheidung Dual-Nav (#702) vs. Prototyp als isolierte Shell (**A** + **G**).

### 4.2 Natürliches Zoomen

**Gewünscht:** Welt → … → Dungeon ohne Editorwechsel.

| Frage | SagaTree | Prototyp |
|-------|----------|----------|
| Semantisches Zoom? | **Teilweise:** Scale×Rect-Schwellwerte + Fade von Raster-Layern | **Ja:** Span-Schwellen schalten 2D-Maps + 3D-Meshes |
| Nur Bild vergrößern? | Basis Weltkarte + eingeblendete Detail-Raster | Textur-Planes + echte Volumen |
| Editorwechsel? | Nein innerhalb Demo-Graph; **Ja** bei DB-Child-Maps | Nein |
| Cursor-Anker? | `atlasZoomAt` — **ja** | `zoomAt` — **ja** |
| Harte Sprünge? | Sanfte `goToRect`-Animation; Sprung nur bei Map-ID-Wechsel | `goTo` log-lerp Span |
| Fehlende Detailkarten? | Imagination-First / leere Fläche (Innenraum bei starkem Zoom oft **fast leer**) | Immer Demo-Geometrie |

**Browser:** Bei Badge **INNENRAUM** / Zoom **~6349 %** (`sagatree-fullpage-1440.png`) zeigt die Stage weitgehend **einfarbiges Grün** — semantischer Zoom ohne ausreichend Interior-Kunst. Prototyp Room/Dungeon zeigt Wände + Props in 3D (`proto-dungeon-desktop.png`, `proto-room-edit-desktop.png`).

**Technische Ursache:** Demo-Raster + flache Stroke/Stamp-Zeichnung vs. Mesh-Extrusion (**C** + **F** Design: keine Pixi/3D in Phase 1).

### 4.3 2D / 3D

| Stufe | SagaTree | Prototyp |
|-------|----------|----------|
| Flache 2D-Karte | **Ja** (Default) | Map-Planes |
| Perspektivisch transformierte 2D | Nein | Nein als alleiniges Modell |
| 2.5D Extrusion | Nein | **Ja** (Häuser, Mauern, Dungeon) |
| Volle 3D-Szene | Nein | Vereinfachte Low-Poly-Szene, Orbit |

Klassifikation SagaTree: **1 — flache 2D-Karte**.  
Prototyp: **3–4 — 2.5D/3D mit geneigter Kamera**.

### 4.4 Zeichenwerkzeuge (Inkarnate-Prinzip)

Gemeinsam: Pinsel + Material, Stempel, Wand, Raum, Radierer, Layer, Undo — **ähnliches mentales Modell**.

| Funktion | SagaTree | Prototyp | Besser für GM-Flow |
|----------|----------|----------|-------------------|
| Terrain-Brush | 2D Strokes auf Weltkoordinaten | Strokes auf Level-Texturen → GPU-Update | Prototyp (sichtbarer auf Textur) |
| Pinselgröße | Slider | Slider | gleich |
| Texture blend | harte Farben | ähnlich hart | keines Inkarnate-Niveau |
| Gebäude 3D | 2D-Stempel „Haus“ | Box-Häuser mit Dach | Prototyp (Lesbarkeit) |
| Dungeon gen | fehlt | Seed/Theme/Räume | Prototyp |
| Persistenz/Rechte | Supabase + Revision | localStorage | **SagaTree** |
| Select/Transform | schwach | Props platzieren, begrenztes Edit | beide unter Inkarnate |

### 4.5 Visuelle Qualität

Trennung:

- **Editor-Chrome:** Prototyp = atlas-first (Stage füllt Viewport); SagaTree = Saga-Shell + Sidebars + Demo-Banner → Canvas oft **schmal** (~418×574 bei 1440×900, CDP).
- **Kartenergebnis:** Prototyp World/City/Dungeon wirken „reicher“ durch 3D + Labels; SagaTree World 2D-Demo ist lesbar (`sagatree-canvas-world.png`), Interior bei Extremzoom **schwächer**.

Schönes Demo ≠ besserer Editor — Persistenz und Dual-Nav sind Produktqualität, die der Prototyp nicht hat.

### 4.6 Bediengeschwindigkeit (Journey-Protokoll)

Zeiten **nicht** gemessen (nicht reproduzierbar instrumentiert). Aktionen aus Browser + Code:

| Aufgabe | SagaTree (beobachtet/Code) | Prototyp |
|---------|---------------------------|----------|
| 1 Neue Karte | „Detailkarte anlegen“ / ensure root | N/A (eine Demo-Welt) |
| 2 Region | Demo-Node oder neue DB-Karte | Nav „Nordreich“ |
| 3 Stadt | `goToRect(CITY)` / Node | Nav Dornhain |
| 4 Gebäude | Stempel `haus` | 3D-Stempel Haus |
| 5 Innenraum | Zoom Kupferlaterne — oft leere Fläche | Room-Level mit Wänden |
| 6 Wand | Tool Wand, Drag | Tool Wand |
| 7 Möbel | Stempel Tisch/… | 3D Props |
| 8 Dungeon gen | **nicht möglich** | Button + Seed |
| 9 Dungeon ändern | manuell Raum/Wand | Regen + manuell |
| 10 Zurück Welt | „Ansicht zurücksetzen“ / Welt zeigen | „Zur Weltkarte“ |

**Friction SagaTree:** Viele Panels gleichzeitig (Werkzeuge rechts, Atlas links, Meta, Azgaar, DB-Liste); Mobile Sidebars versteckt hinter Container-Queries (`@[48rem]`).

### 4.7 Heuristiken → konkrete Fixes

1. **Sichtbarkeit Status:** Demo-Badge gut; Save disabled bis Dirty — klar. Stage „INNENRAUM“ bei leerer Fläche widerspricht Erwartung → Placeholder „Noch kein Innenraum definiert“ (IV-04/10).
2. **Cognitive Load:** Inspector + Stempel + Texturen + Azgaar + DB-Liste immer sichtbar → progressive disclosure: nur aktive Tool-Sektion.
3. **Direkte Manipulation:** Floating Tools auf Canvas gut (beide); Prototyp hält Tools zentriert über Stage — weniger Blickwechsel.
4. **Touch:** Prototyp `@media max-width:790` Drawer; SagaTree workbench Sheets — Mobile-Shot zeigt Atlas, aber Canvas-Anteil klein.
5. **A11y:** beide DE-Labels; Keyboard-Shortcuts für Tools **nicht** verifiziert / weitgehend fehlend.
6. **Consistency:** Stage-Labels vs. Node-Levels (`GEBÄUDE` vs `INNENRAUM`) leicht inkonsistent (`eldoria-scene.ts`).

---

## 5. Technischer Architekturvergleich

### Renderer

| | SagaTree | Prototyp |
|--|----------|----------|
| API | Canvas2D | WebGL custom + 2D software |
| Texturen | Offscreen procedural canvases `procedural-eldoria.ts` | Offline texture canvases → GPU upload |
| Geometrie | drawImage + path strokes + stamp vectors | Triangle meshes (boxes, walls) |
| Canvas-Count | 1 sichtbarer Stage-Canvas | 2 (`scene` + `fallback`) |
| Kamera | 2D center + px/unit | 3D look-at aus span/tilt/yaw |

### Datenmodell

| | SagaTree | Prototyp |
|--|----------|----------|
| Welt | `world_atlas_maps` Hierarchie + Unified Doc | ein State-Objekt |
| LOD | Demo-Rects; DB parent_map_id unverbunden mit Zoom | Level-spans in Weltkoordinaten |
| Editierbar | strokes/objects/rooms/walls | strokes/walls/rooms/props + dungeon grid |
| Tiles | Legacy parallel | nein |

### Persistenz / Performance / Security

- SagaTree: Supabase RPC, Revision, Soft-Cap, owner/GM scoped — **Produkt-ready**.
- Prototyp: localStorage — **G**.
- Performance-Zahlen: **nicht gemessen**. Beobachtung: beide interaktiv auf Desktop; Prototyp WebGL bei Dungeon ok in Testumgebung.
- Security: Prototyp offen lokal; SagaTree RLS/RPC — beibehalten.

---

## 6. Feature-Matrix

| Bereich | SagaTree aktuell | Referenzprototyp | UX-Unterschied | Technischer Grund | Bessere Lösung |
|---------|------------------|------------------|----------------|-------------------|----------------|
| Weltkarte | 2D procedural Eldoria | 2D texture + optional world3D | Prototyp „tiefer“ | Canvas vs Mesh | Hybrid: 2D edit, 3D preview optional |
| Zoom | cursor-anchored 2D | span + tilt | Prototyp immersiver | Kein 3D in Produkt | 2D behalten; Tilt nur Viewer |
| LOD | Opacity fade demo rects | Mesh visibility by span | Prototyp Stadt/Dungeon klarer | Demo vs authored 3D | Persistierte Nested Maps + Fade |
| 3D | keines | WebGL Extrusion | Groß | Scope Phase1 | Optional Scene-Layer |
| Dungeon | manuell 2D | Procgen + 3D | Prototyp schneller Start | fehlende Feature | Port Generator → Doc + View |
| Zeichenwerkzeuge | voller 2D-Satz | ähnlich + 3D stamps | ähnlich | — | SagaTree Doc + Proto UX-Chrome |
| Layer | 8 Layer-Flags | 6 visibility | ähnlich | — | vereinheitlichen |
| Persistenz | Supabase | localStorage | SagaTree | Architektur | SagaTree |
| Dual Nav | Library+Saga | Fake tabs | SagaTree | Produkt | SagaTree |
| Rechte/Reveal | Orte Sheet + RPCs | keine | SagaTree | — | SagaTree |
| Azgaar | Storage round-trip | nein | SagaTree | Design | SagaTree |
| Leaflet | orphan | nein | — | Demotion | entfernen oder experimentell belassen |
| Mobile | adaptive sheets | drawer | Prototyp atlas-first | Shell chrome | atlas-fullscreen mode |

**Teststatus-Legende:** Code ✓ = gelesen; Browser ✓ = interaktiv; — = nicht verifiziert.

---

## 7. Unterschiede und Ursachen

| Abweichung | Ursache-Klasse | Beleg vs Hypothese |
|------------|----------------|--------------------|
| Canvas2D statt WebGL/Three | **A/F** Design Spike | `.qa/design/world-atlas-editor.md` Primary Canvas; Pixi out of scope |
| Kein 3D Gebäude/Dungeon | **C** | kein Mesh-Code unter `atlas/unified` |
| Demo-LOD nicht DB-aligned | **A/B** | Design `:77–79`; `eldoria-scene` „Sample geometry“ |
| Dungeon-Generator nur Proto | **C** | Proto `dungeonGenerate`; Domain ohne Procgen |
| Leaflet demoted | **A** | Design `:32–33`; orphan file |
| Prototyp localStorage | **G** | Proto `persist()` |
| Prototyp „fühlt sich besser an“ | **E** + visuelle **C** | atlas-first Chrome + 3D Depth |
| Three.js im Repo ungenutzt für Atlas | **A** | Avatare orthogonal |
| Select/Erase unvollständig | **C** | Code-Inventar |
| Innenraum leer bei Extremzoom | **E** + IV-Spannung | Browser fullpage 6349 % |

---

## 8. Was SagaTree bereits besser macht

1. **Echte Dual-Navigation** Library/Saga auf einer Workstation.  
2. **Server-Persistenz**, Revision, Soft-Caps, Domain-Validation.  
3. **Rechte-/Reveal-Anbindung** (Orte Sheet, `canEdit`).  
4. **Legacy-Pfad** und Azgaar-File-IO ohne Fake-SDK.  
5. **Imagination-First-Hinweis** (Demo-Badge „nicht kanonisch“) — passt zu IV-02/04.  
6. **Architekturgrenzen** (#94): Domain Doc vs Infrastructure RPC.  
7. **Cursor-anchored Zoom** als reine Domain-Math (testbar).

---

## 9. Was der Prototyp besser macht

1. **Atlas-first Layout** — Stage dominiert; Tools floaten auf der Karte.  
2. **Eine emotionale Zoom-Story** bis Dungeon/Room mit Volumen.  
3. **Geneigte Kamera** macht Stadt/Dungeon sofort lesbar.  
4. **Dungeon-Procgen** als „Sofort-Erfolg“ für GMs.  
5. **Hotspots** als räumliche Affordance beim Zoomen.  
6. **Engine-State sichtbar** (WebGL vs Software) — Systemstatus.  
7. **Weniger konkurrierende Meta-Panels** während des Zeichnens.

---

## 10. Kritische UX-Probleme (SagaTree)

1. **Canvas zu klein** im Saga-Chrome (Sidebars + Meta) — Karte wirkt wie Nebensache.  
2. **Semantischer Zoom endet in leerem Grün** (Innenraum) — Erwartung „Raum betreten“ bricht.  
3. **Demo-Hierarchie ≠ DB-Hierarchie** — zwei mentale Modelle (Nodes vs Kartenliste).  
4. **Kein 3D/Dungeon-Wow** — Vergleich mit Prototyp enttäuscht trotz Feature-Parität bei 2D-Tools.  
5. **Werkzeug-Spalte immer voll** — Cognitive Load beim reinen Navigieren.  
6. **Library-Pfad** für neue Nutzer leer/unklar, wenn noch keine Welt existiert (dieser Lauf).  
7. **Select/Erase/Transform** unter Erwartung eines VTT-Editors.

---

## 11. Gap-Analyse P0–P3

### P0 — Kritisch

| ID | Nutzerproblem | Änderung | Dateien | Aufwand | Akzeptanz |
|----|---------------|----------|---------|---------|-----------|
| P0-1 | Zoom in unautorisierte Detailstufe ohne Feedback | Bei fehlendem Detail: IV-Placeholder („nicht festgelegt“) statt leerem Grün; optional Auto-Stop vor leerem LOD | `UnifiedAtlasEditor.tsx`, ggf. `procedural-eldoria.ts` | S–M | Zoom zeigt expliziten Leer-Zustand; CE/IV-04 |
| P0-2 | Atlas wirkt nicht wie Hauptobjekt | „Focus mode“: Stage min. 70 vh, Meta/Azgaar hinter Sheet | `WorldAtlasWorkbench.tsx`, Editor layout | M | AU-CONTENT-WIDTH; Screenshot Desktop |
| P0-3 | Demo- vs DB-Hierarchie verwirrt | UI: „Beispielpfad“ klar trennen von „Gespeicherte Karten“ | Workbench + Editor chrome | S | Labels + keine doppelten Listen ohne Erklärung |

### P1 — Hoch

| ID | Änderung | Abhängigkeit |
|----|----------|--------------|
| P1-1 | Nested Map: Zoom-Schwelle lädt/blendet **persistierte** Child-Map | Domain anchors + camera helpers nutzen |
| P1-2 | Dungeon-Procgen → `UnifiedCanvasDoc` (+ optional 3D view later) | Proto-Algorithmus portieren |
| P1-3 | Optional WebGL/Three **Viewer** für settlement/dungeon (Edit weiter 2D) | Shared world coords |
| P1-4 | Select: Move/Rotate Stamps; Erase rooms/walls | Editor pointer handlers |
| P1-5 | Floating tool rail wie Proto; Inspector nur kontextuell | UX redesign |

### P2 — Mittel

| ID | Thema |
|----|-------|
| P2-1 | Hotspots auf Canvas |
| P2-2 | Keyboard shortcuts (H/B/W/…) |
| P2-3 | Leaflet-Orphan entfernen oder hinter Feature-Flag |
| P2-4 | Brush auf Basemap-Textur (nicht nur Stroke-Overlay) |

### P3 — Niedrig

| ID | Thema |
|----|-------|
| P3-1 | Tilt-Preview Toggle (Viewer) |
| P3-2 | Combat-grid Polish |
| P3-3 | PNG export Parität |

---

## 12. Empfohlene Zielarchitektur

| Option | Bewertung |
|--------|-----------|
| **A. Bestehende Canvas-Architektur verbessern** | **Basis — ja.** Domain Doc + RPC + Dual-Nav sind die richtige Produkt-Säule. |
| **B. Hybrid 2D-Editor + Three/WebGL Viewer** | **Empfohlen.** Edit/Persistenz bleiben Canvas/Doc; immersive Preview für Stadt/Dungeon teilt Kamera-Hierarchie. |
| **C. Unified Three.js Rewrite** | **Nicht jetzt.** Hoher Migrationsaufwand, bestehende Docs/Tiles/Azgaar/RLS; Prototyp ist nicht Three.js sondern custom WebGL — Rewrite würde ohnehin neu spezifiziert. |

**Begründung:** UX-Gewinn von 3D ist lokal (Settlement/Dungeon). Weltmaßstab bleibt 2D-Kartenästhetik. Imagination First verbietet ohnehin flächendeckende Vollmodellierung (IV-04).

---

## 13. Konkretes UX-Redesign

### Layout

```
[ Top: Welt | Saga context · Save · Focus ]
[ Left drawer: Hierarchie (Demo|Saved) · Layers ]
[ CENTER: Stage 70–85% — floating tools · hotspots · scale ]
[ Right drawer: nur aktives Tool · Properties on select ]
```

### Übernehmen vom Prototyp

- Floating Action-Tools über Stage  
- Level-Pill + Crumb  
- Hotspots  
- Dungeon-Generator-Panel (als optionales Sheet)  
- Tilt nur im Viewer-Modus  

### Behalten von SagaTree

- Dual Nav + Orte Reveal  
- Supabase Doc + Revision  
- Demo-Badge / non-canon  
- Material/Stamp Domain-Typen  
- Azgaar round-trip  

### Imagination First

- Unspezifizierte Regionen: Nebel/„offen“ statt Fake-Detail  
- Procgen = **suggestive** bis GM bestätigt (IV-02)  
- Spielermodus: keine GM-only Layer  

### Mobile

- Proto-Pattern: Side/Inspector als Overlay; Stage full-bleed  
- Touch-Targets ≥44px (bereits teilweise)

---

## 14. Priorisierter Implementierungsplan

1. **Phase UX-Shell (P0):** Focus mode, Hierarchie-Klarheit, Empty-LOD Placeholder.  
2. **Phase Edit-Completeness (P1-4/5):** Transform, Erase, Tool-Chrome.  
3. **Phase Semantic Maps (P1-1):** Child-map anchors an Kamera.  
4. **Phase Dungeon Gen (P1-2):** Port Proto-Generator → Doc.  
5. **Phase Immersive Viewer (P1-3):** Optional WebGL/Three read-mostly.  
6. **Cleanup (P2-3):** Leaflet orphan.

Keine Zahlen zu Perf; jedes Phase-Gate: Browser 1440×900 + 390×844 + Acceptance IV/AU.

---

## 15. Risiken und offene Fragen

| Risiko / Frage | Status |
|----------------|--------|
| Library → Welten leer in Testaccount | Library-E2E **offen** |
| Player-View Atlas | RPC Flag vorhanden; UI-Chrome **nicht** verifiziert |
| Soft-Cap 1 MB bei reichen Strokes | Risiko bei Brush-heavy Maps |
| Zwei Persistenzwelten (tiles vs unified) | Migrationspfad teilweise; langfristig konsolidieren? |
| Proto-String „Three.js“ irreführend | Custom WebGL — bei Port nicht Three voraussetzen |
| CE-Performance Live Mode | Atlas vs Conductor — getrennte Surfaces? **offen** |

---

## Die 10 wichtigsten Unterschiede

1. **Renderer: Canvas2D vs WebGL-3D**  
   - Warum: bewusste Scope-Entscheidung (#702 Design).  
   - Nutzer: weniger Tiefe in Stadt/Dungeon.  
   - Ändern? Hybrid Viewer, kein Full-Rewrite.  

2. **LOD: Demo-Raster vs Mesh-Volumes**  
   - Warum: Sample geometry; echte Nested Maps deferred.  
   - Nutzer: Zoom fühlt sich „flach“ an.  
   - Ändern? Ja — persistierte Anchors + optionale 3D.  

3. **Dungeon-Generator nur im Prototyp**  
   - Warum: Feature fehlt (C).  
   - Nutzer: Battlemaps starten bei Null.  
   - Ändern? Ja, P1.  

4. **Persistenz: Supabase vs localStorage**  
   - Warum: Produkt vs Demo (G).  
   - Nutzer: SagaTree speichert teamfähig.  
   - Ändern? Nein — behalten.  

5. **Chrome: Shell-dicht vs atlas-first**  
   - Warum: Saga-IA + Meta-Features.  
   - Nutzer: Karte wirkt klein.  
   - Ändern? Ja, Focus mode P0.  

6. **Kamera: rein orthografisch vs Tilt/Orbit**  
   - Warum: 2D-Edit-Einfachheit (F).  
   - Nutzer: weniger räumliche Orientierung.  
   - Ändern? Viewer-only Tilt.  

7. **Hierarchie: zwei Listen vs eine Level-Nav**  
   - Warum: DB multi-map + Demo-Nodes.  
   - Nutzer: Verwirrung.  
   - Ändern? Ja, UI trennen/mergen.  

8. **Rechte/Reveal nur in SagaTree**  
   - Warum: Plattform.  
   - Nutzer: Geheimnisse möglich.  
   - Ändern? Nein.  

9. **Interior-Zoom Qualität**  
   - Warum: schwache Interior-Kunst + kein Volume.  
   - Nutzer: „kaputter“ Zoom bei 6000 %.  
   - Ändern? Ja, Placeholder + Art/Gen.  

10. **Leaflet-Tote vs Proto-Klarheit**  
    - Warum: Demotion ohne Cleanup.  
    - Nutzer: indirekt (Komplexität).  
    - Ändern? Orphan entfernen (P2).  

---

## Abschließende Bewertung

1. **Nähe zur Unified-Atlas-Vision:** mittel (~55–65 % Konzept, ~25–35 % immersives Zoom-Erlebnis).  
2. **Wirklich fehlend:** 3D/2.5D-Volumen, Dungeon-Procgen, persistiertes Nested-LOD, Interior-Affordance, atlas-first Chrome, Select-Transform.  
3. **Unbedingt behalten:** Dual-Nav Workbench, UnifiedCanvas Doc + RPC/Revision, Domain-Kamera, Demo/non-canon Badge, Orte-Reveal, Azgaar-IO, Legacy-Tiles-Escape.  
4. **Warum sich der Prototyp besser anfühlt:** größere Stage, 3D-Tiefe, Hotspots, sofortiger Dungeon-Erfolg — nicht weil die Persistenz besser wäre.  
5. **UX übernehmen:** Focus layout, floating tools, hotspots, level pill, dungeon sheet, empty-LOD honesty.  
6. **Technik übernehmen:** Procgen-Algorithmus, LOD-Sichtbarkeitskurve, optional WebGL-Mesh-View — **nicht** localStorage, nicht Full custom-engine als alleinige Wahrheit.  
7. **Nächste Phase:** P0 Shell + Empty-LOD + Hierarchie-Klarheit; parallel Spez für Hybrid-Viewer und Dungeon-Gen → Doc.

---

## Evidence-Index

| Artefakt | Pfad |
|----------|------|
| Prototype HTML | `.qa/evidence/unified-atlas-vs-prototype/sagatree_unified_atlas_3d_v3.html` |
| Screenshots | `.qa/evidence/unified-atlas-vs-prototype/screenshots/` |
| Code inventory (Subagent) | Transcript subagent `8f257866-…` |
| Design | `.qa/design/world-atlas-editor.md` |
| Acceptance | `.qa/acceptance/world-atlas-editor.md`, `saga-world-atlas.md`, `unified-atlas-canvas-height.md` |

**Browser-Läufe:** Prototyp 1440×900 + 390×844; SagaTree Saga-Weltkarte 1440×900 + Mobile-Emulation; Library-Welten leer (dokumentiert).

### Inventory cross-check (Explore subagent)

Zusätzliche Code-Fakten aus [Explore SagaTree atlas codebase](8f257866-03af-44c4-8de1-9103fea7fad8), bereits mit Report abgeglichen:

- `SagaWorldCatalogPanel` — Orphan (keine anderen `src`-Importer); nicht Teil der Dual-Nav.
- Save kann `legacy_tiles` → `kind: 'world'` coercen (`useWorldAtlasEditor.ts:141`) — Migrationspfad beim Unified-Speichern.
- Nested-camera helpers `atlasLocalToRoot` / `atlasDetailActive` exportiert, UI unbenutzt — relevant für P1 Nested-Map-LOD.
