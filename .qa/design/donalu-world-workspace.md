# SagaTree: Donalu World Workspace, Ortsmodell und Referenz-Saga

**Designstatus:** Entscheidungsvorlage, keine Implementierung. **Stand:** 2026-10-17. **Zielpfad im lokalen SagaTree-Repo:** `.qa/design/donalu-world-workspace.md`. Dieses Dokument liegt ausschliesslich als Chat-Artefakt vor; die lokale Codebasis wurde nicht geaendert.

## 0. Basis und Geltungsbereich

**Verbindliche Produktentscheidungen:** `Donalu` ist die Welt, `Dornhain` eine Stadt in Donalu. Die vorhandene Test-Saga heisst exakt **Das Flüstern unter Dornhain**. Welt-Identitaet `WO-9FFK6` und Saga-Identitaet `SA-E979J` bleiben stabil. Die Umgebung der Stadt erhält **noch keinen erfundenen Eigennamen**. Andere Welten, insbesondere die übrigen 37 der lokal gemeldeten 38 Dornhain-Profile, bleiben bis zur Prüfung unverändert.

**Evidenzbasis:** Vom Nutzer gelieferter Cursor-Snapshot 2026-10-17 10:10:52 UTC ist für den lokalen WIP massgeblich. GitHub-`main` wurde nur read-only konsultiert für `AGENTS.md`, `src/domains/world/atlas/unified-canvas-doc.ts`, `.qa/design/world-atlas-editor.md` und die Experience-Contracts; GitHub ist NICHT der aktuelle lokale Dateistand. Die übermittelten DB-Zahlen und Statusangaben sind Berichtsangaben, noch keine hier selbst ausgefuehrten DB-Checks oder Browser-Screenshots.

**Ist-Zustand laut Snapshot:** React/Vite/TS, Supabase, #94 `domains -> infrastructure -> app`. 38 `world_profiles` namens Dornhain; 38 Legacy-Tile-Karten, eine `world_atlas_maps`-Weltkarte, keine persistierten Child-Maps, keine gespeicherten `generator_meta.unifiedCanvas`-Docs. Lokale, uncommitted 2D/3D-Hybrid-Arbeit mit `AtlasSpatialViewport.tsx`, `map-edit-ops.ts`, `dungeon-generator.ts`, Fokusmodus. Zwei blockierende DEV-Auth/RLS-Fehler. Test-Saga hat fuenf Orte, fuenf NPC-Bindings, vier Pregens, drei Quests, drei Lore, vier Items, eine Kartenbindung; Details zu einzelnen NPC-/Quest-Namen und deren Beziehungen liegen in diesem Brief nicht vor.

**Ziel:** Eine konkrete, zusammenhaengende Welt mit Orten, NPCs, Karten und spielbaren Saga-Szenen. Keine separate Datenwelt für Karte, Dungeon, Weltorte oder die Saga. **Nichtziel:** Eine komplett prozedural ausgefuellte Donalu-Welt, ein Rewrite aller existierenden Module oder automatisch als Kanon ausgegebene AI-Details.

## 1. Produktprinzipien

1. **Ein Ort, viele Zugriffe:** Der semantische Ort wird einmal gespeichert; Atlas-Pin, Gebäudeflaeche, NPC-Zuordnung, Dungeon-Eingang, Lore und Saga-Referenz verweisen darauf.
2. **Eine Welt, mehrere Sagas:** Canonical World = Geografie, stabile Orte, Weltfakten und Identitaeten. Saga = Nutzung der Welt, Geheimnisse, Quest- und Entdeckungszustand, Sessions.
3. **Eine Arbeitsflaeche, zwei Kameraperspektiven:** Draufsicht und 3D bilden dieselbe editierbare Geometrie ab. Erstellen/Leiten sind unterschiedliche Aufgaben-Kontexte, nicht getrennte Datenmodelle.
4. **Imagination First:** `canonical`, `suggestive`, `atmospheric` bleiben getrennt. Generator-Ergebnis ist Draft/Vorschlag bis explizite GM-Bestaetigung. Leere Details erhalten einen klaren Zustand statt Fake-Geometrie.
5. **Karte ist eine Ansicht der Welt, nicht die Welt-DB:** Das Atlas-System speichert kartografische Features und Detailkarten, aber Weltentitaeten besitzen unabhaengige stabile IDs.
6. **Keine Rechte durch UI:** GM-only Daten duerfen in Player-RPCs nicht geliefert werden. Public IDs sind keine Berechtigung.
7. **Keine doppelten produktiven Editoren:** Gegebenenfalls Canvas2D + Three.js intern, aber gemeinsamer Zustand und gemeinsame Editieroperationen.

