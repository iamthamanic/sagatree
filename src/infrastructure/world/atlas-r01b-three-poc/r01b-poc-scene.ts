/**
 * r01b-poc-scene — ATL3-R01B (#1296) Three.js scene from the SAME canonical data.
 * Location: src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts
 *
 * Input: stored UnifiedCanvasDoc → `buildAtlasProductGeometryPlan` (domain SoT) + heightfield.
 * Geometry mirrors the productive custom-WebGL runtime 1:1 (y-levels incl. the R01B layer
 * spacing, wall heights per map scale, door carving, stamp dimensions in `u = size`).
 * Look follows Ben's Atlas V8 reference: PBR map/normal/roughness atlas, MeshStandardMaterial,
 * soft shadows, ACES, fog. Read-only research PoC — no write path, never product-mounted.
 */
import * as THREE from 'three';
import {
  buildAtlasProductGeometryPlan,
  type AtlasProductGeometryPrimitive,
} from '../../../domains/world/atlas/atlas-product-geometry-plan';
import type { AtlasHeightfield } from '../../../domains/world/atlas/atlas-heightfield';
import type { UnifiedCanvasDoc } from '../../../domains/world/atlas/unified-canvas-doc';

export type R01bMapScale = 'world' | 'settlement' | 'interior';
export type R01bLook = 'outdoor' | 'indoor';
export const R01B_PBR_KINDS = [
  'grass', 'dirt', 'moss', 'rock', 'wall', 'wood', 'roof', 'cobble', 'plaster', 'gravel',
] as const;
export type R01bPbrKind = (typeof R01B_PBR_KINDS)[number];

type SurfaceSpec = {
  readonly pbr: R01bPbrKind | null;
  readonly color: string;
  readonly roughness: number;
  readonly normalScale: number;
  /** World units per texture tile (box-projected UVs keep texel density constant). */
  readonly tile: number;
  readonly emissive?: string;
  readonly metalness?: number;
};

/** Colours / roughness / normal strength from V8 `terrainField` + props (tinted for the atlas). */
export const R01B_SURFACES = {
  'terrain-grass': { pbr: 'grass', color: '#ffffff', roughness: 0.97, normalScale: 0.63, tile: 70 },
  'terrain-shore': { pbr: 'gravel', color: '#e5d9c1', roughness: 0.93, normalScale: 0.51, tile: 50 },
  'terrain-bed': { pbr: 'gravel', color: '#75938a', roughness: 0.87, normalScale: 0.56, tile: 50 },
  'terrain-cliff': { pbr: 'rock', color: '#a9b2a0', roughness: 0.94, normalScale: 0.77, tile: 60 },
  'sheet-outdoor': { pbr: 'grass', color: '#c9d6b5', roughness: 0.97, normalScale: 0.5, tile: 70 },
  'sheet-indoor': { pbr: 'rock', color: '#4d565a', roughness: 0.96, normalScale: 0.7, tile: 60 },
  'floor-cobble': { pbr: 'cobble', color: '#d2c9b2', roughness: 0.9, normalScale: 0.68, tile: 34 },
  'floor-stone': { pbr: 'cobble', color: '#a8a59a', roughness: 0.92, normalScale: 0.72, tile: 30 },
  'floor-wood': { pbr: 'wood', color: '#d3a77b', roughness: 0.86, normalScale: 0.56, tile: 30 },
  'floor-dirt': { pbr: 'dirt', color: '#c6b18a', roughness: 0.98, normalScale: 0.58, tile: 40 },
  'floor-gravel': { pbr: 'gravel', color: '#e5d9c1', roughness: 0.93, normalScale: 0.51, tile: 40 },
  'floor-grass': { pbr: 'grass', color: '#ffffff', roughness: 0.97, normalScale: 0.63, tile: 60 },
  'floor-moss': { pbr: 'moss', color: '#a1c3a1', roughness: 0.94, normalScale: 0.56, tile: 40 },
  wall: { pbr: 'wall', color: '#ddd6bf', roughness: 0.94, normalScale: 0.58, tile: 26 },
  'wall-indoor': { pbr: 'wall', color: '#b8b19e', roughness: 0.95, normalScale: 0.66, tile: 22 },
  plaster: { pbr: 'plaster', color: '#f0dfbf', roughness: 0.97, normalScale: 0.33, tile: 22 },
  roof: { pbr: 'roof', color: '#f4c0a7', roughness: 0.85, normalScale: 0.81, tile: 18 },
  wood: { pbr: 'wood', color: '#d3a77b', roughness: 0.86, normalScale: 0.56, tile: 16 },
  'wood-dark': { pbr: 'wood', color: '#8d6a4b', roughness: 0.88, normalScale: 0.6, tile: 14 },
  rock: { pbr: 'rock', color: '#a9b2a0', roughness: 0.94, normalScale: 0.77, tile: 28 },
  leaf: { pbr: 'moss', color: '#8fbf8a', roughness: 0.94, normalScale: 0.56, tile: 18 },
  'leaf-pine': { pbr: 'moss', color: '#6f9f86', roughness: 0.94, normalScale: 0.56, tile: 18 },
  window: { pbr: null, color: '#2a3a48', roughness: 0.25, normalScale: 0, tile: 1, metalness: 0.1 },
  flame: { pbr: null, color: '#ffb35c', roughness: 1, normalScale: 0, tile: 1, emissive: '#ffa858' },
} as const satisfies Record<string, SurfaceSpec>;
export type R01bSurfaceKey = keyof typeof R01B_SURFACES;

