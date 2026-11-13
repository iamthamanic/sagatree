/**
 * atlas-heightfield — ATL2-D04 editable heightfield chunks (canonical terrain).
 * Location: src/domains/world/atlas/atlas-heightfield.ts
 *
 * Pure domain — no React / Host. Heights live on UnifiedCanvasDoc; polygons
 * remain untouched. Versioned chunk + brush ops + shore/water rules.
 */

export const ATLAS_HEIGHTFIELD_FORMAT = 'sagatree-atlas-heightfield-v1' as const;
export const ATLAS_HEIGHTFIELD_VERSION = 1 as const;

/** Absolute height clamp (world units). Extreme values rejected on parse. */
export const ATLAS_HEIGHT_MIN = -80;
export const ATLAS_HEIGHT_MAX = 120;
export const ATLAS_HEIGHTFIELD_MAX_CELLS = 128 * 128;
export const ATLAS_HEIGHTFIELD_DEFAULT_CELL = 8;
export const ATLAS_HEIGHTFIELD_DEFAULT_SIZE = 32;
export const ATLAS_HEIGHTFIELD_DEFAULT_WATER = 0;

export type AtlasHeightBrushMode = 'raise' | 'lower' | 'smooth' | 'flatten';

export type AtlasHeightfieldAssetRef = {
  readonly kind: 'inline' | 'host-asset';
  /** Host asset id when kind=host-asset; otherwise omitted. */
  readonly assetId?: string;
  readonly version: number;
};

export type AtlasHeightfield = {
  readonly format: typeof ATLAS_HEIGHTFIELD_FORMAT;
  readonly version: typeof ATLAS_HEIGHTFIELD_VERSION;
  readonly assetRef: AtlasHeightfieldAssetRef;
  /** World X of cell (0,0) corner. */
  readonly originX: number;
  /** World Z of cell (0,0) corner. */
  readonly originZ: number;
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  /** Row-major heights, length === cols * rows. */
  readonly heights: readonly number[];
  /** Shore / water plane; cells below are water-classified. */
  readonly waterLevel: number;
};

export type AtlasHeightBrushStroke = {
  readonly mode: AtlasHeightBrushMode;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly strength: number;
  /** Flatten target height when mode=flatten. */
  readonly targetHeight?: number;
};

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function clampAtlasHeight(h: number): number {
  return Math.min(ATLAS_HEIGHT_MAX, Math.max(ATLAS_HEIGHT_MIN, h));
}

export function emptyAtlasHeightfield(seed?: Partial<AtlasHeightfield>): AtlasHeightfield {
  const cols = seed?.cols && seed.cols > 0 ? Math.min(128, Math.floor(seed.cols)) : ATLAS_HEIGHTFIELD_DEFAULT_SIZE;
  const rows = seed?.rows && seed.rows > 0 ? Math.min(128, Math.floor(seed.rows)) : ATLAS_HEIGHTFIELD_DEFAULT_SIZE;
  const cellSize =
    seed?.cellSize && seed.cellSize > 0 ? seed.cellSize : ATLAS_HEIGHTFIELD_DEFAULT_CELL;
  const len = cols * rows;
  const heights =
    seed?.heights && seed.heights.length === len
      ? seed.heights.map((h) => clampAtlasHeight(finite(h) ? h : 0))
      : Array.from({ length: len }, () => 0);
  return {
    format: ATLAS_HEIGHTFIELD_FORMAT,
    version: ATLAS_HEIGHTFIELD_VERSION,
    assetRef: seed?.assetRef ?? { kind: 'inline', version: ATLAS_HEIGHTFIELD_VERSION },
    originX: finite(seed?.originX) ? seed.originX : 500 - (cols * cellSize) / 2,
    originZ: finite(seed?.originZ) ? seed.originZ : 500 - (rows * cellSize) / 2,
    cellSize,
    cols,
    rows,
    heights,
    waterLevel: finite(seed?.waterLevel) ? seed.waterLevel : ATLAS_HEIGHTFIELD_DEFAULT_WATER,
  };
}

