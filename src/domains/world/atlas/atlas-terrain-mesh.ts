/**
 * atlas-terrain-mesh — ATL2-D05 terrain triangulation, coasts, water, LOD.
 * Location: src/domains/world/atlas/atlas-terrain-mesh.ts
 *
 * Pure domain — no React / Host. Productive target is custom WebGL
 * (ATL2-D01); issue wording that says Three.js means mesh visualization.
 */

import {
  heightfieldContentFingerprint,
  heightfieldIndex,
  heightfieldMeshTriangles,
  type AtlasHeightfield,
} from './atlas-heightfield';
import type { UnifiedCanvasDoc } from './unified-canvas-doc';

export const ATLAS_TERRAIN_MESH_FORMAT = 'atl2-terrain-mesh-plan-v1' as const;

export type AtlasTerrainLodBand = 'far' | 'mid' | 'near';

export type AtlasTerrainMeshTriangle = {
  readonly a: readonly [number, number, number];
  readonly b: readonly [number, number, number];
  readonly c: readonly [number, number, number];
  readonly material: 'land' | 'shore' | 'water';
};

export type AtlasTerrainCoastEdge = {
  readonly start: readonly [number, number, number];
  readonly end: readonly [number, number, number];
};

export type AtlasTerrainMeshPlan = {
  readonly format: typeof ATLAS_TERRAIN_MESH_FORMAT;
  readonly lod: AtlasTerrainLodBand;
  readonly triangles: readonly AtlasTerrainMeshTriangle[];
  readonly coastEdges: readonly AtlasTerrainCoastEdge[];
  readonly waterPlane: {
    readonly x: number;
    readonly z: number;
    readonly w: number;
    readonly h: number;
    readonly y: number;
  } | null;
  readonly contentFingerprint: string;
  readonly drawBudget: {
    readonly maxTriangles: number;
    readonly triangleCount: number;
    readonly coastCount: number;
  };
};

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function atlasTerrainLodFromSpan(span: number): AtlasTerrainLodBand {
  if (!finite(span) || span >= 280) return 'far';
  if (span >= 90) return 'mid';
  return 'near';
}

export function atlasTerrainLodStride(lod: AtlasTerrainLodBand): number {
  if (lod === 'far') return 4;
  if (lod === 'mid') return 2;
  return 1;
}

export function atlasTerrainMaxTriangles(lod: AtlasTerrainLodBand): number {
  if (lod === 'far') return 800;
  if (lod === 'mid') return 2500;
  return 8000;
}

/** Triangle count for a full-chunk grid at the given stride (2 tris per cell). */
export function atlasTerrainTriangleEstimate(
  cols: number,
  rows: number,
  stride: number,
): number {
  if (cols < 2 || rows < 2 || stride < 1) return 0;
  const cellCols = Math.ceil((cols - 1) / stride);
  const cellRows = Math.ceil((rows - 1) / stride);
  return cellCols * cellRows * 2;
}

/**
 * Prefer the LOD band stride; raise stride until the full chunk fits the budget
 * (never truncate the authoritative extent).
 */
export function atlasTerrainStrideForBudget(
  cols: number,
  rows: number,
  preferredStride: number,
  maxTriangles: number,
): number {
  let stride = Math.max(1, Math.floor(preferredStride) || 1);
  while (
    atlasTerrainTriangleEstimate(cols, rows, stride) > maxTriangles &&
    stride < Math.max(cols, rows)
  ) {
    stride += 1;
  }
  return stride;
}

function cellMaterial(
  hf: AtlasHeightfield,
  y00: number,
  y10: number,
  y01: number,
  y11: number,
): 'land' | 'shore' | 'water' {
  const avg = (y00 + y10 + y01 + y11) / 4;
  const water = hf.waterLevel;
  if (avg < water) return 'water';
  if (avg < water + 1.5) return 'shore';
  return 'land';
}

/**
 * Build a LOD-aware terrain mesh plan from the heightfield (+ optional water plane).
 * Coast edges follow shore transitions; no invented geography beyond the chunk.
 */