## 2. Informationsarchitektur / Navigation

```text
Globale Shell: Dashboard | Bibliothek | Marktplatz
Bibliothek
  Welten
    Donalu [WO-9FFK6]
      Übersicht  - Weltstatus, erste Schritte, kuerzlich bearbeitete Orte
      Atlas       - Karte als grosse Workstation, Fokusmodus
      Orte        - alle echten Orte, hierarchisch, such- und filterbar
      Bewohner    - persoenliche NPCs/Kreaturen-Verwendungen in Donalu
      Lore        - Weltwissen, Verbindungen, ggf. Spaeter Fraktionen
      Verwendung  - welche Sagas nutzen Donalu? (kein dupliziertes Abenteuer)
  Sagas
    Das Flüstern unter Dornhain [SA-E979J]
      Übersicht
      Welt: Atlas | Schauplaetze | NSCs | Items | Quests | Lore
      Vorbereitung (bestehende Module / spaetere Verdichtung)
      Sessions
```

**Wichtig:** Die aktuelle `Saga -> Welt`-Struktur und gemeinsame `WorldAtlasWorkbench` nicht ersetzen, sondern den Saga-Kontext eindeutiger machen. Identischer Atlas bei Library und Saga, verschiedene Sichtfilter und Aktionen. Library = Welt authoren. Saga = Weltinhalte referenzieren, eigene Zustands-/Reveal-Layer authoren. Session = praesentieren und live steuern. Lange wiederaufladbare Aufgaben erhalten Routes, kontextuelle Kurzaktionen Sheets/Inspector.

**Globale Objekte:** Welt, Ort, NPC-Definition/Actor, Quest, Lore. **Der Atlas ist kein zusaetzlicher Content-Katalog.**

## 3. UX-Spezifikation / Screens

### 3.1 Welt Übersicht (Journey)

- Kopf: `Donalu` / Beschreibung, World-ID nur in Details, Hauptaktion `Atlas öffnen`.
- Weltstatus: Zahl echter Orte, verankerte Orte, angelegte Karten, verwendende Sagas. Keine Demo-Karten als bestehende Weltinhalte zaehlen.
- Einstieg für leere Welt: `Ersten Ort anlegen` oder `Karte importieren/erstellen`; kein grosses leeres Dashboard.
- `Das Flüstern unter Dornhain` als verknüpfte Saga sichtbar.

### 3.2 World Atlas (Workstation, SETUP)

```text
[ Donalu > Dornhain > Taverne Zum Flüstern ][Draufsicht | 3D] [Fokus][Speichern]
[Orte / Ebenen]   [                         KARTEN-STAGE                      ] [Kontext-]
[Suche/Pfad    ]  [ Orte und Hotspots, Zoom, Drag, Edit, LOD, Kartenstatus ] [Inspector]
[Baum          ]  [        situative Werkzeugleiste und Zoom/Orientierung   ] [Tools nur]
[             ]  [                                                           ] [bei Bedarf]
```

- Focus mode: Hauptbuehne soll bei 1440x900 ohne redundantes Chrome nutzbar gross sein (Richtwert >=70% Hauptbereichsbreite, >=70vh Stage). Im Saga-Kontext nicht das halbe Fenster mit Meta-Panels belegen.
- Linkes Panel: `Orte`, `Ebenen`; zwei getrennte Hierarchien (Demo vs DB) nicht als gleichberechtigte Listen zeigen.
- Platzieren eines Ortes: `+ Ort` -> Typ, Name -> auf Karte klicken -> Canonical-Place + räumliche Referenz *atomar* speichern; bis zur Bestaetigung Draft.
- Auswahl eines Orts: Inspector zeigt Name/Typ/Breadcrumb, Inhalte, Bewohner, Karten, Sagas; Primaraktionen `Hier zoomen`, `Ort bearbeiten`, `Detailkarte erstellen`.
- Kein Detail? Stufe nicht simulieren. Hinweis `Für diesen Ort gibt es noch keine Detailkarte.` mit `Anlegen`, `Importieren`, `Generieren` (sofern berechtigt).
- Editor-Modus `Bearbeiten` steuert Werkzeugleiste, nicht die Kameraart. `Draufsicht` und `3D` sind orthogonale Kamerapraesentationen.
- Werkzeuge kontextabhaengig: Welt/Region = Terrain, Fluesse, Wege, Regionen; Stadt = Gebäude, Strassen, Stadtmauern; Raum/Dungeon = Boden, Wand, Tuer, Mobiliar, Licht, Grid.
- Select/Transform: Pick in beiden Ansichten, dieselbe Objekt-ID und `applyMapEdit`, Zug-Position, Rotation und Resize mit aktivem Undo/Redo; Persistenz versioniert.
- Breadcrumb und Hotspots sind direkte Navigationsziele; normale Zoombewegung bleibt cursor-verankert und rückwärts vorhersehbar.

