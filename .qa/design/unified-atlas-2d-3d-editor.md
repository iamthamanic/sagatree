# Design — SagaTree Unified Atlas 2D/3D Editor

**Status:** In progress (hybrid path landed; nested DB LOD + full transform gizmos remaining)  
**Date:** 2026-10-17  
**Branch:** `feat/unified-atlas-2d-3d-editor`  
**Related:** `.qa/research/unified-atlas-implementation-vs-prototype.md`, `.qa/research/unified-atlas-renderer-comparison.md`, `#702`

---

## 1. Ausgangszustand (validiert gegen Code)

| Komponente | Pfad | Stand |
|------------|------|-------|
| Workbench | `src/app/world/atlas/WorldAtlasWorkbench.tsx` | Dual Library/Saga |
| Editor | `src/app/world/atlas/unified/UnifiedAtlasEditor.tsx` | Canvas2D multi-scale |
| Doc | `src/domains/world/atlas/unified-canvas-doc.ts` | `sagatree-unified-atlas-v1` |
| Camera | `src/domains/world/map/atlas-camera.ts` | Cursor-anchored zoom |
| Persistenz | `world_atlas_maps.generator_meta.unifiedCanvas` | RPC + revision |
| Three.js on atlas | — | **fehlte** (nur Avatar/LiveAct) |
| Dungeon procgen | — | **fehlte** |
| Fokusmodus | — | **fehlte** |

Audit-Empfehlung „2D + optional 3D Viewer“ war **nicht** verbindlich. Produktziel verlangt **editierbare** 2D- und 3D-Ansichten desselben Objekts.

---

## 2. Getestete Renderer-Architekturen

Siehe `.qa/research/unified-atlas-renderer-comparison.md`.

| Variante | Ergebnis |
|----------|----------|
| A Hybrid Canvas2D + Three | 10/10 Schritte PASS, bidirektional PASS |
| B Unified Three | 10/10 Schritte PASS, bidirektional PASS |

**Entscheidung: Hybrid (A).**

---

## 3. Tatsächliche Messergebnisse

| | A | B |
|--|---|---|
| Frame median ms | 76.5 | 78.2 |
| Frame p95 ms | 82.6 | 82.1 |
| Heap MB | 14.3 | 15.2 |

Umgebung: darwin arm64, HeadlessChrome 156, 1440×900. Rohdaten: `.qa/evidence/unified-atlas-renderer-poc/results.json`.

---

## 4. Architekturentscheidung

```text
UnifiedCanvasDoc (domain)
        │
        ├─ Canvas2D viewport  → brushes, LOD art, top-down edit
        └─ AtlasSpatialViewport (Three.js) → extruded geometry, raycast move
```

- Ein Objekt = eine ID in `objects` / `rooms` / `walls` (optional `z`, `height`).  
- Edits nur über `applyMapEdit` (`map-edit-ops.ts`).  
- Kein zweiter paralleler 3D-Editor und kein Viewer-only.

---

## 5. Implementierte Funktionen (nachgewiesen)

### Domain

- `map-edit-ops.ts` — move/transform/add/remove rooms/walls/objects  
- `dungeon-generator.ts` — Dungeon-Forge-Pipeline (scatter→MST→export), MIT attribution  
- Object fields `z` / `height` in parse/serialize (v1-kompatibel)

### App

- `AtlasSpatialViewport.tsx` — editierbare 3D-Ansicht, schreibt ins Doc  
- `UnifiedAtlasEditor` — Umschalter **Draufsicht / 3D-Ansicht**, Object-Drag in 2D (Select), Dungeon-Generator UI (Vorschau → Bestätigen), Missing-Detail Placeholder (IV)  
- `WorldAtlasWorkbench` — **Fokusmodus** (Meta-Panels weg, Stage ≥70vh), Label „Gespeicherte Karten“ vs Demo

### Checks

- `scripts/world-atlas-editor-check.mjs` erweitert  
- `scripts/unified-atlas-dungeon-check.mjs` (esbuild + determinism)  
- `scripts/unified-atlas-renderer-poc-check.mjs` (Playwright Messungen)  
- `test-gate` ruft dungeon-check über world-atlas-check auf

### Third-party

- `third_party/dungeon-forge/LICENSE` + `THIRD_PARTY_DUNGEON_FORGE.md`

