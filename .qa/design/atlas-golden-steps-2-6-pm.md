# Atlas Golden World — Implementierungsplan Steps 2–6 (PM Review)

## Zielbild

```
Welt Donalu
└─ Kontinent <NAME>
   └─ Land <NAME>
      └─ Ort Dornhain (eigene Stadtkarte)
         ├─ Gebäude Taverne Zum Flüstern → Räume
         └─ Gebäude Krypta unter dem Hügel → Räume
```

**Heute (nach Step 1):** Produkt-Atlas zeigt die gespeicherte Golden-Weltkarte (Rechteck-Land + Strokes + Place-Pins) in 3D und Draufsicht.  
**Noch nicht:** echte Küsten, Kind-Karten pro Hierarchieebene, Ausschnitt-Verorten, voller Golden-Inhalt pro Ebene, Reset der gesamten Kette.

**Stacking:** PR #1194 (Golden v4) → Step 1 (3D/2D echte Karte) → Step 2 → Steps 3+4 → Steps 5+6.

---

## Step 1 · 3D/2D echte Karte + Pins — ✅ DONE

**Warum zuerst:** Ohne das rendert 3D eine feste Demo-Welt (Westmark/Nordreich/…). Alles später Gebaute wäre unsichtbar.

**Was geliefert:** Produkt-Maps (`demoSeed: false`) zeichnen nur `generator_meta` / UnifiedCanvas; Draufsicht nicht mehr blank; Place-Pins + Fly-to; Select/Road in 3D.

**Nicht in Scope gewesen:** Polygon-Küsten (Rechtecke bleiben bewusst eckig bis Step 2).

---

## Step 2 · Küstenpolygone + „Fläche zeichnen“ — ⏳ PR #2

### Warum

`UnifiedCanvasRoom` ist heute nur Rechteck:

```ts
// src/domains/world/atlas/unified-canvas-doc.ts
type UnifiedCanvasRoom = {
  id: string; x: number; y: number; w: number; h: number;
  material: UnifiedCanvasMaterial;
};
```

Kontinente als Rechtecke sehen in 2D und 3D kaputt aus. Im Demo-Runtime gibt es schon Küstenpfade (`coast: [[x,y],…]` + `coastalPath`) — das Datenmodell der Produkt-Karte nicht.

### Was wir bauen

1. **Domain-Schema erweitern** (`unified-canvas-doc.ts`)
   - Optional `points?: [number, number][]` (geschlossen, ≥3).
   - Wenn `points` gesetzt: Fläche = Polygon; `x/y/w/h` = Bounding-Box (Kompatibilität, Hit-Tests, LOD).
   - Parse/Serialize: alte Docs ohne `points` bleiben gültig (Rechteck = Default).
   - Self-Test: round-trip + Invalid (zu wenig Punkte → reject).

2. **Bridge** (`webgl-runtime-bridge.ts`)
   - `roomsToWebgl` / `projectRoomsToCanvas` tragen `points` 1:1 mit (kein Verlust beim 2D↔3D-Save).

3. **Tool „Fläche zeichnen“**
   - Neue Tool-ID z. B. `area` in `unified-canvas-doc` + `atlas-tool-registry.ts`.
   - Erlaubt auf: World-Root (`kind === null`), `continent`, `country` (role: `terrain`).
   - **2D** (`UnifiedAtlasEditor.tsx`): Klick setzt Vertex; Doppelklick / Enter schließt; Escape abbricht; Material aus Palette.
   - **3D** (`atlas-prototype-runtime.mjs`): gleiche Semantik auf Boden-Raycast; Prefill-Pfad wie Demo-`coastalPath` (quadratische Midpoint-Kurve nur als Stroke-Look, Persistenz = Roh-Vertices).
   - Select/Erase/Drag: Polygon-Hit via point-in-polygon / bbox zuerst.

4. **Renderer**
   - 2D fill + Soft-Coast-Outline für Polygone (heute soft outline nur für Rect-Land).
   - 3D Terrain-Texture: gleiche Polygon-Fill wie Rect-Rooms (kein Demo-Coast mehr).

5. **Golden v4 Seed anpassen (minimal)**  
   - West-/Ost-Kontinent-Rechtecke → wenige Küstenpolygone (optisch „Land“, noch nicht volle Hierarchie-Inhalte).  
   - Seed-Key bleibt `dornhain.unified.v4` **oder** bewusst `v5` nur wenn Auto-Upgrade nötig — Prefer: gleiche v4 + shape change nur wenn blank/golden flag; sonst User-painted nicht clobbern (bestehende Upgrade-Regel).

### Warum so (nicht anders)

| Alternative | Warum nicht |
|-------------|-------------|
| Nur optisch runden in 3D | 3D ≠ 2D-Wahrheit; bricht „eine Wahrheit“ |
| Brush statt Polygon | Pinsel ist Stroke, kein geschlossenes Land; LOD/Selection/Reset brauchen Flächen-IDs |
| Azgaar-Import only | Authoring-Tool fehlt; GM kann nichts korrigieren |

### Acceptance (beobachtbar)

