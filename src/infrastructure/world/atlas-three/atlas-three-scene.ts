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
  'floor-cobble': { pbr: 'cobble', color: '#e4dac2', roughness: 0.84, normalScale: 0.68, tile: 48 },
  'floor-stone': { pbr: 'cobble', color: '#b4b0a5', roughness: 0.86, normalScale: 0.72, tile: 36 },
  'floor-wood': { pbr: 'wood', color: '#deb486', roughness: 0.72, normalScale: 0.58, tile: 34 },
  'floor-dirt': { pbr: 'dirt', color: '#c8b28d', roughness: 0.96, normalScale: 0.58, tile: 42 },
  'floor-sand': { pbr: 'sand', color: '#e4d5af', roughness: 0.9, normalScale: 0.54, tile: 46 },
  'floor-grass': { pbr: 'grass', color: '#d7e2c2', roughness: 0.95, normalScale: 0.65, tile: 62 },
  'floor-moss': { pbr: 'moss', color: '#9fc29b', roughness: 0.94, normalScale: 0.6, tile: 42 },
  wall: { pbr: 'wall', color: '#ded7c2', roughness: 0.92, normalScale: 0.62, tile: 26 },
  'wall-indoor': { pbr: 'wall', color: '#b6b09f', roughness: 0.94, normalScale: 0.7, tile: 22 },
  plaster: { pbr: 'plaster', color: '#f2e3c7', roughness: 0.95, normalScale: 0.36, tile: 22 },
  'roof-tile': { pbr: 'roofTile', color: '#e69b78', roughness: 0.82, normalScale: 0.88, tile: 16 },
  'roof-slate': { pbr: 'roofSlate', color: '#90a3b5', roughness: 0.74, normalScale: 0.82, tile: 16 },
  'roof-moss': { pbr: 'roofMoss', color: '#a5bd88', roughness: 0.88, normalScale: 0.84, tile: 16 },
  wood: { pbr: 'wood', color: '#c8986b', roughness: 0.84, normalScale: 0.62, tile: 15 },
  'wood-dark': { pbr: 'wood', color: '#5c412c', roughness: 0.86, normalScale: 0.66, tile: 14 },
  'bark-birch': { pbr: 'plaster', color: '#dfd8c8', roughness: 0.86, normalScale: 0.44, tile: 14 },
  rock: { pbr: 'rock', color: '#9ea89e', roughness: 0.92, normalScale: 0.9, tile: 30 },
  snow: { pbr: 'snow', color: '#f2f7fa', roughness: 0.74, normalScale: 0.36, tile: 34 },
  leaf: { pbr: 'moss', color: '#5f9458', roughness: 0.9, normalScale: 0.6, tile: 16 },
  'leaf-sun': { pbr: 'moss', color: '#8fbe65', roughness: 0.88, normalScale: 0.56, tile: 16 },
  'leaf-birch': { pbr: 'moss', color: '#9bc46e', roughness: 0.88, normalScale: 0.52, tile: 16 },
  'leaf-pine': { pbr: 'moss', color: '#3b6f54', roughness: 0.92, normalScale: 0.62, tile: 16 },
  'gold-accent': { pbr: null, color: '#eab95a', roughness: 0.28, normalScale: 0, tile: 1, metalness: 0.72 },
  'iron-dark': { pbr: null, color: '#394048', roughness: 0.42, normalScale: 0, tile: 1, metalness: 0.68 },
  'fabric-crimson': { pbr: 'fabric', color: '#d85852', roughness: 0.92, normalScale: 0.35, tile: 32 },
  'bottle-emerald': { pbr: null, color: '#2b8a64', roughness: 0.14, normalScale: 0, tile: 1, metalness: 0.12 },
  flower: { pbr: null, color: '#f3d474', roughness: 0.85, normalScale: 0, tile: 1 },
  window: { pbr: null, color: '#2b3e4f', roughness: 0.22, normalScale: 0, tile: 1, metalness: 0.18 },
  'window-warm': {
    pbr: null,
    color: '#ffd584',
    roughness: 0.35,
    normalScale: 0,
    tile: 1,
    emissive: '#ffae45',
  },
  flame: { pbr: null, color: '#ffbe66', roughness: 1, normalScale: 0, tile: 1, emissive: '#ffa342' },
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

  constructor(private readonly tile: number) { }

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

export type AtlasThreeAoDisc = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
};

export type AtlasThreeContentBounds = {
  readonly centerX: number;
  readonly centerZ: number;
  readonly fitSpan: number;
};

