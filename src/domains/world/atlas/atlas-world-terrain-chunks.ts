/**
 * atlas-world-terrain-chunks — Shared Chunked World Heightfield & Visumaxx LOD Contract.
 * Location: src/domains/world/atlas/atlas-world-terrain-chunks.ts
 *
 * Pure domain — NO React, NO Three.js, NO DOM, NO Host SDK (BR-005).
 *
 * Implements the Google-Maps / GTA / RDR2 "ONE World, ONE Ground" architecture:
 *  - A single authoritative World Heightfield owned by the world root covers the entire
 *    world coordinate space `[0..1000] × [0..1000]` (continents above `waterLevel`,
 *    ocean floor below `waterLevel` — one continuous physical coastline).
 *  - Subdivided lazily via a camera-driven quadtree into fixed-resolution chunks
 *    (`L<lod>:<gx>:<gz>`), so only frustum-relevant chunks exist in RAM/GPU and
 *    coarse base chunks remain present (keep-coarse — never replaced by bare ocean + pins).
 *  - Localized fine relief overlays (e.g. Dornhain canonical hills) blend seamlessly into
 *    the same continuous height sampler rather than spawning separate floating island meshes.
 *  - Exposes a clean, renderer-independent `AtlasTerrainChunkDescriptor` contract so
 *    Visumaxx can run GPU culling & LOD directly on the exact same chunk layout later.
 */
import type { AtlasWorldCameraState } from './atlas-world-camera';
import {
  sampleHeightfield,
  type AtlasHeightfield,
} from './atlas-heightfield';

export const ATLAS_WORLD_TERRAIN_CHUNK_FORMAT = 'sagatree-world-terrain-chunks-v1' as const;

/** Logical chunk cell grid size at full LOD (64×64 cells per Visumaxx contract). */
export const ATLAS_TERRAIN_CHUNK_LOGICAL_CELLS = 64 as const;
/** Default runtime triangulation resolution per active chunk (32×32 = 2,048 tris/chunk). */
export const ATLAS_TERRAIN_CHUNK_DEFAULT_RESOLUTION = 32 as const;
export const ATLAS_TERRAIN_CHUNK_MAX_LOD = 6 as const;

export type AtlasWorldTerrainBounds = {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
};

/**
 * Optional localized high-resolution heightfield blended seamlessly into the shared
 * world heightfield inside `worldBounds` (e.g. Dornhain canonical hills in world coords).
 */
export type AtlasWorldHeightfieldOverlay = {
  readonly id: string;
  readonly worldBounds: AtlasWorldTerrainBounds;
  readonly heightfield: AtlasHeightfield;
  /** Vertical scale factor converting overlay local heights into world Y units. */
  readonly elevationScale: number;
  /** Feather margin ratio (0..0.45) at outer edges for zero-seam blending. */
  readonly featherRatio?: number;
  /**
   * Optional oriented world transform (matching `applyWorldTransformToGroup`) so rotated
   * outdoor child heightfields rotate in lockstep with their rendered Three.js scene group.
   */
  readonly worldTransform?: {
    readonly centerX: number;
    readonly centerZ: number;
    readonly scaleX: number;
    readonly scaleZ: number;
    readonly rotationRad: number;
    readonly localBounds?: AtlasWorldTerrainBounds;
  };
};

/** Single authoritative heightfield source for the entire world. */
export type AtlasWorldHeightfieldSource = {
  readonly format: typeof ATLAS_WORLD_TERRAIN_CHUNK_FORMAT;
  readonly revisionKey: string;
  readonly worldBounds: AtlasWorldTerrainBounds;
  readonly rootHeightfield: AtlasHeightfield;
  readonly waterLevel: number;
  readonly detailSeed: number;
  readonly overlays: readonly AtlasWorldHeightfieldOverlay[];
};

/**
 * Renderer-independent chunk descriptor — stable Visumaxx contract.
 * Every chunk has a deterministic ID `L<lodLevel>:<gridX>:<gridZ>` and exact world AABB.
 */
