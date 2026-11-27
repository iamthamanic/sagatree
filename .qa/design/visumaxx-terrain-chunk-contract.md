# Visumaxx Terrain-Chunk-Vertrag (`sagatree-world-terrain-chunks-v1`)

- **Status:** Verbindlich für Shared Chunked World Terrain (Phase 1, 2026-11-26)
- **Domain-Quelle:** `src/domains/world/atlas/atlas-world-terrain-chunks.ts`
- **Renderer-Konsument:** `src/infrastructure/world/atlas-three/atlas-three-world-terrain.ts`
- **Bridge-Zugang:** `window.__sagatreeAtlas.getState().terrain`

---

## 1. Grundprinzip: EINE Welt, EIN Boden

Die gesamte Welt (`[0..1000] × [0..1000]` Welt-Koordinaten) besitzt **genau ein**
autoritäres Welt-Heightfield (`rootDoc.heightfield`, `waterLevel = 0`).

- **Landmassen / Kontinente** = Zellen mit `h >= waterLevel`
- **Ozean-Boden** = Zellen mit `h < waterLevel` im **selben** Raster
- **Küstenlinie** = physikalischer Nulldurchgang `h = waterLevel` (kein separates Land-Polygon-System)
- **Länder & Orte** = Overlays (politische Grenzen, Straßen, Flüsse, Plätze, Gebäude, Marker) auf diesem einen Boden — niemals eigene gestapelte Landmassen-Inseln.
- **Lokale Detail-Reliefs** (z. B. Dornhain-Hügel) werden als weich gefeatherte `AtlasWorldHeightfieldOverlay`s in `sampleWorldHeight(...)` eingemischt.

---

## 2. Quadtree-Chunk-Layout & LOD-Stufen

| `lodLevel` | Gitter (`2^lod × 2^lod`) | Kachelgröße (Welt-Einheiten) | Logische Zellen | Typische Skala |
|---:|---:|---:|---:|---|
| `0` | `1 × 1` | `1000.0` | `64 × 64` | Planet / Keep-Coarse-Basis (immer vorhanden) |
| `1` | `2 × 2` | `500.0` | `64 × 64` | Kontinent |
| `2` | `4 × 4` | `250.0` | `64 × 64` | Land / Region |
| `3` | `8 × 8` | `125.0` | `64 × 64` | Provinz / Tal |
| `4` | `16 × 16` | `62.5` | `64 × 64` | Umland / Siedlungsgürtel |
| `5` | `32 × 32` | `31.25` | `64 × 64` | Ort / Straße (Dornhain) |

### Deterministische Chunk-ID

```text
L<lodLevel>:<gridX>:<gridZ>   (z. B. "L0:0:0", "L2:1:2", "L5:7:13")
```

### `AtlasTerrainChunkDescriptor` (Visumaxx-GPU-Culling-Vertrag)

```ts
type AtlasTerrainChunkDescriptor = {
  readonly chunkId: string;
  readonly lodLevel: number;
  readonly gridX: number;
  readonly gridZ: number;
  readonly resolution: number;     // aktuelle Triangulierung (z. B. 16 / 32)
  readonly logicalCells: number;   // 64 (kanonische Kachel-Größe)
  readonly boundsWorld: { minX: number; minZ: number; maxX: number; maxZ: number };
  readonly minY: number;           // konservative vertikale AABB für GPU-Frustum-Culling
  readonly maxY: number;
  readonly centerX: number;
  readonly centerZ: number;
  readonly worldSize: number;
  readonly isCoarseBase: boolean;  // Keep-Coarse-Basis (nie durch Marker ersetzt)
  readonly distanceToFocus: number;
  readonly screenSizePx: number;
};
```

---

## 3. Nahtfreiheit, Speicher & Visumaxx-Anschluss

1. **Kein monolithisches RAM-Array:** Chunks werden erst on-demand über `sampleWorldChunkHeightGrid(source, descriptor)` innerhalb des gepolsterten Frustums (`frustumPadRatio = 0.45`) erzeugt und beim Verlassen sauber disposed (`liveGeometryCount → 0` beim Teardown).
2. **Rissfreie LOD-Übergänge:** Jede Chunk-Kachel trägt einen abwärts gefalteten Rand-Skirt (`-1.2` Welt-Einheiten), sodass grobe und feine Nachbar-Chunks ohne T-Junction-Spalten aneinanderliegen.
3. **Keep-Coarse-Garantie:** `L0:0:0` bleibt als grobe Basis immer aktiv (tiefere LOD-Kacheln heben sich um winziges LOD-Offset `+0.03 * lodLevel` ohne Z-Fighting ab).
4. **Visumaxx-GPU-Drop-In:** Ein künftiger Visumaxx-Renderer liest exakt dieselben `AtlasTerrainChunkDescriptor`-Objekte aus `planWorldTerrainChunks(...)` (bzw. `getState().terrain.chunks`), bindet je Chunk `boundsWorld` + `[minY, maxY]` in den GPU-Frustum-Culler und lädt dieselben `sampleWorldChunkHeightGrid`-Kacheln als Height-Textur / Storage-Buffer.