/** Canvas materials (German doc keys + English runtime keys) → floor surface. */
export function r01bFloorSurface(material: string | undefined, scale: R01bMapScale): R01bSurfaceKey | 'water' {
  const m = (material ?? '').toLowerCase();
  if (m === 'wasser' || m === 'water') return 'water';
  if (m === 'holz' || m === 'wood') return 'floor-wood';
  if (m === 'pflaster' || m === 'paving') return 'floor-cobble';
  if (m === 'stein' || m === 'stone') return scale === 'interior' ? 'floor-stone' : 'floor-cobble';
  if (m === 'erde' || m === 'earth') return 'floor-dirt';
  if (m === 'sand') return 'floor-gravel';
  if (m === 'moos' || m === 'moss') return 'floor-moss';
  return 'floor-grass';
}

/** Box-projected world UVs + per-triangle canonical id (picking / 2D↔3D id parity). */
export class R01bGeoBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly triIds: string[] = [];

  constructor(private readonly tile: number) {}

  get triangleCount(): number {
    return this.triIds.length;
  }

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, id: string, normal?: THREE.Vector3): void {
    const n = normal ?? new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (const p of [a, b, c]) {
      this.positions.push(p.x, p.y, p.z);
      this.normals.push(n.x, n.y, n.z);
      if (ay >= ax && ay >= az) this.uvs.push(p.x / this.tile, p.z / this.tile);
      else if (az >= ax) this.uvs.push(p.x / this.tile, p.y / this.tile);
      else this.uvs.push(p.z / this.tile, p.y / this.tile);
    }
    this.triIds.push(id);
  }

  /** Append a (possibly indexed) Three geometry transformed by `matrix`. */
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
const tmpM = new THREE.Matrix4();

function boxMatrix(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, rotY = 0): THREE.Matrix4 {
  return tmpM.compose(
    new THREE.Vector3(cx, cy, cz),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(Math.max(1e-3, sx), Math.max(1e-3, sy), Math.max(1e-3, sz)),
  );
}

/** Collected scene parts; the runtime turns them into meshes/materials. */
export type R01bScenePlan = {
  readonly builders: Map<R01bSurfaceKey, R01bGeoBuilder>;
  readonly water: R01bGeoBuilder;
  readonly terrain: {
    readonly geometry: THREE.BufferGeometry;
    readonly groups: readonly { readonly surface: R01bSurfaceKey; readonly start: number; readonly count: number }[];
    readonly stride: number;
  } | null;
  /** Door jambs + lintels as instances of one unit box (InstancedMesh). */
  readonly doorInstances: { readonly matrices: THREE.Matrix4[]; readonly ids: string[] };
  readonly torches: readonly { readonly id: string; readonly position: THREE.Vector3; readonly radius: number }[];
  readonly ids: ReadonlySet<string>;
  readonly planFingerprint: string;
  readonly look: R01bLook;
  readonly mapScale: R01bMapScale;
};