export function parseAtlasHeightfield(raw: unknown): AtlasHeightfield | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.format !== ATLAS_HEIGHTFIELD_FORMAT) return null;
  if (o.version !== ATLAS_HEIGHTFIELD_VERSION) return null;
  if (!finite(o.originX) || !finite(o.originZ) || !finite(o.cellSize) || o.cellSize <= 0) return null;
  if (!finite(o.cols) || !finite(o.rows)) return null;
  const cols = Math.floor(o.cols);
  const rows = Math.floor(o.rows);
  if (cols < 2 || rows < 2 || cols * rows > ATLAS_HEIGHTFIELD_MAX_CELLS) return null;
  if (!Array.isArray(o.heights) || o.heights.length !== cols * rows) return null;
  const heights: number[] = [];
  for (const h of o.heights) {
    if (!finite(h) || h < ATLAS_HEIGHT_MIN || h > ATLAS_HEIGHT_MAX) return null;
    heights.push(h);
  }
  let assetRef: AtlasHeightfieldAssetRef = { kind: 'inline', version: ATLAS_HEIGHTFIELD_VERSION };
  if (o.assetRef != null && typeof o.assetRef === 'object' && !Array.isArray(o.assetRef)) {
    const ar = o.assetRef as Record<string, unknown>;
    if (ar.kind === 'host-asset' && typeof ar.assetId === 'string' && ar.assetId.length > 0) {
      assetRef = {
        kind: 'host-asset',
        assetId: ar.assetId,
        version: finite(ar.version) ? Math.floor(ar.version) : ATLAS_HEIGHTFIELD_VERSION,
      };
    } else if (ar.kind === 'inline') {
      assetRef = {
        kind: 'inline',
        version: finite(ar.version) ? Math.floor(ar.version) : ATLAS_HEIGHTFIELD_VERSION,
      };
    } else {
      return null;
    }
  }
  return {
    format: ATLAS_HEIGHTFIELD_FORMAT,
    version: ATLAS_HEIGHTFIELD_VERSION,
    assetRef,
    originX: o.originX,
    originZ: o.originZ,
    cellSize: o.cellSize,
    cols,
    rows,
    heights,
    waterLevel: finite(o.waterLevel) ? o.waterLevel : ATLAS_HEIGHTFIELD_DEFAULT_WATER,
  };
}

export function serializeAtlasHeightfield(hf: AtlasHeightfield): AtlasHeightfield {
  return {
    format: ATLAS_HEIGHTFIELD_FORMAT,
    version: ATLAS_HEIGHTFIELD_VERSION,
    assetRef: { ...hf.assetRef },
    originX: hf.originX,
    originZ: hf.originZ,
    cellSize: hf.cellSize,
    cols: hf.cols,
    rows: hf.rows,
    heights: [...hf.heights],
    waterLevel: hf.waterLevel,
  };
}

export function snapshotAtlasHeightfield(hf: AtlasHeightfield): AtlasHeightfield {
  return serializeAtlasHeightfield(hf);
}

export function heightfieldIndex(cols: number, col: number, row: number): number {
  return row * cols + col;
}

export function sampleHeightfield(hf: AtlasHeightfield, x: number, z: number): number {
  const u = (x - hf.originX) / hf.cellSize;
  const v = (z - hf.originZ) / hf.cellSize;
  const c0 = Math.floor(u);
  const r0 = Math.floor(v);
  if (c0 < 0 || r0 < 0 || c0 >= hf.cols - 1 || r0 >= hf.rows - 1) return 0;
  const tx = u - c0;
  const ty = v - r0;
  const i00 = heightfieldIndex(hf.cols, c0, r0);
  const i10 = heightfieldIndex(hf.cols, c0 + 1, r0);
  const i01 = heightfieldIndex(hf.cols, c0, r0 + 1);
  const i11 = heightfieldIndex(hf.cols, c0 + 1, r0 + 1);
  const h00 = hf.heights[i00] ?? 0;
  const h10 = hf.heights[i10] ?? 0;
  const h01 = hf.heights[i01] ?? 0;
  const h11 = hf.heights[i11] ?? 0;
  const a = h00 + (h10 - h00) * tx;
  const b = h01 + (h11 - h01) * tx;
  return a + (b - a) * ty;
}

export function isWaterCell(hf: AtlasHeightfield, col: number, row: number): boolean {
  const i = heightfieldIndex(hf.cols, col, row);
  const h = hf.heights[i];
  return finite(h) && h < hf.waterLevel;
}

/** Shore rule: cells below waterLevel stay water; brush cannot raise them above shore without leaveWater. */
export function applyShoreRule(
  height: number,
  waterLevel: number,
  opts?: { readonly leaveWater?: boolean },
): number {
  const h = clampAtlasHeight(height);
  if (opts?.leaveWater) return h;
  if (h < waterLevel) return Math.min(h, waterLevel - 0.01);
  return h;
}