### 3.3 Ort (Sheet auf Karte / Route bei langem Edit)

Die **gleiche** Ort-Entitaet ist über Karte oder Orte-Liste erreichbar. Inspector-Felder: Identitaet/Typ/Parent, Kurzbeschreibung, Sichtstatus, `Auf Karte`, `Bewohner`, `Karten & Räume`, `Lore`, `Verwendet in Sagas`, `Verknuepfte Inhalte`. Kein blindes Anlegen von mehreren Objekten.

- Ort hat noch keinen Pin: `Auf Karte verorten`.
- Ort hat keinen Innenraum: `Detailkarte anlegen`.
- Ort hat NPCs: verknüpfte NPC-Liste; Klick oeffnet denselben NPC-Datensatz.
- Ort ist GM-only in einer Saga: Sicht-/Reveal-Badge gilt für Saga, nicht automatisch als globale Welteigenschaft.

### 3.4 Dungeon Generator (kontextuelles Sheet in Atlas)

Voraussetzung: passender Ort (`Krypta unter dem Hügel`) oder explizit erstellter Dungeon-Ort. Sheet: Seed, Stil, Raumanzahl, Verbindungsschleifen, Dichte, Preview -> `Vorschlag übernehmen` oder `Verwerfen`. Preview darf keine Canonical-Lore behaupten. Nach Übernahme entsteht eine persistierte Child-Map mit editierbaren Räumen/Wänden/Gegenstaenden, keine flache Screenshot-Textur. Reforge darf vorhandene manuelle Änderungen niemals ohne Warnung zerstoeren; spaeter Patch-/Override-Mechanismus. `Draufsicht | 3D` bleibt erreichbar.

### 3.5 Saga-Kontext (SETUP)

`Saga -> Welt -> Atlas` zeigt Donalu mit **Saga Overlay** (Party / Nur GM / Unlisted). Orte werden aus Welt gewählt, nicht in der Saga kopiert. Schauplaetze-Liste = durch die Saga referenzierte `world_places`. Vorbereitungsfunktionen: `Ort verwenden`, `NPC verknüpfen`, `Quest-Referenz`, `Begegnung vorbereiten`, `Sichtbarkeit`, `Session-Szene festlegen`.

### 3.6 Live/Session (PERFORMANCE)

Bestehende Session-Stage bleibt dauerhaft montiert; Ort/NPC/Quest-Auswahl aendert Kontext, nicht Route. GM-Reveal pro Schauplatz und seiner Inhalte; NPCs und Bilder per Rechtspruefung gefiltert; Fokus auf 2-3 direkte Aktionen. Maps und Dungeons repraesentieren Session-Zustand (Fog/Positions/Actor placements) als Saga-/Session-Overlay, nicht als irreversible Mutation des World Master.

### 3.7 Responsive und Accessibility

Adaptive UI: Phone 320-767, Tablet 768-1023, Desktop >=1024. Workstation Phone hat reduzierte authoring-Funktion mit Sheet-Inspector, grosser Karte und sichtbaren 44x44 Touch-Zielen; Tablet 2-Pane bei Platz. Kontext- und Scrollbreiten beachten; keine festen 3-Panel-Layouts unter 1024. Tastatur: Tab, Esc, Shortcut-Hilfe, vollwertige Alternative zu drag-only Aktionen, `prefers-reduced-motion`; Loading/Empty/Error/Retry explizit. Tokens/Farben/Typografie aus Theme Guide; Darker Grotesque, Cyan Auswahl, Gold Hover, keine neue generische UI.

## 4. Datenmodell: fachliche Wahrheit vs Darstellung

```
world_profiles (Donalu, WO-9FFK6)
  |-- world_places (semantische Orte: Stadt, Wald, Taverne, Krypta ...)
  |     |-- parent_place_id -> world_places (optionale Hierarchie)
  |     |-- world_place_map_links -> world_atlas_maps (+ anchor/feature id)
  |     `-- npc_place_affiliations -> existierende Actor/NPC-Identitaet
  |-- world_atlas_maps (bestehende hierarchische Map Docs)
  |     |-- parent_map_id + persisted spatial transform/anchor
  |     `-- unifiedCanvas / geo + objects + dungeon-generated draft/published
  `-- Welt-Lore / bisherige World Assets

projects (Saga SA-E979J)
  |-- world_profile_id -> Donalu
  |-- saga_asset_bindings.location -> world_place_id (neu referenzieren)
  |-- saga_place_state -> discovery/visit/reveal/GM notes
  |-- Quest/Lore/Item/NPC bindings (bestehend, keines duplizieren)
  `-- sessions -> Live Actor/Map/Reveals, getrennt von Weltkanon
```