export type AtlasTerrainChunkDescriptor = {
  readonly chunkId: string;
  readonly lodLevel: number;
  readonly gridX: number;
  readonly gridZ: number;
  readonly resolution: number;
  readonly logicalCells: number;
  readonly boundsWorld: AtlasWorldTerrainBounds;
  readonly minY: number;
  readonly maxY: number;
  readonly centerX: number;
  readonly centerZ: number;
  readonly worldSize: number;
  /** True when this chunk serves as the keep-coarse fallback basis under finer chunks. */
  readonly isCoarseBase: boolean;
  readonly distanceToFocus: number;
  readonly screenSizePx: number;
};

export type AtlasWorldTerrainChunkPlanConfig = {
  /** Maximum active chunks simultaneously mounted (default 20). */
  readonly maxChunks: number;
  /** Maximum quadtree subdivision depth (0..5; default 5). */
  readonly maxLodLevel: number;
  /** Screen-space pixel threshold above which a chunk subdivides into 4 finer children. */
  readonly splitScreenPx: number;
  /** Extra frustum padding ratio around camera view AABB for prefetch continuity. */
  readonly frustumPadRatio: number;
  /** Triangulation resolution per chunk side (default 32 → 32×32 cells). */
  readonly chunkResolution: number;
};

export const DEFAULT_ATLAS_WORLD_TERRAIN_CHUNK_CONFIG: AtlasWorldTerrainChunkPlanConfig = {
  maxChunks: 22,
  maxLodLevel: ATLAS_TERRAIN_CHUNK_MAX_LOD,
  splitScreenPx: 240,
  frustumPadRatio: 0.45,
  chunkResolution: ATLAS_TERRAIN_CHUNK_DEFAULT_RESOLUTION,
};

export type AtlasWorldTerrainChunkPlan = {
  readonly format: typeof ATLAS_WORLD_TERRAIN_CHUNK_FORMAT;
  readonly revisionKey: string;
  readonly waterLevel: number;
  readonly chunks: readonly AtlasTerrainChunkDescriptor[];
  readonly maxActiveLod: number;
  readonly coarseBaseCount: number;
};

// ─── Deterministic Micro-Detail Noise (Pure Math) ────────────────────────────

