/**
 * atlas-three-multimap — SWS-04 + Phase 1/2: Shared Chunked World Terrain & Continuous-LOD Crossfade.
 * Location: src/infrastructure/world/atlas-three/atlas-three-multimap.ts
 *
 * Consumes domain `AtlasWorldScenePlan` (SWS-03) and manages:
 *  - ONE shared chunked world terrain (`AtlasThreeWorldTerrain`, Phase 1.3) — zero per-map landmass islands.
 *  - One `THREE.Group` per active map placed at its exact `worldTransform` (derived via SWS-01),
 *    rendering overlays (political borders, roads, rivers, plazas, buildings, interiors, props) on that ONE ground.
 *  - Per-group cloned materials driven continuously by `entry.detailWeight` with smooth time-damped
 *    fade-in / fade-out (Phase 2.1, RC-1 & RC-3) — zero hard 0→100% single-frame pops, zero geometry rebuilds.
 *  - Replacement-Refinement overlay cutout clipping (Liang-Barsky for `freeland` strokes) without punching
 *    terrain holes or dropping keep-coarse terrain chunks.
 *  - Clean GPU disposal of every geometry and cloned material on exit/teardown.
 */
import * as THREE from 'three';
import {
  DEFAULT_ATLAS_BOUNDS,
  clipPolylineOutsideRects,
  createAtlasWorldHeightfieldSource,
  type AtlasGraphicsPresetId,
  type AtlasLocalCutoutRect,
  type AtlasMapScale,
  type AtlasWorldCameraState,
  type AtlasWorldHeightfieldOverlay,
  type AtlasWorldSceneGroupPlan,
  type AtlasWorldScenePlan,
  type UnifiedCanvasDoc,
  type UnifiedCanvasStroke,
  type WorldAtlasBounds,
} from '../../../domains/world/atlas';
import {
  ATLAS_THREE_SURFACES,
  buildAtlasThreeScenePlan,
  type AtlasThreeLook,
  type AtlasThreeScenePlan,
  type AtlasThreeSurfaceKey,
  type SharedWorldTerrainBinding,
} from './atlas-three-scene';
import {
  AtlasThreeWorldTerrain,
  type AtlasThreeWorldTerrainStats,
} from './atlas-three-world-terrain';

export type AtlasThreeWorldMapSource = {
  readonly mapId: string;
  readonly doc: UnifiedCanvasDoc;
  readonly mapScale: AtlasMapScale;
  readonly look: AtlasThreeLook;
  readonly bounds?: WorldAtlasBounds;
  readonly revisionKey?: string;
};

type ClonedGroupMaterial = {
  readonly material: THREE.Material;
  readonly surfaceKey: AtlasThreeSurfaceKey | 'water';
};

export type AtlasThreeMapGroupNode = {
  readonly mapId: string;
  readonly depth: number;
  readonly pivot: THREE.Group;
  readonly content: THREE.Group;
  readonly pickables: THREE.Object3D[];
  readonly scenePlan: AtlasThreeScenePlan;
  readonly buildSignature: string;
  readonly geometries: THREE.BufferGeometry[];
  readonly materials: ClonedGroupMaterial[];
  readonly cutoutSignature: string;
  readonly hasOwnTerrain: boolean;
  lodState: string;
  detailWeight: number;
  targetOpacity: number;
  currentOpacity: number;
  exiting: boolean;
};

export type AtlasThreeGroupOpacitySnapshot = {
  readonly detailWeight: number;
  readonly opacity: number;
  readonly depth: number;
  readonly lodState: string;
  readonly exiting: boolean;
};

export type AtlasThreeMultiMapStats = {
  readonly activeMapIds: readonly string[];
  readonly activeEditorMapId: string | null;
  readonly groupCount: number;
  readonly liveGeometryCount: number;
  readonly clearRootCount: number;
  readonly incrementalSyncCount: number;
  readonly ownPerMapTerrainCount: number;
  readonly terrain: AtlasThreeWorldTerrainStats;
  readonly groupOpacities: Readonly<Record<string, AtlasThreeGroupOpacitySnapshot>>;
};

