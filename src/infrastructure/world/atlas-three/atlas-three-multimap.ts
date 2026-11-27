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
  buildAtlasScatterGeometry,
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
  readonly surfaceKey: AtlasThreeSurfaceKey | 'water' | 'ao';
};

export type AtlasThreeMapGroupNode = {
  readonly mapId: string;
  readonly depth: number;
  readonly pivot: THREE.Group;
  readonly content: THREE.Group;
  readonly pickables: THREE.Object3D[];
  readonly overlayMeshes: THREE.Object3D[];
  readonly waterMeshes: THREE.Object3D[];
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
  targetWaterOpacity: number;
  currentWaterOpacity: number;
  exiting: boolean;
};

export type AtlasThreeGroupOpacitySnapshot = {
  readonly detailWeight: number;
  readonly opacity: number;
  readonly waterOpacity: number;
  readonly depth: number;
  readonly lodState: string;
  readonly exiting: boolean;
};

function smoothstep01(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Compute target opacity for macro non-water overlays (macro landmark markers & macro roads)
 * on World/Continent/Country maps (`depth 1..3`) when Shared World Terrain is active.
 * Always fades completely to exact `0` (NEVER lingering `0.08` ghost geometry!) before
 * entering settlement scale, and symmetrically fades back in when zooming out.
 */
export function computeMacroOverlayTargetOpacity(input: {
  readonly depth: number;
  readonly detailWeight: number;
  readonly viewSpan: number;
  readonly childWeight: number;
  readonly hasActiveSettlementOrDeeper: boolean;
}): number {
  const { depth, detailWeight, viewSpan, childWeight, hasActiveSettlementOrDeeper } = input;
  if (depth <= 1) {
    if (hasActiveSettlementOrDeeper) return 0;
    const spanFade = smoothstep01(80, 195, viewSpan);
    const childFade = 1 - smoothstep01(0.45, 0.95, childWeight);
    return Math.max(0, Math.min(1, spanFade * childFade));
  }
  if (depth === 2) {
    if (hasActiveSettlementOrDeeper) return 0;
    const spanFade = smoothstep01(30, 88, viewSpan);
    const childFade = 1 - smoothstep01(0.25, 0.85, childWeight);
    return Math.max(0, Math.min(1, detailWeight * spanFade * childFade));
  }
  // depth === 3 (Country): fades smoothly to 0 as settlement comes into close-up view
  const spanFade = smoothstep01(9, 28, viewSpan);
  const childFade = 1 - smoothstep01(0.15, 0.72, childWeight);
  return Math.max(0, Math.min(1, detailWeight * spanFade * childFade));
}

/**
 * Compute target opacity for macro river/water overlays (`surfaceKey === 'water'`) on `depth 1..3`.
 * Keeps slim regional carrier rivers active across regional/approach zoom up to the Liang-Barsky
 * settlement cutout, then smoothly hands over to the calibrated local settlement river at close-up
 * zoom so no coarse blunt macro ribbon sits beside a narrow village stream.
 */
export function computeMacroWaterTargetOpacity(input: {
  readonly depth: number;
  readonly detailWeight: number;
  readonly viewSpan: number;
  readonly childWeight: number;
  readonly hasActiveSettlementOrDeeper: boolean;
}): number {
  const { depth, detailWeight, viewSpan, childWeight, hasActiveSettlementOrDeeper } = input;
  if (depth <= 1) {
    if (hasActiveSettlementOrDeeper) return 0;
    return Math.max(0, Math.min(1, 1 - smoothstep01(0.35, 0.9, childWeight)));
  }
  if (depth === 2) {
    if (hasActiveSettlementOrDeeper && viewSpan < 10) return 0;
    return Math.max(0, Math.min(1, detailWeight * (1 - smoothstep01(0.35, 0.9, childWeight))));
  }
  // depth === 3 (Country): stays active through regional approach (`span >= 8`), then hands off
  // smoothly (`span 8 -> 2.8`) once the calibrated local settlement river owns the frame.
  const closeHandoff = hasActiveSettlementOrDeeper ? smoothstep01(2.8, 8.0, viewSpan) : 1;
  return Math.max(0, Math.min(1, Math.max(detailWeight, hasActiveSettlementOrDeeper ? 0.95 : 0) * closeHandoff));
}

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
  const table = [0, 0.08, 0.14, 0.18, 0.184, 0.187];
  const idx = Math.max(0, depth - 1);
  if (idx < table.length) return table[idx]!;
  return 0.187 + (idx - (table.length - 1)) * 0.003;
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
  if (entry.surfaceKey === 'ao') {
    mat.opacity = clamped * 0.72;
    mat.transparent = true;
    mat.depthWrite = false;
    return;
  }
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
    private readonly aoMaterial?: THREE.Material,
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
      if (
        useSmoothDamp &&
        node.depth > 1 &&
        (node.currentOpacity > OPACITY_EXIT_EPSILON || node.currentWaterOpacity > OPACITY_EXIT_EPSILON)
      ) {
        node.exiting = true;
        node.targetOpacity = 0;
        node.targetWaterOpacity = 0;
        node.detailWeight = 0;
        node.currentOpacity += (0 - node.currentOpacity) * dampAlpha;
        node.currentWaterOpacity += (0 - node.currentWaterOpacity) * dampAlpha;
        this.applyOpacityToNode(node);
        if (
          node.currentOpacity <= OPACITY_EXIT_EPSILON &&
          node.currentWaterOpacity <= OPACITY_EXIT_EPSILON
        ) {
          this.disposeGroupNode(node);
          this.groups.delete(mapId);
        }
      } else {
        this.disposeGroupNode(node);
        this.groups.delete(mapId);
      }
    }

    // Compute highest active child detailWeight per parent so coarse outdoor parent overlays
    // (coarse land roads, world landmark icons) smoothly yield to detailed settlements/buildings
    // while the ONE shared chunked world terrain stays 100% opaque underneath!
    const maxChildWeightByParent = new Map<string, number>();
    const hasIndoorChildByParent = new Map<string, boolean>();
    let hasActiveSettlementOrDeeper = false;
    for (const e of input.scenePlan.entries) {
      if (e.depth >= 4 && e.detailWeight > 0.25) {
        hasActiveSettlementOrDeeper = true;
      }
      if (!e.parentMapId) continue;
      const prev = maxChildWeightByParent.get(e.parentMapId) ?? 0;
      if (e.detailWeight > prev) {
        maxChildWeightByParent.set(e.parentMapId, e.detailWeight);
      }
      const childSrc = input.sources.get(e.mapId);
      if (childSrc?.look === 'indoor' && e.detailWeight > 0.25) {
        hasIndoorChildByParent.set(e.parentMapId, true);
      }
    }

    // 2) Mount new groups or incrementally update transform & continuous opacity
    for (const entry of input.scenePlan.entries) {
      const source = input.sources.get(entry.mapId);
      if (!source) continue;

      const cSig = cutoutSignature(entry.cutoutRectsLocal);
      const rev = source.revisionKey ?? 'v0';
      const terrainSig = hasSharedTerrain ? this.lastTerrainSourceKey : 'local';
      // Auto roof-cutaway on a settlement when an interior building/room inside it is active!
      const effectiveHideRoofs =
        input.hideRoofs || Boolean(hasIndoorChildByParent.get(entry.mapId));
      const sig = `${rev}|${source.mapScale}|${source.look}|${input.presetId}|${effectiveHideRoofs ? 1 : 0}|${cSig}|${terrainSig}`;

      const childWeight = maxChildWeightByParent.get(entry.mapId) ?? 0;
      // Scale-aware 2-channel handover:
      //  - Macro non-water overlays (macro landmark markers & coarse roads on depth 1..3) fade
      //    completely to exact `0` before settlement scale (ZERO `0.08` ghost geometry!).
      //  - Macro rivers (`water`) stay active on the immediate regional carrier around Liang-Barsky
      //    settlement cutouts so calibrated local settlement rivers hand off without abrupt breaks.
      const isSharedMacroOutdoor =
        hasSharedTerrain && source.look === 'outdoor' && source.mapScale === 'world';
      let targetOpacity: number;
      let targetWaterOpacity: number;
      if (isSharedMacroOutdoor) {
        targetOpacity = computeMacroOverlayTargetOpacity({
          depth: entry.depth,
          detailWeight: entry.detailWeight,
          viewSpan: input.viewSpan,
          childWeight,
          hasActiveSettlementOrDeeper,
        });
        targetWaterOpacity = computeMacroWaterTargetOpacity({
          depth: entry.depth,
          detailWeight: entry.detailWeight,
          viewSpan: input.viewSpan,
          childWeight,
          hasActiveSettlementOrDeeper,
        });
      } else if (entry.depth === 1) {
        targetOpacity = 1;
        targetWaterOpacity = 1;
      } else if (source.look === 'outdoor' && hasIndoorChildByParent.get(entry.mapId)) {
        // Keep settlement surroundings gently visible as context around an active indoor building
        targetOpacity = Math.max(0.45, Math.min(1, entry.detailWeight * 0.72));
        targetWaterOpacity = targetOpacity;
      } else {
        targetOpacity = Math.max(0, Math.min(1, entry.detailWeight));
        targetWaterOpacity = targetOpacity;
      }

      const baseElevationY =
        hasSharedTerrain && source.look === 'indoor'
          ? this.worldTerrain.sampleElevation(
            entry.worldTransform.centerX,
            entry.worldTransform.centerY,
          ) + 0.003
          : 0;

      const existing = this.groups.get(entry.mapId);
      if (existing && existing.buildSignature === sig) {
        // Zero rebuild: update world transform AND smoothly ramp continuous opacity!
        existing.exiting = false;
        existing.lodState = entry.lodState;
        existing.detailWeight = entry.detailWeight;
        existing.targetOpacity = targetOpacity;
        existing.targetWaterOpacity = targetWaterOpacity;
        existing.currentOpacity =
          useSmoothDamp
            ? existing.currentOpacity + (targetOpacity - existing.currentOpacity) * dampAlpha
            : targetOpacity;
        existing.currentWaterOpacity =
          useSmoothDamp
            ? existing.currentWaterOpacity +
              (targetWaterOpacity - existing.currentWaterOpacity) * dampAlpha
            : targetWaterOpacity;
        if (Math.abs(existing.currentOpacity - targetOpacity) < 0.004) {
          existing.currentOpacity = targetOpacity;
        }
        if (Math.abs(existing.currentWaterOpacity - targetWaterOpacity) < 0.004) {
          existing.currentWaterOpacity = targetWaterOpacity;
        }
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
      const prevWaterOpacity = existing?.currentWaterOpacity;
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
        hideRoofs: effectiveHideRoofs,
        warmWindows: true,
        sharedWorldTerrain,
        exclusionRects: entry.cutoutRectsLocal,
      });

      const pivot = new THREE.Group();
      pivot.name = `atlas3:map-pivot:${entry.mapId}`;
      pivot.userData.mapId = entry.mapId;
      pivot.userData.depth = entry.depth;

      const content = new THREE.Group();
      content.name = `atlas3:map-content:${entry.mapId}`;
      pivot.add(content);

      const pickables: THREE.Object3D[] = [];
      const overlayMeshes: THREE.Object3D[] = [];
      const waterMeshes: THREE.Object3D[] = [];
      const geometries: THREE.BufferGeometry[] = [];
      const materials: ClonedGroupMaterial[] = [];

      const clonedMatCache = new Map<AtlasThreeSurfaceKey, THREE.Material>();
      const cloneSurfaceMat = (surfaceKey: AtlasThreeSurfaceKey): THREE.Material => {
        const cached = clonedMatCache.get(surfaceKey);
        if (cached) return cached;
        const cloned = this.getMaterial(surfaceKey).clone();
        clonedMatCache.set(surfaceKey, cloned);
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
        overlayMeshes.push(mesh);
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
        waterMeshes.push(mesh);
        pickables.push(mesh);
      }

      if (plan.doorInstances.matrices.length > 0) {
        const doorGeo = new THREE.BoxGeometry(1, 1, 1);
        geometries.push(doorGeo);
        const inst = new THREE.InstancedMesh(
          doorGeo,
          cloneSurfaceMat('wood-dark'),
          plan.doorInstances.matrices.length,
        );
        plan.doorInstances.matrices.forEach((m, i) => inst.setMatrixAt(i, m));
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
        inst.castShadow = true;
        inst.receiveShadow = true;
        inst.userData.instanceIds = plan.doorInstances.ids;
        inst.userData.mapId = entry.mapId;
        inst.name = `atlas3:${entry.mapId}:doors`;
        content.add(inst);
        overlayMeshes.push(inst);
        pickables.push(inst);
      }

      // Suggestive scatter (settlement perimeter woods/bushes/flowers & interior rubble)
      // — skip coarse world-level scatter on depth 1–3 outdoor overview maps when shared terrain
      // is active so zooming in never lingers on giant coarse trees before reaching Dornhain!
      const emitScatterForGroup =
        !hasSharedTerrain || source.mapScale === 'settlement' || source.look === 'indoor';
      if (emitScatterForGroup) {
        for (const batch of plan.scatterBatches) {
          const { parts } = buildAtlasScatterGeometry(batch.kind);
          for (const part of parts) {
            geometries.push(part.geo);
            const inst = new THREE.InstancedMesh(
              part.geo,
              cloneSurfaceMat(part.surface),
              batch.matrices.length,
            );
            batch.matrices.forEach((m, i) => inst.setMatrixAt(i, m));
            inst.instanceMatrix.needsUpdate = true;
            inst.computeBoundingSphere();
            inst.castShadow = batch.kind !== 'flower' && batch.kind !== 'rubble';
            inst.receiveShadow = true;
            inst.userData.mapId = entry.mapId;
            inst.name = `atlas3:${entry.mapId}:scatter:${batch.kind}`;
            content.add(inst);
            overlayMeshes.push(inst);
          }
        }
      }

      if (this.aoMaterial && plan.aoDiscs.length > 0 && source.mapScale !== 'world') {
        const discGeo = new THREE.PlaneGeometry(2, 2);
        discGeo.rotateX(-Math.PI / 2);
        geometries.push(discGeo);
        const aoClone = this.aoMaterial.clone();
        materials.push({ material: aoClone, surfaceKey: 'ao' });
        const aoInst = new THREE.InstancedMesh(discGeo, aoClone, plan.aoDiscs.length);
        const mat4 = new THREE.Matrix4();
        const quat = new THREE.Quaternion();
        plan.aoDiscs.forEach((d, i) => {
          mat4.compose(new THREE.Vector3(d.x, d.y, d.z), quat, new THREE.Vector3(d.radius, 1, d.radius));
          aoInst.setMatrixAt(i, mat4);
        });
        aoInst.instanceMatrix.needsUpdate = true;
        aoInst.computeBoundingSphere();
        aoInst.renderOrder = 2;
        aoInst.name = `atlas3:${entry.mapId}:ao`;
        content.add(aoInst);
        overlayMeshes.push(aoInst);
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
        overlayMeshes.push(mesh);
      }

      applyWorldTransformToGroup(pivot, content, entry, source.bounds, baseElevationY);
      this.rootGroup.add(pivot);

      // Start freshly entering child maps from 0 (damped fade-in) instead of jumping 0→100%
      const initialOpacity =
        prevOpacity !== undefined
          ? prevOpacity
          : entry.depth === 1
            ? targetOpacity
            : useSmoothDamp
              ? targetOpacity * dampAlpha
              : targetOpacity;
      const initialWaterOpacity =
        prevWaterOpacity !== undefined
          ? prevWaterOpacity
          : entry.depth === 1
            ? targetWaterOpacity
            : useSmoothDamp
              ? targetWaterOpacity * dampAlpha
              : targetWaterOpacity;

      const node: AtlasThreeMapGroupNode = {
        mapId: entry.mapId,
        depth: entry.depth,
        pivot,
        content,
        pickables,
        overlayMeshes,
        waterMeshes,
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
        targetWaterOpacity,
        currentWaterOpacity: initialWaterOpacity,
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
        if (entry.surfaceKey === 'water' || entry.surfaceKey === 'ao') continue;
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
        if (dst.uWorldHeightTex && src.uWorldHeightTex) dst.uWorldHeightTex.value = src.uWorldHeightTex.value;
        if (dst.uHasWorldHeight && src.uHasWorldHeight) dst.uHasWorldHeight.value = src.uHasWorldHeight.value;
        if (dst.uHeightMin && src.uHeightMin) dst.uHeightMin.value = src.uHeightMin.value;
        if (dst.uHeightMax && src.uHeightMax) dst.uHeightMax.value = src.uHeightMax.value;
        if (dst.uWaterLevel && src.uWaterLevel) dst.uWaterLevel.value = src.uWaterLevel.value;
      }
    }
  }

  private applyOpacityToNode(node: AtlasThreeMapGroupNode): void {
    const op = Math.max(0, Math.min(1, node.currentOpacity));
    const waterOp = Math.max(0, Math.min(1, node.currentWaterOpacity));
    const showOverlay = op > 0.005;
    const showWater = waterOp > 0.005;
    for (const m of node.materials) {
      applyMaterialOpacity(m, m.surfaceKey === 'water' ? waterOp : op);
    }
    for (const mesh of node.overlayMeshes) {
      mesh.visible = showOverlay;
    }
    for (const mesh of node.waterMeshes) {
      mesh.visible = showWater;
    }
    node.pivot.visible = showOverlay || showWater;
  }

  getGroup(mapId: string): AtlasThreeMapGroupNode | undefined {
    return this.groups.get(mapId);
  }

  getAllPickables(): readonly THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const g of this.groups.values()) {
      if (!g.pivot.visible || g.exiting) continue;
      for (const p of g.pickables) {
        if (p.visible) out.push(p);
      }
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
        waterOpacity: Math.round(g.currentWaterOpacity * 1000) / 1000,
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
    node.overlayMeshes.length = 0;
    node.waterMeshes.length = 0;
  }
}

function hfVersionKey(hf: { readonly cols: number; readonly rows: number; readonly assetRef: { readonly version: number } }): string {
  return `${hf.cols}x${hf.rows}v${hf.assetRef.version}`;
}