function hash2D(ix: number, iz: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
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
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbmMicroDetail(x: number, z: number, seed: number): number {
  let acc = 0;
  let amp = 0.55;
  let freq = 0.08;
  for (let oct = 0; oct < 3; oct += 1) {
    acc += (valueNoise2D(x * freq, z * freq, seed + oct * 31) - 0.5) * 2 * amp;
    freq *= 2.15;
    amp *= 0.48;
  }
  return acc;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-9, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function createAtlasWorldHeightfieldSource(input: {
  readonly rootHeightfield: AtlasHeightfield;
  readonly revisionKey?: string;
  readonly detailSeed?: number;
  readonly overlays?: readonly AtlasWorldHeightfieldOverlay[];
}): AtlasWorldHeightfieldSource {
  const hf = input.rootHeightfield;
  const worldBounds: AtlasWorldTerrainBounds = {
    minX: hf.originX,
    minZ: hf.originZ,
    maxX: hf.originX + (hf.cols - 1) * hf.cellSize,
    maxZ: hf.originZ + (hf.rows - 1) * hf.cellSize,
  };
  return {
    format: ATLAS_WORLD_TERRAIN_CHUNK_FORMAT,
    revisionKey: input.revisionKey ?? `hf-v${hf.assetRef.version}`,
    worldBounds,
    rootHeightfield: hf,
    waterLevel: hf.waterLevel,
    detailSeed: input.detailSeed ?? 1337,
    overlays: input.overlays ?? [],
  };
}

/**
 * Sample the single authoritative world elevation at `(worldX, worldZ)` across ALL scales.
 *
 * - Outside root bounds: smooth deep ocean floor (`waterLevel - 10`).
 * - Inside root bounds: bilinearly samples `rootHeightfield`, adds subtle deterministic
 *   micro-relief strictly above `waterLevel` (preserving the exact physical coastline at
 *   `h = waterLevel`), and smoothly feathers any localized fine overlays (e.g. Dornhain hills).
 */
export function sampleWorldHeight(
  source: AtlasWorldHeightfieldSource,
  worldX: number,
  worldZ: number,
  options?: { readonly includeMicroDetail?: boolean },
): number {
  const wb = source.worldBounds;
  if (worldX < wb.minX || worldX > wb.maxX || worldZ < wb.minZ || worldZ > wb.maxZ) {
    return source.waterLevel - 10;
  }

  // Clamp slightly inside max edge so bilinear `sampleHeightfield` covers the exact max boundary
  const eps = 1e-4;
  const cx = Math.min(wb.maxX - eps, Math.max(wb.minX, worldX));
  const cz = Math.min(wb.maxZ - eps, Math.max(wb.minZ, worldZ));
  let h = sampleHeightfield(source.rootHeightfield, cx, cz);

  // Subtle multi-octave relief strictly inland above shoreline (never shifts physical coastline!)
  if (options?.includeMicroDetail !== false && h > source.waterLevel + 0.6) {
    const inlandFade = smoothstep(source.waterLevel + 0.6, source.waterLevel + 4.5, h);
    h += fbmMicroDetail(worldX, worldZ, source.detailSeed) * 1.15 * inlandFade;
  }

  // Seamlessly blend localized high-resolution overlays (e.g. Dornhain hills) onto the SAME ground
  for (const ov of source.overlays) {
    const b = ov.worldBounds;
    if (worldX < b.minX || worldX > b.maxX || worldZ < b.minZ || worldZ > b.maxZ) continue;
    let u: number;
    let v: number;
    if (ov.worldTransform) {
      const wt = ov.worldTransform;
      const lb = wt.localBounds ?? { minX: 0, minZ: 0, maxX: 1000, maxZ: 1000 };
      const localW = Math.max(1e-6, lb.maxX - lb.minX);
      const localD = Math.max(1e-6, lb.maxZ - lb.minZ);
      const rx = worldX - wt.centerX;
      const rz = worldZ - wt.centerZ;
      const cos = Math.cos(wt.rotationRad);
      const sin = Math.sin(wt.rotationRad);
      const unrotX = rx * cos + rz * sin;
      const unrotZ = -rx * sin + rz * cos;
      u = 0.5 + unrotX / Math.max(1e-6, wt.scaleX * localW);
      v = 0.5 + unrotZ / Math.max(1e-6, wt.scaleZ * localD);
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    } else {
      const w = Math.max(1e-6, b.maxX - b.minX);
      const d = Math.max(1e-6, b.maxZ - b.minZ);
      u = (worldX - b.minX) / w;
      v = (worldZ - b.minZ) / d;
    }
    const hf = ov.heightfield;
    const localX = hf.originX + u * ((hf.cols - 1) * hf.cellSize);
    const localZ = hf.originZ + v * ((hf.rows - 1) * hf.cellSize);
    const ovRaw = sampleHeightfield(
      hf,
      Math.min(hf.originX + (hf.cols - 1) * hf.cellSize - eps, Math.max(hf.originX, localX)),
      Math.min(hf.originZ + (hf.rows - 1) * hf.cellSize - eps, Math.max(hf.originZ, localZ)),
    );
    const reliefDelta = Math.max(0, ovRaw - hf.waterLevel) * ov.elevationScale;
    const feather = Math.max(0.05, Math.min(0.45, ov.featherRatio ?? 0.22));
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const blend = smoothstep(0, feather, edge);
    h += reliefDelta * blend;
  }

  return h;
}

/**
 * Sample a dense `(res + 1) × (res + 1)` elevation grid for a single chunk on demand.
 * Never allocates a monolithic array for the entire world.
 */
export function sampleWorldChunkHeightGrid(
  source: AtlasWorldHeightfieldSource,
  chunk: AtlasTerrainChunkDescriptor,
): {
  readonly resolution: number;
  readonly heights: Float32Array;
  readonly minY: number;
  readonly maxY: number;
} {
  const res = Math.max(2, chunk.resolution);
  const stride = res + 1;
  const heights = new Float32Array(stride * stride);
  const { minX, minZ, maxX, maxZ } = chunk.boundsWorld;
  const stepX = (maxX - minX) / res;
  const stepZ = (maxZ - minZ) / res;
  const includeMicroDetail = chunk.lodLevel >= 1;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let r = 0; r <= res; r += 1) {
    const wz = minZ + r * stepZ;
    for (let c = 0; c <= res; c += 1) {
      const wx = minX + c * stepX;
      const h = sampleWorldHeight(source, wx, wz, { includeMicroDetail });
      heights[r * stride + c] = h;
      if (h < minY) minY = h;
      if (h > maxY) maxY = h;
    }
  }
  return {
    resolution: res,
    heights,
    minY: Number.isFinite(minY) ? minY : source.waterLevel,
    maxY: Number.isFinite(maxY) ? maxY : source.waterLevel,
  };
}

function boundsIntersect(a: AtlasWorldTerrainBounds, b: AtlasWorldTerrainBounds): boolean {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxZ < b.minZ || b.maxZ < a.minZ);
}