/** Same LOD bands / triangle budget as the custom runtime (ATL2-D05). */
export function r01bTerrainStride(span: number, cols: number, rows: number): number {
  const preferred = span >= 280 ? 4 : span >= 90 ? 2 : 1;
  const maxTris = preferred >= 4 ? 800 : preferred >= 2 ? 2500 : 8000;
  let stride = Math.max(1, preferred);
  const estimate = (s: number): number => Math.ceil((cols - 1) / s) * Math.ceil((rows - 1) / s) * 2;
  while (estimate(stride) > maxTris && stride < Math.max(cols, rows)) stride += 1;
  return stride;
}

function terrainSurface(avg: number, water: number): R01bSurfaceKey {
  if (avg < water) return 'terrain-bed';
  if (avg < water + 1.5) return 'terrain-shore';
  if (avg < 8) return 'terrain-grass';
  return 'terrain-cliff';
}

function buildTerrain(hf: AtlasHeightfield, span: number): R01bScenePlan['terrain'] {
  if (hf.cols < 2 || hf.rows < 2) return null;
  const stride = r01bTerrainStride(span, hf.cols, hf.rows);
  const colsL: number[] = [];
  for (let c = 0; c < hf.cols - 1; c += stride) colsL.push(c);
  colsL.push(hf.cols - 1);
  const rowsL: number[] = [];
  for (let r = 0; r < hf.rows - 1; r += stride) rowsL.push(r);
  rowsL.push(hf.rows - 1);
  const h = (c: number, r: number): number => Number(hf.heights[r * hf.cols + c]) || 0;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const r of rowsL) {
    for (const c of colsL) {
      const x = hf.originX + c * hf.cellSize, z = hf.originZ + r * hf.cellSize;
      positions.push(x, h(c, r), z);
      uvs.push(x / 70, z / 70);
    }
  }
  const W = colsL.length;
  const bySurface = new Map<R01bSurfaceKey, number[]>();
  for (let j = 0; j + 1 < rowsL.length; j += 1) {
    for (let i = 0; i + 1 < colsL.length; i += 1) {
      const i00 = j * W + i, i10 = j * W + i + 1, i01 = (j + 1) * W + i, i11 = (j + 1) * W + i + 1;
      const avg = (h(colsL[i], rowsL[j]) + h(colsL[i + 1], rowsL[j]) + h(colsL[i], rowsL[j + 1]) + h(colsL[i + 1], rowsL[j + 1])) / 4;
      const key = terrainSurface(avg, hf.waterLevel);
      const list = bySurface.get(key) ?? [];
      // Same split as the runtime: (p00,p10,p11) + (p00,p11,p01); wound for +Y normals.
      list.push(i00, i11, i10, i00, i01, i11);
      bySurface.set(key, list);
    }
  }
  const index: number[] = [];
  const groups: { surface: R01bSurfaceKey; start: number; count: number }[] = [];
  for (const [surface, list] of bySurface) {
    groups.push({ surface, start: index.length, count: list.length });
    index.push(...list);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return { geometry, groups, stride };
}

function ribbon(b: R01bGeoBuilder, points: readonly (readonly [number, number])[], width: number, y: number, id: string): void {
  const r = Math.max(0.15, width) / 2;
  const up = new THREE.Vector3(0, 1, 0);
  const kept: (readonly [number, number])[] = [];
  for (const p of points) {
    const last = kept[kept.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < r * 0.35) continue;
    kept.push(p);
  }
  kept.forEach(([x, z], i) => {
    for (let k = 0; k < 10; k += 1) {
      const a = (k * Math.PI) / 5, c = ((k + 1) * Math.PI) / 5;
      b.tri(new THREE.Vector3(x, y, z), new THREE.Vector3(x + Math.cos(c) * r, y, z + Math.sin(c) * r), new THREE.Vector3(x + Math.cos(a) * r, y, z + Math.sin(a) * r), id, up);
    }
    if (i === 0) return;
    const [px, pz] = kept[i - 1];
    const len = Math.hypot(x - px, z - pz) || 1, nx = (-(z - pz) / len) * r, nz = ((x - px) / len) * r;
    const q0 = new THREE.Vector3(px + nx, y, pz + nz), q1 = new THREE.Vector3(x + nx, y, z + nz);
    const q2 = new THREE.Vector3(x - nx, y, z - nz), q3 = new THREE.Vector3(px - nx, y, pz - nz);
    b.tri(q0, q1, q2, id, up);
    b.tri(q0, q2, q3, id, up);
  });
}

