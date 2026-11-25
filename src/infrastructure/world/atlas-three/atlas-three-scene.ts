/**
 * atlas-three-scene — Productive Three.js scene builder (ATL3 R02/G01/D01/I01).
 * Location: src/infrastructure/world/atlas-three/atlas-three-scene.ts
 *
 * Builds canonical meshes (1:1 ID parity with `UnifiedCanvasDoc` via
 * `buildAtlasProductGeometryPlan`), smooth biome-blended heightfield terrain,
 * multi-variant procedural buildings (3 roof shapes × 3 materials + cutaway),
 * multi-silhouette trees/mountains, instanced door frames, and deterministic
 * suggestive scenery scatter (`buildAtlasSceneScatter`) via `InstancedMesh`.
 */
import * as THREE from 'three';
import {
  ATLAS_HEIGHTFIELD_FORMAT,
  ATLAS_HEIGHTFIELD_VERSION,
  buildAtlasProductGeometryPlan,
  buildAtlasSceneScatter,
  pointInPolygon,
  sampleHeightfield,
  type AtlasGraphicsPresetId,
  type AtlasHeightfield,
  type AtlasMapScale,
  type AtlasProductGeometryPrimitive,
  type AtlasScatterKind,
  type UnifiedCanvasDoc,
} from '../../../domains/world/atlas';
import type { AtlasPbrKind } from './pbr-textures';

export type AtlasThreeLook = 'outdoor' | 'indoor';

export type AtlasThreeSurfaceSpec = {
  readonly pbr: AtlasPbrKind | null;
  readonly color: string;
  readonly roughness: number;
  readonly normalScale: number;
  readonly tile: number;
  readonly emissive?: string;
  readonly metalness?: number;
  readonly vertexColors?: boolean;
};

export const ATLAS_THREE_SURFACES = {
  terrain: {
    pbr: 'grass',
    color: '#ffffff',
    roughness: 0.94,
    normalScale: 0.72,
    tile: 74,
    vertexColors: true,
  },
  'sheet-outdoor': { pbr: 'grass', color: '#bdd0a8', roughness: 0.96, normalScale: 0.52, tile: 74 },
  'sheet-indoor': { pbr: 'rock', color: '#465056', roughness: 0.95, normalScale: 0.7, tile: 54 },
  'floor-cobble': { pbr: 'cobble', color: '#d8cfb8', roughness: 0.88, normalScale: 0.7, tile: 34 },
  'floor-stone': { pbr: 'cobble', color: '#a8a69d', roughness: 0.9, normalScale: 0.75, tile: 28 },
  'floor-wood': { pbr: 'wood', color: '#d5aa7e', roughness: 0.84, normalScale: 0.56, tile: 28 },
  'floor-dirt': { pbr: 'dirt', color: '#c8b28d', roughness: 0.96, normalScale: 0.58, tile: 42 },
  'floor-sand': { pbr: 'sand', color: '#e4d5af', roughness: 0.9, normalScale: 0.54, tile: 46 },
  'floor-grass': { pbr: 'grass', color: '#d7e2c2', roughness: 0.95, normalScale: 0.65, tile: 62 },
  'floor-moss': { pbr: 'moss', color: '#9fc29b', roughness: 0.94, normalScale: 0.6, tile: 42 },
  wall: { pbr: 'wall', color: '#ded7c2', roughness: 0.92, normalScale: 0.62, tile: 26 },
  'wall-indoor': { pbr: 'wall', color: '#b6b09f', roughness: 0.94, normalScale: 0.7, tile: 22 },
  plaster: { pbr: 'plaster', color: '#f2e3c7', roughness: 0.95, normalScale: 0.36, tile: 22 },
  'roof-tile': { pbr: 'roofTile', color: '#f2c4ae', roughness: 0.84, normalScale: 0.82, tile: 18 },
  'roof-slate': { pbr: 'roofSlate', color: '#b4c2cf', roughness: 0.76, normalScale: 0.78, tile: 18 },
  'roof-moss': { pbr: 'roofMoss', color: '#bed0a8', roughness: 0.88, normalScale: 0.8, tile: 18 },
  wood: { pbr: 'wood', color: '#d3a77b', roughness: 0.84, normalScale: 0.56, tile: 16 },
  'wood-dark': { pbr: 'wood', color: '#8a6648', roughness: 0.86, normalScale: 0.6, tile: 14 },
  'bark-birch': { pbr: 'plaster', color: '#dfd8c8', roughness: 0.86, normalScale: 0.4, tile: 14 },
  rock: { pbr: 'rock', color: '#b4bcb0', roughness: 0.92, normalScale: 0.82, tile: 32 },
  snow: { pbr: 'snow', color: '#eef4f8', roughness: 0.76, normalScale: 0.35, tile: 36 },
  leaf: { pbr: 'moss', color: '#7eb276', roughness: 0.92, normalScale: 0.55, tile: 18 },
  'leaf-birch': { pbr: 'moss', color: '#a1c97b', roughness: 0.9, normalScale: 0.5, tile: 18 },
  'leaf-pine': { pbr: 'moss', color: '#4f866a', roughness: 0.94, normalScale: 0.58, tile: 18 },
  flower: { pbr: null, color: '#e8c468', roughness: 0.85, normalScale: 0, tile: 1 },
  window: { pbr: null, color: '#2b3e4f', roughness: 0.22, normalScale: 0, tile: 1, metalness: 0.18 },
  'window-warm': {
    pbr: null,
    color: '#ffcf7d',
    roughness: 0.4,
    normalScale: 0,
    tile: 1,
    emissive: '#ffb658',
  },
  flame: { pbr: null, color: '#ffb961', roughness: 1, normalScale: 0, tile: 1, emissive: '#ffa64c' },
} as const satisfies Record<string, AtlasThreeSurfaceSpec>;

export type AtlasThreeSurfaceKey = keyof typeof ATLAS_THREE_SURFACES;

