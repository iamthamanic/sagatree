# SWS — Breaking-Change-Matrix & Datenmigrationsstrategie

- **Status:** Planungsartefakt zu ADR-SWS-01. ✅ verifiziert · 🧩 Schlussfolgerung · 🔴 offene Entscheidung · ⚠️ Risiko

---

## 1. Breaking-Change-Matrix

| Bereich | Art der Änderung | Bricht Bestand? | Migration nötig? | Risiko |
|---|---|:-:|:-:|:-:|
| `world_atlas_maps`-Schema | **erweitert** (keine Spalte entfernt) | nein | nein (additive Migration) | niedrig |
| `ParentSpatialAnchor` | **erweitert** um optionale Felder (z. B. Höhe, Ownership) | nein (optional, abwärtskompatibel) | nein (Defaults) | niedrig |
| Scherungs-Regel (`rotation≠0` ⇒ uniform extent) | **Validierung verschärft** | ⚠️ nur falls rotierte nicht-uniforme Anchors existieren | 🔴 Bestandsdaten prüfen | mittel |
| `parent_map_id`-Zyklus | **Schreib-Guard neu** (lehnt Zyklen ab) | ⚠️ nur falls Zyklen persistiert wurden | Bereinigung falls vorhanden | mittel |
| `generator_meta.mapFrame` | **erweitert** (Rekursion ableitbar) | nein | nein (Weltkoordinate abgeleitet, nicht persistiert) | niedrig |
| Geometry Ownership | **neues Konzept** + Golden-Konflikt-Auflösung | ⚠️ **Golden-Geometrie ändert sich sichtbar** | **ja, manuell** (Gewinner-Quelle pro Struktur) | **hoch** |
| Renderer: Single-Doc → Multi-Map | **intern**, API-Vertrag (`upsertMap`/`getMap`) bleibt | nein (Persistenz unverändert) | nein | mittel (Laufzeit) |
| `activeMapId`-Semantik | **Bedeutungsänderung** (Editor-Kontext, nicht Render-Auswahl) | ⚠️ interne Konsumenten | nein (Daten) | mittel |
| LOD: Breadcrumb → SSE | **intern** | nein | nein | niedrig |
| Undo/Redo 3D | **neu verdrahtet** | nein (Feature-Addition) | nein | niedrig |
| Trackpad-Input | **neu** | nein | nein | niedrig |
| Legacy `world_maps`-Tabelle | **unverändert** (getrennter Pfad) | nein | nein | niedrig |
| `AtlasPortalTransitionOverlay` | **deprecated** für räumliche Übergänge | nein (bleibt für echte Portale) | nein | niedrig |

---

## 2. Datenmigrationsstrategie

### 2.1 Unverändert bleibt ✅

- `world_atlas_maps` Zeilen, `id`, `parent_map_id`, `kind`, `title`, `sort_order`, `revision`.
- `bounds` (lokale 0…1000-Systeme bleiben).
- `layers` (GeoJSON), `basemap/azgaar`-Pfade.
- `UnifiedCanvasDoc`-Wire-Format (`sagatree-unified-atlas-v1`) — Persistenz unverändert.
- `world_places` / `world_place_map_links`.
- API-Verträge `getMap` / `upsertMap` (inkl. `expectedRevision`-Optimistic-Concurrency).

### 2.2 Erweitert wird (additiv, abwärtskompatibel) ✅

- `ParentSpatialAnchor`: optionale `elevationBase` / `metersPerUnitZ` (🔴 D2), optional `geometryOwnerHint`.
- `generator_meta`: optional `worldSpace`-Metadaten (Kalibrierung, Ownership-Version).
- **Keine** neuen Pflicht-Felder ohne Default.

### 2.3 Transformiert werden muss ⚠️

- **Bestands-Anchors mit `rotationRad≠0` UND `extentX≠extentY`:** auf uniforme Extents normalisieren oder Rotation auf 0
  setzen — 🔴 **Bestandsdaten-Audit** nötig (Golden hat keine solchen; produktive Nutzerdaten unbekannt).
