# ATL3 — Procedural Fantasy Rendering: visueller Qualitätsvertrag (V01)

**Issue:** #1295 (ATL3-V01) · **Epic:** #1294 · **Slug:** `atl3-v01-visual-contract`
**Maschinenlesbarer Vertrag:** `.qa/fixtures/atl3-v01-visual-contract/golden-scenes.json`
**Ist-Baseline (Custom-WebGL):** `.qa/evidence/atl3-v01-visual-contract/baseline/`
**Prüfung:** `scripts/atl3-v01-visual-contract.self-test.mjs` (test-gate) + `e2e/atl3-v01-visual-contract.spec.ts` (Host-Browser)

## 1. Zweck und Grenzen

Dieser Vertrag ist das **einheitliche Testorakel** für den späteren prozeduralen
Atlas: ATL3-R01B (#1296, Three.js-Visual-PoC), die eventuelle Migration
(R02–R04, M01, G01, C01), R05 (#1270) und Q01 (#1300). Er definiert zwei feste,
gespeicherte Golden-Szenen, ihre Kameras/Zoomstufen/Lichtprofile, beobachtbare
Material- und Geometriekriterien mit Soll/Ist, Budgets für echte Zielhardware
und ein reproduzierbares Aufnahmeprotokoll.

- **Kein Three.js-Prototyp, keine GO/NO-GO-Entscheidung** in V01 — beides ist R01B.
  Kein Three.js-Import in V01-Dateien (self-test prüft das).
- **Produktiver Renderer bleibt Custom-WebGL** (`custom-webgl-prototype-runtime`, ADR-ST-10 / R01 NO-GO).
  Die Baseline fotografiert genau diesen Renderer; sie ist das **Ist**, kein Qualitäts-PASS.
- Kein neues Kartenmodell, keine Änderung an Golden-Daten, Renderer oder GPU-Codepfaden.
- ATL2-G04-Belege (#1232) werden **nicht** umetikettiert oder überschrieben; sie stehen nur als
  Ausgangsbeleg gegenüber (§8). G04 bleibt das Pixel-Regressions-Gate des aktuellen Renderers.
- Keine Geschmacksurteile: jede Anforderung hat eine beobachtbare Metrik und einen Schwellwert
  (AGENTS.md, Product Experience Contracts). Wörter wie „hochwertig“ sind keine Kriterien.

## 2. Art Direction (beobachtbar formuliert)

Ziel ist eine **synthetisch-satellitenähnliche Fantasy-Welt in Draufsicht** plus Diorama- und
Perspektivansicht derselben Szene — nicht Google-Earth-Fotorealismus, keine Pflicht für
handillustrierte Assets, Fototexturen oder Satellitenbilder. Referenz für Material-/Lichtwirkung:
`majidmanzarpour/threejs-procedural-dungeon` (prozedurale Geometrie, CanvasTexture/GLSL).

Erkennbar an (Details und Schwellwerte in §8):
1. Gebäude mit variierenden Dachformen/-materialien, deterministisch aus Feature-ID + Seed.
2. Bäume mit unterscheidbaren Silhouetten und Pro-Instanz-Variation.
3. Gelände mit Relief und weichen Materialübergängen statt einfarbiger Polygone mit Kanten.
4. Kontakt- und Schlagschatten passend zur Lichtrichtung.
5. Innenräume (Krypta) mit geschlossenen Räumen, Türen, Steinoberflächen und lokalem warmem Licht.
6. Zoomabhängige Detailstufen ohne Pop-in; Lesbarkeit kleiner Objekte bleibt erhalten.
7. Keine Darstellungsartefakte (Z-Fighting, Flimmern) in irgendeiner Kamera.

## 3. Golden-Szenen und feste gespeicherte Daten

Beide Szenen sind **echte gespeicherte Karten** der Starter-Welt `dornhain.whisper`
(World-Seed `dornhain.unified.v4`), angelegt über `ensure-starter` aus
`src/domains/world/atlas/dornhain-golden-hierarchy.ts`. Die Browser-Aufnahme lädt die Karte über
die Host-API und prüft, dass `generatorMeta.seed` = Map-Seed und der Feature-Fingerprint der
gespeicherten `generatorMeta.unifiedCanvas` = gepinnter Wert ist (sonst FAIL). Der self-test
prüft denselben Fingerprint gegen den Domain-Builder: Datenänderungen sind nur als bewusste
Vertragsänderung möglich.

Fingerprint: sha256(canonical sorted-key JSON of stored generatorMeta.unifiedCanvas.{rooms,walls,doors,objects,strokes,heightfield}).slice(0,16) — equals the Golden domain builder output.

| Szene | Karte | Map-Seed | Domain-Builder | Daten-Fingerprint | Navigation |
|---|---|---|---|---|---|
| `dornhain-block` | Dornhain (`settlement`) | `dornhain.map.place.dornhain` | `buildGoldenDornhainCanvas` | `29f3947cb45600e3` | Welt › Kontinent Westmark › Land Westmark › Dornhain |
| `krypta` | Krypta unter dem Hügel (`scene`) | `dornhain.map.loc.crypt` | `buildGoldenCryptCanvas` | `9fc038d9291de012` | Welt › Kontinent Westmark › Land Westmark › Dornhain › Krypta unter dem Hügel |

**Deterministische Seeds:** World `dornhain.unified.v4`; Map-Seeds wie oben; Varianten (Haus/Baum/Fels)
deterministisch per FNV-1a-Hash der Feature-ID (`atlas-diorama-look.ts`); Dungeon-Theme `ancient`.
Der Dungeon-Forge-Vorschau-Seed (4242) ist **nicht** Teil der Baseline (Vorschau ist nicht kanonisch).

## 4. Kameras, Zoomstufen, Licht, Viewports, Profile

| Kamera | Label | Gier | Pitch | FOV-Y |
|---|---|---|---|---|
| `ortho-topdown` | Draufsicht (Ortho) | 0° | 1.5708 rad (≈ 90.0°) | — |
| `diorama-oblique` | Diorama (Schräg) | 20° | 1.0500 rad (≈ 60.2°) | — |
| `perspective` | Perspektive | 20° | 0.9500 rad (≈ 54.4°) | 50° |

Pitch = Produkt-Default je Modus (`atlas-product-camera.ts`), Ortho = senkrecht.

| Szene | Zoomstufe | Bedeutung | Zoom | Span (Welteinheiten) | Zentrum (x, z) |
|---|---|---|---|---|---|
| `dornhain-block` | `z0-uebersicht` | Übersicht | 100 % | 530.0 | (390, 470) |
| `dornhain-block` | `z1-stadtblock` | Stadtblock | 240 % | 220.8 | (390, 470) |
| `dornhain-block` | `z2-detail-kleines-gebaeude` | Detail (kleines Gebäude g.watch) | 480 % | 110.4 | (452, 430) |
| `krypta` | `z0-uebersicht` | Übersicht | 100 % | 530.0 | (420, 480) |
| `krypta` | `z1-raumgruppe` | Raumgruppe | 175 % | 302.9 | (420, 480) |
| `krypta` | `z2-raum` | Halle mit Reliquie/Lampe | 330 % | 160.6 | (400, 360) |

Span = 530 × 100 / Zoom-%. Zentrum in Karten-Einheiten (0–1000, z = Karten-y).

**Licht (gepinnt, self-test vergleicht mit Domain):**
- Dornhain: `resolveAtlasDioramaLightProfile('balanced')` — daylightDir (−0,4; 1; −0,5), ambient 0,34,
  fog 0,00045, shadowStrength 0,42 (gebackene Flächenabdunklung, **keine Shadow-Map**), detail `reduced`.
- Krypta: `resolveAtlasDungeonLightProfile('ancient','balanced')` — daylightDir (−0,35; 1; −0,25), ambient 0,28,
  fog 0,0004, shadowStrength 0,35, torchIntensity 0,75, Lichtfarbe `#ffc17b`.

**Viewports (AU-Bänder):** Desktop 1280×800 (alle Kameras × alle Zoomstufen), Tablet 834×1112 und
Phone 390×844 (je `diorama-oblique` @ `z0`).

**Qualitätsprofile:** `balanced` wird aufgenommen. `high` und `lite` sind **NOT_RUN**: das Produkt hat
keinen Preset-Wähler (`AtlasNative3dEditor` nutzt immer `balanced`); siehe §11.

## 5. Aufnahmeprotokoll

1. Host-Browser-E2E (`SAGATREE_BROWSER_E2E_HOST=1`), echte Anmeldung, `ensure-starter`.
2. Navigation über die DB-WorldNode-Navigation (wie G04/G05) bis zur Szene; `data-atlas-ready`, Modus `webgl`.
3. Kamera über **Produkt-Bedienelemente**: Zoom-% (`#zoom`) und Koordinaten (`#coords`) im Maßstabs-Widget,
   Kameramodus und Gierwinkel über die öffentliche Bridge `__sagatreeAtlas` (`setCameraMode`, `setYaw`).
   Keine Test-Hooks in der Runtime.
4. Kamera-Snapshot muss innerhalb Toleranz liegen: Zentrum ±0.5, Span ±1 %, Gier ±0.5°.
5. HTML-Chrome (Panels, Pins, Maßstab, Labels) wird per Stylesheet ausgeblendet; aufgenommen wird nur das
   WebGL-Canvas. Ortsbeschriftungen sind HTML und werden separat bewertet (D-READ-01).
6. Bildmetriken aus dem PNG (Luma-Mittel/σ, unterscheidbare Farben, Kantendichte, dominanter Farbanteil);
   Nicht-leer-Grenze: ≥ 16 Farben und Luma-σ ≥ 3.
7. Reproduzierbarkeit: Ortho-Z0 wird nach einer Kamera-Rundreise erneut aufgenommen; Diff ≤ 0.08
   (maxChannelDelta 8, gleiche Toleranz wie G04).
8. Gleiche Szene in allen Kameramodi: identische Mesh-Menge je Szene/Zoomstufe.
9. Manifest `capture-manifest.json` mit Renderer (WEBGL_debug_renderer_info), Preset, Build-SHA, Messklasse,
   Soll-/Ist-Kamera, Mesh-/Dreieckszahl, Metriken, Frame p50/p95, Geräte-Maße.

**Dateinamen:** `v01__<sceneId>__map-<atlasMapId>__<camera>__<zoomId>__<buildSha10>__<preset>-<renderer>__<viewport>.png` (Regex im Vertrag; enthält Szene, volle Atlas-Map-ID, Kamera,
Zoomstufe, Build-SHA, Qualitätsprofil + Renderer-Klasse, Viewport).

Pixel-Diffs gelten nur **innerhalb desselben Renderers/Presets**. Renderer-Vergleiche (R01B, R05) laufen
kriterienbasiert über §8 mit denselben Szenen, Kameras, Zoomstufen und Dateinamen.

## 6. Visual Authority (canonical / suggestive / atmospheric) — Renderer-Regeln

Gemäß `docs/concepts/imagination-first-visualization-contract.md`:

- **canonical** — gespeicherte Features mit ID (Räume, Wände, Türen, Objekte, Wege, Heightfield).
  Der Renderer darf keine kanonischen Objekte erfinden oder weglassen; Mesh-/Instanz-IDs ⊆ Feature-IDs
  (**IV-01**, **IV-18**). Interaktive Affordanzen nur auf kanonischen Elementen (**IV-09**).
- **suggestive** — prozedurale Ausprägung kanonischer Features (Dachform, Baumart, Fassadenfenster,
  Mikro-Relief, Materialtextur). Deterministisch aus Feature-ID + Seed, nicht persistiert, keine
  Gameplay-Wahrheit (**IV-02**). Spieler-Referenzen darauf entscheidet die SL.
- **atmospheric** — Licht, Nebel, Partikel, Farbstimmung. Nicht abfragbar, frei änderbar, 1–3 dominante
  Kanäle (**IV-14**), im `lite`-Profil abschaltbar.
- **IV-07 Hidden info safety:** Player-Szenen, Meshes, Texturen und Caches enthalten keine GM-only oder
  unentdeckten Inhalte; Caches pro Rolle getrennt. V01-Baseline ist Owner/GM; Player-Visual = NOT_RUN (C-SEC-01).
- Vergleichsdaten enthalten keine fremden Daten; dekorative Details werden nicht still kanonisiert.

## 7. Adaptive UI (AU)

Surface-Klasse: **Workstation** (World Editor). Desktop = volle Matrix; Tablet/Phone = reduzierte Komposition
(**AU-06**) mit nutzbarem Canvas und ohne horizontale Überbreite (**AU-01**). Touch-Ziele/Chrome des Atlas
sind Gate G03, nicht V01. Renderer-Wechsel dürfen AU-01/AU-06 nicht verschlechtern.

## 8. Soll/Ist-Qualitätsmatrix

Status: `MET` erfüllt · `PARTIAL` teilweise · `GAP` nicht erfüllt (Ziel für R01B/M01/G01) · `NOT_RUN`
nicht messbar in der Baseline · `ACCEPTED_EXCEPTION` bewusst akzeptiert. Ist = Custom-WebGL-Baseline
(Software-Rendering in CI, Preset `balanced`).

| ID | Szene | Bereich | Authority | Metrik | Soll | Ist (Custom-WebGL) | Status |
|---|---|---|---|---|---|---|---|
| D-GEO-01 | dornhain-block | geometry | suggestive | Anzahl unterscheidbarer Dachformen und Dach-Material-Tokens über g.tavern, g.market, g.watch (Domain-Plan + Z2-Screenshot) | ≥ 3 Dachformen (z. B. Sattel/Walm/Turmhelm) und ≥ 3 Dach-Material-Tokens; Variante deterministisch aus Feature-ID + Seed | 1 Dachform (Pyramide/Walm) für Häuser und Turm; 2 Dach-Tokens (roofDark, roofMoss); Varianten deterministisch (FNV-Hash der Feature-ID) | **GAP** |
| D-GEO-02 | dornhain-block | geometry | suggestive | Baumkronen: Anzahl Silhouetten-Varianten + deterministische Pro-Instanz-Skalierung/Rotation | ≥ 3 Arten mit unterscheidbarer Silhouette; Pro-Instanz-Jitter Skala ±10–25 % und Rotation aus Feature-ID-Seed; Kronen nicht als einzelnes Low-Poly-Primitiv | 3 Varianten im Plan (oak, birch, pine); im Bild alle als ähnliches Low-Poly-Primitiv (Ikosaeder/Kegel), kein sichtbarer Jitter | **PARTIAL** |
| D-GEO-03 | dornhain-block | geometry | canonical | Gelände-Relief: Höhenbereich des Heightfields und sichtbarer Schattierungsgradient am Boden (Diorama Z1) | Höhenvarianz > 0 mit sichtbarem Licht-/Schattengradient auf Hügeln/Böschungen; Relief nur aus gespeicherten Heightfield-Daten (canonical) oder als markierte suggestive Mikro-Variation | Gespeicherte Golden-Dornhain-Karte hat kein Heightfield (null) → Gelände vollständig flach | **GAP** |
| D-MAT-01 | dornhain-block | material | suggestive | Materialübergänge Pflaster/Gras/Erde/Holz: Breite der Übergangszone an Polygonkanten in Z1 (px) und Luma-Streuung innerhalb einer Materialfläche | Übergangszone ≥ 4 px (weich/gebrochen statt 1-px-Polygonkante) in Z1 Desktop; Luma-σ innerhalb einer Materialfläche ≥ 4 (prozedurale Textur statt Flachfarbe) | Harte 1-px-Polygonkanten; jede Fläche einfarbig (Flat-Albedo, keine prozedurale Textur) | **GAP** |
| D-SHD-01 | dornhain-block | light | atmospheric | Kontaktschatten (AO) unter Gebäuden/Bäumen und Schlagschatten passend zu daylightDir in Diorama/Perspektive | 100 % der Gebäude und Bäume mit sichtbarem Bodenschatten (≥ 10 Luma dunkler als freie Fläche) in Richtung −daylightDir; Kontakt-AO an der Basis; Ortho: Schatten optional, aber konsistent | Keine Schatten: nur gebackene Flächenabdunklung (shadowStrength 0.42, keine Shadow-Map) | **GAP** |
| D-LOD-01 | dornhain-block | lod | suggestive | Detailstufen pro Zoomstufe: Fassadendetails (Fenster/Türen) in Z2 sichtbar, in Z0 aggregiert; keine sichtbaren Pop-ins zwischen Z0→Z1→Z2 | Z2: Türen + Fenster an jedem Haus sichtbar; Z0: vereinfachte Silhouetten; LOD-Schwellen dokumentiert und zoomabhängig (nicht nur preset-abhängig) | Türen an 2 Häusern in Z1/Z2 sichtbar, keine Fenster; Detailstufe hängt nur am Grafik-Preset (balanced = reduced), nicht am Zoom | **PARTIAL** |
| D-READ-01 | dornhain-block | readability | canonical | Lesbarkeit kleines Gebäude g.watch (Turm, size 0.45): Bildschirm-Fußabdruck in Z1 Desktop | ≥ 16×16 px in Z1 auf 1280×800; Ortsbeschriftungen (HTML) überdecken das Ziel nicht vollständig | Turm in Z1 Diorama ca. 40×55 px (visuell aus Baseline geschätzt), klar als Gebäude erkennbar | **MET** |
| D-ART-01 | dornhain-block | artifact | canonical | Z-Fighting / Streifenartefakte auf koplanaren Bodenpolygonen (Plaza/Blöcke/Ozean) in allen Kameras | 0 sichtbare Streifen-/Flimmerartefakte in allen 3 Kameras × 3 Zoomstufen (Layer-Offset oder Polygon-Offset) | Sichtbare horizontale Streifen (Z-Fighting) zwischen Plaza und Block-Flächen in Perspektive Z2 und an Kanten | **GAP** |
| K-GEO-01 | krypta | geometry | canonical | Raumschluss: jede Raumkante hat eine Wand, Raumübergänge haben Türen (gespeicherte Daten) | Jeder Raum allseitig von Wänden begrenzt außer an Türen; ≥ 1 Tür pro Raumverbindung; Türen als eigene Geometrie sichtbar | Gespeicherte Golden-Krypta: 2 Räume, 3 Wände (Halle südlich offen, Gewölbe ohne Wände), 0 Türen | **GAP** |
| K-GEO-02 | krypta | geometry | canonical | Wandhöhe: in Diorama Z2 sichtbare Wand-Seitenflächen (px) | Wände als Volumen mit lesbarer Höhe: sichtbare Seitenfläche ≥ 12 px in Diorama Z2 Desktop | Wände als flache, niedrige Leisten; Seitenfläche ca. 8–15 px (visuell geschätzt), kaum als Wand lesbar | **PARTIAL** |
| K-MAT-01 | krypta | material | suggestive | Stein-Material: Oberflächenvariation (Fugen/Platten/Risse) — Luma-σ innerhalb der Hallen-Bodenfläche in Z2 | Luma-σ innerhalb der Bodenfläche ≥ 6; Wandmaterial unterscheidbar vom Boden (ΔLuma ≥ 10) | Boden und Wände flach einfarbig (Flat-Albedo), keine Fugen/Platten | **GAP** |
| K-LIT-01 | krypta | light | atmospheric | Atmosphärisches Licht: g.crypt.lamp als warme Punktlichtquelle mit Abfall (Luma nahe Lampe vs. ferner Boden) | Luma im Radius der Lampe ≥ 1,3× ferner Boden; Lichtfarbe warm (Theme ancient light #ffc17b); ambient ≤ 0,3 | Kein lokales Licht: Dungeon-Look-Plan greift nur für droom-/dwall-/dlamp-IDs, Golden-Krypta nutzt g.crypt.* → 0 Fackeln, gleichmäßige Ausleuchtung | **GAP** |
| K-SHD-01 | krypta | light | atmospheric | Kontakt-AO an Wandfüßen und Raumecken | Sichtbare Abdunklung entlang Wandfuß und in Ecken (≥ 8 Luma dunkler als Raummitte) | Keine AO, Ecken gleich hell wie Raummitte | **GAP** |
| K-ATM-01 | krypta | atmosphere | atmospheric | Atmosphärische Kanäle (Nebel, Staub/Partikel, Lichtschein) — Anzahl aktiver Kanäle | 1–3 dominante Atmosphärenkanäle (IV-14), nicht persistiert, nicht abfragbar; abschaltbar im lite-Profil | Keine sichtbaren Atmosphärenkanäle | **GAP** |
| K-ART-01 | krypta | artifact | canonical | Z-Fighting auf Krypta-Böden in Perspektive | 0 Streifenartefakte in allen 3 Kameras × 3 Zoomstufen; 100 % der Raumbodenfläche sichtbar | Starke Streifen (Z-Fighting) auf Hallen- und Gewölbeboden in Perspektive Z1; Gewölbeboden teilweise unsichtbar | **GAP** |
| C-CAM-01 | * | camera | canonical | Gleiche Szene in allen Kameramodi: identische Mesh-Namen-Menge je Szene/Zoomstufe über ortho/diorama/perspective | Identische Mesh-Menge in allen 3 Kameramodi je Szene/Zoomstufe (Δ = 0; keine zweite Szene, keine zweite Karte) | Identisch (14 Mesh-Slots je Szene) | **MET** |
| C-DET-01 | * | determinism | canonical | Reproduzierbarkeit: erneute Aufnahme derselben Kamera nach Kamera-Rundreise | Pixel-Diff ≤ 0,08 (maxChannelDelta 8) auf demselben Renderer/Preset | Diff 0 (pixelidentisch) für Dornhain und Krypta | **MET** |
| C-CAM-02 | * | camera | canonical | Kamera-/Zoomvorgaben über Produkt-Bedienelemente (#coords, #zoom, Kameramodus, Gierwinkel) innerhalb Toleranz | Zentrum ±0,5 Einheiten, Span ±1 %, Gier ±0,5°, Pitch = Modus-Default | Alle 22 Aufnahmen innerhalb Toleranz | **MET** |
| C-DATA-01 | * | data | canonical | Gespeicherte Kartendaten = Golden-Domain-Daten (Feature-Fingerprint) | Fingerprint (16 Hex-Zeichen) der gespeicherten generatorMeta.unifiedCanvas = gepinnter Vertragswert (0 Abweichung); Seed = mapSeedKey | Dornhain 29f3947cb45600e3, Krypta 9fc038d9291de012 — identisch | **MET** |
| C-AU-01 | * | adaptive | canonical | Tablet/Phone: Canvas nutzbar, keine horizontale Überbreite | Canvas ≥ 200 px breit, overflowX ≤ 1 px (AU-01); Workstation-Phone = reduzierte Komposition (AU-06) | Tablet 730×912, Phone 366×604, overflowX 0 | **MET** |
| C-PROF-01 | * | quality-profile | atmospheric | Aufnahmen in den Profilen high/balanced/lite | Alle 3 Profile (high/balanced/lite) je Szene/Kamera aufgenommen; lite = Low-End/Software-Pfad, D-READ-01 bleibt erfüllt (≥ 16×16 px) | Nur balanced aufnehmbar: Produkt hat keinen Preset-Wähler (AtlasNative3dEditor nutzt immer balanced) | **NOT_RUN** |
| C-PERF-01 | * | performance | canonical | Frame p50/p95, Erstbild, Draw Calls, Dreiecke, GPU-Speicher, Heap-Wachstum auf echter Zielhardware (hardwareBudgets) | Je Tier alle Werte aus hardwareBudgets einhalten (z. B. Tablet p95 ≤ 33,3 ms), gemessen auf echter Hardware | Nur SwiftShader-CI gemessen (p95 17–19 ms bei 258–344 Dreiecken) — keine Hardware-Aussage | **NOT_RUN** |
| C-AUTH-01 | * | authority | canonical | Renderer erzeugt keine neuen kanonischen Objekte; suggestive Variation nur aus Feature-ID + Seed; Atmosphäre nicht persistiert | Mesh-/Instanz-IDs ⊆ gespeicherte Feature-IDs; keine Gameplay-Affordanzen aus suggestive/atmospheric (IV-01/02/09) | Diorama-Plan ist canonical-only (atlasDioramaLookPlanIsCanonicalOnly = true); Themes atmosphärisch | **MET** |
| C-SEC-01 | * | security | canonical | Player-Variante: keine GM-only/unentdeckten Inhalte in Meshes, Texturen, Caches (IV-07) | Player-Capture derselben Szene enthält 0 GM-only/unentdeckte Features; Texture-/Mesh-Caches pro Rolle getrennt (IV-07) | Baseline nur als Owner/GM aufgenommen; Player-Projektion durch ATL2-G01 (Host) geprüft, nicht visuell | **NOT_RUN** |

**Dokumentierte Ausnahmen / Datenlücken:**
- **D-GEO-03:** Datenlücke: Relief erfordert entweder ein Heightfield in der Golden-Karte (ändert G04-Fingerprints) oder eine suggestive Mikro-Relief-Regel — Entscheidung offen (siehe Design §11).
- **K-GEO-01:** Datenlücke der Golden-Krypta: Türen/Wände fehlen in den gespeicherten Daten, nicht im Renderer. Änderung der Golden-Daten ändert G04-Fingerprints → Entscheidung offen (Design §11).

**Gegenüberstellung mit den Ausgangsbelegen (ATL2-G04, unverändert):**
- Dornhain: `.qa/evidence/atl2-g04-golden-visual/raw-city-desktop.png` ↔ `baseline/v01__dornhain-block__…__diorama-oblique__z1-stadtblock__…__desktop.png`
- Krypta: `.qa/evidence/atl2-g04-golden-visual/raw-crypt-desktop.png` ↔ `baseline/v01__krypta__…__diorama-oblique__z2-raum__…__desktop.png`

G04 zeigt eine feste Diorama-Kamera je Maßstab; V01 erweitert auf drei Kameras × drei Zoomstufen ×
drei Geräteklassen, bewertet aber nicht anders: Die sichtbaren Lücken (flache Flächen, keine Schatten,
Z-Fighting, fehlende Türen/Lichter) sind in beiden Belegen dieselben.

## 9. Performance- und Ressourcenbudgets (echte Zielhardware)

Abnahme gilt nur auf echter Hardware. CI misst **Software-Rendering** (SwiftShader) und prüft dort nur die
Regressionsgrenze p95 ≤ 120 ms — das ist **keine** Hardware-Aussage.

| Tier | Geräteklasse | Profil | p50 ms | p95 ms | Erstbild ms | Draw Calls | Dreiecke | GPU-MB | Prozedurale Textur | Heap +MB nach 8 Map-Wechseln |
|---|---|---|---|---|---|---|---|---|---|---|
| desktop-reference | Desktop/Laptop mit iGPU (Intel Iris Xe / Apple M1). Chrome stable. 1280×800. DPR 1–2 | `high` | 12 | 16.7 | 1500 | 150 | 500.000 | 256 | 1024² | 16 |
| tablet | Tablet Mittelklasse (iPad 9. Gen / Galaxy Tab S6 Lite). 834×1112. DPR 2 | `balanced` | 16.7 | 33.3 | 2500 | 100 | 250.000 | 128 | 512² | 16 |
| phone-low-end | Android Low-End (Mali-G52-Klasse. z. B. Moto G). 390×844. DPR ≤ 1.5 | `lite` | 25 | 33.3 | 3500 | 60 | 100.000 | 96 | 256² | 16 |

Instanz-Budgets bleiben die G02-Werte (`ATLAS_PERF_BUDGET_THRESHOLDS`): high 2048, balanced 1024, lite 256.
p95 ist nie lockerer als das G02-Soft-Budget (33,3 ms). Messung: rAF-Frames nach 8 Warm-up-Frames, ≥ 48 Samples,
`--enable-precise-memory-info` für Heap, GPU-Speicher über Ressourcen-Buchhaltung des Renderers.

**Auf echter Hardware zu messen (offen, C-PERF-01):** alle Spalten oben je Tier, inkl. Low-End-GPU,
Context-Loss-Wiederherstellung, Kamerawechsel ohne zweiten Szenenaufbau.

## 10. Edge Cases (für R01B/R05 verbindlich, in der Baseline teils NOT_RUN)

| Fall | Erwartung | Baseline |
|---|---|---|
| Leere/unlocated Kindkarte | Ehrlicher leerer Zustand (Ozean/Leerhinweis), keine erfundenen Inhalte (IV-01) | NOT_RUN |
| Dichtes Stadtbild | Instanz-Budget je Profil eingehalten, Lesbarkeit kleiner Gebäude ≥ 16×16 px in Z1 | teilw. (Dornhain klein) |
| Sehr kleines Gebäude | `g.watch` (size 0,45) in Z1/Z2 als Gebäude erkennbar (D-READ-01) | MET |
| Stark heraus-/hineingezoomt | Z0…Z2 ohne Pop-in; Span-Clamp 0,5…8000 | Z0–Z2 aufgenommen |
| Profile high/balanced/lite | Gleiche Szene, degradierte Details, Lesbarkeit bleibt | nur balanced |
| DPR-Variation | Preset begrenzt DPR (high 2, balanced 1,5, lite 1); Toleranz pro Renderer | DPR 1 |
| Screenshot-Toleranz | Diff ≤ 0,08 innerhalb Renderer/Preset; renderer-übergreifend kriterienbasiert | MET (Diff 0) |

## 11. Funktionale Grenzen, Priorisierung, offene Entscheidungen

**Priorität der GAPs für R01B/M01/G01** (P0 = muss der PoC auf denselben Daten zeigen):
- **P0:** D-SHD-01 Schatten, D-MAT-01 Materialübergänge, K-MAT-01 Stein, K-LIT-01 lokales Licht,
  D-ART-01/K-ART-01 Z-Fighting.
- **P1:** D-GEO-01 Dächer, D-GEO-02 Baumkronen, K-GEO-02 Wandhöhe, K-SHD-01 AO, D-LOD-01 zoomabhängige LOD.
- **P2:** K-ATM-01 Atmosphäre, D-GEO-03 Relief (hängt an Datenentscheidung).

**Offene Entscheidungen (Ben):**
1. Golden-Krypta hat keine Türen und eine offene Hallenwand (K-GEO-01), Golden-Dornhain kein Heightfield
   (D-GEO-03). Golden-Daten ergänzen (ändert G04-Fingerprints/-Baselines bewusst) oder als akzeptierte
   Datenlücke führen und Relief nur suggestiv erzeugen?
2. Profile `high`/`lite` sind im Produkt nicht wählbar. Für R01B/R05 einen Preset-Schalter (Produkt-Feature)
   einführen oder Profile nur im PoC-Harness aufnehmen?
3. Hardware-Budgets (§9) sind ein Vorschlag auf Basis G02 — bestätigen oder anpassen, und Referenzgeräte benennen.
4. Dungeon-Look greift nur für Forge-IDs (`droom-`/`dwall-`/…); Golden-Krypta (`g.crypt.*`) bekommt daher kein
   Theme-Licht. Soll die Krypta-Szene künftig eine committete Forge-Krypta sein?

## 12. Nutzung als Testorakel

- **R01B (#1296):** Three.js-PoC rendert dieselben gespeicherten Karten (Fingerprint-Check), nimmt dieselbe Matrix
  mit demselben Namensschema auf und füllt eine zweite Ist-Spalte je Kriterium. GO/NO-GO entscheidet die neue ADR,
  nicht dieser Vertrag.
- **Migration (R02–R04, M01, G01, C01):** jede PR nennt die betroffenen Kriterien-IDs und aktualisiert Ist/Status
  mit Belegen; Status darf nur mit neuer Aufnahme steigen.
- **R05 (#1270) / Q01 (#1300):** unabhängige Abnahme gegen §8/§9 auf echter Hardware; GAP-Zeilen mit P0 müssen MET
  sein oder als `ACCEPTED_EXCEPTION` mit Begründung geführt werden.

## 13. Reproduktion

```bash
node scripts/atl3-v01-visual-contract.self-test.mjs
npm run test:e2e   # Host-Browser-Suite (scripts/browser-e2e-with-host.mjs) inkl. e2e/atl3-v01-visual-contract.spec.ts
# frische Aufnahmen: .qa/evidence/atl3-v01-visual-contract/run/ (gitignored)
# Baseline bewusst erneuern: run/* nach baseline/ kopieren und Soll/Ist-Matrix neu bewerten
ATL3_V01_WRITE_EVIDENCE=1 node scripts/atl3-v01-visual-contract.self-test.mjs
```