### 4.1 `world_places` (Vorschlag, vor Migration bestehende Schema-Aequivalente suchen)

- `id uuid PK`, `world_profile_id uuid FK`, `parent_place_id uuid nullable FK`.
- `kind`: `continent|realm|region|settlement|district|site|building|interior|dungeon|area` (als domain enum/constraints und migrationsfreundlich; keine erzwungene weltweite Taxonomie auf einmal).
- `name`, `description`, `status` (`draft|canonical|archived`), `visibility_policy` / owner fields nach existierenden Policies, `revision`, `created_at`, `updated_at`.
- Parent muss in derselben Welt sein; keine Zyklen; Child-Typen nur soweit sinnvoll validieren, z.B. `building` unter settlement/site erlaubt.
- **Nicht jeder geometrische Raum/Tile ist ein world_place**: erst semantisch benannte/spielrelevante Räume. Sonst erhält ein generierter 80-Raum-Dungeon unnötig 80 Canonical-Eintraege.
- `place_id` ist stabil. Der Ortsname ist aenderbar; Slugs/URL werden nicht als FK verwendet. Langfristig lokalisierte `display_name`/Alias möglich, nicht zwingend MVP.

### 4.2 `world_place_map_links` (Vorschlag)

- `id`, `world_profile_id`, `place_id FK`, `map_id FK`.
- `usage = overview|footprint|entrance|interior|dungeon|battlemap`.
- `feature_id nullable` plus normalisierte oder map-lokale Koordinaten und Bounds; Transform von lokalen Map Units zu Parent-Units.
- Eindeutige Primary-Reference je Rolle wo fachlich sinnvoll, mehrere verschiedene Karten pro Ort erlaubt (Etagen, mehrere Battlemaps).
- Map und Place muessen derselben `world_profile_id` angehoeren; RLS und DB-Constraints durchsetzen.
- Bereits vorhandene `world_atlas_maps.parent_map_id` nutzen, Child-Map-Bounds samt Richtung/Skalierung persistent definieren; keine Rechtecke aus `eldoria-scene.ts` als Kanon verwenden.

### 4.3 NPC-Verknuepfung statt NPC-Duplizierung

- Bestehende NPC-Definition / Actor-Identity ermitteln. `npc_creature_definitions` laut Snapshot 0, aber Saga hat 5 `origin:native` NPC-Bindings: *nicht* aus der Zahl `0` folgern, dass gar keine NPC-Inhalte existieren.
- Eine dauerhafte NPC-Identitaet kann 0..n Ort-Beziehungen besitzen (`resident|works_here|visits|origin`), aber in Live/Session eine andere aktuelle Position haben. Eine `npc_place_affiliations`-Relation oder bestehende Entsprechung genuegt; keine zweite NPC-Definitions-Tabelle ohne Prüfung.
- Saga-Referenzen behalten vorhandene NPC-IDs/Bindungen; Migration in kanonische Definitionen nur mit reproduzierbarem Mapping.

### 4.4 Saga-Bindings und Zustand

- Bestehende `saga_asset_bindings` bleibt der verifizierte Katalog-/Reveal-Pfad. Für `location` Bindings nach Schema-Prüfung nullable `world_place_id` FK oder schema-kompatible Bridge; keine neue konkurrierende Bindings-Liste.
- Saga-spezifisches `saga_place_state`: `saga_id, place_id, discovery_state, visit_state, visibility/reveal, gm_notes` (soweit nicht im vorhandenen Binding abgedeckt) + Version; Daten nur für Saga-Berechtigte. Überlappende Felder verhindern.
- **Spieler-Reveal ist serverseitige Datenprojektion**: GM-only Orte/NPCs/Quests duerfen nicht per `SELECT`, RPC, Search-Index, Geo-Feature oder Storage-Pfad ausgelesen werden. Clientseitiges Ausblenden reicht nicht.
- World-Editor-Recht != Saga-GM-Recht. Welt geometrisch bearbeiten nur bei World-Edit-Rechten; die Saga darf ohne Welt-Edit nur ihre Overlays mutieren.

### 4.5 2D/3D, Karten und Generator