- **Persistierte Hierarchie-Zyklen** (falls vorhanden): detektieren + manuell auflösen vor Schreib-Guard-Aktivierung.

### 2.4 Manuelle Entscheidung erforderlich (nicht automatisierbar) ⚠️

- **Golden-Geometrie-Konflikte (R1):** pro Struktur die **Gewinner-Quelle** bestimmen.
  Beispiel: Westmark-Küste — Kontinent-Polygon oder Nordreich-Rechteck? Owner entscheidet; die andere Ebene wird **abgeleitet**.
- **Kalibrierung (D4):** Golden-Welt `metersPerUnit` global setzen oder bewusst abstrakt lassen.

### 2.5 Konflikt-Auflösung (automatisch vs. manuell)

| Konflikt | Auflösung |
|---|---|
| Zwei Ebenen zeichnen dieselbe Küste | **manuell** (Gewinner), dann derive |
| Überlappende Kind-Anchors | ✅ detektierbar (`parentAnchorsOverlapAabb`); **manuell** verorten |
| Zyklus in `parent_map_id` | ✅ detektierbar (Walk); **manuell** auflösen |
| Fehlender Anchor (unverortet) | ✅ honest fallback (`UNLOCATED_MAP_HINT_DE`), kein erfundener Drill |

### 2.6 Datenintegritäts-Prüfung

- Neuer Self-Test `sws-spatial-integrity.self-test.mjs`: prüft über alle Maps einer Welt —
  keine Zyklen, alle Anchors valide (`assertParentSpatialAnchor`), keine Scherungs-Verletzung, Ownership-Vollständigkeit.
- Golden-Fingerprints (`dornhain-golden-hierarchy`) ändern sich **deliberat** bei Geometrie-Migration → mit
  `atl3-v01-visual-contract`-Oracle abgleichen.

### 2.7 Rollback

- Da Persistenz **unverändert** bleibt (Weltkoordinate abgeleitet), ist Rollback = **Renderer-Feature-Flag zurücksetzen**.
- Geometry-Migration (2.4) erzeugt **Backup** via bestehendem `atlasMapDocBackup`-Meta-Key (✅ `atlas-map-doc-adapter.ts`).
- 🔴 Feature-Flag `ATLAS_SHARED_WORLD_SPACE` (Domain-Lock analog `atlasR01bAllowsFollowOnRendererWork`).

### 2.8 Exit-Kriterien für Legacy-Entfernung

| Legacy | Exit-Kriterium |
|---|---|
| Single-Active-Doc-Rendering | Multi-Map-Pfad erreicht Funktionsparität + Perf-Budget auf Zielhardware |
| `AtlasPortalTransitionOverlay` für räumliche Übergänge | Continuous LOD nachgewiesen ohne Positionssprung (Vertical Slice) |
| Breadcrumb-getriebene LOD | SSE-getriebene LOD stabil (Hysterese, kein Flackern) |
| Getrennter 2D-Kamerazustand | Unified Camera State mit nachgewiesener 2D-Parität (🔴 D7) |

🧩 **Kein** dauerhafter Parallelbetrieb: jeder Kompatibilitätsmechanismus hat ein messbares Exit-Kriterium + Flag.

---

## 3. Migration-Risiko-Ampel

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|:-:|:-:|---|
| Golden-Geometrie sichtbar anders | hoch | mittel | Owner-Review + Visual-Oracle + Backup |
| Scherung bei Bestandsdaten | ❓ unbekannt | mittel | Audit vor Validierungs-Verschärfung |
| Multi-Map-Performance-Einbruch | mittel | hoch | Budgets + Culling + inkrementeller Rollout hinter Flag |
| Undo/Redo-Inkonsistenz 3D | mittel | mittel | Verdrahtung vor Vertical-Slice-Abnahme |
| Bestands-User-Welten unkalibriert | hoch | niedrig | abstrakte Einheiten bleiben zulässig (kein Zwang zu m/km) |