/** Exponential opacity damping time constant (~180 ms smooth Google-Maps fade). */
const OPACITY_DAMP_RATE = 10.5;
const OPACITY_EXIT_EPSILON = 0.015;

function pointInsideAnyCutout(
  x: number,
  y: number,
  cutouts: readonly AtlasLocalCutoutRect[],
): boolean {
  for (const c of cutouts) {
    if (x >= c.minX && x <= c.maxX && y >= c.minY && y <= c.maxY) return true;
  }
  return false;
}

function rectFullyInsideAnyCutout(
  x: number,
  y: number,
  w: number,
  h: number,
  cutouts: readonly AtlasLocalCutoutRect[],
): boolean {
  for (const c of cutouts) {
    if (x >= c.minX && y >= c.minY && x + w <= c.maxX && y + h <= c.maxY) return true;
  }
  return false;
}

/**
 * Replacement-Refinement overlay filter (ADR-SWS-01 §5.2 / D4 + SCM Finding M-2):
 * removes coarse parent objects/rooms superseded by an active child map inside
 * `cutoutRectsLocal` AND clips `freeland` strokes (rivers/roads) cleanly along cutout
 * borders via Liang-Barsky so coarse parent ribbons never protrude into finer children.
 */
export function applyLocalCutoutFilter(
  doc: UnifiedCanvasDoc,
  cutouts: readonly AtlasLocalCutoutRect[],
): UnifiedCanvasDoc {
  if (cutouts.length === 0) return doc;
  const rooms = doc.rooms.filter((r) => {
    if (r.id === 'w.ocean' || r.id === 'g.ocean') return true;
    return !rectFullyInsideAnyCutout(r.x, r.y, r.w, r.h, cutouts);
  });
  const objects = doc.objects.filter((o) => !pointInsideAnyCutout(o.x, o.y, cutouts));
  const strokes: UnifiedCanvasStroke[] = [];
  for (const s of doc.strokes) {
    const clippedSegments = clipPolylineOutsideRects(s.points, cutouts);
    for (let i = 0; i < clippedSegments.length; i += 1) {
      const seg = clippedSegments[i]!;
      if (seg.length < 2) continue;
      strokes.push({
        ...s,
        id: i === 0 ? s.id : `${s.id}#clip${i}`,
        points: seg,
      });
    }
  }
  return {
    ...doc,
    rooms,
    objects,
    strokes,
  };
}

function cutoutSignature(cutouts: readonly AtlasLocalCutoutRect[]): string {
  if (cutouts.length === 0) return '';
  return cutouts
    .map((c) => `${c.childMapId}:${c.minX},${c.minY},${c.maxX},${c.maxY}`)
    .sort()
    .join('|');
}

/**
 * Monotonic depth lift per hierarchy level so overlay ribbons & interiors sit cleanly
 * above parent overlays with zero coplanar Z-fighting (ADR-SWS-01 §5.2).
 */
export function multiMapDepthLiftY(depth: number): number {
  const table = [0, 0.14, 0.24, 0.32, 0.36, 0.39];
  const idx = Math.max(0, depth - 1);
  if (idx < table.length) return table[idx]!;
  return 0.39 + (idx - (table.length - 1)) * 0.02;
}

/**
 * Position a map group's pivot + content offset so local `(x, y)` maps to exact
 * World Space `(centerX + dx*cos - dy*sin, elevationY, centerY + dx*sin + dy*cos)`.
 */
export function applyWorldTransformToGroup(
  pivot: THREE.Group,
  content: THREE.Group,
  entry: AtlasWorldSceneGroupPlan,
  bounds: WorldAtlasBounds = DEFAULT_ATLAS_BOUNDS,
  baseElevationY = 0,
): void {
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const { centerX, centerY, scaleX, scaleY, rotationRad } = entry.worldTransform;
  const verticalScale = Math.sqrt(Math.max(1e-8, scaleX * scaleY));
  const depthLiftY = multiMapDepthLiftY(entry.depth);

  pivot.position.set(centerX, baseElevationY + depthLiftY, centerY);
  pivot.rotation.set(0, -rotationRad, 0);
  pivot.scale.set(scaleX, verticalScale, scaleY);
  content.position.set(-midX, 0, -midY);
  pivot.updateMatrixWorld(true);
}