export function atlasThreeFloorSurface(
  material: string | undefined,
  scale: AtlasMapScale,
): AtlasThreeSurfaceKey | 'water' {
  const m = (material ?? '').toLowerCase();
  if (m === 'wasser' || m === 'water') return 'water';
  if (m === 'holz' || m === 'wood') return 'floor-wood';
  if (m === 'pflaster' || m === 'paving') return 'floor-cobble';
  if (m === 'stein' || m === 'stone') return scale === 'interior' ? 'floor-stone' : 'rock';
  if (m === 'erde' || m === 'earth') return 'floor-dirt';
  if (m === 'sand') return 'floor-sand';
  if (m === 'moos' || m === 'moss') return 'floor-moss';
  if (m === 'schnee' || m === 'snow') return 'snow';
  return 'floor-grass';
}

export class AtlasThreeGeoBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly triIds: string[] = [];

  constructor(private readonly tile: number) {}

  get triangleCount(): number {
    return this.triIds.length;
  }

  tri(
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    id: string,
    normal?: THREE.Vector3,
  ): void {
    const n =
      normal ??
      new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    for (const p of [a, b, c]) {
      this.positions.push(p.x, p.y, p.z);
      this.normals.push(n.x, n.y, n.z);
      if (ay >= ax && ay >= az) this.uvs.push(p.x / this.tile, p.z / this.tile);
      else if (az >= ax) this.uvs.push(p.x / this.tile, p.y / this.tile);
      else this.uvs.push(p.z / this.tile, p.y / this.tile);
    }
    this.triIds.push(id);
  }

  geometry(source: THREE.BufferGeometry, matrix: THREE.Matrix4, id: string): void {
    const g = source.index ? source.toNonIndexed() : source.clone();
    g.applyMatrix4(matrix);
    const pos = g.getAttribute('position');
    for (let i = 0; i + 2 < pos.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, i);
      const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
      this.tri(a, b, c, id);
    }
    g.dispose();
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.computeBoundingSphere();
    return g;
  }
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

function composeMatrix(
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number,
  rotY = 0,
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(cx, cy, cz),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(Math.max(1e-3, sx), Math.max(1e-3, sy), Math.max(1e-3, sz)),
  );
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type AtlasThreeScatterBatch = {
  readonly kind: AtlasScatterKind;
  readonly matrices: readonly THREE.Matrix4[];
};

export type AtlasThreeScenePlan = {
  readonly builders: Map<AtlasThreeSurfaceKey, AtlasThreeGeoBuilder>;
  readonly water: AtlasThreeGeoBuilder;
  readonly terrain: THREE.BufferGeometry | null;
  readonly doorInstances: { readonly matrices: THREE.Matrix4[]; readonly ids: string[] };
  readonly scatterBatches: readonly AtlasThreeScatterBatch[];
  readonly torches: readonly {
    readonly id: string;
    readonly position: THREE.Vector3;
    readonly radius: number;
  }[];
  readonly ids: ReadonlySet<string>;
  readonly look: AtlasThreeLook;
  readonly mapScale: AtlasMapScale;
};

/** Smooth elevation + slope-based vertex colors for lush fantasy terrain. */
function terrainColorAt(height: number, waterLevel: number, slope: number): THREE.Color {
  const c = new THREE.Color();
  if (height < waterLevel - 0.6) {
    const depthT = Math.min(1, (waterLevel - 0.6 - height) / 7);
    c.set('#2b6972').lerp(new THREE.Color('#1a4452'), depthT);
    return c;
  }
  if (height < waterLevel + 1.8) {
    const t = Math.max(0, Math.min(1, (height - (waterLevel - 0.6)) / 2.4));
    c.set('#5a928a').lerp(new THREE.Color('#decfa4'), t);
    return c;
  }
  if (height < 13) {
    const t = Math.max(0, Math.min(1, (height - (waterLevel + 1.8)) / 11.2));
    c.set('#7ea85f').lerp(new THREE.Color('#4a7b4c'), t);
    if (slope > 0.28) {
      c.lerp(new THREE.Color('#8d9387'), Math.min(0.82, (slope - 0.28) * 2.1));
    }
    return c;
  }
  if (height < 25) {
    const t = Math.max(0, Math.min(1, (height - 13) / 12));
    c.set('#6d7c63').lerp(new THREE.Color('#959d94'), t);
    if (slope > 0.35) {
      c.lerp(new THREE.Color('#7f8580'), Math.min(0.75, (slope - 0.35) * 1.8));
    }
    return c;
  }
  const snowT = Math.max(0, Math.min(1, (height - 25) / 14));
  c.set('#9ba49d').lerp(new THREE.Color('#f3f7fa'), snowT);
  return c;
}