export function buildAtlasTerrainMeshPlan(
  doc: UnifiedCanvasDoc,
  options?: { readonly span?: number },
): AtlasTerrainMeshPlan {
  const lod = atlasTerrainLodFromSpan(options?.span ?? 200);
  const preferredStride = atlasTerrainLodStride(lod);
  const maxTriangles = atlasTerrainMaxTriangles(lod);
  const hf = doc.heightfield;
  if (!hf || hf.cols < 2 || hf.rows < 2 || !Array.isArray(hf.heights)) {
    return {
      format: ATLAS_TERRAIN_MESH_FORMAT,
      lod,
      triangles: [],
      coastEdges: [],
      waterPlane: null,
      contentFingerprint: `terrain:none:${lod}:${heightfieldContentFingerprint(hf)}`,
      drawBudget: { maxTriangles, triangleCount: 0, coastCount: 0 },
    };
  }

  const stride = atlasTerrainStrideForBudget(
    hf.cols,
    hf.rows,
    preferredStride,
    maxTriangles,
  );
  const triangles: AtlasTerrainMeshTriangle[] = [];
  const coastEdges: AtlasTerrainCoastEdge[] = [];
  const water = hf.waterLevel;
  const coastBudget = Math.max(64, Math.floor(maxTriangles / 4));

  for (let row = 0; row < hf.rows - 1; row += stride) {
    for (let col = 0; col < hf.cols - 1; col += stride) {
      const c1 = Math.min(hf.cols - 1, col + stride);
      const r1 = Math.min(hf.rows - 1, row + stride);
      const x0 = hf.originX + col * hf.cellSize;
      const z0 = hf.originZ + row * hf.cellSize;
      const x1 = hf.originX + c1 * hf.cellSize;
      const z1 = hf.originZ + r1 * hf.cellSize;
      const y00 = hf.heights[heightfieldIndex(hf.cols, col, row)] ?? 0;
      const y10 = hf.heights[heightfieldIndex(hf.cols, c1, row)] ?? 0;
      const y01 = hf.heights[heightfieldIndex(hf.cols, col, r1)] ?? 0;
      const y11 = hf.heights[heightfieldIndex(hf.cols, c1, r1)] ?? 0;
      const material = cellMaterial(hf, y00, y10, y01, y11);
      const a: [number, number, number] = [x0, y00, z0];
      const b: [number, number, number] = [x1, y10, z0];
      const c: [number, number, number] = [x1, y11, z1];
      const d: [number, number, number] = [x0, y01, z1];
      triangles.push({ a, b, c, material }, { a, b: c, c: d, material });

      // Coast edges only at preferred near LOD (stride 1); skip when budget forced coarser.
      if (preferredStride === 1 && stride === 1 && coastEdges.length < coastBudget) {
        const submerged = (h: number) => h < water;
        if (submerged(y00) !== submerged(y10)) {
          coastEdges.push({
            start: [x0, Math.max(y00, y10, water), z0],
            end: [x1, Math.max(y00, y10, water), z0],
          });
        }
        if (
          coastEdges.length < coastBudget &&
          submerged(y00) !== submerged(y01)
        ) {
          coastEdges.push({
            start: [x0, Math.max(y00, y01, water), z0],
            end: [x0, Math.max(y00, y01, water), z1],
          });
        }
      }
    }
  }

  const waterPlane = {
    x: hf.originX + (hf.cols * hf.cellSize) / 2,
    z: hf.originZ + (hf.rows * hf.cellSize) / 2,
    w: hf.cols * hf.cellSize,
    h: hf.rows * hf.cellSize,
    y: water,
  };

  const contentFingerprint = [
    ATLAS_TERRAIN_MESH_FORMAT,
    lod,
    stride,
    triangles.length,
    coastEdges.length,
    heightfieldContentFingerprint(hf),
  ].join(':');

  return {
    format: ATLAS_TERRAIN_MESH_FORMAT,
    lod,
    triangles,
    coastEdges,
    waterPlane,
    contentFingerprint,
    drawBudget: {
      maxTriangles,
      triangleCount: triangles.length,
      coastCount: coastEdges.length,
    },
  };
}

/** Sanity: near LOD must not invent more tris than the dense heightfield mesh. */
export function atlasTerrainDenseTriangleUpperBound(hf: AtlasHeightfield): number {
  return heightfieldMeshTriangles(hf).length;
}