- [ ] GM zeichnet in 2D und 3D eine geschlossene Landfläche; Save/Reload behält Vertices.
- [ ] Rechteck-Rooms aus alten Saves rendern unverändert.
- [ ] Kein Demo-Coast (Westmark…) auf Produkt-Maps.
- [ ] `npm run test-gate` inkl. neuer Self-Tests; Architecture-Boundaries ok (Domain rein, Runtime nur App).

### Out of scope Step 2

- Child-Maps / Hierarchie-Nodes  
- parentAnchor-UI  
- Session/Secrets  

---

## Steps 3+4 · Hierarchie + Ausschnitt verorten — ⏳ PR #3

### Warum

Heute: Orte sind **Pins auf der Weltkarte**, ohne eigene Primary-Maps → kein Drill Welt→Stadt→Gebäude→Raum.  
Child-Maps starten als `mapStatus: 'unlocated'` ohne `parentAnchor`; UI zeigt Hinweis „Verorte den Ausschnitt…“, **ohne Werkzeug**. LOD darf laut Contract nicht „erfinden“ (`canLodEnterChildMap` in `map-frame.ts`).

### Was wir bauen

#### 3 — Hierarchie über bestehenden Produktpfad

- Golden-Setup (und Sidebar `+`) nutzt denselben Pfad wie heute: `createWorldNodeWithMaps` / `editor.createChildMap` + Place-Links.
- Kanonische Kette (bereits Regel im Hierarchy-Kernel):

  `world → continent → country → place → building → room`

- Pro Node: **eigene** `world_atlas_maps`-Primary-Map mit `unlocatedChildMapGeneratorMeta` bis verortet.
- UI: eine Hierarchie-Liste (Demo-Pfad klar getrennt / nicht als Produktwahrheit); „unverortet“-Badge bleibt.

**Golden-Namen (PM-Entscheidung offen):** Kontinent + Land brauchen Labels. Optionen: erfinden (z. B. „Donalu“ / „Westmark-Platzhalter“) vs. Platzhalter „Kontinent A“ / „Land A“.

#### 4 — Werkzeug „Ausschnitt verorten“

Domain existiert schon:

```ts
// src/domains/world/atlas/map-frame.ts
type ParentSpatialAnchor = {
  parentMapId: string;
  centerX: number; centerY: number;
  extentX: number; extentY: number;
  rotationRad: number;
  metersPerUnit: number | null; // bleibt null bis Kalibrierung
};
```

**UI/Flow:**

1. Child-Map aktiv oder „Verorten“ aus Hierarchy → Parent-Map öffnen im Locate-Modus.
2. Drag-Rechteck (oder Center+Extent) auf Parent → schreibt `parentAnchor` + setzt `mapStatus` von `unlocated` → `unsketched`/`ready` (Regel: Anchor gültig ⇒ LOD erlaubt; leere Child-Canvas = unsketched ok).
3. Persistenz: `mergeMapFrameIntoGeneratorMeta` + bestehendes Atlas-Upsert (owner-scoped).
4. Drill: Doppelklick Pin / Hierarchy nur wenn `canLodEnterChildMap` true; sonst Toast (bereits DE-Copy).
5. 2D+3D: gleicher Anchor; 3D fly-to span aus Extent (Reuse `atlas-map-pins` span helpers).

### Warum so

| Alternative | Warum nicht |
|-------------|-------------|
| Alles auf einer Map als LOD-Stamps (`s.*`) | Kein echtes Reinzoomen; widerspricht #722 independent frames |
| Auto-Anchor aus Pin-Koordinaten still | User sieht keinen Ausschnitt; Scale/Extent falsch; Imagination-First „honest unlocated“ |
| Meter-Skala jetzt | Contract: abstract 0…1000 bis kalibriert; `metersPerUnit: null` |

### Acceptance

- [ ] Sidebar legt Kontinent→…→Raum an; jeder hat eigene Map.
- [ ] Unverortete Child-Map: kein LOD-Drill; Hinweis sichtbar.
- [ ] Nach Verorten: Zoom Parent→Child in 2D und 3D; Reload behält Anchor.
- [ ] Ungültiger Anchor (extent ≤ 0) → DE-Fehler, keine Teilmutation.
- [ ] Fremde Welt / non-owner: kein Write (bestehende RLS/Host-Checks).

### Out of scope 3+4

- Voller Golden-Innenausbau (kommt in 5)  
- Session-Reveal-Wipe  

---

## Steps 5+6 · Golden-Content + Reset-Kette — ⏳ PR #4

### Warum

Step 1/2 liefern eine **Weltkarte**. Grill-Entscheidung **1D**: Golden soll session-fertig sein (Secret-*Definitionen* + Startszene im Seed).  
Reset heute (`dornhain-golden-reset.ts`): nur Root-Canvas + 5 lose Golden-Places — **nicht** Child-Maps / Hierarchie-Dokumente.

### Was wir bauen

#### 5 — Inhalt pro Ebene (Author-Seed)