- `UnifiedCanvasDoc` und `applyMapEdit` bleiben vorerst kanonisches Bearbeitungsmodell. `AtlasSpatialViewport` ist 3D-Projektion derselben IDs, keine zusaetzliche Autoritaet. Three.js-Objects werden aus Domain-Geometrie erzeugt, nicht blind in die DB serialisiert.
- Camera/Map-Layer speichert `map_id`, lokale Achsen X/Z, optional Y für Höhe, Parent->Child Transform, Kind, Bounds, Revision.
- Generator speichert `seed, parameters, generator_version, algorithm_attribution, draft_output` und bei Übernahme die editierbaren Entity-Records. Manuelle Edits getrennt von regenerierbarer Basis; overwrite verlangt ausdrueckliche bestaetigte Entscheidung.
- `generator_meta.unifiedCanvas` hat 1-MB-Soft-Cap: grosse Dungeons / Stroke-Felder sind Kapazitaetsrisiko. Vor Scope-Ausbau Speicherformat und persistente Map-Chunk-/Asset-Storage-Strategie benchmarken; nicht heimlich limit ignorieren.

## 5. Konkrete Donalu-Welt / Place Tree für MVP

**Nicht erfundene Struktur; alle unbekannten Beziehungen sind TBD.**

```text
Donalu (world_profiles, WO-9FFK6)
|-- Dornhain (world_places, kind=settlement/city)
|   |-- Taverne Zum Flüstern (building/site; interior-map needed)
|   `-- Marktplatz Dornhain (site; city-map space, eigene Child Map optional)
|-- Schattenwald (natural area; parent region TBD)
|-- Krypta unter dem Hügel (site/dungeon; genauer Parent/Entrance TBD; GM-only Saga)
`-- Banditenlager (site; genauer Parent TBD; GM-only Saga)
```

Eine noch namenlose Umland-Region kann spaeter als Parent der vier Aussenschauplaetze und Dornhains entstehen, aber nicht erfunden oder per Default als kanonisch gespeichert werden. Der Baum muss Orte ohne festgelegten Parent innerhalb der Welt erlauben. Verortungen an der Welt- / Regional-Karte können unbestimmt bleiben, bis der GM sie festlegt.

## 6. Test-Saga als Golden Path / Content Coverage

**Saga `SA-E979J`**, Titel `Das Flüstern unter Dornhain`, Welt `WO-9FFK6`, Session `SE-GH2C8` Episode E001 Status `waiting`.

**Bestehende Inventarzaehlung (laut Snapshot):** 4 Pregens, 5 Location-Bindings, 5 NPC-Bindings, 3 Quests, 3 Lore, 4 Items, 1 Overview-Map-Binding. Keine NPC- oder Quest-Namen erfunden. Alle `origin:native` Bindings unverändert lassen, bis Inhalt/Eigentuemer/FKs belegt sind.

| Ort (bestehender Saga-Binding) | Semantischer Place / Parent | Atlas-/Map-Anforderung | Saga-Kontext und Test-Gate |
|---|---|---|---|
| Taverne Zum Flüstern | Building unter Stadt Dornhain | Pin oder Footprint in Stadtszene; mindestens eine betretbare Interior-Map; 2D/3D Objekt-Sync prüfen | Auswahl aus Ort -> NPCs/Quest/Encounter nur nach echten Bindings; no invented NPC |
| Marktplatz Dornhain | Site unter Stadt Dornhain | Marktplatz-Position und Umgebung in Stadt-Map; keine separate Map erzwingen | Platz öffnen, NPC-/Quest-Referenz prüfen, Zurueck nach Dornhain |
| Schattenwald | Natural area in Donalu | Verortung + regionale/Wildnis-Szene falls für Adventure genutzt | Entdecken/GM reveal; nicht die Baumverteilung als kanonische Wegfuehrung erfinden |
| Krypta unter dem Hügel | Site/Dungeon; Parent TBD | Eingang verankern; persistierte Dungeon-Child-Map; procgen Draft->Confirm->Edit 2D/3D | `gm_only` bleibt auch in API/Player-Map unsichtbar bis Reveal |
| Banditenlager | Site; Parent TBD | Vorbereitete Lager-Szene bzw. klare Platzhalter, keine ungeprüfte Lage im Schattenwald | `gm_only` bis GM offenbart; Gameplay nicht von automatischer Lore abhaengig |

### 6.1 Content-Abgleich vor Befuellung