function hash2D(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise2D(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2D(ix, iz, seed);
  const b = hash2D(ix + 1, iz, seed);
  const c = hash2D(ix, iz + 1, seed);
  const d = hash2D(ix + 1, iz + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm2D(x: number, z: number, seed: number): number {
  let sum = 0;
  let amp = 0.52;
  let freq = 1;
  for (let i = 0; i < 4; i += 1) {
    sum += valueNoise2D(x * freq, z * freq, seed + i * 31) * amp;
    freq *= 2.05;
    amp *= 0.48;
  }
  return sum;
}

function distPointToSeg(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 <= 1e-6) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/**
 * Deterministic suggestive 3D fantasy terrain synthesizer for outdoor maps
 * without a stored canonical heightfield (e.g. Weltkarte, Kontinent Westmark,
 * Nordreich). Preserves 100% of canonical land/water/mountain/river geography
 * while sculpting organic coastlines, hills, mountain ranges, and river valleys.
 */
function synthesizeWorldReliefHeightfield(
  doc: UnifiedCanvasDoc,
  seedStr: string,
): AtlasHeightfield | null {
  const landRooms = doc.rooms.filter(
    (r) => r.id !== 'w.ocean' && r.id !== 'g.ocean' && r.material !== 'wasser',
  );
  if (landRooms.length === 0) return null;

  const lakeRooms = doc.rooms.filter(
    (r) => r.id !== 'w.ocean' && r.id !== 'g.ocean' && r.material === 'wasser',
  );
  const riverStrokes = doc.strokes.filter((s) => s.material === 'wasser');
  const ridgeStrokes = doc.strokes.filter((s) => s.material === 'stein');
  const buildings = doc.objects.filter((o) => o.type === 'haus' || o.type === 'turm');

  const toPoly = (r: UnifiedCanvasDoc['rooms'][number]): readonly (readonly [number, number])[] =>
    r.points && r.points.length >= 3
      ? r.points
      : [
          [r.x, r.y],
          [r.x + r.w, r.y],
          [r.x + r.w, r.y + r.h],
          [r.x, r.y + r.h],
        ];

  const landPolys = landRooms.map((r) => ({
    material: r.material,
    pts: toPoly(r),
  }));
  const lakePolys = lakeRooms.map((r) => toPoly(r));

  const seed = hashId(seedStr);
  const cols = 81;
  const rows = 81;
  const cellSize = 1000 / (cols - 1);
  const rawH = new Float32Array(cols * rows);

  for (let r = 0; r < rows; r += 1) {
    const z = r * cellSize;
    for (let c = 0; c < cols; c += 1) {
      const x = c * cellSize;
      // Subtle organic coastline warp so straight polygon edges read as natural bays & capes.
      const wx = x + (fbm2D(x * 0.0085, z * 0.0085, seed + 17) - 0.5) * 34;
      const wz = z + (fbm2D(x * 0.0085 + 19, z * 0.0085 + 11, seed + 53) - 0.5) * 34;

      let mat: string | null = null;
      for (const lp of landPolys) {
        if (pointInPolygon(wx, wz, lp.pts)) {
          mat = lp.material;
        }
      }
      const inLake = lakePolys.some((lp) => pointInPolygon(wx, wz, lp));
      const idx = r * cols + c;
      if (!mat || inLake) {
        rawH[idx] = inLake ? -3.4 : -7.5;
        continue;
      }
      const n = fbm2D(x * 0.011, z * 0.011, seed);
      const ridge = 1 - Math.abs(fbm2D(x * 0.017 + 7, z * 0.017 - 5, seed + 99) * 2 - 1);
      if (mat === 'sand') {
        rawH[idx] = 1.9 + n * 3.8;
      } else if (mat === 'stein') {
        rawH[idx] = 20 + n * 16 + ridge * ridge * 24;
      } else if (mat === 'erde') {
        rawH[idx] = 10.5 + n * 13 + ridge * 6;
      } else if (mat === 'holz') {
        rawH[idx] = 7.5 + n * 9;
      } else if (mat === 'pflaster') {
        rawH[idx] = 5.2 + n * 1.2;
      } else {
        rawH[idx] = 4.8 + n * 9.5 + ridge * 3.2;
      }
    }
  }

  // Smooth coastline shelves & biome transitions (2 quick box-filter passes).
  const smooth = new Float32Array(rawH);
  const tmp = new Float32Array(rawH.length);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        let acc = 0;
        let weight = 0;
        for (let dr = -1; dr <= 1; dr += 1) {
          const rr = Math.max(0, Math.min(rows - 1, r + dr));
          for (let dc = -1; dc <= 1; dc += 1) {
            const cc = Math.max(0, Math.min(cols - 1, c + dc));
            const w = dr === 0 && dc === 0 ? 4 : dr === 0 || dc === 0 ? 2 : 1;
            acc += smooth[rr * cols + cc]! * w;
            weight += w;
          }
        }
        tmp[r * cols + c] = acc / weight;
      }
    }
    smooth.set(tmp);
  }

  // Apply mountain ridges, carved river valleys, and flat settlement plateaus.
  const heights: number[] = new Array(cols * rows);
  for (let r = 0; r < rows; r += 1) {
    const z = r * cellSize;
    for (let c = 0; c < cols; c += 1) {
      const x = c * cellSize;
      const idx = r * cols + c;
      let h = smooth[idx]!;

      for (const rs of ridgeStrokes) {
        let bestD = Infinity;
        for (let i = 0; i + 1 < rs.points.length; i += 1) {
          const a = rs.points[i]!;
          const b = rs.points[i + 1]!;
          bestD = Math.min(bestD, distPointToSeg(x, z, a[0], a[1], b[0], b[1]));
        }
        const spanR = Math.max(42, rs.width * 3.8);
        if (bestD < spanR) {
          const t = 1 - bestD / spanR;
          const peakNoise = 0.72 + fbm2D(x * 0.025, z * 0.025, seed + 211) * 0.6;
          h = Math.max(h, h + t * t * 30 * peakNoise);
        }
      }

      for (const rv of riverStrokes) {
        let bestD = Infinity;
        for (let i = 0; i + 1 < rv.points.length; i += 1) {
          const a = rv.points[i]!;
          const b = rv.points[i + 1]!;
          bestD = Math.min(bestD, distPointToSeg(x, z, a[0], a[1], b[0], b[1]));
        }
        const riverW = Math.max(12, rv.width * 1.45);
        if (bestD < riverW * 2.2) {
          const t = Math.max(0, 1 - bestD / (riverW * 2.2));
          h = h * (1 - t * t) + -2.2 * (t * t);
        }
      }

      for (const b of buildings) {
        const d = Math.hypot(x - b.x, z - b.y);
        const flatR = Math.max(26, b.size * 54);
        if (d < flatR && h > 1.2) {
          const t = 1 - d / flatR;
          const target = Math.min(11, Math.max(4.5, h * 0.75));
          h = h * (1 - t * 0.55) + target * (t * 0.55);
        }
      }

      heights[idx] = Math.round(h * 10) / 10;
    }
  }

  return {
    format: ATLAS_HEIGHTFIELD_FORMAT,
    version: ATLAS_HEIGHTFIELD_VERSION,
    assetRef: { kind: 'inline', version: ATLAS_HEIGHTFIELD_VERSION },
    originX: 0,
    originZ: 0,
    cellSize,
    cols,
    rows,
    heights,
    waterLevel: 0,
  };
}