/** Wall segment as a box (thickness = doc width), rotated along the wall. */
function wallBox(b: R01bGeoBuilder, s: readonly [number, number], e: readonly [number, number], thick: number, baseY: number, height: number, id: string): void {
  const dx = e[0] - s[0], dz = e[1] - s[1], len = Math.hypot(dx, dz);
  if (len < 0.02) return;
  b.geometry(UNIT_BOX, boxMatrix((s[0] + e[0]) / 2, baseY + height / 2, (s[1] + e[1]) / 2, len, height, thick, Math.atan2(-dz, dx)), id);
}

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type PropPrim = Extract<AtlasProductGeometryPrimitive, { kind: 'prop' | 'building_footprint' }>;

function propInto(
  get: (k: R01bSurfaceKey) => R01bGeoBuilder,
  p: PropPrim,
  torches: { id: string; position: THREE.Vector3; radius: number }[],
  fullDetail: boolean,
): void {
  const u = Math.min(40, Math.max(0.01, p.size || 1));
  const H = p.height > 0 ? Math.min(10, Math.max(0.1, p.height)) : 1;
  const x = p.x, z = p.y, elev = Number.isFinite(p.elevation) ? p.elevation : 0, id = p.id;
  const box = (k: R01bSurfaceKey, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): void =>
    get(k).geometry(UNIT_BOX, boxMatrix(cx, cy, cz, sx, sy, sz), id);
  const cone = (k: R01bSurfaceKey, cx: number, y0: number, cz: number, r: number, h: number, seg: number): void => {
    const g = new THREE.ConeGeometry(r, h, seg);
    get(k).geometry(g, new THREE.Matrix4().makeTranslation(cx, y0 + h / 2, cz), id);
    g.dispose();
  };
  const pyramid = (k: R01bSurfaceKey, cx: number, y0: number, cz: number, w: number, h: number, d: number): void => {
    const g = new THREE.ConeGeometry(Math.SQRT1_2, h, 4);
    g.rotateY(Math.PI / 4);
    get(k).geometry(g, new THREE.Matrix4().compose(new THREE.Vector3(cx, y0 + h / 2, cz), new THREE.Quaternion(), new THREE.Vector3(w, 1, d)), id);
    g.dispose();
  };
  const octa = (k: R01bSurfaceKey, cx: number, cy: number, cz: number, s: number): void => {
    const g = new THREE.OctahedronGeometry(s / 2, 0);
    get(k).geometry(g, new THREE.Matrix4().makeTranslation(cx, cy, cz), id);
    g.dispose();
  };
  switch (p.stamp) {
    case 'baum':
    case 'tanne': {
      const s = p.stamp === 'tanne' ? 58 : 62;
      box('wood-dark', x, elev + 0.12 * s * u, z, 0.12 * s * u, 0.24 * s * u, 0.12 * s * u);
      if (p.stamp === 'tanne') {
        cone('leaf-pine', x, elev + 0.18 * s * u, z, 0.55 * s * u, 1.15 * s * u, 7);
        cone('leaf-pine', x, elev + 0.55 * s * u, z, 0.4 * s * u, 0.95 * s * u, 7);
        cone('leaf-pine', x, elev + 0.95 * s * u, z, 0.26 * s * u, 0.7 * s * u, 6);
      } else {
        cone('leaf', x, elev + 0.2 * s * u, z, 0.65 * s * u, 1.03 * s * u, 7);
        cone('leaf', x, elev + 0.63 * s * u, z, 0.48 * s * u, 0.92 * s * u, 7);
      }
      break;
    }
    case 'fels':
      if (hash(id) % 2 === 0) octa('rock', x, elev + 14 * u, z, 30 * u);
      else {
        box('rock', x, elev + 10 * u, z, 36 * u, 20 * u, 28 * u);
        box('rock', x + 10 * u, elev + 16 * u, z - 6 * u, 18 * u, 14 * u, 16 * u);
        octa('rock', x - 8 * u, elev + 18 * u, z + 4 * u, 12 * u);
      }
      break;
    case 'haus': {
      const n = hash(id) % 3;
      const wallKey: R01bSurfaceKey = n === 2 ? 'wall' : 'plaster';
      const bw = 80 * u, bd = 60 * u, bh = 55 * u * H;
      box(wallKey, x, elev + bh * 0.48 + 0.06, z, bw, bh, bd);
      pyramid('roof', x, elev + bh + 0.06, z, bw * 1.2, bh * 0.64, bd * 1.2);
      box('wood-dark', x, elev + bh * 0.35 + 0.1, z + bd * 0.5 - bd * 0.06, bw * 0.18, bh * 0.55, bd * 0.12);
      if (fullDetail) {
        const wy = elev + bh * 0.55, wh = bh * 0.18, ww = bw * 0.12, wd = bd * 0.04;
        box('window', x - bw * 0.28, wy, z + bd * 0.5 - wd, ww, wh, wd);
        box('window', x + bw * 0.28, wy, z + bd * 0.5 - wd, ww, wh, wd);
        if (n === 0) {
          box('wood-dark', x, elev + bh * 0.15, z + bd * 0.5 - wd * 0.5, bw * 0.92, bh * 0.04, wd * 0.5);
          box('wood-dark', x, elev + bh * 0.78, z + bd * 0.5 - wd * 0.5, bw * 0.92, bh * 0.04, wd * 0.5);
        }
      }
      break;
    }
    case 'turm': {
      const bh = 90 * u * H, bw = 40 * u;
      box('wall', x, elev + bh * 0.5, z, bw, bh, bw);
      pyramid('roof', x, elev + bh, z, 52 * u, 30 * u, 52 * u);
      box('wood-dark', x, elev + bh * 0.22, z + bw * 0.5 - bw * 0.08, bw * 0.22, bh * 0.28, bw * 0.12);
      if (fullDetail) {
        box('window', x, elev + bh * 0.62, z + bw * 0.5 - bw * 0.05, bw * 0.14, bh * 0.12, bw * 0.08);
        box('window', x, elev + bh * 0.78, z + bw * 0.5 - bw * 0.05, bw * 0.14, bh * 0.12, bw * 0.08);
      }
      break;
    }
    case 'tisch':
      box('wood', x, elev + 30 * u, z, 80 * u, 6 * u, 48 * u);
      for (const xx of [-34, 34]) for (const zz of [-18, 18]) box('wood-dark', x + xx * u, elev + 14 * u, z + zz * u, 6 * u, 28 * u, 6 * u);
      break;
    case 'stuhl':
      box('wood', x, elev + 18 * u, z, 44 * u, 5 * u, 44 * u);
      box('wood-dark', x, elev + 36 * u, z - 19 * u, 44 * u, 36 * u, 6 * u);
      break;
    case 'fass':
      box('wood', x, elev + 26 * u, z, 56 * u, 52 * u, 56 * u);
      box('wood-dark', x, elev + 52.5 * u, z, 50 * u, u, 50 * u);
      break;
    case 'bett':
      box('wood-dark', x, elev + 12 * u, z, 80 * u, 24 * u, 60 * u);
      box('plaster', x, elev + 26 * u, z - 15 * u, 64 * u, 6 * u, 18 * u);
      break;
    case 'teppich':
      box('floor-dirt', x, elev + u, z, 80 * u, 2 * u, 48 * u);
      break;
    case 'lampe': {
      box('wood-dark', x, elev + 20 * u, z, 6 * u, 40 * u, 6 * u);
      octa('flame', x, elev + 44 * u, z, 8 * u);
      torches.push({ id, position: new THREE.Vector3(x, elev + 46 * u, z), radius: Math.max(120, 420 * u) });
      break;
    }
    default:
      // kiste / unknown stamps: crate (same 44u footprint as the custom runtime).
      box('wood', x, elev + 22 * u, z, 44 * u, 44 * u, 44 * u);
      box('wood-dark', x, elev + 44.5 * u, z, 46 * u, 2 * u, 46 * u);
  }
}

