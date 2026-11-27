# SagaTree Atlas — Einheitliches Welt-Modell & Terminologie

Status: **Bestätigt vom Owner (Ben, 2026-11-26).**
Geltungsbereich: Alle Atlas-, Dungeon-Forge-, Interior-/Exterior- und Visualisierungs-Arbeiten.
Ersetzt die frühere Bezeichnung `FLOWING` durch **`freeland`** (Owner-Entscheid).

Dieses Dokument definiert die **eine, einheitliche Welt-Logik**, die alle Fälle abdeckt
(Taverne, Krypta, Höhle, Palast, Baumhaus, freier Wald, Wald-Labyrinth, Berg mit Wanderwegen)
**ohne Sonderfälle** — nach dem Vorbild von GTA/RAGE (Exterior-Streaming + MLO-Interiors).

---

## 1) Die fünf Struktur-Begriffe (Owner-bestätigt)

| Begriff | Definition | Beispiele |
|---|---|---|
| **Welt / Kontinent / Land / Ort** | Geografische Hierarchie-Ebenen (Containment). | Westmark → Nordreich → Dornhain |
| **`freeland`** | Frei begehbares **Gelände ohne Rooms**. Spieler bewegen sich kontinuierlich auf dem Terrain; Wege sind Routing-Merkmale, keine Räume. Entspricht dem früheren `FLOWING`. | Berg mit Wanderwegen, freier Wald, Wiese, Küste |
| **Dungeon** | **Betretbarer Room-Komplex** = Rooms + Portale, dockt per Portal an die Außenwelt an. **Oberbegriff** für jede betretbare Struktur — nicht nur „Kerker". | Taverne, Krypta, Höhle, Palast, Baumhaus, Wald-Labyrinth |
| **Room** | Einzelner Raum/Bereich **innerhalb** eines Dungeons. | Schankraum, Schlafkammer, Höhlenkammer, Labyrinth-Abschnitt |
| **Building** | Hüllen-Struktur auf der Karte. **Ist das Building betretbar, IST es ein Dungeon** (hat Rooms). Ist es nicht betretbar, bleibt es reine Hülle (kein Dungeon). | Taverne (betretbar → Dungeon), dekorative Scheune (nicht betretbar) |

### Regel Building ↔ Dungeon
- `Building.betretbar == true`  →  Building **ist** ein Dungeon (enthält ≥ 1 Room).
- `Building.betretbar == false` →  Building ist **nur Hülle**, kein Dungeon, keine Rooms.
- **Kein Building ist „von Natur aus" ein Dungeon** — die Betretbarkeit entscheidet.

---

## 2) Exterior vs. Dungeon — die zwei Bewegungs-Modelle

Das ist die Kern-Unterscheidung (analog GTA/RAGE):

### Exterior (Außenwelt)
- **Kontinuierliches Terrain** (Heightfield), gestreamt.
- Spieler bewegt sich **frei auf dem Gelände** — kein Room-Graph.
- Wege/Pfade sind **`freeland`-Routing** (Polylinien auf dem Terrain), keine Räume.
- Beispiele: freier Wald, Wiese, Berg mit Wanderwegen, Küste, offene Straße.

### Dungeon (betretbarer Innenraum-Komplex)
- **Eigene Instanz** mit **Rooms**, verbunden über **Portale**.
- Spieler bewegt sich **von Room zu Room über Portale** — kein freies Terrain.
- **Room 0 = „Limbo" = die Außenwelt** (RAGE-Konvention): der Eingangs-Portal verbindet
  Room 0 (Exterior) mit dem ersten Innen-Room.
- Wird **beim Betreten geladen** (Portal-Trigger), nicht über den Exterior-Stream-Radius.
- Beispiele: Taverne (Schankraum, Keller), Krypta (Gänge, Grabkammer), Höhle (Kammern),
  Baumhaus (Plattform, Innenraum), Wald-Labyrinth (Abschnitte als Rooms).

---

## 3) Entscheidungsbaum (für jede Struktur)

```
Ist es Gelände, auf dem man sich frei bewegt?
├─ JA → freeland (Exterior, Terrain + Wege)
│        Beispiele: freier Wald, Berg mit Wegen, Wiese
│
└─ NEIN → Ist es betretbar (hat innen Räume/Bereiche)?
         ├─ NEIN → Building (reine Hülle, kein Dungeon)
         │          Beispiel: dekorative Scheune, Statue, Mauer
         │
         └─ JA → Dungeon (Rooms + Portale)
                  └─ besteht aus ≥ 1 Room
                  Beispiele: Taverne, Krypta, Höhle, Palast, Baumhaus, Wald-Labyrinth
```

### Die bisherigen „Unklarheiten" aufgelöst