function terrainStride(span: number, cols: number, rows: number): number {
  const preferred = span >= 550 ? 2 : 1;
  const maxTris = span >= 550 ? 3600 : 12000;
  let stride = preferred;
  const estimate = (s: number): number =>
    Math.ceil((cols - 1) / s) * Math.ceil((rows - 1) / s) * 2;
  while (estimate(stride) > maxTris && stride < Math.max(cols, rows)) stride += 1;
  return stride;
}

function buildBlendedTerrain(hf: AtlasHeightfield, span: number): THREE.BufferGeometry | null {
  if (hf.cols < 2 || hf.rows < 2) return null;
  const stride = terrainStride(span, hf.cols, hf.rows);
  const colsL: number[] = [];
  for (let c = 0; c < hf.cols - 1; c += stride) colsL.push(c);
  colsL.push(hf.cols - 1);
  const rowsL: number[] = [];
  for (let r = 0; r < hf.rows - 1; r += stride) rowsL.push(r);
  rowsL.push(hf.rows - 1);

  const h = (c: number, r: number): number => Number(hf.heights[r * hf.cols + c]) || 0;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];

  for (let j = 0; j < rowsL.length; j += 1) {
    const r = rowsL[j]!;
    for (let i = 0; i < colsL.length; i += 1) {
      const c = colsL[i]!;
      const x = hf.originX + c * hf.cellSize;
      const z = hf.originZ + r * hf.cellSize;
      const elev = h(c, r);
      const hL = h(Math.max(0, c - 1), r);
      const hR = h(Math.min(hf.cols - 1, c + 1), r);
      const hU = h(c, Math.max(0, r - 1));
      const hD = h(c, Math.min(hf.rows - 1, r + 1));
      const slope = Math.hypot(hR - hL, hD - hU) / Math.max(1, hf.cellSize * 2);
      const col = terrainColorAt(elev, hf.waterLevel, slope);
      positions.push(x, elev, z);
      uvs.push(x / 72, z / 72);
      colors.push(col.r, col.g, col.b);
    }
  }

  const w = colsL.length;
  const index: number[] = [];
  for (let j = 0; j + 1 < rowsL.length; j += 1) {
    for (let i = 0; i + 1 < colsL.length; i += 1) {
      const i00 = j * w + i;
      const i10 = j * w + i + 1;
      const i01 = (j + 1) * w + i;
      const i11 = (j + 1) * w + i + 1;
      index.push(i00, i11, i10, i00, i01, i11);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildRibbon(
  b: AtlasThreeGeoBuilder,
  points: readonly (readonly [number, number])[],
  width: number,
  y: number,
  id: string,
  sampleY?: (x: number, z: number) => number,
): void {
  const r = Math.max(0.2, width) / 2;
  const up = new THREE.Vector3(0, 1, 0);
  const yAt = (px: number, pz: number): number => (sampleY ? sampleY(px, pz) : y);
  const kept: (readonly [number, number])[] = [];
  for (const p of points) {
    const last = kept[kept.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < r * 0.35) continue;
    kept.push(p);
  }
  kept.forEach(([x, z], i) => {
    const cy = yAt(x, z);
    for (let k = 0; k < 10; k += 1) {
      const a = (k * Math.PI) / 5;
      const c = ((k + 1) * Math.PI) / 5;
      const ax = x + Math.cos(a) * r;
      const az = z + Math.sin(a) * r;
      const cx = x + Math.cos(c) * r;
      const cz = z + Math.sin(c) * r;
      b.tri(
        new THREE.Vector3(x, cy, z),
        new THREE.Vector3(cx, yAt(cx, cz), cz),
        new THREE.Vector3(ax, yAt(ax, az), az),
        id,
        up,
      );
    }
    if (i === 0) return;
    const [px, pz] = kept[i - 1]!;
    const len = Math.hypot(x - px, z - pz) || 1;
    const nx = (-(z - pz) / len) * r;
    const nz = ((x - px) / len) * r;
    const q0 = new THREE.Vector3(px + nx, yAt(px + nx, pz + nz), pz + nz);
    const q1 = new THREE.Vector3(x + nx, yAt(x + nx, z + nz), z + nz);
    const q2 = new THREE.Vector3(x - nx, yAt(x - nx, z - nz), z - nz);
    const q3 = new THREE.Vector3(px - nx, yAt(px - nx, pz - nz), pz - nz);
    b.tri(q0, q1, q2, id, up);
    b.tri(q0, q2, q3, id, up);
  });
}

function wallBox(
  b: AtlasThreeGeoBuilder,
  s: readonly [number, number],
  e: readonly [number, number],
  thick: number,
  baseY: number,
  height: number,
  id: string,
): void {
  const dx = e[0] - s[0];
  const dz = e[1] - s[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.02) return;
  b.geometry(
    UNIT_BOX,
    composeMatrix(
      (s[0] + e[0]) / 2,
      baseY + height / 2,
      (s[1] + e[1]) / 2,
      len,
      height,
      thick,
      Math.atan2(-dz, dx),
    ),
    id,
  );
}

/** Build a true pitched gable roof (Satteldach) prism geometry. */
function createGableRoofGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -d / 2);
  return geo;
}

type PropPrim = Extract<AtlasProductGeometryPrimitive, { kind: 'prop' | 'building_footprint' }>;