function applyMaterialOpacity(entry: ClonedGroupMaterial, opacity: number): void {
  const clamped = Math.max(0, Math.min(1, opacity));
  const mat = entry.material;
  const isTranslucent = clamped < 0.999;
  if (mat instanceof THREE.ShaderMaterial && mat.uniforms?.uOpacity) {
    mat.uniforms.uOpacity.value = clamped;
    if (mat.transparent !== isTranslucent) {
      mat.transparent = isTranslucent;
      mat.depthWrite = !isTranslucent;
      mat.needsUpdate = true;
    }
    return;
  }
  const prevTransparent = mat.transparent;
  mat.opacity = clamped;
  mat.transparent = isTranslucent;
  mat.depthWrite = !isTranslucent;
  if (prevTransparent !== isTranslucent) {
    mat.needsUpdate = true;
  }
}

export class AtlasThreeMultiMapGraph {
  readonly rootGroup = new THREE.Group();
  readonly worldTerrain: AtlasThreeWorldTerrain;
  private readonly groups = new Map<string, AtlasThreeMapGroupNode>();
  private activeEditorMapId: string | null = null;
  private clearRootCount = 0;
  private incrementalSyncCount = 0;
  private lastTerrainSourceKey = '';

  constructor(
    private readonly getMaterial: (key: AtlasThreeSurfaceKey) => THREE.Material,
    private readonly waterMaterial: THREE.Material,
  ) {
    this.rootGroup.name = 'atlas3:multimap-root';
    this.worldTerrain = new AtlasThreeWorldTerrain(() => this.getMaterial('terrain'));
    this.rootGroup.add(this.worldTerrain.rootGroup);
  }

  /**
   * Synchronize the shared chunked world terrain source from the root map's heightfield
   * plus any localized fine heightfield overlays (e.g. Dornhain hills) projected into World Space.
   */
  private ensureSharedWorldTerrainSource(
    scenePlan: AtlasWorldScenePlan,
    sources: ReadonlyMap<string, AtlasThreeWorldMapSource>,
  ): void {
    const rootId = scenePlan.rootMapId;
    const rootSource = rootId ? sources.get(rootId) : undefined;
    const rootHf = rootSource?.doc.heightfield ?? null;
    if (!rootHf || !rootSource) {
      if (this.lastTerrainSourceKey !== '') {
        this.lastTerrainSourceKey = '';
        this.worldTerrain.setSource(null);
      }
      return;
    }

    const overlays: AtlasWorldHeightfieldOverlay[] = [];
    const overlayParts: string[] = [];
    for (const entry of scenePlan.entries) {
      if (entry.depth === 1) continue;
      const src = sources.get(entry.mapId);
      if (!src || src.look !== 'outdoor' || !src.doc.heightfield) continue;
      const hf = src.doc.heightfield;
      const verticalScale = Math.sqrt(
        Math.max(1e-8, entry.worldTransform.scaleX * entry.worldTransform.scaleY),
      );
      overlays.push({
        id: entry.mapId,
        worldBounds: {
          minX: entry.worldAabb.minX,
          minZ: entry.worldAabb.minY,
          maxX: entry.worldAabb.maxX,
          maxZ: entry.worldAabb.maxY,
        },
        heightfield: hf,
        elevationScale: Math.max(0.012, Math.min(0.06, verticalScale * 4)),
        featherRatio: 0.24,
      });
      overlayParts.push(`${entry.mapId}:${src.revisionKey ?? 'v0'}`);
    }

    const key = `${rootId}:${rootSource.revisionKey ?? 'v0'}:${hfVersionKey(rootHf)}|${overlayParts.sort().join(',')}`;
    if (key === this.lastTerrainSourceKey) return;
    this.lastTerrainSourceKey = key;

    this.worldTerrain.setSource(
      createAtlasWorldHeightfieldSource({
        rootHeightfield: rootHf,
        revisionKey: key,
        overlays,
      }),
    );
  }