---

## 6. Gemeinsames Kartenmodell

Bestehende Typen wiederverwendet / erweitert:

| Konzept | SagaTree Typ |
|---------|--------------|
| World map row | `WorldAtlasMapVm` |
| Editable scene | `UnifiedCanvasDoc` |
| MapObject | `UnifiedCanvasObject` (+ `z`, `height`) |
| MapGeometry rooms/walls | `UnifiedCanvasRoom` / `UnifiedCanvasWall` |
| MapEditOperation | `MapEditOperation` |
| MapCamera (2D) | `AtlasCamera` |
| Generator | `DungeonGenerateResult` + meta helpers |

Keine parallele „MapNode“-Doppelwelt — Hierarchie bleibt `world_atlas_maps.parent_map_id` + Demo-Rects.

---

## 7. Dungeon-Integration

1. GM öffnet Generator im Inspector.  
2. Seed + Raumzahl → `generateDungeon` (validiert Connectivity).  
3. **Bestätigen** hängt rooms/walls/objects an Doc an (nicht stillschweigend).  
4. Danach 2D/3D editierbar; Speichern über bestehendes `saveCanvas`.  
5. Regeneration überschreibt nicht ohne Confirm; manuelle Edits bleiben beim Append.

**Noch geplant:** `generator_meta.dungeon` Persistenz-Flag `manualDirty`, Re-gen Guard UI.

---

## 8. UX-Verbesserungen

| Item | Status |
|------|--------|
| Fokusmodus | **done** |
| Größerer Viewport (`min-h-[min(70vh,40rem)]`) | **done** |
| Draufsicht / 3D Toggle | **done** |
| Kontext-Inspector-Titel | **partial** |
| Missing detail IV copy | **done** (Innenraum ohne rooms) |
| DB vs Demo Hierarchie Label | **done** |
| Mobile Sheets | bestehend; Fokus hilft |

---

## 9. Screenshots

| Shot | Path |
|------|------|
| PoC A | `.qa/evidence/unified-atlas-renderer-poc/screenshots/poc-a-hybrid-1440.png` |
| PoC B | `.qa/evidence/unified-atlas-renderer-poc/screenshots/poc-b-unified-1440.png` |
| Prior product audit | `.qa/evidence/unified-atlas-vs-prototype/screenshots/*` |

Product E2E screenshots (Test E) — **noch ausstehend** gegen laufende App-Session.

---

## 10. Testresultate

| Gate | Result |
|------|--------|
| `npm run typecheck` | PASS (nach Fix delaunay types) |
| `world-atlas-editor-check` | PASS |
| `unified-atlas-dungeon-check` | PASS (runtime via esbuild) |
| Renderer PoC A/B | PASS (results.json) |
| Full `npm run test-gate` | run before merge |

Acceptance scenarios A–F: domain/PoC cover A/C logic; product E2E B/D/E/F remain for browser session against self-host.

---

## 11. Bekannte Einschränkungen

1. Demo Eldoria LOD noch nicht an persistierte Child-Maps gebunden.  
2. 3D-Gizmos nur Translate (kein Rotate/Scale-Gizmo).  
3. Texture brushes in 3D nicht gezeichnet (Hybrid: Pinseln in Draufsicht).  
4. Dungeon export is room-rects + wall edges, not full tile grid/carve from upstream showcase.  
5. Library empty-world journey still environment-dependent.  
6. Player-view secret overlay regression not re-run in this branch.

---

## 12. Weitere Ausbaustufen

1. Wire `parent_map_id` bounds into camera LOD with hysteresis.  
2. Persist dungeon generator meta + `manualDirty` regen guard.  
3. Transform gizmos + duplicate.  
4. Asset library for 2D stamps ↔ 3D meshes.  
5. Performance suite city/dungeon 80 rooms in product chrome.  
6. Optional later: migrate paint layers to GPU if Hybrid bottlenecks appear (re-measure first).

---

## Gates

- **IV-04 / IV-10:** missing detail copy, demo badge retained  
- **AU-CONTENT-WIDTH / AU-TOUCH:** focus mode + min 44px controls  
- **CE:** N/A for setup atlas workstation (not live performance mode)

DaisyUI / Next.js personal rules do **not** apply — SagaTree Vite/React/Radix/#94.
