/**
 * atlas-three-world-terrain — Shared Chunked World Terrain Renderer (Phase 1.3).
 * Location: src/infrastructure/world/atlas-three/atlas-three-world-terrain.ts
 *
 * Renders the ONE shared world heightfield as incrementally mounted, frustum-scoped
 * quadtree chunks with Visumaxx-ready `AtlasTerrainChunkDescriptor` metadata:
 *  - ZERO per-continent / per-country / per-place landmass island meshes.
 *  - Keep-coarse: level-0 base chunk always stays mounted beneath finer LOD chunks.
 *  - Downward border skirts eliminate T-junction cracks between adjacent LOD levels.
 *  - Zero `clearRoot()` calls; clean GPU geometry disposal on chunk eviction & teardown.
 */
import * as THREE from 'three';
import {
  ATLAS_TERRAIN_CHUNK_MAX_LOD,
  planWorldTerrainChunks,
  sampleWorldChunkHeightGrid,
  sampleWorldHeight,
  type AtlasTerrainChunkDescriptor,
  type AtlasWorldCameraState,
  type AtlasWorldHeightfieldSource,
  type AtlasWorldTerrainChunkPlan,
  type AtlasWorldTerrainChunkPlanConfig,
} from '../../../domains/world/atlas';
import { terrainColorAt } from './atlas-three-scene';

type TerrainChunkNode = {
  readonly chunkId: string;
  readonly revisionKey: string;
  readonly descriptor: AtlasTerrainChunkDescriptor;
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  readonly triangleCount: number;
};

export type AtlasThreeWorldTerrainStats = {
  readonly enabled: boolean;
  readonly revisionKey: string | null;
  readonly chunkCount: number;
  readonly maxActiveLod: number;
  readonly coarseBaseCount: number;
  readonly totalTriangles: number;
  readonly liveGeometryCount: number;
  readonly incrementalSyncCount: number;
  readonly chunks: readonly AtlasTerrainChunkDescriptor[];
};

const SKIRT_DROP = 1.6;
const TERRAIN_LOD_LIFT_STEP = 0.002;

/**
 * Build a vertex-colored Three.js `BufferGeometry` for a single terrain chunk
 * including 4 downward skirts along outer borders so coarse/fine neighbors never crack.
 */
export function buildTerrainChunkGeometry(
  source: AtlasWorldHeightfieldSource,
  descriptor: AtlasTerrainChunkDescriptor,
): { readonly geometry: THREE.BufferGeometry; readonly triangleCount: number } {
  const { resolution: res, heights } = sampleWorldChunkHeightGrid(source, descriptor);
  const stride = res + 1;
  const { minX, minZ, maxX, maxZ } = descriptor.boundsWorld;
  const stepX = (maxX - minX) / res;
  const stepZ = (maxZ - minZ) / res;
  // Subtle monotonic lift by LOD level so finer chunks always win depth over L0 coarse base
  // without burying fine settlement architecture (~0.18 wu tall at Dornhain scale).
  const lodLift = descriptor.lodLevel * TERRAIN_LOD_LIFT_STEP;

  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];

  const hAt = (c: number, r: number): number =>
    heights[Math.max(0, Math.min(res, r)) * stride + Math.max(0, Math.min(res, c))] ?? 0;

  for (let r = 0; r <= res; r += 1) {
    const wz = minZ + r * stepZ;
    for (let c = 0; c <= res; c += 1) {
      const wx = minX + c * stepX;
      const elev = hAt(c, r);
      const hL = hAt(c - 1, r);
      const hR = hAt(c + 1, r);
      const hU = hAt(c, r - 1);
      const hD = hAt(c, r + 1);
      const slope = Math.hypot(hR - hL, hD - hU) / Math.max(0.25, (stepX + stepZ));
      const col = terrainColorAt(elev, source.waterLevel, slope);
      positions.push(wx, elev + lodLift, wz);
      uvs.push(wx / 72, wz / 72);
      colors.push(col.r, col.g, col.b);
    }
  }

  const index: number[] = [];
  for (let r = 0; r < res; r += 1) {
    for (let c = 0; c < res; c += 1) {
      const i00 = r * stride + c;
      const i10 = r * stride + c + 1;
      const i01 = (r + 1) * stride + c;
      const i11 = (r + 1) * stride + c + 1;
      index.push(i00, i11, i10, i00, i01, i11);
    }
  }

  // Append downward skirts along all 4 chunk borders (zero LOD T-junction cracks)
  const appendSkirtEdge = (edgeIndices: readonly number[]) => {
    const baseStart = positions.length / 3;
    for (let k = 0; k < edgeIndices.length; k += 1) {
      const srcIdx = edgeIndices[k]!;
      const p3 = srcIdx * 3;
      const p2 = srcIdx * 2;
      positions.push(positions[p3]!, positions[p3 + 1]! - SKIRT_DROP, positions[p3 + 2]!);
      uvs.push(uvs[p2]!, uvs[p2 + 1]!);
      colors.push(colors[p3]!, colors[p3 + 1]!, colors[p3 + 2]!);
    }
    for (let k = 0; k + 1 < edgeIndices.length; k += 1) {
      const top0 = edgeIndices[k]!;
      const top1 = edgeIndices[k + 1]!;
      const bot0 = baseStart + k;
      const bot1 = baseStart + k + 1;
      index.push(top0, bot1, top1, top0, bot0, bot1);
    }
  };

  if (descriptor.lodLevel > 0) {
    const north: number[] = [];
    const south: number[] = [];
    const west: number[] = [];
    const east: number[] = [];
    for (let i = 0; i <= res; i += 1) {
      north.push(i);
      south.push(res * stride + (res - i));
      west.push((res - i) * stride);
      east.push(i * stride + res);
    }
    appendSkirtEdge(north);
    appendSkirtEdge(south);
    appendSkirtEdge(west);
    appendSkirtEdge(east);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, triangleCount: index.length / 3 };
}