| Ebene | Inhalt (Minimum Golden) |
|-------|-------------------------|
| Welt | Ozean + Kontinent-Polygone + Namen |
| Kontinent | Ländergrenzen, Gebirge, Flüsse, Wälder |
| Land | Dornhain + 2–3 Orte + Whisper Road |
| Dornhain (place map) | Straßen, Marktplatz, Häuser, Taverne-, Krypta-Eingang |
| Taverne / Krypta | Räume, Wände, Türen; Krypta ggf. Dungeon-Generator |
| Räume | Möbel/Objekte |
| Saga-Schicht | Krypta GM-only (Definition); Taverne+Marktplatz spieler-sichtbar; Startszene Taverne |

Technik:

- Seed-Builder pro Map (Domain), nicht hardcoded Demo-LOD in Runtime.
- Places mit `seed_key` + Parent-`seed_key` (erweitert `DORNHAIN_GOLDEN_PLACES`).
- Jede Golden-Map: Canvas-Doc + `mapStatus`/`parentAnchor` gesetzt (fertig verortet im Seed).
- Reveal: **Definition** im Author-Seed; **Zustand** Session (7C). Toggle Voll/Spieleransicht bleibt GM-only (8b) — bereits in v4 Chrome.

#### 6 — Reset-Kette

Dialog-Modi bleiben (5B/6C):

| Mode | Neu |
|------|-----|
| `atlas` | Alle Golden-Maps (Root **und** Child-Docs per seed) → Golden Canvas; User-Maps ohne Golden-Key unberührt |
| `atlas_places` (Default) | + Golden Places/Hierarchie/Links/Anchors upsert; User-Places ohne Golden-`seed_key` bleiben |
| `everything` | wie oben + Session-Progress wipe **wenn API existiert**; sonst DE-Hinweis (kein stilles No-Op als Erfolg) |

Implementierung:

- Domain: `planDornhainGoldenReset` erweitert um Map-Liste / seed keys für Child-Maps.
- Host/Infra: upsert Atlas-Maps + Places in einer owner-scoped Transaktion (kein partial tree).
- UI: bestehender `AtlasGoldenResetDialog`; Copy anpassen („gesamte Golden-Hierarchie“).
- Tests: Self-Test Reset stellt Anchor+Child-Docs wieder her; User-Extra-Place überlebt Default.

### Warum so

| Alternative | Warum nicht |
|-------------|-------------|
| Default-Reset löscht Session-Reveals | Grill 5c: Karte neu ≠ Kampagne neu |
| Zwei persistierte Welten (Author/Play) | Grill 7C abgelehnt; Drift |
| Nur Root resetten (Status quo) | Child-Maps bleiben „kaputt“; Zielbild unerreichbar |

### Acceptance

- [ ] Frischer Golden: Drill Welt→…→Raum mit Inhalt (nicht nur Pins).
- [ ] Reset „Karte und Orte“ stellt Hierarchie+Karten+Anchors wieder her; eigene Orte ohne seed bleiben.
- [ ] Reset „Alles“ ohne Session-API: klarer DE-Toast, keine Fake-Erfolgsmeldung.
- [ ] Spieler sehen keinen Toggle, der GM-Secrets leaked.
- [ ] Composition-/Architecture-Gates + Self-Tests grün.

### Out of scope 5+6

- Procedualgen-Wizard  
- Meter-Kalibrierung  
- Eldoria-`demoSeed`-Pfad ändern  

---

## Reihenfolge & Abhängigkeiten

```
#1194 Golden v4  →  Step1 Renderer  →  Step2 Polygone  →  Step3+4 Hierarchy/Locate  →  Step5+6 Content/Reset
```

- Step 2 vor 3: sonst seedet Hierarchie wieder Rechteck-Land.  
- Step 3+4 vor 5: Content braucht echte Child-Maps + Anchors.  
- Step 6 mit 5: Reset-Ziel = voller Seed, sonst Reset regressiert auf flache Orte.

## Architektur-Constraints (nicht verhandelbar)

- Domain rein: `src/domains/world/atlas/**` (kein React/Host).  
- Persistenz nur Infrastructure/Host.  
- UI DE; Commits EN.  
- IV: keine erfundenen Küsten/LOD auf `unlocated`.  
- Owner-scoped Writes.  
- Quality: `npm run test-gate`.

## Offene PM-Entscheidung (blockiert nur Step 5 Naming, nicht Step 2)

1. **Kontinent- und Land-Name** für Golden Donalu?  
2. Seed-Bump `v4` shape-in-place vs. `v5` mit Auto-Upgrade nur für blank/golden?

---

## Kurzfassung für PM „Go / No-Go“

| Step | Deliverable | Risiko wenn skip |
|------|-------------|------------------|
| 2 | Polygon-Flächen + Tool 2D/3D | Welt bleibt „Legosteine“ |
| 3+4 | Node+Map-Hierarchie + Locate-Tool | Kein Reinzoomen; Hinweis ohne Aktion |
| 5+6 | Voller Golden-Seed + Reset ganze Kette | Referenzwelt / Factory-Reset unbrauchbar |

**Empfohlener Go:** Steps unverändert in dieser Reihenfolge; Naming-Entscheidung vor Step-5-Seed-Freeze.