1. Local fixtures / Seed / DB lesen: tatsaechliche fuenf NPC-Identitaeten, ihre Texte, drei Quest-Beziehungen, Lore-/Item-Referenzen; IDs und Sichtbarkeit dokumentieren.
2. Fehlende `world_places` exakt einmal je bestaendigem Schauplatz anlegen. Bestehende Saga-Location-Binding IDs (`loc.*`) auf Place IDs mappen; Saga-Bindings nicht zerstoeren.
3. Fuenf NPC-Bindings ggf. in dauerhafte NPC-Identitaeten überfuehren, Beziehungen zu Orten **nur bei Quellenbeleg** erstellen. Verknuepfte NPCs in den Place-Inspector und Saga-UI projizieren.
4. Vier Pregens, drei Quests, drei Lore, vier Items bleiben aus ihren bestehenden Katalogen; nur fehlende Referenzen nachtragen. Keine neuen Lore-Fakten oder Quest-Ablaeufe erfinden.
5. Eine physische Weltkarte und eine Stadt-/Umland-Karte mit persistierten Child-Ankern erstellen (nur soweit durch Worldbuilding festgelegt). Tavern Interior und Crypt Dungeon für den End-to-End-Pfad; Bandit/Wald Szenen nach vorhandenen Quests priorisieren.
6. GM/Party Screens verifizieren, dass GM-only Orte/NPC/Quest-Details nicht in Player API/HTML/Storage-Antworten auftauchen.
7. Session `SE-GH2C8` mit vorbereiteten Scene-Referenzen starten: Taverne oder andere tatsaechlich im Adventure festgelegte Einstiegs-Szene. Keine nicht belegte Reihenfolge hart kodieren.

### 6.2 Completion Definition (kein spaeterer Demo-Trick)

- `WO-9FFK6` hat genau den kanonisch gewünschten Namen Donalu; existierende andere Welten unverändert.
- `SA-E979J` referenziert genau diese Welt; der Titel ist korrekt.
- Alle 5 Location-Bindings haben einen `world_place_id` oder einen dokumentierten bewusst unverorteten Zustand.
- Mindestens ein kompletter Pfad `World -> City -> Building -> Interior` und einer `World/Region -> Crypt entrance -> Dungeon` mit persistierter Kamera/Child-Map funktionieren.
- NPC-Definitionen, Quest-/Lore-/Item-Referenzen und 4 Pregens bleiben erhalten, keine Doppelidentitaeten.
- 2D/3D Edits / Reload liefern gleiche Geometrie. Player-Reveal ist serverseitig kontrolliert.
- Kein Demo-Eldoria-LOD wird als Donalu-Kanon dargestellt.

## 7. Umbenennung / Migration Donalu (sicher und reversibel)

1. Uncommitted WIP sichern und Entwicklerzweig nicht verlieren; Build, Test-Gates und Auth/RLS-Szenarien inventarisieren.
2. Vorher-/Nachher-Snapshot nur für `WO-9FFK6` und referenzierende IDs (ohne sensitive Daten); Transaktion / idempotente Migrationsroutine mit dry-run und Rollback.
3. Auf `world_profiles` genau **ein** Profil mit public `WO-9FFK6` nach `Donalu` umbenennen, sofern Eigentuemerkontext und Referenzen verifiziert sind. `id` und `public_id` unverändert.
4. `Dornhain` als Place vom Typ Stadt anlegen und Test-Saga-Orte darunter bzw. in Donalu verknüpfen. Wo Parent/Position unbekannt ist, **TBD** belassen.
5. Im Client fest kodierte `Eldoria`/`Nordreich`/`Dornhain`-Demo-Labels nur aus kanonischer Produktansicht entfernen oder explizit als nicht-kanonische Demo kennzeichnen, nicht mit World-Place-Daten verschmelzen.
6. 37 weitere Dornhain-Profile und 38 alte Tile-Maps erst inventarisieren; keine Massendeletes. Dubletten ggf. separat migrieren nach Nutzungs- und Referenzpruefung.
7. Sprachen: Place-IDs stabil; Name ist Display-Text. Keine voreilige Ortsumbenennung für Englisch. Optional spaeter `localized_names` / Alias-Feld, ohne Plot oder URLs abzuleiten.

## 8. Optionen und Trade-offs

| Option | Produktumfang | Fit zum lokalen Zustand | Vorteile | Nachteile | Urteil |
|---|---|---|---|---|---|
| A `YAGNI / jetzt nur verknüpfen` | Keine neue Place-Entitaet; Demo vorerst nicht erweitern | bestehende Bindings/Listen | geringstes Migrationsrisiko | die Fragmentierung und Mehrfacheingabe bleiben bestehen | Nur als kurzfristiger Blocker-Fix |
| B `Places + Map-Links + Saga Overlay + Hybrid` | First-class Places, persistierte Kamera-Child-Map, 2D/3D same state, Saga als Overlay | nutzt WIP `AtlasSpatialViewport`, `applyMapEdit`, DB-RPC, `saga_asset_bindings` | Loest die eigentliche UX-Fragmentierung; reuse; graduell migrierbar | Neues Schema, RLS, Undo/Versionierung, Place-Mapping | **Empfohlen** |
| C `kompletter Three Rewrite + voller Kanon` | Neuaufbau 2D/3D und komplette Donalu-Generierung | widerspricht erfolgreichem lokalem Hybrid-PoC | theoretisch ein Renderer | hohes Risiko, Fokusverlust, violates imagination-first | Nicht jetzt |