export class AtlasThreeWorldTerrain {
  readonly rootGroup = new THREE.Group();
  private readonly chunks = new Map<string, TerrainChunkNode>();
  private source: AtlasWorldHeightfieldSource | null = null;
  private lastPlan: AtlasWorldTerrainChunkPlan | null = null;
  private incrementalSyncCount = 0;

  constructor(private readonly getTerrainMaterial: () => THREE.Material) {
    this.rootGroup.name = 'atlas3:shared-world-terrain';
  }

  setSource(source: AtlasWorldHeightfieldSource | null): void {
    if (this.source?.revisionKey === source?.revisionKey && Boolean(this.source) === Boolean(source)) {
      return;
    }
    this.source = source;
    if (!source) {
      this.dispose();
    }
  }

  getSource(): AtlasWorldHeightfieldSource | null {
    return this.source;
  }

  /** Mounted terrain chunk meshes for accurate 3D raycast picking under cursor (Phase A). */
  getChunkMeshes(): readonly THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const node of this.chunks.values()) {
      out.push(node.mesh);
    }
    return out;
  }

  sampleElevation(worldX: number, worldZ: number): number {
    if (!this.source) return 0;
    return sampleWorldHeight(this.source, worldX, worldZ) + ATLAS_TERRAIN_CHUNK_MAX_LOD * TERRAIN_LOD_LIFT_STEP;
  }

  sync(input: {
    readonly camera: AtlasWorldCameraState;
    readonly viewportPx: { readonly width: number; readonly height: number };
    readonly config?: Partial<AtlasWorldTerrainChunkPlanConfig>;
  }): AtlasWorldTerrainChunkPlan | null {
    if (!this.source) return null;
    this.incrementalSyncCount += 1;
    const plan = planWorldTerrainChunks({
      source: this.source,
      camera: input.camera,
      viewportPx: input.viewportPx,
      config: input.config,
    });
    this.lastPlan = plan;

    const wantedIds = new Set(plan.chunks.map((c) => c.chunkId));
    for (const [id, node] of [...this.chunks.entries()]) {
      if (!wantedIds.has(id) || node.revisionKey !== this.source.revisionKey) {
        this.disposeChunkNode(node);
        this.chunks.delete(id);
      }
    }

    const material = this.getTerrainMaterial();
    for (const desc of plan.chunks) {
      const existing = this.chunks.get(desc.chunkId);
      if (existing && existing.descriptor.resolution === desc.resolution) {
        continue;
      }
      if (existing) {
        this.disposeChunkNode(existing);
        this.chunks.delete(desc.chunkId);
      }
      const { geometry, triangleCount } = buildTerrainChunkGeometry(this.source, desc);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = desc.lodLevel >= 1;
      mesh.receiveShadow = true;
      mesh.name = `atlas3:terrain-chunk:${desc.chunkId}`;
      mesh.userData.chunkId = desc.chunkId;
      mesh.userData.lodLevel = desc.lodLevel;
      mesh.renderOrder = desc.isCoarseBase && desc.lodLevel === 0 ? 0 : 1;
      this.rootGroup.add(mesh);
      this.chunks.set(desc.chunkId, {
        chunkId: desc.chunkId,
        revisionKey: this.source.revisionKey,
        descriptor: desc,
        mesh,
        geometry,
        triangleCount,
      });
    }

    return plan;
  }

  getStats(): AtlasThreeWorldTerrainStats {
    let totalTriangles = 0;
    for (const node of this.chunks.values()) {
      totalTriangles += node.triangleCount;
    }
    return {
      enabled: Boolean(this.source),
      revisionKey: this.source?.revisionKey ?? null,
      chunkCount: this.chunks.size,
      maxActiveLod: this.lastPlan?.maxActiveLod ?? 0,
      coarseBaseCount: this.lastPlan?.coarseBaseCount ?? 0,
      totalTriangles,
      liveGeometryCount: this.chunks.size,
      incrementalSyncCount: this.incrementalSyncCount,
      chunks: this.lastPlan?.chunks ?? [],
    };
  }

  dispose(): void {
    for (const node of this.chunks.values()) {
      this.disposeChunkNode(node);
    }
    this.chunks.clear();
    this.lastPlan = null;
  }

  private disposeChunkNode(node: TerrainChunkNode): void {
    this.rootGroup.remove(node.mesh);
    node.geometry.dispose();
  }
}