export type AtlasThreeScenePlan = {
  readonly builders: Map<AtlasThreeSurfaceKey, AtlasThreeGeoBuilder>;
  readonly water: AtlasThreeGeoBuilder;
  readonly terrain: THREE.BufferGeometry | null;
  readonly waterLevel: number;
  readonly contentBounds: AtlasThreeContentBounds;
  readonly doorInstances: { readonly matrices: THREE.Matrix4[]; readonly ids: string[] };
  readonly scatterBatches: readonly AtlasThreeScatterBatch[];
  readonly aoDiscs: readonly AtlasThreeAoDisc[];
  readonly smokePoints: readonly THREE.Vector3[];
  readonly mistPoints: readonly { readonly position: THREE.Vector3; readonly scale: number }[];
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

      // Smoothly taper outer 5% edge underwater so zero rectangular seam ever appears in the infinite ocean.
      const edgeDist = Math.min(x, 1000 - x, z, 1000 - z);
      if (edgeDist < 55) {
        const et = Math.max(0, edgeDist / 55);
        const smoothEdge = et * et * (3 - 2 * et);
        h = -13 * (1 - smoothEdge) + h * smoothEdge;
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
  aoDiscs: AtlasThreeAoDisc[],
  smokePoints: THREE.Vector3[],
  mistPoints: { position: THREE.Vector3; scale: number }[],
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
        localGeo('leaf-pine', new THREE.ConeGeometry(0.58 * sc, 0.88 * sc, 7), 0, 0.58 * sc, 0);
        localGeo('leaf-pine', new THREE.ConeGeometry(0.46 * sc, 0.8 * sc, 7), 0, 0.94 * sc, 0);
        localGeo('leaf-pine', new THREE.ConeGeometry(0.32 * sc, 0.66 * sc, 6), 0, 1.26 * sc, 0);
        localGeo('leaf-sun', new THREE.ConeGeometry(0.18 * sc, 0.44 * sc, 5), 0, 1.54 * sc, 0);
      } else {
        const leafKey: AtlasThreeSurfaceKey = isBirch ? 'leaf-birch' : 'leaf';
        const sunKey: AtlasThreeSurfaceKey = isBirch ? 'leaf-birch' : 'leaf-sun';
        localGeo(leafKey, new THREE.DodecahedronGeometry(0.46 * sc, 1), 0, 0.68 * sc, 0);
        localGeo(leafKey, new THREE.DodecahedronGeometry(0.34 * sc, 0), 0.25 * sc, 0.6 * sc, 0.18 * sc);
        localGeo(leafKey, new THREE.DodecahedronGeometry(0.31 * sc, 0), -0.23 * sc, 0.64 * sc, -0.15 * sc);
        localGeo(sunKey, new THREE.DodecahedronGeometry(0.3 * sc, 1), 0.08 * sc, 0.96 * sc, 0.04 * sc);
        localGeo(sunKey, new THREE.DodecahedronGeometry(0.22 * sc, 0), -0.16 * sc, 0.88 * sc, 0.14 * sc);
      }
      aoDiscs.push({ x, y: elev + 0.16, z, radius: sc * 0.58 });
      break;
    }
    case 'fels': {
      const crag = 24 * u;
      localGeo('rock', new THREE.ConeGeometry(crag * 0.92, crag * 1.15, 7), 0, crag * 0.54, 0, 1.18, 1.0, 1.04);
      localGeo('rock', new THREE.ConeGeometry(crag * 0.64, crag * 0.85, 6), crag * 0.52, crag * 0.4, -crag * 0.24, 1.1, 1.0, 0.95);
      localGeo('rock', new THREE.ConeGeometry(crag * 0.52, crag * 0.72, 6), -crag * 0.46, crag * 0.34, crag * 0.26, 1.0, 0.95, 1.1);
      if (crag > 11) {
        localGeo('snow', new THREE.ConeGeometry(crag * 0.3, crag * 0.44, 7), 0, crag * 0.94, 0, 1.08, 1.0, 0.96);
        localGeo('snow', new THREE.ConeGeometry(crag * 0.2, crag * 0.3, 6), crag * 0.52, crag * 0.72, -crag * 0.24);
        mistPoints.push({ position: new THREE.Vector3(x, elev + crag * 0.78, z), scale: crag * 2.2 });
      }
      aoDiscs.push({ x, y: elev + 0.16, z, radius: crag * 1.15 });
      break;
    }
    case 'haus': {
      const styleIdx = hHash % 3;
      const wallKey: AtlasThreeSurfaceKey = styleIdx === 2 ? 'wall' : 'plaster';
      const roofKey: AtlasThreeSurfaceKey =
        styleIdx === 0 ? 'roof-tile' : styleIdx === 1 ? 'roof-slate' : 'roof-moss';
      const bw = 82 * u;
      const bd = 62 * u;
      const bh = 56 * u * H;
      // Raised cobblestone foundation plinth (V7/V8 Dornhain Fachwerk craft)
      localBox('wall', 0, bh * 0.1, 0, bw * 1.08, bh * 0.2, bd * 1.08);
      aoDiscs.push({ x, y: elev + 0.14, z, radius: Math.max(bw, bd) * 0.76 });
      if (opts.hideRoofs) {
        localBox('floor-wood', 0, 0.45, 0, bw * 0.96, 0.9, bd * 0.96);
        const wt = Math.max(2, bw * 0.07);
        const lowH = bh * 0.45;
        localBox(wallKey, 0, lowH / 2, -bd / 2 + wt / 2, bw, lowH, wt);
        localBox(wallKey, 0, lowH / 2, bd / 2 - wt / 2, bw, lowH, wt);
        localBox(wallKey, -bw / 2 + wt / 2, lowH / 2, 0, wt, lowH, bd);
        localBox(wallKey, bw / 2 - wt / 2, lowH / 2, 0, wt, lowH, bd);
      } else {
        // Main plaster/stone body + subtle second-story timber overhang
        localBox(wallKey, 0, bh * 0.56, 0, bw, bh * 0.86, bd);
        // 3 distinct roof shapes + ridge beam + stone chimney with animated smoke!
        if (styleIdx === 0) {
          const gable = createGableRoofGeometry(bw * 1.22, bh * 0.74, bd * 1.18);
          localGeo(roofKey, gable, 0, bh * 0.98, 0);
          localBox('wood-dark', 0, bh * 1.72, 0, bw * 0.07, bh * 0.07, bd * 1.22);
          localBox('wall', bw * 0.28, bh * 1.38, -bd * 0.16, bw * 0.15, bh * 0.58, bd * 0.17);
          localBox('wall', bw * 0.28, bh * 1.68, -bd * 0.16, bw * 0.19, bh * 0.06, bd * 0.21);
          smokePoints.push(new THREE.Vector3(x + bw * 0.24, elev + bh * 1.78, z - bd * 0.12));
        } else if (styleIdx === 1) {
          const hip = new THREE.ConeGeometry(Math.SQRT1_2, bh * 0.72, 4);
          hip.rotateY(Math.PI / 4);
          localGeo(roofKey, hip, 0, bh * 0.98 + bh * 0.36, 0, bw * 1.22, 1, bd * 1.22);
          localBox('wall', -bw * 0.22, bh * 1.34, -bd * 0.18, bw * 0.14, bh * 0.5, bd * 0.16);
          smokePoints.push(new THREE.Vector3(x - bw * 0.2, elev + bh * 1.66, z - bd * 0.15));
        } else {
          const gable = createGableRoofGeometry(bd * 1.2, bh * 0.68, bw * 1.18);
          localGeo(roofKey, gable, 0, bh * 0.98, 0, 1, 1, 1, Math.PI / 2);
          localBox('wood-dark', 0, bh * 1.66, 0, bw * 1.2, bh * 0.07, bd * 0.07);
          localBox('wall', -bw * 0.26, bh * 1.32, bd * 0.14, bw * 0.15, bh * 0.52, bd * 0.17);
          smokePoints.push(new THREE.Vector3(x - bw * 0.24, elev + bh * 1.64, z + bd * 0.12));
        }
        // Recessed timber door + wooden awning
        localBox('wood-dark', 0, bh * 0.34, bd * 0.5 + 0.35, bw * 0.2, bh * 0.5, bd * 0.09);
        localBox('roof-tile', 0, bh * 0.61, bd * 0.56, bw * 0.28, bh * 0.08, bd * 0.18);
        // Warm glowing windows (golden-hour cozy glow like V7/V8 Dornhain!)
        const winKey: AtlasThreeSurfaceKey = 'window-warm';
        if (opts.fullDetail) {
          const wy = bh * 0.56;
          const wh = bh * 0.2;
          const ww = bw * 0.14;
          for (const side of [1, -1]) {
            localBox(winKey, -bw * 0.29, wy, side * (bd * 0.5 + 0.38), ww, wh, bd * 0.05);
            localBox(winKey, bw * 0.29, wy, side * (bd * 0.5 + 0.38), ww, wh, bd * 0.05);
            // Fachwerk beams & posts
            localBox('wood-dark', 0, bh * 0.22, side * (bd * 0.5 + 0.22), bw * 1.03, bh * 0.055, bd * 0.045);
            localBox('wood-dark', 0, bh * 0.52, side * (bd * 0.5 + 0.22), bw * 1.03, bh * 0.05, bd * 0.045);
            localBox('wood-dark', 0, bh * 0.88, side * (bd * 0.5 + 0.22), bw * 1.03, bh * 0.055, bd * 0.045);
            localBox('wood-dark', -bw * 0.48, bh * 0.55, side * (bd * 0.5 + 0.22), bw * 0.055, bh * 0.72, bd * 0.045);
            localBox('wood-dark', bw * 0.48, bh * 0.55, side * (bd * 0.5 + 0.22), bw * 0.055, bh * 0.72, bd * 0.045);
            localBox('wood-dark', 0, bh * 0.7, side * (bd * 0.5 + 0.22), bw * 0.05, bh * 0.38, bd * 0.045);
          }
          // Cozy porch lantern glow on larger houses / taverns
          if (u >= 0.48) {
            torches.push({
              id: `${id}:lantern`,
              position: new THREE.Vector3(
                x + Math.sin(rotY) * (bd * 0.62),
                elev + bh * 0.46,
                z + Math.cos(rotY) * (bd * 0.62),
              ),
              radius: Math.max(46, bw * 1.65),
            });
          }
        }
      }
      break;
    }
    case 'turm': {
      const bh = 104 * u * H;
      const bw = 44 * u;
      aoDiscs.push({ x, y: elev + 0.14, z, radius: bw * 0.92 });
      localGeo('wall', new THREE.CylinderGeometry(bw * 0.48, bw * 0.58, bh, 8), 0, bh * 0.5, 0);
      if (!opts.hideRoofs) {
        // Protruding timber/stone hoarding crown + tall slate spire + golden finial
        localGeo('wood-dark', new THREE.CylinderGeometry(bw * 0.6, bw * 0.54, bh * 0.08, 8), 0, bh * 0.91, 0);
        localGeo('wall', new THREE.CylinderGeometry(bw * 0.62, bw * 0.58, bh * 0.1, 8), 0, bh * 0.98, 0);
        localGeo('roof-slate', new THREE.ConeGeometry(bw * 0.7, bh * 0.5, 8), 0, bh * 1.28, 0);
        localGeo('gold-accent', new THREE.OctahedronGeometry(bw * 0.1, 0), 0, bh * 1.55, 0);
      }
      localBox('wood-dark', 0, bh * 0.18, bw * 0.5, bw * 0.22, bh * 0.26, bw * 0.14);
      if (opts.fullDetail) {
        localBox('window-warm', 0, bh * 0.56, bw * 0.5, bw * 0.14, bh * 0.12, bw * 0.1);
        localBox('window-warm', 0, bh * 0.76, bw * 0.5, bw * 0.14, bh * 0.12, bw * 0.1);
        localBox('window-warm', bw * 0.5, bh * 0.66, 0, bw * 0.1, bh * 0.12, bw * 0.14);
      }
      break;
    }
    case 'tisch': {
      // Heavy medieval oak trestle table with wooden trencher plates, brass tankards & lit wax candle!
      localBox('wood', 0, 29 * u, 0, 86 * u, 6.5 * u, 50 * u);
      localBox('wood-dark', 0, 25 * u, 0, 74 * u, 3 * u, 42 * u);
      for (const xx of [-32, 32]) {
        localBox('wood-dark', xx * u, 13 * u, -17 * u, 7 * u, 26 * u, 7 * u);
        localBox('wood-dark', xx * u, 13 * u, 17 * u, 7 * u, 26 * u, 7 * u);
        localBox('wood-dark', xx * u, 7 * u, 0, 6 * u, 4 * u, 38 * u);
      }
      localBox('wood-dark', 0, 9 * u, 0, 66 * u, 4 * u, 5 * u);
      // Tabletop dressing: brass candleholder + glowing flame + tankards + wooden plates
      localGeo('gold-accent', new THREE.CylinderGeometry(4.5 * u, 6 * u, 2 * u, 8), 0, 33.2 * u, 0);
      localGeo('plaster', new THREE.CylinderGeometry(1.8 * u, 2.2 * u, 8.5 * u, 8), 0, 38 * u, 0);
      localGeo('flame', new THREE.OctahedronGeometry(2.6 * u, 0), 0, 44 * u, 0);
      localGeo('gold-accent', new THREE.CylinderGeometry(2.8 * u, 3.2 * u, 6.5 * u, 8), -20 * u, 35.5 * u, 8 * u);
      localGeo('gold-accent', new THREE.CylinderGeometry(2.8 * u, 3.2 * u, 6.5 * u, 8), 22 * u, 35.5 * u, -7 * u);
      localGeo('wood-dark', new THREE.CylinderGeometry(7.5 * u, 6.5 * u, 1.4 * u, 10), -18 * u, 33 * u, -8 * u);
      localGeo('wood-dark', new THREE.CylinderGeometry(7.5 * u, 6.5 * u, 1.4 * u, 10), 18 * u, 33 * u, 9 * u);
      torches.push({
        id: `${id}:candle`,
        position: new THREE.Vector3(x, elev + 46 * u, z),
        radius: Math.max(115, 220 * u),
      });
      aoDiscs.push({ x, y: elev + 0.14, z, radius: 58 * u });
      break;
    }
    case 'stuhl': {
      // Carved medieval high-back oak chair with legs, cross-stretchers & slatted back
      localBox('wood', 0, 17 * u, 0, 42 * u, 5 * u, 40 * u);
      for (const xx of [-17, 17]) {
        for (const zz of [-16, 16]) {
          localBox('wood-dark', xx * u, 8.5 * u, zz * u, 5 * u, 17 * u, 5 * u);
        }
      }
      localBox('wood-dark', -17 * u, 35 * u, -17 * u, 5 * u, 36 * u, 5 * u);
      localBox('wood-dark', 17 * u, 35 * u, -17 * u, 5 * u, 36 * u, 5 * u);
      localBox('wood', 0, 48 * u, -17 * u, 40 * u, 8 * u, 5 * u);
      localBox('wood', 0, 32 * u, -17 * u, 34 * u, 6 * u, 4 * u);
      aoDiscs.push({ x, y: elev + 0.14, z, radius: 28 * u });
      break;
    }
    case 'fass': {
      // Iron-banded oak ale barrel + brass spigot + companion small keg
      localGeo('wood', new THREE.CylinderGeometry(23 * u, 25 * u, 50 * u, 12), 0, 25 * u, 0);
      localGeo('iron-dark', new THREE.CylinderGeometry(26 * u, 26 * u, 4.5 * u, 12), 0, 12 * u, 0);
      localGeo('iron-dark', new THREE.CylinderGeometry(26 * u, 26 * u, 4.5 * u, 12), 0, 38 * u, 0);
      localGeo('gold-accent', new THREE.CylinderGeometry(2.2 * u, 2.2 * u, 10 * u, 6), 0, 20 * u, 26 * u);
      localGeo('wood-dark', new THREE.CylinderGeometry(16 * u, 17 * u, 32 * u, 10), 34 * u, 16 * u, 12 * u);
      localGeo('iron-dark', new THREE.CylinderGeometry(18 * u, 18 * u, 3.5 * u, 10), 34 * u, 8 * u, 12 * u);
      localGeo('iron-dark', new THREE.CylinderGeometry(18 * u, 18 * u, 3.5 * u, 10), 34 * u, 24 * u, 12 * u);
      aoDiscs.push({ x, y: elev + 0.14, z, radius: 42 * u });
      break;
    }
    case 'bett':
      localBox('wood-dark', 0, 12 * u, 0, 82 * u, 22 * u, 62 * u);
      localBox('fabric-crimson', 0, 24 * u, 6 * u, 74 * u, 6 * u, 44 * u);
      localBox('plaster', 0, 26 * u, -18 * u, 64 * u, 7 * u, 16 * u);
      localBox('wood-dark', 0, 26 * u, -30 * u, 84 * u, 32 * u, 5 * u);
      break;
    case 'teppich':
      localBox('fabric-crimson', 0, 0.9 * u, 0, 84 * u, 1.6 * u, 52 * u);
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
  const aoDiscs: AtlasThreeAoDisc[] = [];
  const smokePoints: THREE.Vector3[] = [];
  const mistPoints: { position: THREE.Vector3; scale: number }[] = [];
  const doorInstances: { matrices: THREE.Matrix4[]; ids: string[] } = { matrices: [], ids: [] };
  const up = new THREE.Vector3(0, 1, 0);

  // Determine active terrain heightfield: canonical heightfield OR suggestive 3D fantasy world relief!
  const syntheticRelief =
    opts.look === 'outdoor' && !doc.heightfield && doc.layers.terrain !== false
      ? synthesizeWorldReliefHeightfield(doc, opts.seed)
      : null;
  const activeTerrainHf = doc.heightfield ?? syntheticRelief;
  const waterLevel = activeTerrainHf ? activeTerrainHf.waterLevel : -0.52;
  const sampleGroundY = (x: number, z: number, fallback: number): number => {
    if (!activeTerrainHf) return fallback;
    const sampled = sampleHeightfield(activeTerrainHf, x, z);
    if (sampled === null || !Number.isFinite(sampled)) return fallback;
    return syntheticRelief ? Math.max(0.2, sampled) : sampled > fallback ? sampled : fallback;
  };

  // NOTE: Infinite ocean / infinite meadow / infinite dark cavern horizon surround is rendered
  // by AtlasThreeRuntime (camera-following 28k×28k plane + sky dome + FogExp2) so zero
  // rectangular edges ever appear when zooming out!

  const rooms = plan.primitives.filter(
    (q): q is Extract<AtlasProductGeometryPrimitive, { kind: 'area' | 'room' }> =>
      q.kind === 'area' || q.kind === 'room',
  );
  const dyR = Math.min(0.075, 0.3 / Math.max(1, rooms.length));
  const roomMaterial = new Map(doc.rooms.map((r) => [r.id, r.material] as const));
  rooms.forEach((rm, i) => {
    ids.add(rm.id);
    const matName = roomMaterial.get(rm.id);
    // Skip ocean backdrop polygons — handled seamlessly by the infinite camera-following surround.
    if (rm.id === 'g.ocean' || rm.id === 'w.ocean') {
      return;
    }
    // When suggestive 3D fantasy terrain relief is active, the continuous terrain mesh
    // renders the land & water biomes cleanly without flat z-fighting slabs (keep paved squares!).
    if (syntheticRelief && matName !== 'pflaster') {
      return;
    }
    const cx = rm.points.reduce((a, p) => a + p[0], 0) / Math.max(1, rm.points.length);
    const cz = rm.points.reduce((a, p) => a + p[1], 0) / Math.max(1, rm.points.length);
    const y =
      syntheticRelief && matName === 'pflaster'
        ? sampleGroundY(cx, cz, 4.5) + 0.38
        : -0.45 + i * dyR;
    const surface: AtlasThreeSurfaceKey | 'water' = atlasThreeFloorSurface(matName, opts.mapScale);
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

    // V7/V8 Dornhain touch: stone village fountain, glowing corner lanterns, striped market stall & fences on plazas!
    if (opts.mapScale === 'settlement' && matName === 'pflaster' && opts.presetId !== 'lite') {
      const minX = Math.min(...rm.points.map((p) => p[0]));
      const maxX = Math.max(...rm.points.map((p) => p[0]));
      const minZ = Math.min(...rm.points.map((p) => p[1]));
      const maxZ = Math.max(...rm.points.map((p) => p[1]));
      if (maxX - minX >= 100 && maxZ - minZ >= 80) {
        const fx = (minX + maxX) * 0.5;
        const fz = (minZ + maxZ) * 0.5;
        const rimGeo = new THREE.CylinderGeometry(12, 13.8, 5, 14);
        get('wall').geometry(rimGeo, composeMatrix(fx, y + 2.5, fz, 1, 1, 1), '__fountain');
        rimGeo.dispose();
        const spireGeo = new THREE.CylinderGeometry(2.3, 3.8, 11.5, 8);
        get('wall').geometry(spireGeo, composeMatrix(fx, y + 5.7, fz, 1, 1, 1), '__fountain');
        spireGeo.dispose();
        const capGeo = new THREE.CylinderGeometry(5.8, 2.5, 2.6, 12);
        get('wall').geometry(capGeo, composeMatrix(fx, y + 10.2, fz, 1, 1, 1), '__fountain');
        capGeo.dispose();
        const poolGeo = new THREE.CylinderGeometry(10.2, 10.2, 0.7, 14);
        water.geometry(poolGeo, composeMatrix(fx, y + 4.3, fz, 1, 1, 1), '__fountain-water');
        poolGeo.dispose();
        aoDiscs.push({ x: fx, y: y + 0.14, z: fz, radius: 19 });

        // Warm medieval wooden street lanterns at plaza corners (V7/V8 evening magic!)
        const lampCorners: readonly [number, number][] = [
          [minX + 12, minZ + 12],
          [maxX - 12, minZ + 12],
          [minX + 12, maxZ - 12],
          [maxX - 12, maxZ - 12],
        ];
        for (let lc = 0; lc < lampCorners.length; lc += 1) {
          const [lx, lz] = lampCorners[lc]!;
          get('wood-dark').geometry(UNIT_BOX, composeMatrix(lx, y + 11, lz, 2.6, 22, 2.6), '__streetlamp');
          get('iron-dark').geometry(UNIT_BOX, composeMatrix(lx + 2.2, y + 21, lz, 6, 1.4, 1.8), '__streetlamp');
          get('flame').geometry(UNIT_BOX, composeMatrix(lx + 4.2, y + 19, lz, 3.2, 4, 3.2), '__streetlamp');
          torches.push({
            id: `__streetlamp-${lc}`,
            position: new THREE.Vector3(lx + 4.2, y + 19.5, lz),
            radius: 68,
          });
        }

        // Festive crimson & oak market stall tucked near the northeast plaza edge
        const sx = maxX - 30;
        const sz = minZ + 22;
        get('wood').geometry(UNIT_BOX, composeMatrix(sx, y + 5.5, sz, 24, 11, 12), '__market-stall');
        for (const px of [-11, 11]) {
          for (const pz of [-5, 5]) {
            get('wood-dark').geometry(UNIT_BOX, composeMatrix(sx + px, y + 13, sz + pz, 2, 16, 2), '__market-stall');
          }
        }
        get('fabric-crimson').geometry(UNIT_BOX, composeMatrix(sx, y + 21.5, sz, 28, 2.6, 16), '__market-stall');
        aoDiscs.push({ x: sx, y: y + 0.14, z: sz, radius: 18 });
      }
    }

    // Dungeon-Alchemist Interior Dressing: transform bare wooden/stone rooms into rich cozy taverns!
    if (opts.mapScale === 'interior' && opts.presetId !== 'lite') {
      const minX = Math.min(...rm.points.map((p) => p[0]));
      const maxX = Math.max(...rm.points.map((p) => p[0]));
      const minZ = Math.min(...rm.points.map((p) => p[1]));
      const maxZ = Math.max(...rm.points.map((p) => p[1]));
      const rw = maxX - minX;
      const rh = maxZ - minZ;

      // 1) Main wooden tavern hall: grand stone fireplace, crimson hearth rug, oak benches, bookshelves, wall sconces & entrance double door!
      if (matName === 'holz' && rw >= 180 && rh >= 160) {
        // Grand stone hearth fireplace on the east-north wall
        const hx = maxX - 18;
        const hz = minZ + rh * 0.48;
        get('wall-indoor').geometry(UNIT_BOX, composeMatrix(hx + 6, y + 16, hz, 24, 32, 64), '__hearth');
        get('iron-dark').geometry(UNIT_BOX, composeMatrix(hx - 2, y + 9, hz, 12, 17, 36), '__hearth');
        get('wood-dark').geometry(UNIT_BOX, composeMatrix(hx - 2, y + 21, hz, 18, 4, 72), '__hearth');
        get('wood-dark').geometry(UNIT_BOX, composeMatrix(hx - 4, y + 3, hz, 8, 5, 22), '__hearth-logs');
        get('flame').geometry(UNIT_BOX, composeMatrix(hx - 4, y + 8, hz, 7, 10, 20), '__hearth-fire');
        // Mantlepiece candles
        for (const mz of [-22, 22]) {
          get('gold-accent').geometry(UNIT_BOX, composeMatrix(hx - 4, y + 24, hz + mz, 3.5, 2, 3.5), '__hearth');
          get('plaster').geometry(UNIT_BOX, composeMatrix(hx - 4, y + 27.5, hz + mz, 2.2, 6, 2.2), '__hearth');
          get('flame').geometry(UNIT_BOX, composeMatrix(hx - 4, y + 31.5, hz + mz, 2.4, 3, 2.4), '__hearth');
        }
        torches.push({
          id: '__hearth-light',
          position: new THREE.Vector3(hx - 14, y + 18, hz),
          radius: 290,
        });

        // Cozy woven crimson-gold hearth rug in front of fireplace + central hall runner
        get('fabric-crimson').geometry(
          UNIT_BOX,
          composeMatrix(hx - 54, y + 0.7, hz, 64, 1.2, 92),
          '__tavern-rug',
        );
        get('fabric-crimson').geometry(
          UNIT_BOX,
          composeMatrix(minX + rw * 0.44, y + 0.65, maxZ - 64, 118, 1.1, 46),
          '__tavern-runner',
        );

        // Second cozy tavern booth (oak trestle table + dual wooden benches + glowing candle) in southeast corner
        const bx = maxX - 88;
        const bz = maxZ - 68;
        const boothClear = !doc.objects.some((o) => Math.hypot(o.x - bx, o.y - bz) < 75);
        if (boothClear) {
          get('wood').geometry(UNIT_BOX, composeMatrix(bx, y + 18, bz, 62, 4.5, 34), '__booth');
          get('wood-dark').geometry(UNIT_BOX, composeMatrix(bx - 22, y + 9, bz, 5, 18, 28), '__booth');
          get('wood-dark').geometry(UNIT_BOX, composeMatrix(bx + 22, y + 9, bz, 5, 18, 28), '__booth');
          get('wood').geometry(UNIT_BOX, composeMatrix(bx, y + 10.5, bz - 28, 56, 3.5, 12), '__booth');
          get('wood').geometry(UNIT_BOX, composeMatrix(bx, y + 10.5, bz + 28, 56, 3.5, 12), '__booth');
          get('gold-accent').geometry(UNIT_BOX, composeMatrix(bx + 12, y + 22.5, bz + 4, 4, 5, 4), '__booth');
          get('plaster').geometry(UNIT_BOX, composeMatrix(bx - 4, y + 23.5, bz, 2.4, 7, 2.4), '__booth');
          get('flame').geometry(UNIT_BOX, composeMatrix(bx - 4, y + 28, bz, 2.8, 3.4, 2.8), '__booth');
          torches.push({
            id: '__booth-candle',
            position: new THREE.Vector3(bx - 4, y + 30, bz),
            radius: 175,
          });
          aoDiscs.push({ x: bx, y: y + 0.14, z: bz, radius: 46 });
        }

        // Tall oak wall bookshelf / trophy cabinet along the north wall (east of bar)
        const sx = maxX - 96;
        const sz = minZ + 14;
        get('wood-dark').geometry(UNIT_BOX, composeMatrix(sx, y + 15, sz, 66, 30, 14), '__shelf');
        get('wood').geometry(UNIT_BOX, composeMatrix(sx, y + 8, sz + 3, 58, 2, 10), '__shelf');
        get('wood').geometry(UNIT_BOX, composeMatrix(sx, y + 17, sz + 3, 58, 2, 10), '__shelf');
        get('bottle-emerald').geometry(UNIT_BOX, composeMatrix(sx - 18, y + 12.5, sz + 3, 4.5, 8, 4.5), '__shelf');
        get('fabric-crimson').geometry(UNIT_BOX, composeMatrix(sx + 4, y + 12.5, sz + 3, 14, 7.5, 8), '__shelf');
        get('gold-accent').geometry(UNIT_BOX, composeMatrix(sx + 20, y + 21, sz + 3, 5, 6, 5), '__shelf');

        // Heavy carved oak tavern double entrance doors on south wall
        const dxDoor = minX + rw * 0.44;
        get('wood-dark').geometry(UNIT_BOX, composeMatrix(dxDoor, y + 13, maxZ - 3, 52, 26, 11), '__tavern-door');
        get('iron-dark').geometry(UNIT_BOX, composeMatrix(dxDoor, y + 8, maxZ - 8.5, 48, 2.2, 1.2), '__tavern-door');
        get('iron-dark').geometry(UNIT_BOX, composeMatrix(dxDoor, y + 19, maxZ - 8.5, 48, 2.2, 1.2), '__tavern-door');
        get('gold-accent').geometry(UNIT_BOX, composeMatrix(dxDoor - 4, y + 13, maxZ - 9, 2.4, 2.4, 2.4), '__tavern-door');
        get('gold-accent').geometry(UNIT_BOX, composeMatrix(dxDoor + 4, y + 13, maxZ - 9, 2.4, 2.4, 2.4), '__tavern-door');

        // Warm wrought-iron wall sconces around perimeter for rich golden-amber ambiance
        const sconces: readonly [number, number][] = [
          [minX + 12, minZ + rh * 0.52],
          [minX + 12, maxZ - 48],
          [minX + rw * 0.55, minZ + 12],
          [maxX - 48, maxZ - 12],
        ];
        for (let sc = 0; sc < sconces.length; sc += 1) {
          const [scx, scz] = sconces[sc]!;
          get('iron-dark').geometry(UNIT_BOX, composeMatrix(scx, y + 17, scz, 4, 8, 4), '__sconce');
          get('flame').geometry(UNIT_BOX, composeMatrix(scx, y + 22, scz, 3.6, 4.5, 3.6), '__sconce');
          torches.push({
            id: `__sconce-${sc}`,
            position: new THREE.Vector3(scx, y + 24, scz),
            radius: 195,
          });
        }
      }

      // 2) Tavern stone bar corner (e.g. `g.tav.bar`): carved L-shaped oak counter, tap kegs, bottle shelf & barstools!
      if (matName === 'stein' && rw >= 80 && rw <= 200 && rh >= 50 && rh <= 130) {
        const hasWoodHall = doc.rooms.some((r) => r.material === 'holz' && r.w >= 180);
        if (hasWoodHall) {
          // Main front bar counter along south edge + return along east edge
          get('wood-dark').geometry(UNIT_BOX, composeMatrix(minX + rw * 0.5, y + 10, maxZ - 6, rw - 8, 20, 14), '__bar-counter');
          get('wood').geometry(UNIT_BOX, composeMatrix(minX + rw * 0.5, y + 20.8, maxZ - 6, rw - 2, 3, 18), '__bar-counter');
          get('gold-accent').geometry(UNIT_BOX, composeMatrix(minX + rw * 0.5, y + 3.5, maxZ + 3, rw - 10, 1.8, 1.8), '__bar-counter');
          get('wood-dark').geometry(UNIT_BOX, composeMatrix(maxX - 6, y + 10, minZ + rh * 0.5, 14, 20, rh - 10), '__bar-counter');
          get('wood').geometry(UNIT_BOX, composeMatrix(maxX - 6, y + 20.8, minZ + rh * 0.5, 18, 3, rh - 4), '__bar-counter');

          // 3 brass-tapped ale kegs + emerald bottles along the back bar
          for (let k = 0; k < 3; k += 1) {
            const kx = minX + 26 + k * 34;
            const kz = minZ + 18;
            const kegGeo = new THREE.CylinderGeometry(8.5, 9, 18, 10);
            get('wood').geometry(kegGeo, composeMatrix(kx, y + 11, kz, 1, 1, 1), '__bar-keg');
            kegGeo.dispose();
            const hoopGeo = new THREE.CylinderGeometry(9.4, 9.4, 2, 10);
            get('iron-dark').geometry(hoopGeo, composeMatrix(kx, y + 16, kz, 1, 1, 1), '__bar-keg');
            hoopGeo.dispose();
            get('bottle-emerald').geometry(UNIT_BOX, composeMatrix(kx + 14, y + 25.5, maxZ - 6, 3.2, 8.5, 3.2), '__bar-bottle');
          }
          // 3 carved oak barstools along the front of the bar
          for (let s = 0; s < 3; s += 1) {
            const stx = minX + 28 + s * 38;
            const stz = maxZ + 18;
            const seatGeo = new THREE.CylinderGeometry(8, 8, 2.5, 10);
            get('wood').geometry(seatGeo, composeMatrix(stx, y + 14, stz, 1, 1, 1), '__barstool');
            seatGeo.dispose();
            const legGeo = new THREE.CylinderGeometry(2.4, 4.5, 13, 6);
            get('wood-dark').geometry(legGeo, composeMatrix(stx, y + 7, stz, 1, 1, 1), '__barstool');
            legGeo.dispose();
            aoDiscs.push({ x: stx, y: y + 0.14, z: stz, radius: 11 });
          }
          // Warm bar lantern
          get('gold-accent').geometry(UNIT_BOX, composeMatrix(maxX - 8, y + 25, maxZ - 6, 5, 6, 5), '__bar-lamp');
          get('flame').geometry(UNIT_BOX, composeMatrix(maxX - 8, y + 29, maxZ - 6, 3.5, 4, 3.5), '__bar-lamp');
          torches.push({
            id: '__bar-lantern',
            position: new THREE.Vector3(maxX - 8, y + 31, maxZ - 6),
            radius: 210,
          });
        }
      }
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

    // Architectural interior detailing: oak wainscoting baseboard, beveled capstone & corner timber pilasters!
    if (opts.mapScale === 'interior' && opts.presetId !== 'lite') {
      const capKey: AtlasThreeSurfaceKey = doc.rooms.some((r) => r.material === 'holz') ? 'wood-dark' : 'rock';
      wallBox(get(capKey), q.start, q.end, thick * 1.24, -0.42 + wallH, 1.8, '__wall-cap');
      wallBox(get(capKey), q.start, q.end, thick * 1.22, -0.42, 4.2, '__wall-base');
      const postCount = Math.max(2, Math.round(length / 95) + 1);
      for (let pi = 0; pi < postCount; pi += 1) {
        const [px, pz] = pt(pi / Math.max(1, postCount - 1));
        get(capKey).geometry(
          UNIT_BOX,
          composeMatrix(px, -0.42 + wallH * 0.5, pz, thick * 1.45, wallH + 2.4, thick * 1.45),
          '__wall-pilaster',
        );
      }
    }
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
      emitCanonicalProp(get, q, objAngles.get(q.id) ?? 0, torches, aoDiscs, smokePoints, mistPoints, {
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
    if (inst.kind === 'oak' || inst.kind === 'birch' || inst.kind === 'pine' || inst.kind === 'mountain') {
      aoDiscs.push({
        x: inst.x,
        y: inst.elevation + 0.14,
        z: inst.y,
        radius: inst.kind === 'mountain' ? inst.scale * 46 : inst.scale * 24,
      });
    }
    if (inst.kind === 'mountain' && mistPoints.length < 18) {
      mistPoints.push({
        position: new THREE.Vector3(inst.x, inst.elevation + inst.scale * 36, inst.y),
        scale: inst.scale * 72,
      });
    }
  }
  const scatterBatches: AtlasThreeScatterBatch[] = [];
  for (const [kind, matrices] of scatterByKind) {
    if (matrices.length > 0) scatterBatches.push({ kind, matrices });
  }

  // Compute exact content bounding box so every map (e.g. Taverne at 200..600) frames dead-center!
  let minCX = Infinity;
  let maxCX = -Infinity;
  let minCZ = Infinity;
  let maxCZ = -Infinity;
  for (const r of doc.rooms) {
    if (r.id === 'w.ocean' || r.id === 'g.ocean') continue;
    const pts = r.points && r.points.length >= 3
      ? r.points
      : [
          [r.x, r.y],
          [r.x + r.w, r.y + r.h],
        ];
    for (const [px, pz] of pts) {
      if (px < minCX) minCX = px;
      if (px > maxCX) maxCX = px;
      if (pz < minCZ) minCZ = pz;
      if (pz > maxCZ) maxCZ = pz;
    }
  }
  for (const o of doc.objects) {
    if (o.x < minCX) minCX = o.x;
    if (o.x > maxCX) maxCX = o.x;
    if (o.y < minCZ) minCZ = o.y;
    if (o.y > maxCZ) maxCZ = o.y;
  }
  const hasBounds = Number.isFinite(minCX) && Number.isFinite(maxCX) && maxCX > minCX;
  const contentBounds: AtlasThreeContentBounds = hasBounds
    ? {
        centerX: (minCX + maxCX) * 0.5,
        centerZ: (minCZ + maxCZ) * 0.5,
        fitSpan:
          opts.mapScale === 'world'
            ? Math.max(360, Math.min(500, Math.max(maxCX - minCX, maxCZ - minCZ) * 0.54))
            : opts.mapScale === 'settlement'
              ? Math.max(175, Math.min(280, Math.max(maxCX - minCX, maxCZ - minCZ) * 0.58))
              : Math.max(210, Math.min(340, Math.max(maxCX - minCX, maxCZ - minCZ) * 0.74)),
      }
    : {
        centerX: 500,
        centerZ: 500,
        fitSpan: opts.mapScale === 'world' ? 430 : 210,
      };

  return {
    builders,
    water,
    terrain,
    waterLevel,
    contentBounds,
    doorInstances,
    scatterBatches,
    aoDiscs,
    smokePoints,
    mistPoints,
    torches,
    ids,
    look: opts.look,
    mapScale: opts.mapScale,
  };
}
