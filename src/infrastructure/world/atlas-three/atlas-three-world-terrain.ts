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
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];

  const hAt = (c: number, r: number): number => {
    if (c >= 0 && c <= res && r >= 0 && r <= res) {
      return heights[r * stride + c] ?? 0;
    }
    return sampleWorldHeight(source, minX + c * stepX, minZ + r * stepZ);
  };

  for (let r = 0; r <= res; r += 1) {
    const wz = minZ + r * stepZ;
    for (let c = 0; c <= res; c += 1) {
      const wx = minX + c * stepX;
      const elev = hAt(c, r);
      const hL = hAt(c - 1, r);
      const hR = hAt(c + 1, r);
      const hU = hAt(c, r - 1);
      const hD = hAt(c, r + 1);
      // Continuous cross-chunk analytical normal (eliminates chunk border seams & skirt normal bleed!)
      const nx = hL - hR;
      const ny = Math.max(0.25, stepX + stepZ);
      const nz = hU - hD;
      const nLen = Math.hypot(nx, ny, nz) || 1;
      const slope = Math.hypot(nx, nz) / ny;
      const col = terrainColorAt(elev, source.waterLevel, slope);
      positions.push(wx, elev + lodLift, wz);
      normals.push(nx / nLen, ny / nLen, nz / nLen);
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

  // Append downward skirts along all 4 chunk borders using copied surface normals
  // so skirts hide T-junction cracks without bleeding vertical normals into chunk edges!
  const appendSkirtEdge = (edgeIndices: readonly number[]) => {
    const baseStart = positions.length / 3;
    for (let k = 0; k < edgeIndices.length; k += 1) {
      const srcIdx = edgeIndices[k]!;
      const p3 = srcIdx * 3;
      const p2 = srcIdx * 2;
      positions.push(positions[p3]!, positions[p3 + 1]! - SKIRT_DROP, positions[p3 + 2]!);
      normals.push(normals[p3]!, normals[p3 + 1]!, normals[p3 + 2]!);
      uvs.push(uvs[p2]!, uvs[p2 + 1]!);
      colors.push(colors[p3]! * 0.94, colors[p3 + 1]! * 0.94, colors[p3 + 2]! * 0.94);
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
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return { geometry, triangleCount: index.length / 3 };
}

const HEIGHT_TEX_RES = 128;
const HEIGHT_TEX_MIN = -12;
const HEIGHT_TEX_MAX = 36;

/**
 * Enhance a `MeshStandardMaterial` with world-space tri-scale procedural PBR detail
 * (macro biome warmth, mid meadow/earth grain, micro grass/pebble detail, steep cliff strata,
 * and coastal damp-sand band) while preserving 100% of Three.js PCF shadows, IBL, and ACES.
 * Zero extra textures or draw calls; completely deterministic in world space (ATL3-M01).
 */
export function enhanceWorldTerrainMaterial(base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const mat = base.clone();
  mat.vertexColors = true;
  mat.roughness = 0.92;
  mat.metalness = 0.0;
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vAtlasWorldPos;
varying vec3 vAtlasWorldNormal;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vec4 atlasWp = modelMatrix * vec4(transformed, 1.0);
vAtlasWorldPos = atlasWp.xyz;
vAtlasWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vAtlasWorldPos;
varying vec3 vAtlasWorldNormal;
float atlasHash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float atlasVNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(atlasHash2(i), atlasHash2(i + vec2(1.0, 0.0)), u.x),
    mix(atlasHash2(i + vec2(0.0, 1.0)), atlasHash2(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 wp = vAtlasWorldPos.xz;
  float wy = vAtlasWorldPos.y;
  float slopeAmt = 1.0 - clamp(vAtlasWorldNormal.y, 0.0, 1.0);

  // Tri-scale world-space procedural variation: macro biome (90 wu), mid meadow (11 wu), micro blade/pebble (0.8 wu)
  float macro = atlasVNoise(wp * 0.011 + vec2(3.7, -2.1)) * 0.62 + atlasVNoise(wp * 0.029) * 0.38;
  float mid = atlasVNoise(wp * 0.095 + vec2(-5.2, 8.4)) * 0.6 + atlasVNoise(wp * 0.24) * 0.4;
  float micro = atlasVNoise(wp * 1.15) * 0.55 + atlasVNoise(wp * 2.85 + vec2(1.9, 4.3)) * 0.45;

  // Warm sunlit meadow vs rich forest soil variation (breaks flat green plastic look at ALL spans)
  vec3 warmEarth = vec3(0.56, 0.49, 0.34);
  vec3 sunGrass = vec3(0.60, 0.72, 0.38);
  vec3 cliffRock = vec3(0.47, 0.49, 0.46);
  vec3 wetSand = vec3(0.58, 0.55, 0.41);

  float earthPatch = smoothstep(0.54, 0.84, macro) * smoothstep(1.2, 4.0, wy) * (1.0 - smoothstep(10.0, 18.0, wy));
  diffuseColor.rgb = mix(diffuseColor.rgb, warmEarth, earthPatch * 0.28);
  diffuseColor.rgb = mix(diffuseColor.rgb, sunGrass, smoothstep(0.42, 0.78, mid) * 0.16 * (1.0 - slopeAmt));

  // Steep slope rock strata blending (only on real cliffs/ridges, never gentle rolling meadows)
  float rockMask = smoothstep(0.18, 0.44, slopeAmt);
  float strata = 0.88 + 0.20 * sin(wy * 2.6 + macro * 6.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, cliffRock * strata, rockMask * 0.65);

  // Coastal damp-sand & shoreline darkening near water level
  float coastBand = 1.0 - smoothstep(0.0, 1.8, abs(wy - 0.15));
  diffuseColor.rgb = mix(diffuseColor.rgb, wetSand, coastBand * 0.32);

  // Multi-scale crisp luminance grain (stays readable from planet zoom down to tavern close-up!)
  float grain = (macro - 0.5) * 0.14 + (mid - 0.5) * 0.14 + (micro - 0.5) * 0.16;
  diffuseColor.rgb *= clamp(1.0 + grain, 0.74, 1.24);
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
{
  float wyR = vAtlasWorldPos.y;
  float wetShore = 1.0 - smoothstep(-0.2, 0.85, wyR);
  roughnessFactor = mix(roughnessFactor, 0.42, wetShore * 0.55);
}`,
      );
  };
  mat.customProgramCacheKey = () => 'atlas-world-terrain-triscale-v1';
  mat.needsUpdate = true;
  return mat;
}

export class AtlasThreeWorldTerrain {
  readonly rootGroup = new THREE.Group();
  private readonly chunks = new Map<string, TerrainChunkNode>();
  private source: AtlasWorldHeightfieldSource | null = null;
  private lastPlan: AtlasWorldTerrainChunkPlan | null = null;
  private incrementalSyncCount = 0;
  private enhancedMaterial: THREE.MeshStandardMaterial | null = null;
  private heightTex: THREE.DataTexture | null = null;
  private heightTexRevision = '';

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
    } else {
      this.rebuildHeightTexture(source);
    }
  }

  getSource(): AtlasWorldHeightfieldSource | null {
    return this.source;
  }

  /** Lightweight 128×128 normalized heightfield bathymetry texture for organic shoreline water shading. */
  getHeightFieldTexture(): {
    readonly texture: THREE.DataTexture | null;
    readonly minH: number;
    readonly maxH: number;
    readonly waterLevel: number;
  } {
    return {
      texture: this.heightTex,
      minH: HEIGHT_TEX_MIN,
      maxH: HEIGHT_TEX_MAX,
      waterLevel: this.source?.waterLevel ?? 0,
    };
  }

  private rebuildHeightTexture(source: AtlasWorldHeightfieldSource): void {
    if (this.heightTex && this.heightTexRevision === source.revisionKey) return;
    if (this.heightTex) {
      this.heightTex.dispose();
      this.heightTex = null;
    }
    const data = new Uint8Array(HEIGHT_TEX_RES * HEIGHT_TEX_RES * 4);
    const invRange = 1 / (HEIGHT_TEX_MAX - HEIGHT_TEX_MIN);
    for (let r = 0; r < HEIGHT_TEX_RES; r += 1) {
      const wz = ((r + 0.5) / HEIGHT_TEX_RES) * 1000;
      for (let c = 0; c < HEIGHT_TEX_RES; c += 1) {
        const wx = ((c + 0.5) / HEIGHT_TEX_RES) * 1000;
        const h = sampleWorldHeight(source, wx, wz);
        const norm = Math.max(0, Math.min(1, (h - HEIGHT_TEX_MIN) * invRange));
        const byte = Math.round(norm * 255);
        const off = (r * HEIGHT_TEX_RES + c) * 4;
        data[off] = byte;
        data[off + 1] = byte;
        data[off + 2] = byte;
        data[off + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, HEIGHT_TEX_RES, HEIGHT_TEX_RES, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.flipY = false;
    tex.needsUpdate = true;
    this.heightTex = tex;
    this.heightTexRevision = source.revisionKey;
  }

  private resolveChunkMaterial(): THREE.Material {
    if (this.enhancedMaterial) return this.enhancedMaterial;
    const base = this.getTerrainMaterial();
    if (base instanceof THREE.MeshStandardMaterial) {
      this.enhancedMaterial = enhanceWorldTerrainMaterial(base);
      return this.enhancedMaterial;
    }
    return base;
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

    const material = this.resolveChunkMaterial();
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
    if (this.heightTex) {
      this.heightTex.dispose();
      this.heightTex = null;
      this.heightTexRevision = '';
    }
    if (this.enhancedMaterial) {
      this.enhancedMaterial.dispose();
      this.enhancedMaterial = null;
    }
    this.lastPlan = null;
  }

  private disposeChunkNode(node: TerrainChunkNode): void {
    this.rootGroup.remove(node.mesh);
    node.geometry.dispose();
  }
}