  /**
   * Incrementally sync the shared chunked world terrain AND Three.js overlay groups
   * to match `scenePlan`.
   *
   * - Never calls `clearRoot()`.
   * - Consumes `entry.detailWeight` continuously via per-group cloned materials without
   *   rebuilding geometry when only opacity/transform changes.
   * - When `dtSec` is provided (live render loop), smoothly damps opacity (~180 ms)
   *   and fades exiting groups out to 0 before disposing them.
   */
  sync(input: {
    readonly scenePlan: AtlasWorldScenePlan;
    readonly sources: ReadonlyMap<string, AtlasThreeWorldMapSource>;
    readonly presetId: AtlasGraphicsPresetId;
    readonly hideRoofs: boolean;
    readonly viewSpan: number;
    readonly camera?: AtlasWorldCameraState;
    readonly viewportPx?: { readonly width: number; readonly height: number };
    readonly dtSec?: number;
  }): void {
    this.incrementalSyncCount += 1;
    this.activeEditorMapId = input.scenePlan.activeEditorMapId;

    // 0) Sync the ONE shared chunked world terrain (Phase 1.3)
    this.ensureSharedWorldTerrainSource(input.scenePlan, input.sources);
    const hasSharedTerrain = Boolean(this.worldTerrain.getSource());
    if (hasSharedTerrain && input.camera && input.viewportPx) {
      this.worldTerrain.sync({
        camera: input.camera,
        viewportPx: input.viewportPx,
      });
    }

    const wantedIds = new Set(input.scenePlan.entries.map((e) => e.mapId));
    const useSmoothDamp = typeof input.dtSec === 'number' && Number.isFinite(input.dtSec);
    const dampAlpha = useSmoothDamp
      ? 1 - Math.exp(-OPACITY_DAMP_RATE * Math.max(0.001, Math.min(0.1, input.dtSec!)))
      : 1;

    // 1) Fade out or dispose groups that left the active scene plan
    for (const [mapId, node] of [...this.groups.entries()]) {
      if (wantedIds.has(mapId)) continue;
      if (useSmoothDamp && node.depth > 1 && node.currentOpacity > OPACITY_EXIT_EPSILON) {
        node.exiting = true;
        node.targetOpacity = 0;
        node.detailWeight = 0;
        node.currentOpacity += (0 - node.currentOpacity) * dampAlpha;
        this.applyOpacityToNode(node);
        if (node.currentOpacity <= OPACITY_EXIT_EPSILON) {
          this.disposeGroupNode(node);
          this.groups.delete(mapId);
        }
      } else {
        this.disposeGroupNode(node);
        this.groups.delete(mapId);
      }
    }

    // 2) Mount new groups or incrementally update transform & continuous opacity
    for (const entry of input.scenePlan.entries) {
      const source = input.sources.get(entry.mapId);
      if (!source) continue;

      const cSig = cutoutSignature(entry.cutoutRectsLocal);
      const rev = source.revisionKey ?? 'v0';
      const terrainSig = hasSharedTerrain ? this.lastTerrainSourceKey : 'local';
      const sig = `${rev}|${source.mapScale}|${source.look}|${input.presetId}|${input.hideRoofs ? 1 : 0}|${cSig}|${terrainSig}`;
      const targetOpacity = entry.depth === 1 ? 1 : Math.max(0, Math.min(1, entry.detailWeight));

      const baseElevationY =
        hasSharedTerrain && source.look === 'indoor'
          ? this.worldTerrain.sampleElevation(
              entry.worldTransform.centerX,
              entry.worldTransform.centerY,
            ) + 0.15
          : 0;

      const existing = this.groups.get(entry.mapId);
      if (existing && existing.buildSignature === sig) {
        // Zero rebuild: update world transform AND smoothly ramp continuous opacity!
        existing.exiting = false;
        existing.lodState = entry.lodState;
        existing.detailWeight = entry.detailWeight;
        existing.targetOpacity = targetOpacity;
        existing.currentOpacity =
          entry.depth === 1
            ? 1
            : useSmoothDamp
              ? existing.currentOpacity + (targetOpacity - existing.currentOpacity) * dampAlpha
              : targetOpacity;
        applyWorldTransformToGroup(
          existing.pivot,
          existing.content,
          entry,
          source.bounds,
          baseElevationY,
        );
        this.applyOpacityToNode(existing);
        continue;
      }

      const prevOpacity = existing?.currentOpacity;
      if (existing) {
        this.disposeGroupNode(existing);
        this.groups.delete(entry.mapId);
      }

      const filteredDoc = applyLocalCutoutFilter(source.doc, entry.cutoutRectsLocal);
      const bounds = source.bounds ?? DEFAULT_ATLAS_BOUNDS;
      const midX = (bounds.minX + bounds.maxX) / 2;
      const midY = (bounds.minY + bounds.maxY) / 2;
      const { centerX, centerY, scaleX, scaleY, rotationRad } = entry.worldTransform;
      const cosR = Math.cos(rotationRad);
      const sinR = Math.sin(rotationRad);
      const verticalScale = Math.sqrt(Math.max(1e-8, scaleX * scaleY));
      const depthLiftY = multiMapDepthLiftY(entry.depth);

      const sharedWorldTerrain: SharedWorldTerrainBinding | undefined =
        hasSharedTerrain && source.look === 'outdoor'
          ? {
              sampleElevationWorld: (wx, wz) => this.worldTerrain.sampleElevation(wx, wz),
              mapToWorld: (lx, lz) => {
                const dx = (lx - midX) * scaleX;
                const dz = (lz - midY) * scaleY;
                return [centerX + dx * cosR - dz * sinR, centerY + dx * sinR + dz * cosR] as const;
              },
              verticalScale,
              depthLiftY,
              waterLevel: this.worldTerrain.getSource()?.waterLevel ?? 0,
            }
          : undefined;

      const plan = buildAtlasThreeScenePlan(filteredDoc, {
        mapScale: source.mapScale,
        look: source.look,
        span: Math.max(24, input.viewSpan / Math.max(1e-4, entry.worldTransform.scaleX)),
        presetId: input.presetId,
        seed: entry.mapId,
        hideRoofs: input.hideRoofs,
        warmWindows: true,
        sharedWorldTerrain,
      });

      const pivot = new THREE.Group();
      pivot.name = `atlas3:map-pivot:${entry.mapId}`;
      pivot.userData.mapId = entry.mapId;
      pivot.userData.depth = entry.depth;

      const content = new THREE.Group();
      content.name = `atlas3:map-content:${entry.mapId}`;
      pivot.add(content);

      const pickables: THREE.Object3D[] = [];
      const geometries: THREE.BufferGeometry[] = [];
      const materials: ClonedGroupMaterial[] = [];

      const cloneSurfaceMat = (surfaceKey: AtlasThreeSurfaceKey): THREE.Material => {
        const cloned = this.getMaterial(surfaceKey).clone();
        materials.push({ material: cloned, surfaceKey });
        return cloned;
      };

      for (const [surfaceKey, builder] of plan.builders) {
        if (builder.triangleCount === 0) continue;
        const geo = builder.build();
        geometries.push(geo);
        const mat = cloneSurfaceMat(surfaceKey);
        const mesh = new THREE.Mesh(geo, mat);
        const flat = surfaceKey.startsWith('sheet') || surfaceKey.startsWith('floor');
        mesh.castShadow = !flat;
        mesh.receiveShadow = true;
        mesh.userData.triIds = builder.triIds;
        mesh.userData.mapId = entry.mapId;
        mesh.name = `atlas3:${entry.mapId}:${surfaceKey}`;
        content.add(mesh);
        pickables.push(mesh);
      }

      if (plan.water.triangleCount > 0) {
        const geo = plan.water.build();
        geometries.push(geo);
        const waterClone = this.waterMaterial.clone();
        materials.push({ material: waterClone, surfaceKey: 'water' });
        const mesh = new THREE.Mesh(geo, waterClone);
        mesh.userData.triIds = plan.water.triIds;
        mesh.userData.mapId = entry.mapId;
        mesh.name = `atlas3:${entry.mapId}:water`;
        mesh.renderOrder = 2;
        content.add(mesh);
        pickables.push(mesh);
      }

      // Per-map terrain only if no shared world terrain source exists (legacy fallback)
      let hasOwnTerrain = false;
      if (plan.terrain) {
        hasOwnTerrain = true;
        geometries.push(plan.terrain);
        const mat = cloneSurfaceMat('terrain');
        const mesh = new THREE.Mesh(plan.terrain, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.mapId = entry.mapId;
        mesh.name = `atlas3:${entry.mapId}:terrain`;
        content.add(mesh);
      }

      applyWorldTransformToGroup(pivot, content, entry, source.bounds, baseElevationY);
      this.rootGroup.add(pivot);

      // Start freshly entering child maps from 0 (damped fade-in) instead of jumping 0→100%
      const initialOpacity =
        entry.depth === 1
          ? 1
          : prevOpacity !== undefined
            ? prevOpacity
            : useSmoothDamp
              ? targetOpacity * dampAlpha
              : targetOpacity;

      const node: AtlasThreeMapGroupNode = {
        mapId: entry.mapId,
        depth: entry.depth,
        pivot,
        content,
        pickables,
        scenePlan: plan,
        buildSignature: sig,
        geometries,
        materials,
        cutoutSignature: cSig,
        hasOwnTerrain,
        lodState: entry.lodState,
        detailWeight: entry.detailWeight,
        targetOpacity,
        currentOpacity: initialOpacity,
        exiting: false,
      };
      this.applyOpacityToNode(node);
      this.groups.set(entry.mapId, node);
    }
  }

  /** Propagate lighting/style roughness & normalScale updates to cloned per-group materials. */
  applyStyleMode(styleMode: 'pbr' | 'illustrated' | 'cel'): void {
    for (const node of this.groups.values()) {
      for (const entry of node.materials) {
        if (entry.surfaceKey === 'water') continue;
        if (!(entry.material instanceof THREE.MeshStandardMaterial)) continue;
        const spec = ATLAS_THREE_SURFACES[entry.surfaceKey];
        if (!spec) continue;
        if (styleMode === 'cel') {
          entry.material.roughness = Math.min(1, spec.roughness + 0.08);
          entry.material.normalScale.set(spec.normalScale * 0.35, spec.normalScale * 0.35);
        } else if (styleMode === 'illustrated') {
          entry.material.roughness = Math.min(1, spec.roughness + 0.03);
          entry.material.normalScale.set(spec.normalScale * 0.72, spec.normalScale * 0.72);
        } else {
          entry.material.roughness = spec.roughness;
          entry.material.normalScale.set(spec.normalScale, spec.normalScale);
        }
      }
    }
  }

  /** Propagate animated water shader uniforms to cloned per-group river/water materials. */
  syncWaterUniforms(sourceWater: THREE.ShaderMaterial): void {
    for (const node of this.groups.values()) {
      for (const entry of node.materials) {
        if (entry.surfaceKey !== 'water' || !(entry.material instanceof THREE.ShaderMaterial)) continue;
        const dst = entry.material.uniforms;
        const src = sourceWater.uniforms;
        if (dst.uTime && src.uTime) dst.uTime.value = src.uTime.value;
        if (dst.uDeep && src.uDeep) dst.uDeep.value.copy(src.uDeep.value);
        if (dst.uShallow && src.uShallow) dst.uShallow.value.copy(src.uShallow.value);
        if (dst.uSky && src.uSky) dst.uSky.value.copy(src.uSky.value);
        if (dst.uSunDir && src.uSunDir) dst.uSunDir.value.copy(src.uSunDir.value);
        if (dst.uFogColor && src.uFogColor) dst.uFogColor.value.copy(src.uFogColor.value);
        if (dst.uFocus && src.uFocus) dst.uFocus.value.copy(src.uFocus.value);
        if (dst.uSpan && src.uSpan) dst.uSpan.value = src.uSpan.value;
      }
    }
  }

  private applyOpacityToNode(node: AtlasThreeMapGroupNode): void {
    const op = Math.max(0, Math.min(1, node.currentOpacity));
    for (const m of node.materials) {
      applyMaterialOpacity(m, op);
    }
    node.pivot.visible = op > 0.005;
  }

  getGroup(mapId: string): AtlasThreeMapGroupNode | undefined {
    return this.groups.get(mapId);
  }

  getAllPickables(): readonly THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const g of this.groups.values()) {
      if (!g.pivot.visible || g.exiting) continue;
      for (const p of g.pickables) out.push(p);
    }
    return out;
  }

  getActiveEditorElevationY(focusX?: number, focusZ?: number): number {
    const activeGroup = this.activeEditorMapId ? this.groups.get(this.activeEditorMapId) : undefined;
    if (activeGroup && activeGroup.pivot.position.y > 0.5) {
      return activeGroup.pivot.position.y;
    }
    const terrainSource = this.worldTerrain.getSource();
    if (terrainSource && focusX !== undefined && focusZ !== undefined) {
      return Math.max(terrainSource.waterLevel, this.worldTerrain.sampleElevation(focusX, focusZ));
    }
    return activeGroup ? activeGroup.pivot.position.y : 0;
  }

  getRenderedIds(): string[] {
    const out = new Set<string>();
    for (const g of this.groups.values()) {
      for (const id of g.scenePlan.ids) out.add(id);
    }
    return [...out].sort();
  }

  getStats(): AtlasThreeMultiMapStats {
    const terrain = this.worldTerrain.getStats();
    let liveGeometryCount = terrain.liveGeometryCount;
    let ownPerMapTerrainCount = 0;
    const groupOpacities: Record<string, AtlasThreeGroupOpacitySnapshot> = {};
    for (const g of this.groups.values()) {
      liveGeometryCount += g.geometries.length;
      if (g.hasOwnTerrain) ownPerMapTerrainCount += 1;
      groupOpacities[g.mapId] = {
        detailWeight: Math.round(g.detailWeight * 1000) / 1000,
        opacity: Math.round(g.currentOpacity * 1000) / 1000,
        depth: g.depth,
        lodState: g.lodState,
        exiting: g.exiting,
      };
    }
    return {
      activeMapIds: [...this.groups.keys()],
      activeEditorMapId: this.activeEditorMapId,
      groupCount: this.groups.size,
      liveGeometryCount,
      clearRootCount: this.clearRootCount,
      incrementalSyncCount: this.incrementalSyncCount,
      ownPerMapTerrainCount,
      terrain,
      groupOpacities,
    };
  }

  /** Teardown all groups + shared terrain chunks and release 100% of GPU geometries & cloned materials. */
  dispose(): void {
    this.worldTerrain.dispose();
    for (const node of this.groups.values()) {
      this.disposeGroupNode(node);
    }
    this.groups.clear();
    this.activeEditorMapId = null;
    this.lastTerrainSourceKey = '';
  }

  private disposeGroupNode(node: AtlasThreeMapGroupNode): void {
    this.rootGroup.remove(node.pivot);
    for (const geo of node.geometries) {
      geo.dispose();
    }
    for (const entry of node.materials) {
      entry.material.dispose();
    }
    node.geometries.length = 0;
    node.materials.length = 0;
    node.pickables.length = 0;
  }
}

function hfVersionKey(hf: { readonly cols: number; readonly rows: number; readonly assetRef: { readonly version: number } }): string {
  return `${hf.cols}x${hf.rows}v${hf.assetRef.version}`;
}