**Ponytail / KISS:** Stufe 1 (`nicht bauen`) verworfen, weil sie ein Kernproblem des Produktes nicht loest. Minimal notwendige neue Abstraktion ist die semantische Place-Identitaet plus Spatial Link, nicht ein Universal-World-Simulator. Renderer-Wechsel ist durch den bereits getesteten Hybrid-PoC aktuell nicht gerechtfertigt.

## 9. Umsetzungspakete und Abhaengigkeiten (kein Produktionscode in diesem Plan)

| Phase | Definition / Gates | Dependency |
|---|---|---|
| P0: Werkstand sichern & Auth | Uncommitted Änderungen sichern, CI/Test-Gate, Local JWT/RLS für Library und Atlas reparieren; keine Service-Role-Bypaesse als produktiver Fix | Blocker für alles |
| P1: Weltidentitaet | Scoped Rename Donalu; Dornhain als Stadt, keine Massenmigration; dedupe-inventory 38 worlds | P0 |
| P2: Orte als Domain | Existing equivalent check, WorldPlace + Link zu Map und Saga; RLS/Constraints und Migration aus 5 bindings | P0/P1 |
| P3: Karte + Orts-UX | Real Child-Maps/Anchors, Placeholder, Atlas-first Focus, Place Sheet, create-from-map/list | P2 |
| P4: Referenz-Saga | NPC/Quest/Lore/Item-IDs mappen, 5 Schauplaetze verbinden, Szene-Refs testen; 4 Pregens und session waiting erhalten | P2/P3 |
| P5: Dungeon/3D | Lokalen Generator, 3D Editor und shared `applyMapEdit` haerten, Crypt entrance -> Dungeon -> room; Regeneration sicher | P3 |
| P6: Live + Player + Release | Rollensichere Projektionen, Reveal, Discovery, Session E2E und responsive/golden tests | P4/P5 |

**Wichtig:** P4 und P5 können nach P3 parallel stattfinden. Nicht für die Spielbarkeit erst eine ganze Welt ausmodellieren.

### Vorlaeufige Dateigrenzen (lokal prüfen, keine blind neuen Verzeichnisse)

```text
src/domains/world/places/              NEW  - Place-Identitaet, Parent-/Same-world-Regeln, kanonische References
src/domains/world/atlas/               EXT  - Spatial transforms/child-map bindings, map edit ops
src/infrastructure/world/              EXT  - Place/Atlas RPC-Adapter und Mapping
src/app/world/                          EXT  - World Workspace, Places Inspector, Atlas Stage, Dungeon Sheet
src/app/project/                        EXT  - Saga World Place Bindings und Kontext
supabase/migrations/                    NEW  - idempotente Schema-/Backfill-Migrationen mit RLS
.qa/design/donalu-world-workspace.md    NEW  - Architektur + UX
.qa/acceptance/donalu-world-workspace.md NEW - Golden journeys
```

Parnas-Grenzen: `places` verbirgt die Entscheidung, *was ein Ort ist*, Atlas verbirgt die Projektion/Koordinaten, `infrastructure` verbirgt Persistenz/Permissions, `app` verbirgt Presentation/Interaktionen. Domain darf nicht Three/React/Supabase importieren. Vermeide zirkulaere Abhaengigkeiten zwischen Saga/World/Atlas.

### Abnahmetests / Goldene Journeys

1. **World Rename:** Donalu hat noch `WO-9FFK6`; `SA-E979J` unverändert verknüpft; andere 37 Dornhain-Profile unverändert.
2. **Place dedupe:** Eine Taverne in der World-Orte-Liste ist dieselbe beim Atlas-Pin und bei Saga-Schauplaetzen (ein Place-ID).
3. **Authoring:** `+Ort` auf Karte -> DB -> Liste -> reload -> gleicher Anker; `Ort verorten` von der Liste -> Karte ebenfalls.
4. **Nested zoom:** Welt -> Dornhain -> Taverne -> Innenraum; Kameraursprung und Position stabil; nicht vorhandene Details zeigen Placeholder, keine Fake-Geometrie.
5. **2D/3D:** Wand/Gebäude in 2D erstellen, in 3D move/rotate, zurueck in 2D, reload -> gleiche IDs/Geometrie.
6. **Dungeon:** Crypt Seed -> Draft -> Confirm -> editable Child-Map -> manual edit -> reload; Reforge darf Changes nicht kommentarlos loeschen.
7. **NPCs:** Fuenf existierende Saga-Bindings bleiben verknüpft; Ortzuordnungen nur bei Quelle belegt; keine Doppel-NPCs.
8. **Player reveal:** GM-only `Krypta` und `Banditenlager` und NPC-Details sind für Player weder sichtbar noch über APIs abrufbar vor Berechtigung.
9. **Session:** vorbereiteten Schauplatz auf Live Stage, GM Reveal ohne Stage-Unmount, Reveal visible player projection.
10. **Adaptive:** Desktop 1440x900 und 1920x1080, Tablet 768x1024, Phone 390x844 plus 320px narrow; keine unzugaenglichen Hauptaktionen, Touch >=44px; AU/CE/IV Gates.