| Fall | Auflösung |
|---|---|
| **Taverne / Palast** | Building, betretbar → **Dungeon** mit Rooms (Schankraum, Thronsaal, …). |
| **Krypta / Höhle** | Building, betretbar → **Dungeon** mit Rooms (Kammern, Gänge). Identische Logik wie Taverne. |
| **Baumhaus** | Building (auf einem Baum), betretbar → **Dungeon** mit Room(s). Der Baum/die Krone ist Exterior. |
| **Freier Wald** (Robin Hood Lagerplatz) | **`freeland`** (Exterior) — kontinuierliches Gelände, keine Rooms. Baumhäuser darin sind eigene Dungeons. |
| **Wald-Labyrinth** | **Dungeon** — die begehbaren Abschnitte sind **Rooms**, die Übergänge **Portale**. Die Bäume bilden die „Wände". |
| **Berg mit Wanderwegen** | **`freeland`** (Exterior) — Wege sind `freeland`-Routing auf dem Heightfield, **keine** Rooms. Eine Höhle **im** Berg ist ein separater Dungeon (CARVED). |

---

## 4) Portale — das Verbindungs-Prinzip

- **Portale** verbinden Exterior ↔ Dungeon und Room ↔ Room.
- **Exterior → Dungeon:** Eingangs-Portal (Tür, Höhlenmund, Falltür, Labyrinth-Eingang).
  Stil kontextabhängig: Palast-Portal ≠ Tavernen-Tür ≠ Höhlenöffnung ≠ Labyrinth-Hecke.
- **Dungeon → Dungeon:** möglich (z. B. Höhle hinter der Krypta).
- **Room → Room:** Türen, Gänge, Treppen innerhalb des Dungeons.
- **Room 0 (Limbo)** = die Außenwelt; der Rückweg führt über dasselbe Portal zurück ins Exterior.

---

## 5) Verhältnis zu den drei SCM-Beziehungstypen

Das Spatial Containment Model (`.qa/design/sws-containment-model.md`) nutzt drei
**geometrische** Beziehungstypen. Diese sind **orthagonal** zu den obigen **semantischen**
Struktur-Begriffen:

| SCM-Beziehung (geometrisch) | Bedeutung | Welt-Modell-Bezug |
|---|---|---|
| **CONTAINED** | Kind liegt innerhalb des Elternteils | Building in Ort, Room in Dungeon, Ort in Land |
| **CARVED** | Kind ist Aushöhlung im Elternteil | Höhle/Krypta **im** Berg/Fels (Dungeon im `freeland`-Berg) |
| **`freeland`** (ehem. FLOWING) | Routing auf dem Gelände, darf Grenzen kreuzen, wächst nie Topografie | Wege auf Bergen, Flüsse, Straßen, Labyrinth-Pfade |

**Wichtig:** `freeland` ist sowohl ein **Bewegungs-Modell** (Exterior, Abschnitt 2)
als auch der **SCM-Routing-Typ** (Wege/Flüsse). Beide meinen „freies, nicht-Raum-Gelände".

---

## 6) Generierungs-Quellen (einheitlich)

- **Handgebaut** oder **Dungeon-Forge-generiert** — beides erzeugt dieselbe Dungeon-Struktur
  (Rooms + Portale). Der Dungeon-Forge ist der prozedurale Generator für Dungeons.
- **`freeland`** (Terrain + Wege) kommt aus dem Atlas-Terrain-/Biome-System, nicht aus dem
  Dungeon-Forge.
- **Prozedurale Generierung ist der Default** für Items, Umgebung und Dungeons
  (Owner-Entscheid); glTF-Import ist ein optionaler späterer Pfad, kein Ersatz.

---

## 7) Implikation für die Eingangs-Animation (Owner-Feedback: „sieht kacke aus")

Die **Portal-Übergangs-Animation** (Exterior → Dungeon) muss **kontextabhängig** sein:
- Palast: große Flügeltür.
- Taverne: Holztür.
- Höhle: Felsöffnung / Dunkelheit.
- Wald-Labyrinth: Hecke/Baum-Durchgang.

→ Das Portal-Asset und die Übergangs-Animation werden **aus dem Dungeon-Typ** abgeleitet
(kein einheitlicher generischer Übergang). Dies ist ein separater Folge-Task, nicht Teil
von SCM.

---

## 8) Verbindliche Begriffe (Do / Don't)

| Verwenden | Nicht mehr verwenden |
|---|---|
| `freeland` | ~~FLOWING~~ |
| Dungeon (Oberbegriff für betretbaren Room-Komplex) | ~~Interior~~ als Oberbegriff, ~~Kerker-only~~ |
| Room (einzelner Raum im Dungeon) | ~~Interior~~ für Einzelraum |
| Building (Hülle; betretbar → Dungeon) | — |
| Portal (Verbindung Exterior↔Dungeon, Room↔Room) | — |
| Exterior (Außenwelt, kontinuierliches Gelände) | — |

---

## Siehe auch
- `.qa/design/sws-containment-model.md` — SCM-Invarianten (INV-1..6), Propagation, Dialoge.
- `docs/concepts/imagination-first-visualization-contract.md` — IV-Gates für Visualisierung.
- `docs/concepts/conductor-experience-contract.md` — CE-Gates (Live/Performance).