function pointInBounds(x: number, z: number, b: AtlasWorldTerrainBounds): boolean {
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

/**
 * Plan the active quadtree chunks for the current camera & viewport (Visumaxx-ready).
 *
 * Guarantees:
 *  - **keep-coarse**: Level-0 root chunk(s) (or coarse covering quads) are ALWAYS kept so
 *    continents & landmass silhouettes never disappear at any zoom depth.
 *  - **frustum-scoped**: Fine subdivisions happen ONLY on chunks overlapping the padded
 *    camera frustum (`frustumPadRatio`), strictly capped at `maxChunks`.
 *  - **deterministic**: Identical inputs always yield identical chunk IDs & ordering.
 */
export function planWorldTerrainChunks(input: {
  readonly source: AtlasWorldHeightfieldSource;
  readonly camera: AtlasWorldCameraState;
  readonly viewportPx: { readonly width: number; readonly height: number };
  readonly config?: Partial<AtlasWorldTerrainChunkPlanConfig>;
}): AtlasWorldTerrainChunkPlan {
  const cfg: AtlasWorldTerrainChunkPlanConfig = {
    ...DEFAULT_ATLAS_WORLD_TERRAIN_CHUNK_CONFIG,
    ...(input.config ?? {}),
  };
  const wb = input.source.worldBounds;
  const worldW = Math.max(1, wb.maxX - wb.minX);
  const worldD = Math.max(1, wb.maxZ - wb.minZ);

  const vpW = Math.max(1, input.viewportPx.width);
  const vpH = Math.max(1, input.viewportPx.height);
  const aspect = vpW / vpH;
  const pad = 1 + Math.max(0, cfg.frustumPadRatio);
  const halfH = input.camera.span * pad;
  const halfW = input.camera.span * aspect * pad;
  const viewBounds: AtlasWorldTerrainBounds = {
    minX: input.camera.focusWorld.x - halfW,
    minZ: input.camera.focusWorld.y - halfH,
    maxX: input.camera.focusWorld.x + halfW,
    maxZ: input.camera.focusWorld.y + halfH,
  };

  type QuadNode = {
    readonly lodLevel: number;
    readonly gridX: number;
    readonly gridZ: number;
    readonly bounds: AtlasWorldTerrainBounds;
    readonly centerX: number;
    readonly centerZ: number;
    readonly worldSize: number;
    readonly distanceToFocus: number;
    readonly screenSizePx: number;
    readonly containsFocus: boolean;
  };

  const makeNode = (lodLevel: number, gridX: number, gridZ: number): QuadNode => {
    const divisions = 1 << lodLevel;
    const cellW = worldW / divisions;
    const cellD = worldD / divisions;
    const minX = wb.minX + gridX * cellW;
    const minZ = wb.minZ + gridZ * cellD;
    const maxX = minX + cellW;
    const maxZ = minZ + cellD;
    const centerX = (minX + maxX) * 0.5;
    const centerZ = (minZ + maxZ) * 0.5;
    const worldSize = Math.max(cellW, cellD);
    const distanceToFocus = Math.hypot(
      centerX - input.camera.focusWorld.x,
      centerZ - input.camera.focusWorld.y,
    );
    const screenSizePx = (worldSize / Math.max(1e-6, input.camera.span * 2)) * vpH;
    const bounds: AtlasWorldTerrainBounds = { minX, minZ, maxX, maxZ };
    return {
      lodLevel,
      gridX,
      gridZ,
      bounds,
      centerX,
      centerZ,
      worldSize,
      distanceToFocus,
      screenSizePx,
      containsFocus: pointInBounds(input.camera.focusWorld.x, input.camera.focusWorld.y, bounds),
    };
  };

  const root = makeNode(0, 0, 0);
  // Active leaves start with the level-0 root; we always keep level-0 as keep-coarse fallback
  // when finer subdivisions are present, so distant silhouettes never vanish.
  const leaves: QuadNode[] = [root];
  const maxLeaves = Math.max(1, cfg.maxChunks - 1);

  while (leaves.length + 3 <= maxLeaves) {
    // Choose highest-priority splittable leaf (in view, below maxLod, screenSizePx > splitScreenPx)
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < leaves.length; i += 1) {
      const n = leaves[i]!;
      if (n.lodLevel >= cfg.maxLodLevel) continue;
      if (!boundsIntersect(n.bounds, viewBounds)) continue;
      if (n.screenSizePx < cfg.splitScreenPx) continue;
      // Prioritize focus-containing & largest screen-space chunks
      const score = n.screenSizePx * (n.containsFocus ? 3.5 : 1) - n.distanceToFocus * 0.25;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;

    const parent = leaves[bestIdx]!;
    leaves.splice(bestIdx, 1);
    const nextLod = parent.lodLevel + 1;
    const children = [
      makeNode(nextLod, parent.gridX * 2, parent.gridZ * 2),
      makeNode(nextLod, parent.gridX * 2 + 1, parent.gridZ * 2),
      makeNode(nextLod, parent.gridX * 2, parent.gridZ * 2 + 1),
      makeNode(nextLod, parent.gridX * 2 + 1, parent.gridZ * 2 + 1),
    ];
    for (const ch of children) {
      // Only retain children that intersect the padded view OR cover top-level coarse world (lod<=1)
      if (ch.lodLevel <= 1 || boundsIntersect(ch.bounds, viewBounds)) {
        leaves.push(ch);
      }
    }
  }

  // Always include level-0 coarse world base if root was subdivided (keep-coarse guarantee!)
  const hasRootLeaf = leaves.some((n) => n.lodLevel === 0);
  const finalNodes: Array<{ readonly node: QuadNode; readonly isCoarseBase: boolean }> = [];
  if (!hasRootLeaf) {
    finalNodes.push({ node: root, isCoarseBase: true });
  }
  for (const n of leaves) {
    finalNodes.push({ node: n, isCoarseBase: n.lodLevel <= 1 });
  }

  // Deterministic order: coarsest → finest, then gridZ, gridX
  finalNodes.sort((a, b) => {
    if (a.node.lodLevel !== b.node.lodLevel) return a.node.lodLevel - b.node.lodLevel;
    if (a.node.gridZ !== b.node.gridZ) return a.node.gridZ - b.node.gridZ;
    return a.node.gridX - b.node.gridX;
  });

  const chunks: AtlasTerrainChunkDescriptor[] = finalNodes.slice(0, cfg.maxChunks).map(({ node, isCoarseBase }) => {
    const centerH = sampleWorldHeight(input.source, node.centerX, node.centerZ, {
      includeMicroDetail: false,
    });
    const res = isCoarseBase && node.lodLevel === 0 && !hasRootLeaf
      ? Math.max(16, Math.floor(cfg.chunkResolution / 2))
      : cfg.chunkResolution;
    return {
      chunkId: `L${node.lodLevel}:${node.gridX}:${node.gridZ}`,
      lodLevel: node.lodLevel,
      gridX: node.gridX,
      gridZ: node.gridZ,
      resolution: res,
      logicalCells: ATLAS_TERRAIN_CHUNK_LOGICAL_CELLS,
      boundsWorld: node.bounds,
      minY: Math.min(input.source.waterLevel - 14, centerH - 12),
      maxY: Math.max(input.source.waterLevel + 48, centerH + 24),
      centerX: Math.round(node.centerX * 1000) / 1000,
      centerZ: Math.round(node.centerZ * 1000) / 1000,
      worldSize: Math.round(node.worldSize * 1000) / 1000,
      isCoarseBase,
      distanceToFocus: Math.round(node.distanceToFocus * 100) / 100,
      screenSizePx: Math.round(node.screenSizePx * 100) / 100,
    };
  });

  let maxActiveLod = 0;
  let coarseBaseCount = 0;
  for (const ch of chunks) {
    if (ch.lodLevel > maxActiveLod) maxActiveLod = ch.lodLevel;
    if (ch.isCoarseBase) coarseBaseCount += 1;
  }

  return {
    format: ATLAS_WORLD_TERRAIN_CHUNK_FORMAT,
    revisionKey: input.source.revisionKey,
    waterLevel: input.source.waterLevel,
    chunks,
    maxActiveLod,
    coarseBaseCount,
  };
}