export type R01bSceneOptions = {
  readonly mapScale: R01bMapScale;
  readonly look: R01bLook;
  /** Camera span — drives the terrain LOD stride exactly like the custom runtime. */
  readonly span: number;
  readonly fullDetail: boolean;
};

/** Doc → scene parts. Pure apart from Three math/geometry helpers (no GL). */
export function buildR01bScenePlan(doc: UnifiedCanvasDoc, opts: R01bSceneOptions): R01bScenePlan {
  const plan = buildAtlasProductGeometryPlan(doc, { mapScale: opts.mapScale });
  const builders = new Map<R01bSurfaceKey, R01bGeoBuilder>();
  const get = (k: R01bSurfaceKey): R01bGeoBuilder => {
    let b = builders.get(k);
    if (!b) {
      b = new R01bGeoBuilder(R01B_SURFACES[k].tile);
      builders.set(k, b);
    }
    return b;
  };
  const water = new R01bGeoBuilder(60);
  const ids = new Set<string>();
  const torches: { id: string; position: THREE.Vector3; radius: number }[] = [];
  const doorInstances: { matrices: THREE.Matrix4[]; ids: string[] } = { matrices: [], ids: [] };
  const up = new THREE.Vector3(0, 1, 0);

  // Sheet (non-world product maps) at y −0.5 — PRODUCT_FRAME 1000×1000.
  if (opts.mapScale !== 'world') {
    const b = get(opts.look === 'indoor' ? 'sheet-indoor' : 'sheet-outdoor');
    const y = -0.5;
    const p = (x: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
    b.tri(p(0, 0), p(0, 1000), p(1000, 1000), '__sheet', up);
    b.tri(p(0, 0), p(1000, 1000), p(1000, 0), '__sheet', up);
  }

  const rooms = plan.primitives.filter((q): q is Extract<AtlasProductGeometryPrimitive, { kind: 'area' | 'room' }> => q.kind === 'area' || q.kind === 'room');
  const dyR = Math.min(0.075, 0.3 / Math.max(1, rooms.length));
  const roomMaterial = new Map(doc.rooms.map((r) => [r.id, r.material] as const));
  rooms.forEach((rm, i) => {
    const y = -0.48 + i * dyR;
    const surface = r01bFloorSurface(roomMaterial.get(rm.id), opts.mapScale);
    const b = surface === 'water' ? water : get(surface);
    for (const [ia, ib, ic] of rm.triangles) {
      const a = rm.points[ia], c = rm.points[ib], d = rm.points[ic];
      if (!a || !c || !d) continue;
      const va = new THREE.Vector3(a[0], y, a[1]), vb = new THREE.Vector3(c[0], y, c[1]), vc = new THREE.Vector3(d[0], y, d[1]);
      // Canvas winding varies — always emit an upward-facing triangle.
      const n = new THREE.Vector3().subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va));
      if (n.y >= 0) b.tri(va, vb, vc, rm.id, up);
      else b.tri(va, vc, vb, rm.id, up);
    }
    ids.add(rm.id);
  });

  const paths = plan.primitives.filter((q): q is Extract<AtlasProductGeometryPrimitive, { kind: 'path' }> => q.kind === 'path');
  const dyS = Math.min(0.03, 0.11 / Math.max(1, paths.length));
  const strokeMaterial = new Map(doc.strokes.map((s) => [s.id, s.material] as const));
  paths.forEach((pt, i) => {
    const surface = r01bFloorSurface(strokeMaterial.get(pt.id), opts.mapScale);
    ribbon(surface === 'water' ? water : get(surface), pt.points, pt.width, -0.16 + i * dyS, pt.id);
    ids.add(pt.id);
  });

  const wallH = opts.mapScale === 'interior' ? 22 : opts.mapScale === 'settlement' ? 8 : 3;
  const doorsByWall = new Map<string, Extract<AtlasProductGeometryPrimitive, { kind: 'door' }>[]>();
  for (const q of plan.primitives) {
    if (q.kind !== 'door') continue;
    const list = doorsByWall.get(q.wallId) ?? [];
    list.push(q);
    doorsByWall.set(q.wallId, list);
  }
  const wallKey: R01bSurfaceKey = opts.look === 'indoor' ? 'wall-indoor' : 'wall';
  for (const q of plan.primitives) {
    if (q.kind !== 'wall') continue;
    ids.add(q.id);
    const dx = q.end[0] - q.start[0], dz = q.end[1] - q.start[1], length = Math.hypot(dx, dz);
    if (length < 0.02) continue;
    const thick = Math.max(0.3, q.width || wallH * 0.15);
    const gaps = (doorsByWall.get(q.id) ?? [])
      .map((d) => {
        const halfT = Math.min(0.49, Math.max(0.4, d.width || 1.2) / 2 / length);
        const t = Math.min(1, Math.max(0, d.t || 0.5));
        return [Math.max(0, t - halfT), Math.min(1, t + halfT)] as [number, number];
      })
      .sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const g of gaps) {
      const last = merged[merged.length - 1];
      if (!last || g[0] > last[1] + 1e-4) merged.push([g[0], g[1]]);
      else last[1] = Math.max(last[1], g[1]);
    }
    let cursor = 0;
    const at = (t: number): readonly [number, number] => [q.start[0] + dx * t, q.start[1] + dz * t];
    for (const [g0, g1] of merged) {
      if (g0 - cursor > 1e-3) wallBox(get(wallKey), at(cursor), at(g0), thick, -0.02, wallH, q.id);
      cursor = g1;
    }
    if (1 - cursor > 1e-3) wallBox(get(wallKey), at(cursor), q.end, thick, -0.02, wallH, q.id);
  }

  // Doors: jambs + lintel (same dimensions as productDoorInto) → one InstancedMesh.
  for (const q of plan.primitives) {
    if (q.kind !== 'door') continue;
    ids.add(q.id);
    const width = Math.max(0.4, q.width || 1.2), openH = Math.max(1.2, wallH * 0.82), lintelH = Math.max(0.25, wallH - openH);
    const [tx, tz] = q.tangent, [x, z] = q.position;
    const half = width / 2, jamb = Math.max(0.18, width * 0.08), thick = Math.max(0.25, width * 0.12);
    const rot = Math.atan2(-tz, tx);
    for (const side of [-1, 1]) {
      const cx = x + tx * side * (half - jamb / 2), cz = z + tz * side * (half - jamb / 2);
      doorInstances.matrices.push(boxMatrix(cx, -0.02 + openH / 2, cz, jamb, openH, thick * 2, rot).clone());
      doorInstances.ids.push(q.id);
    }
    doorInstances.matrices.push(boxMatrix(x, -0.02 + openH + lintelH / 2, z, width, lintelH, thick * 2, rot).clone());
    doorInstances.ids.push(q.id);
  }

  for (const q of plan.primitives) {
    if (q.kind !== 'prop' && q.kind !== 'building_footprint') continue;
    ids.add(q.id);
    propInto(get, q, torches, opts.fullDetail);
  }

  const hf = doc.heightfield ?? null;
  const terrain = hf ? buildTerrain(hf, opts.span) : null;
  if (hf && terrain) {
    // Water plane at shore level over the heightfield chunk (runtime parity).
    const y = hf.waterLevel - 0.02, x0 = hf.originX, z0 = hf.originZ;
    const x1 = x0 + hf.cols * hf.cellSize, z1 = z0 + hf.rows * hf.cellSize;
    water.tri(new THREE.Vector3(x0, y, z0), new THREE.Vector3(x0, y, z1), new THREE.Vector3(x1, y, z1), '__terrain-water', up);
    water.tri(new THREE.Vector3(x0, y, z0), new THREE.Vector3(x1, y, z1), new THREE.Vector3(x1, y, z0), '__terrain-water', up);
  }

  return {
    builders,
    water,
    terrain,
    doorInstances,
    torches,
    ids,
    planFingerprint: plan.contentFingerprint,
    look: opts.look,
    mapScale: opts.mapScale,
  };
}