function emitCanonicalProp(
  get: (k: AtlasThreeSurfaceKey) => AtlasThreeGeoBuilder,
  p: PropPrim,
  angleDeg: number,
  torches: { id: string; position: THREE.Vector3; radius: number }[],
  opts: {
    readonly fullDetail: boolean;
    readonly hideRoofs: boolean;
    readonly warmWindows: boolean;
    readonly groundElevation: number;
  },
): void {
  const u = Math.min(40, Math.max(0.01, p.size || 1));
  const H = p.height > 0 ? Math.min(10, Math.max(0.1, p.height)) : 1;
  const x = p.x;
  const z = p.y;
  const elev = Number.isFinite(p.elevation) && p.elevation !== 0 ? p.elevation : opts.groundElevation;
  const id = p.id;
  const rotY = (angleDeg * Math.PI) / 180;
  const rootM = new THREE.Matrix4().compose(
    new THREE.Vector3(x, elev, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(1, 1, 1),
  );
  const localBox = (
    k: AtlasThreeSurfaceKey,
    lx: number,
    ly: number,
    lz: number,
    sx: number,
    sy: number,
    sz: number,
    localRotY = 0,
  ): void => {
    const m = rootM.clone().multiply(composeMatrix(lx, ly, lz, sx, sy, sz, localRotY));
    get(k).geometry(UNIT_BOX, m, id);
  };
  const localGeo = (
    k: AtlasThreeSurfaceKey,
    geo: THREE.BufferGeometry,
    lx: number,
    ly: number,
    lz: number,
    sx = 1,
    sy = 1,
    sz = 1,
    localRotY = 0,
  ): void => {
    const m = rootM.clone().multiply(composeMatrix(lx, ly, lz, sx, sy, sz, localRotY));
    get(k).geometry(geo, m, id);
    geo.dispose();
  };

  const hHash = hashId(id);

  switch (p.stamp) {
    case 'baum':
    case 'tanne': {
      const s = p.stamp === 'tanne' ? 58 : 64;
      const jitter = 0.88 + ((hHash % 25) / 100);
      const sc = s * u * jitter;
      const isBirch = p.stamp === 'baum' && hHash % 3 === 1;
      localGeo(
        isBirch ? 'bark-birch' : 'wood-dark',
        new THREE.CylinderGeometry(0.055 * sc, 0.11 * sc, 0.34 * sc, 6),
        0,
        0.17 * sc,
        0,
      );
      if (p.stamp === 'tanne') {
        localGeo('leaf-pine', new THREE.ConeGeometry(0.56 * sc, 0.9 * sc, 7), 0, 0.62 * sc, 0);
        localGeo('leaf-pine', new THREE.ConeGeometry(0.44 * sc, 0.82 * sc, 7), 0, 0.96 * sc, 0);
        localGeo('leaf-pine', new THREE.ConeGeometry(0.3 * sc, 0.68 * sc, 6), 0, 1.28 * sc, 0);
        localGeo('leaf-pine', new THREE.ConeGeometry(0.17 * sc, 0.45 * sc, 5), 0, 1.54 * sc, 0);
      } else {
        const leafKey: AtlasThreeSurfaceKey = isBirch ? 'leaf-birch' : 'leaf';
        localGeo(leafKey, new THREE.DodecahedronGeometry(0.46 * sc, 1), 0, 0.72 * sc, 0);
        localGeo(leafKey, new THREE.DodecahedronGeometry(0.32 * sc, 0), 0.24 * sc, 0.62 * sc, 0.18 * sc);
        localGeo(leafKey, new THREE.DodecahedronGeometry(0.3 * sc, 0), -0.22 * sc, 0.66 * sc, -0.14 * sc);
        localGeo(leafKey, new THREE.DodecahedronGeometry(0.26 * sc, 0), 0.04 * sc, 0.96 * sc, -0.06 * sc);
      }
      break;
    }
    case 'fels': {
      const crag = 24 * u;
      localGeo('rock', new THREE.DodecahedronGeometry(crag * 0.72, 0), 0, crag * 0.48, 0, 1.25, 0.85, 1.05);
      localGeo('rock', new THREE.DodecahedronGeometry(crag * 0.5, 0), crag * 0.48, crag * 0.36, -crag * 0.24, 1.1, 0.95, 0.9);
      if (crag > 12) {
        localGeo('snow', new THREE.ConeGeometry(crag * 0.32, crag * 0.38, 6), 0, crag * 0.96, 0);
      }
      break;
    }
    case 'haus': {
      const styleIdx = hHash % 3;
      const wallKey: AtlasThreeSurfaceKey = styleIdx === 2 ? 'wall' : 'plaster';
      const roofKey: AtlasThreeSurfaceKey =
        styleIdx === 0 ? 'roof-tile' : styleIdx === 1 ? 'roof-slate' : 'roof-moss';
      const bw = 80 * u;
      const bd = 60 * u;
      const bh = 54 * u * H;
      // Stone foundation plinth
      localBox('wall', 0, bh * 0.08, 0, bw * 1.04, bh * 0.16, bd * 1.04);
      // Main walls (when cutaway/hideRoofs is active, render hollow interior shell)
      if (opts.hideRoofs) {
        localBox('floor-wood', 0, 0.4, 0, bw * 0.96, 0.8, bd * 0.96);
        const wt = Math.max(2, bw * 0.07);
        const lowH = bh * 0.45;
        localBox(wallKey, 0, lowH / 2, -bd / 2 + wt / 2, bw, lowH, wt);
        localBox(wallKey, 0, lowH / 2, bd / 2 - wt / 2, bw, lowH, wt);
        localBox(wallKey, -bw / 2 + wt / 2, lowH / 2, 0, wt, lowH, bd);
        localBox(wallKey, bw / 2 - wt / 2, lowH / 2, 0, wt, lowH, bd);
      } else {
        localBox(wallKey, 0, bh * 0.54, 0, bw, bh * 0.88, bd);
        // 3 distinct roof shapes (ATL3-G01 D-GEO-01): gable, hip pyramid, twin-gable cottage
        if (styleIdx === 0) {
          const gable = createGableRoofGeometry(bw * 1.16, bh * 0.68, bd * 1.14);
          localGeo(roofKey, gable, 0, bh * 0.98, 0);
          localBox('wall', bw * 0.28, bh * 1.32, -bd * 0.15, bw * 0.14, bh * 0.52, bd * 0.16);
        } else if (styleIdx === 1) {
          const hip = new THREE.ConeGeometry(Math.SQRT1_2, bh * 0.66, 4);
          hip.rotateY(Math.PI / 4);
          localGeo(roofKey, hip, 0, bh * 0.98 + bh * 0.33, 0, bw * 1.18, 1, bd * 1.18);
        } else {
          const gable = createGableRoofGeometry(bd * 1.16, bh * 0.62, bw * 1.14);
          localGeo(roofKey, gable, 0, bh * 0.98, 0, 1, 1, 1, Math.PI / 2);
          localBox('wall', -bw * 0.26, bh * 1.28, bd * 0.12, bw * 0.14, bh * 0.46, bd * 0.16);
        }
        // Timber framing + door + windows
        localBox('wood-dark', 0, bh * 0.34, bd * 0.5 + 0.3, bw * 0.18, bh * 0.52, bd * 0.08);
        const winKey: AtlasThreeSurfaceKey = opts.warmWindows ? 'window-warm' : 'window';
        if (opts.fullDetail) {
          const wy = bh * 0.58;
          const wh = bh * 0.19;
          const ww = bw * 0.13;
          localBox(winKey, -bw * 0.28, wy, bd * 0.5 + 0.35, ww, wh, bd * 0.05);
          localBox(winKey, bw * 0.28, wy, bd * 0.5 + 0.35, ww, wh, bd * 0.05);
          localBox(winKey, -bw * 0.28, wy, -bd * 0.5 - 0.35, ww, wh, bd * 0.05);
          localBox(winKey, bw * 0.28, wy, -bd * 0.5 - 0.35, ww, wh, bd * 0.05);
          if (styleIdx !== 2) {
            localBox('wood-dark', 0, bh * 0.18, bd * 0.5 + 0.2, bw * 1.01, bh * 0.05, bd * 0.04);
            localBox('wood-dark', 0, bh * 0.82, bd * 0.5 + 0.2, bw * 1.01, bh * 0.05, bd * 0.04);
            localBox('wood-dark', -bw * 0.48, bh * 0.52, bd * 0.5 + 0.2, bw * 0.05, bh * 0.72, bd * 0.04);
            localBox('wood-dark', bw * 0.48, bh * 0.52, bd * 0.5 + 0.2, bw * 0.05, bh * 0.72, bd * 0.04);
          }
        }
      }
      break;
    }
    case 'turm': {
      const bh = 96 * u * H;
      const bw = 42 * u;
      localGeo('wall', new THREE.CylinderGeometry(bw * 0.48, bw * 0.55, bh, 8), 0, bh * 0.5, 0);
      if (!opts.hideRoofs) {
        // Battlement crown + tall spire (Turmhelm)
        localGeo('wall', new THREE.CylinderGeometry(bw * 0.58, bw * 0.54, bh * 0.1, 8), 0, bh * 0.96, 0);
        localGeo('roof-slate', new THREE.ConeGeometry(bw * 0.66, bh * 0.46, 8), 0, bh * 1.24, 0);
      }
      localBox('wood-dark', 0, bh * 0.2, bw * 0.48, bw * 0.22, bh * 0.28, bw * 0.14);
      const winKey: AtlasThreeSurfaceKey = opts.warmWindows ? 'window-warm' : 'window';
      if (opts.fullDetail) {
        localBox(winKey, 0, bh * 0.58, bw * 0.48, bw * 0.14, bh * 0.12, bw * 0.1);
        localBox(winKey, 0, bh * 0.78, bw * 0.48, bw * 0.14, bh * 0.12, bw * 0.1);
      }
      break;
    }
    case 'tisch':
      localBox('wood', 0, 30 * u, 0, 80 * u, 6 * u, 48 * u);
      for (const xx of [-34, 34]) {
        for (const zz of [-18, 18]) {
          localBox('wood-dark', xx * u, 14 * u, zz * u, 6 * u, 28 * u, 6 * u);
        }
      }
      break;
    case 'stuhl':
      localBox('wood', 0, 18 * u, 0, 44 * u, 5 * u, 44 * u);
      localBox('wood-dark', 0, 36 * u, -19 * u, 44 * u, 36 * u, 6 * u);
      break;
    case 'fass':
      localGeo('wood', new THREE.CylinderGeometry(24 * u, 26 * u, 52 * u, 10), 0, 26 * u, 0);
      localGeo('wood-dark', new THREE.CylinderGeometry(27 * u, 27 * u, 4 * u, 10), 0, 14 * u, 0);
      localGeo('wood-dark', new THREE.CylinderGeometry(27 * u, 27 * u, 4 * u, 10), 0, 38 * u, 0);
      break;
    case 'bett':
      localBox('wood-dark', 0, 12 * u, 0, 80 * u, 24 * u, 60 * u);
      localBox('plaster', 0, 26 * u, -15 * u, 64 * u, 6 * u, 18 * u);
      break;
    case 'teppich':
      localBox('roof-tile', 0, 1.1 * u, 0, 80 * u, 2 * u, 48 * u);
      break;
    case 'lampe': {
      localBox('wood-dark', 0, 20 * u, 0, 6 * u, 40 * u, 6 * u);
      localGeo('flame', new THREE.OctahedronGeometry(5 * u, 0), 0, 44 * u, 0);
      torches.push({
        id,
        position: new THREE.Vector3(x, elev + 46 * u, z),
        radius: Math.max(125, 420 * u),
      });
      break;
    }
    default:
      localBox('wood', 0, 22 * u, 0, 44 * u, 44 * u, 44 * u);
      localBox('wood-dark', 0, 44.5 * u, 0, 46 * u, 2.5 * u, 46 * u);
  }
}

export type BuildAtlasThreeSceneOptions = {
  readonly mapScale: AtlasMapScale;
  readonly look: AtlasThreeLook;
  readonly span: number;
  readonly presetId: AtlasGraphicsPresetId;
  readonly seed: string;
  readonly hideRoofs?: boolean;
  readonly warmWindows?: boolean;
};

export function buildAtlasThreeScenePlan(
  doc: UnifiedCanvasDoc,
  opts: BuildAtlasThreeSceneOptions,
): AtlasThreeScenePlan {
  const plan = buildAtlasProductGeometryPlan(doc, { mapScale: opts.mapScale });
  const builders = new Map<AtlasThreeSurfaceKey, AtlasThreeGeoBuilder>();
  const get = (k: AtlasThreeSurfaceKey): AtlasThreeGeoBuilder => {
    let b = builders.get(k);
    if (!b) {
      b = new AtlasThreeGeoBuilder(ATLAS_THREE_SURFACES[k].tile);
      builders.set(k, b);
    }
    return b;
  };
  const water = new AtlasThreeGeoBuilder(56);
  const ids = new Set<string>();
  const torches: { id: string; position: THREE.Vector3; radius: number }[] = [];
  const doorInstances: { matrices: THREE.Matrix4[]; ids: string[] } = { matrices: [], ids: [] };
  const up = new THREE.Vector3(0, 1, 0);

  // Determine active terrain heightfield: canonical heightfield OR suggestive 3D fantasy world relief!
  const syntheticRelief =
    opts.look === 'outdoor' && !doc.heightfield && doc.layers.terrain !== false
      ? synthesizeWorldReliefHeightfield(doc, opts.seed)
      : null;
  const activeTerrainHf = doc.heightfield ?? syntheticRelief;
  const sampleGroundY = (x: number, z: number, fallback: number): number => {
    if (!activeTerrainHf) return fallback;
    const sampled = sampleHeightfield(activeTerrainHf, x, z);
    if (sampled === null || !Number.isFinite(sampled)) return fallback;
    return syntheticRelief ? Math.max(0.2, sampled) : sampled > fallback ? sampled : fallback;
  };

  // Full ocean surround (world), lush meadow horizon (settlement), or dark slate sheet (interior).
  if (opts.look === 'indoor') {
    const b = get('sheet-indoor');
    const y = -0.52;
    const p = (x: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
    b.tri(p(-600, -600), p(-600, 1600), p(1600, 1600), '__sheet', up);
    b.tri(p(-600, -600), p(1600, 1600), p(1600, -600), '__sheet', up);
  } else if (opts.mapScale === 'settlement') {
    const b = get('sheet-outdoor');
    const y = -0.54;
    const p = (x: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
    b.tri(p(-1400, -1400), p(-1400, 2400), p(2400, 2400), '__meadow', up);
    b.tri(p(-1400, -1400), p(2400, 2400), p(2400, -1400), '__meadow', up);
  } else {
    const wy = activeTerrainHf ? activeTerrainHf.waterLevel : -0.52;
    const p = (x: number, z: number): THREE.Vector3 => new THREE.Vector3(x, wy, z);
    water.tri(p(-1400, -1400), p(-1400, 2400), p(2400, 2400), '__ocean', up);
    water.tri(p(-1400, -1400), p(2400, 2400), p(2400, -1400), '__ocean', up);
  }

  const rooms = plan.primitives.filter(
    (q): q is Extract<AtlasProductGeometryPrimitive, { kind: 'area' | 'room' }> =>
      q.kind === 'area' || q.kind === 'room',
  );
  const dyR = Math.min(0.075, 0.3 / Math.max(1, rooms.length));
  const roomMaterial = new Map(doc.rooms.map((r) => [r.id, r.material] as const));
  rooms.forEach((rm, i) => {
    ids.add(rm.id);
    const matName = roomMaterial.get(rm.id);
    // When suggestive 3D fantasy terrain relief is active, the continuous terrain mesh
    // renders the land & water biomes cleanly without flat z-fighting slabs (keep paved squares!).
    if (syntheticRelief && matName !== 'pflaster') {
      return;
    }
    const y =
      syntheticRelief && matName === 'pflaster'
        ? sampleGroundY(
            rm.points.reduce((a, p) => a + p[0], 0) / Math.max(1, rm.points.length),
            rm.points.reduce((a, p) => a + p[1], 0) / Math.max(1, rm.points.length),
            4.5,
          ) + 0.38
        : -0.45 + i * dyR;
    // Settlement valley surround: render g.ocean / w.ocean as a lush grassy valley floor
    // instead of a flat water sheet so settlements like Dornhain sit in green hills.
    const surface: AtlasThreeSurfaceKey | 'water' =
      opts.mapScale === 'settlement' && (rm.id === 'g.ocean' || rm.id === 'w.ocean')
        ? 'sheet-outdoor'
        : atlasThreeFloorSurface(matName, opts.mapScale);
    const b = surface === 'water' ? water : get(surface);
    for (const [ia, ib, ic] of rm.triangles) {
      const a = rm.points[ia];
      const c = rm.points[ib];
      const d = rm.points[ic];
      if (!a || !c || !d) continue;
      const va = new THREE.Vector3(a[0], y, a[1]);
      const vb = new THREE.Vector3(c[0], y, c[1]);
      const vc = new THREE.Vector3(d[0], y, d[1]);
      const n = new THREE.Vector3().subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va));
      if (n.y >= 0) b.tri(va, vb, vc, rm.id, up);
      else b.tri(va, vc, vb, rm.id, up);
    }
  });

  if (doc.layers.roads !== false) {
    const paths = plan.primitives.filter(
      (q): q is Extract<AtlasProductGeometryPrimitive, { kind: 'path' }> => q.kind === 'path',
    );
    const dyS = Math.min(0.03, 0.12 / Math.max(1, paths.length));
    const strokeMaterial = new Map(doc.strokes.map((s) => [s.id, s.material] as const));
    paths.forEach((pt, i) => {
      ids.add(pt.id);
      const matName = strokeMaterial.get(pt.id);
      // Rivers & mountain ridges are already sculpted directly into the suggestive 3D terrain!
      if (syntheticRelief && (matName === 'wasser' || matName === 'stein')) {
        return;
      }
      const surface = atlasThreeFloorSurface(matName, opts.mapScale);
      const lift = 0.55 + i * dyS;
      buildRibbon(
        surface === 'water' ? water : get(surface),
        pt.points,
        pt.width,
        -0.14 + i * dyS,
        pt.id,
        syntheticRelief ? (rx, rz) => sampleGroundY(rx, rz, 4.5) + lift : undefined,
      );
    });
  }

  const wallH = opts.mapScale === 'interior' ? 24 : opts.mapScale === 'settlement' ? 9 : 4;
  const doorsByWall = new Map<string, Extract<AtlasProductGeometryPrimitive, { kind: 'door' }>[]>();
  for (const q of plan.primitives) {
    if (q.kind !== 'door') continue;
    const list = doorsByWall.get(q.wallId) ?? [];
    list.push(q);
    doorsByWall.set(q.wallId, list);
  }
  const wallKey: AtlasThreeSurfaceKey = opts.look === 'indoor' ? 'wall-indoor' : 'wall';
  for (const q of plan.primitives) {
    if (q.kind !== 'wall') continue;
    ids.add(q.id);
    const dx = q.end[0] - q.start[0];
    const dz = q.end[1] - q.start[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.02) continue;
    const thick = Math.max(0.4, q.width);
    const doors = (doorsByWall.get(q.id) ?? []).slice().sort((a, b) => a.t - b.t);
    const pt = (t: number): readonly [number, number] => [
      q.start[0] + dx * t,
      q.start[1] + dz * t,
    ];
    let cursor = 0;
    for (const dr of doors) {
      ids.add(dr.id);
      const half = Math.min(0.45, Math.max(0.2, dr.width) / (2 * length));
      const a = Math.max(cursor, dr.t - half);
      const b = Math.min(1, dr.t + half);
      if (a - cursor > 1e-3) wallBox(get(wallKey), pt(cursor), pt(a), thick, -0.42, wallH, q.id);
      const doorH = wallH * 0.72;
      const lintelH = wallH - doorH;
      if (lintelH > 0.2) wallBox(get(wallKey), pt(a), pt(b), thick, -0.42 + doorH, lintelH, q.id);
      const rot = Math.atan2(-dz, dx);
      const jambW = Math.max(0.25, thick * 0.45);
      for (const endT of [a, b]) {
        const [jx, jz] = pt(endT);
        doorInstances.matrices.push(
          composeMatrix(jx, -0.42 + doorH / 2, jz, jambW, doorH, thick * 1.18, rot),
        );
        doorInstances.ids.push(dr.id);
      }
      const [mx, mz] = pt((a + b) / 2);
      doorInstances.matrices.push(
        composeMatrix(mx, -0.42 + doorH, mz, Math.max(0.2, (b - a) * length), jambW, thick * 1.2, rot),
      );
      doorInstances.ids.push(dr.id);
      cursor = Math.max(cursor, b);
    }
    if (1 - cursor > 1e-3) wallBox(get(wallKey), pt(cursor), pt(1), thick, -0.42, wallH, q.id);
  }

  const objAngles = new Map(doc.objects.map((o) => [o.id, o.angle ?? 0] as const));
  const fullDetail = opts.presetId === 'high' || opts.span < 380;
  const showCanonicalObjects =
    opts.mapScale === 'world' ? doc.layers.terrain !== false : doc.layers.objects !== false;
  if (showCanonicalObjects) {
    for (const q of plan.primitives) {
      if (q.kind !== 'prop' && q.kind !== 'building_footprint') continue;
      ids.add(q.id);
      const groundElevation = sampleGroundY(q.x, q.y, -0.35);
      emitCanonicalProp(get, q, objAngles.get(q.id) ?? 0, torches, {
        fullDetail,
        hideRoofs: Boolean(opts.hideRoofs),
        warmWindows: Boolean(opts.warmWindows),
        groundElevation,
      });
    }
  }

  const terrain =
    doc.layers.terrain !== false && activeTerrainHf
      ? buildBlendedTerrain(activeTerrainHf, opts.span)
      : null;

  // Suggestive scenery scatter (ATL3-D01 #1327) grouped by kind for InstancedMesh rendering.
  const scatter = buildAtlasSceneScatter({
    doc,
    seed: opts.seed,
    mapScale: opts.mapScale,
    presetId: opts.presetId,
    elevationSampler: activeTerrainHf
      ? (x, y) => sampleGroundY(x, y, 0)
      : undefined,
  });
  const scatterByKind = new Map<AtlasScatterKind, THREE.Matrix4[]>();
  for (const inst of scatter.instances) {
    const list = scatterByKind.get(inst.kind) ?? [];
    list.push(
      composeMatrix(
        inst.x,
        inst.elevation,
        inst.y,
        inst.scale,
        inst.scale,
        inst.scale,
        inst.rotationRad,
      ),
    );
    scatterByKind.set(inst.kind, list);
  }
  const scatterBatches: AtlasThreeScatterBatch[] = [];
  for (const [kind, matrices] of scatterByKind) {
    if (matrices.length > 0) scatterBatches.push({ kind, matrices });
  }

  return {
    builders,
    water,
    terrain,
    doorInstances,
    scatterBatches,
    torches,
    ids,
    look: opts.look,
    mapScale: opts.mapScale,
  };
}