export function applyHeightBrush(
  hf: AtlasHeightfield,
  stroke: AtlasHeightBrushStroke,
): AtlasHeightfield {
  if (!finite(stroke.x) || !finite(stroke.z) || !finite(stroke.radius) || stroke.radius <= 0) {
    return hf;
  }
  const strength = finite(stroke.strength) ? stroke.strength : 1;
  const radius = stroke.radius;
  const next = hf.heights.slice();
  const r2 = radius * radius;
  let changed = false;
  for (let row = 0; row < hf.rows; row++) {
    for (let col = 0; col < hf.cols; col++) {
      const cx = hf.originX + (col + 0.5) * hf.cellSize;
      const cz = hf.originZ + (row + 0.5) * hf.cellSize;
      const dx = cx - stroke.x;
      const dz = cz - stroke.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      const w = 1 - Math.sqrt(d2) / radius;
      const falloff = w * w;
      const i = heightfieldIndex(hf.cols, col, row);
      const cur = next[i] ?? 0;
      let h = cur;
      if (stroke.mode === 'raise') {
        h = cur + strength * falloff;
      } else if (stroke.mode === 'lower') {
        h = cur - strength * falloff;
      } else if (stroke.mode === 'flatten') {
        const target = finite(stroke.targetHeight) ? stroke.targetHeight : 0;
        h = cur + (target - cur) * Math.min(1, strength * falloff);
      } else {
        // smooth — average 3×3 neighborhood
        let sum = 0;
        let n = 0;
        for (let rr = row - 1; rr <= row + 1; rr++) {
          for (let cc = col - 1; cc <= col + 1; cc++) {
            if (rr < 0 || cc < 0 || rr >= hf.rows || cc >= hf.cols) continue;
            sum += next[heightfieldIndex(hf.cols, cc, rr)] ?? 0;
            n++;
          }
        }
        const avg = n > 0 ? sum / n : cur;
        h = cur + (avg - cur) * Math.min(1, strength * falloff);
      }
      h = applyShoreRule(h, hf.waterLevel);
      if (h !== cur) {
        next[i] = h;
        changed = true;
      }
    }
  }
  if (!changed) return hf;
  return {
    ...hf,
    heights: next,
    assetRef: { ...hf.assetRef, version: hf.assetRef.version + 1 },
  };
}

/** Zero all heights (delete hill) while keeping chunk frame. */
export function clearAtlasHeightfield(hf: AtlasHeightfield): AtlasHeightfield {
  const zeros = Array.from({ length: hf.cols * hf.rows }, () => 0);
  return {
    ...hf,
    heights: zeros,
    assetRef: { ...hf.assetRef, version: hf.assetRef.version + 1 },
  };
}

/** Build triangle list for 3D mesh (y-up): [x,y,z] verts as flat quads → 2 tris. */
export function heightfieldMeshTriangles(
  hf: AtlasHeightfield,
): readonly (readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]])[] {
  const tris: [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ][] = [];
  for (let row = 0; row < hf.rows - 1; row++) {
    for (let col = 0; col < hf.cols - 1; col++) {
      const x0 = hf.originX + col * hf.cellSize;
      const z0 = hf.originZ + row * hf.cellSize;
      const x1 = x0 + hf.cellSize;
      const z1 = z0 + hf.cellSize;
      const y00 = hf.heights[heightfieldIndex(hf.cols, col, row)] ?? 0;
      const y10 = hf.heights[heightfieldIndex(hf.cols, col + 1, row)] ?? 0;
      const y01 = hf.heights[heightfieldIndex(hf.cols, col, row + 1)] ?? 0;
      const y11 = hf.heights[heightfieldIndex(hf.cols, col + 1, row + 1)] ?? 0;
      const p00: [number, number, number] = [x0, y00, z0];
      const p10: [number, number, number] = [x1, y10, z0];
      const p01: [number, number, number] = [x0, y01, z1];
      const p11: [number, number, number] = [x1, y11, z1];
      tris.push([p00, p10, p11]);
      tris.push([p00, p11, p01]);
    }
  }
  return tris;
}

export function heightfieldContentFingerprint(hf: AtlasHeightfield | null | undefined): string {
  if (!hf) return 'hf:none';
  let sum = 0;
  for (let i = 0; i < hf.heights.length; i++) sum += (hf.heights[i] ?? 0) * (i + 1);
  return `hf:${hf.cols}x${hf.rows}:${hf.cellSize}:${hf.waterLevel}:${hf.assetRef.version}:${sum.toFixed(3)}`;
}