## 10. Architektur- und Security-Review

| Bereich | Bewertung | Risiko / Gegenmassnahme |
|---|---|---|
| KISS | PASS | nur neues Place-/Spatial-Link-Konzept; keinen Everything-Graph planen |
| SOLID / Parnas | PASS WITH REVIEW | Places/Atlas/Saga getrennte fachliche Owners, gleiche IDs |
| DRY | PASS | eine Place-Identitaet, keine Copy per Saga |
| Security | CONCERN | RLS auth derzeit defekt, GM-only/World-Edit-Prüfung serverseitig bauen und E2E prüfen |
| UI/UX | PASS WITH REVIEW | Atlas-first; context sheet statt mehrfache Panelhierarchien; echte Mobile-Recomposition |
| Scaling | CONCERN | 1MB-Cap, Geometrie/Blob-Chunks, grosse Karten bench |
| Testability | PASS | domain pure, referenzielle Integritaet, Playwright role matrix |
| Maintainability | PASS WITH REVIEW | WIP konsolidieren und keine Duplikat-Data-Stores |

**Offene Blocker:** (1) lokales Auth-/RLS-Bild muss reproduzierbar geklaert sein; (2) genaue 5-NPC-, 3-Quest- und Lore-Daten fehlen diesem Brief; (3) World-Profile-/World-Place-Migrationssicherheit unter existierenden IDs/Berechtigungen braucht lokalen SQL-Nachweis; (4) exakte Geografie ausserhalb der Stadt ist nicht festgelegt; (5) reale lokale UI-Screenshots wurden hier nicht inspiziert.

**Confidence der Designrichtung: ~82%.** Produktabsicht klar und lokaler Snapshot konkret; die reale Datenbank, der uncommitted Code und der aktuelle Bildschirm sind aus dieser Chat-Umgebung nicht direkt geprüft. **Bereit zur Implementierung?** Nur phasenweise: P0 jetzt; danach P1/P2 nach local schema/security review; P3+ erst mit nachgewiesenen Interfaces.

## 11. Noch offen zu entscheiden (nicht blockierend für Plan)

- Soll die Umgebung Dornhains sofort eine benannte Region bekommen? **Default: nein**, spaeter nach Lore-Bedarf.
- Duerfen World-Owner alle Saga-GM-only Orte sehen? **Default:** World-Ownership/GM berechtigt nicht automatisch zur Sicht fremder Saga-Overlays; konkrete Policy aus Rollenmodell ableiten.
- Soll ein Dungeon-Raum immer ein eigener Ort sein? **Default:** nur benötigte benannte/narrativ wichtige Räume werden Places; alle geometrischen Zimmer bleiben Map Features.
- Ist jede Karte zugleich editierbar für Spieler? **Default:** Player sees authorized projection; World-Edit nur für Rechteinhaber.
- Welche Sprache erhalten Orts-Eigennamen? **Default:** Eigennamen neutral, lokalisierte Display-Namen spaeter; `Dornhain` bleibt vorerst bestehen.

## 12. Forschungsmaterial / Herkunft

- Nutzer-übermittelter **SagaTree Consolidated Current-State Brief** (lokaler Snapshot vom 2026-10-17) ist Hauptquelle für Ist-Zustand.
- GitHub `main` read-only: `AGENTS.md` (#94, UX-Gates), `src/THEME_GUIDE.md` (Darker Grotesque, Cyan/Gold), `docs/concepts/imagination-first-visualization-contract.md` (canonical/suggestive/atmospheric), `docs/concepts/adaptive-ui-experience-contract.md` (Device Bands + AU), `docs/concepts/conductor-experience-contract.md` (CE Stage Permanence/Actions), `.qa/design/world-atlas-editor.md` (ParentMap/RPC/Legacy).
- Keine validierten lokalen Screenshots, DB-Zugriffe oder Code-Änderungen in diesem Chat. Alle Tabellen-/Dateinamen für **neue** Funktionen sind Entwurf, nicht Existenzbehauptungen.
