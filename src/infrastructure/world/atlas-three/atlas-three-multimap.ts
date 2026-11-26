/**
 * atlas-three-multimap — SWS-04: Multi-Map Three.js Scene Graph (incremental, zero clearRoot).
 * Location: src/infrastructure/world/atlas-three/atlas-three-multimap.ts
 *
 * Consumes domain `AtlasWorldScenePlan` (SWS-03) and manages one `THREE.Group`
 * per active map placed at its exact `worldTransform` (derived via SWS-01).
 *
 * Guarantees (ADR-SWS-01 §5, Review Checklist D1–D5):
 *  - D1: Parent and Child maps coexist simultaneously in `rootGroup` at exact
 *        anchor world transforms (translation, rotation, scale).
 *  - D2: Incremental mount/update/unmount — `clearRootCount` stays 0 during
 *        continuous zoom and navigation.
 *  - D4: Replacement-Refinement — filters parent features inside active child
 *        `cutoutRectsLocal` and offsets depth cleanly to prevent Z-fighting.
 *  - D5: `activeEditorMapId` is tracked as editor context without swapping out
 *        sibling or parent groups.
 *  - Disposal ownership: every group disposes all its Geometries cleanly on exit.
 */
import * as THREE from 'three';
import {
  DEFAULT_ATLAS_BOUNDS,
  type AtlasGraphicsPresetId,
  type AtlasLocalCutoutRect,
  type AtlasMapScale,
  type AtlasWorldSceneGroupPlan,
  type AtlasWorldScenePlan,
  type UnifiedCanvasDoc,
  type WorldAtlasBounds,
} from '../../../domains/world/atlas';
import {
  buildAtlasThreeScenePlan,
  type AtlasThreeLook,
  type AtlasThreeScenePlan,
  type AtlasThreeSurfaceKey,
} from './atlas-three-scene';

export type AtlasThreeWorldMapSource = {
  readonly mapId: string;
  readonly doc: UnifiedCanvasDoc;
  readonly mapScale: AtlasMapScale;
  readonly look: AtlasThreeLook;
  readonly bounds?: WorldAtlasBounds;
  readonly revisionKey?: string;
};

export type AtlasThreeMapGroupNode = {
  readonly mapId: string;
  readonly pivot: THREE.Group;
  readonly content: THREE.Group;
  readonly pickables: THREE.Object3D[];
  readonly scenePlan: AtlasThreeScenePlan;
  readonly buildSignature: string;
  readonly geometries: THREE.BufferGeometry[];
  readonly cutoutSignature: string;
};

export type AtlasThreeMultiMapStats = {
  readonly activeMapIds: readonly string[];
  readonly activeEditorMapId: string | null;
  readonly groupCount: number;
  readonly liveGeometryCount: number;
  readonly clearRootCount: number;
  readonly incrementalSyncCount: number;
};

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
 * Replacement-Refinement filter (ADR-SWS-01 §5.2 / D4):
 * removes coarse parent objects/rooms/strokes that are superseded by an active
 * child map inside `cutoutRectsLocal`, preventing duplicate geometry & Z-fighting.
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
  const strokes = doc.strokes.filter(
    (s) => !s.points.every(([px, py]) => pointInsideAnyCutout(px, py, cutouts)),
  );
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
 * Monotonic depth lift per hierarchy level so child map slabs always sit cleanly
 * above parent landmass slabs with zero coplanar Z-fighting (ADR-SWS-01 §5.2).
 */
export function multiMapDepthLiftY(depth: number): number {
  const table = [0, 0.45, 0.65, 0.72, 0.725, 0.726];
  const idx = Math.max(0, depth - 1);
  if (idx < table.length) return table[idx]!;
  return 0.726 + (idx - (table.length - 1)) * 0.0005;
}

/**
 * Position a map group's pivot + content offset so local `(x, y)` maps to exact
 * World Space `(centerX + dx*cos - dy*sin, depthY, centerY + dx*sin + dy*cos)`.
 */
export function applyWorldTransformToGroup(
  pivot: THREE.Group,
  content: THREE.Group,
  entry: AtlasWorldSceneGroupPlan,
  bounds: WorldAtlasBounds = DEFAULT_ATLAS_BOUNDS,
): void {
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const { centerX, centerY, scaleX, scaleY, rotationRad } = entry.worldTransform;
  const verticalScale = Math.sqrt(Math.max(1e-8, scaleX * scaleY));
  const depthLiftY = multiMapDepthLiftY(entry.depth);

  pivot.position.set(centerX, depthLiftY, centerY);
  pivot.rotation.set(0, -rotationRad, 0);
  pivot.scale.set(scaleX, verticalScale, scaleY);
  content.position.set(-midX, 0, -midY);
  pivot.updateMatrixWorld(true);
}

export class AtlasThreeMultiMapGraph {
  readonly rootGroup = new THREE.Group();
  private readonly groups = new Map<string, AtlasThreeMapGroupNode>();
  private activeEditorMapId: string | null = null;
  private clearRootCount = 0;
  private incrementalSyncCount = 0;

  constructor(
    private readonly getMaterial: (key: AtlasThreeSurfaceKey) => THREE.Material,
    private readonly waterMaterial: THREE.Material,
  ) {
    this.rootGroup.name = 'atlas3:multimap-root';
  }

  /**
   * Incrementally sync the Three.js scene graph to match `scenePlan`.
   * Never calls `clearRoot()` — only mounts entering maps, updates transforms,
   * rebuilds individual groups whose revision/cutouts changed, and disposes exiting maps.
   */
  sync(input: {
    readonly scenePlan: AtlasWorldScenePlan;
    readonly sources: ReadonlyMap<string, AtlasThreeWorldMapSource>;
    readonly presetId: AtlasGraphicsPresetId;
    readonly hideRoofs: boolean;
    readonly viewSpan: number;
  }): void {
    this.incrementalSyncCount += 1;
    this.activeEditorMapId = input.scenePlan.activeEditorMapId;

    const wantedIds = new Set(input.scenePlan.entries.map((e) => e.mapId));

    // 1) Dispose groups that left the active scene plan
    for (const [mapId, node] of [...this.groups.entries()]) {
      if (!wantedIds.has(mapId)) {
        this.disposeGroupNode(node);
        this.groups.delete(mapId);
      }
    }

    // 2) Mount new groups or update existing groups incrementally
    for (const entry of input.scenePlan.entries) {
      const source = input.sources.get(entry.mapId);
      if (!source) continue;

      const cSig = cutoutSignature(entry.cutoutRectsLocal);
      const rev = source.revisionKey ?? 'v0';
      const sig = `${rev}|${source.mapScale}|${source.look}|${input.presetId}|${input.hideRoofs ? 1 : 0}|${cSig}`;

      const existing = this.groups.get(entry.mapId);
      if (existing && existing.buildSignature === sig) {
        // Zero rebuild: only update world transform & visibility
        applyWorldTransformToGroup(existing.pivot, existing.content, entry, source.bounds);
        existing.pivot.visible = true;
        continue;
      }

      if (existing) {
        this.disposeGroupNode(existing);
        this.groups.delete(entry.mapId);
      }

      const filteredDoc = applyLocalCutoutFilter(source.doc, entry.cutoutRectsLocal);
      const plan = buildAtlasThreeScenePlan(filteredDoc, {
        mapScale: source.mapScale,
        look: source.look,
        span: Math.max(24, input.viewSpan / Math.max(1e-4, entry.worldTransform.scaleX)),
        presetId: input.presetId,
        seed: entry.mapId,
        hideRoofs: input.hideRoofs,
        warmWindows: true,
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

      for (const [surfaceKey, builder] of plan.builders) {
        if (builder.triangleCount === 0) continue;
        const geo = builder.build();
        geometries.push(geo);
        const mesh = new THREE.Mesh(geo, this.getMaterial(surfaceKey));
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
        const mesh = new THREE.Mesh(geo, this.waterMaterial);
        mesh.userData.triIds = plan.water.triIds;
        mesh.userData.mapId = entry.mapId;
        mesh.name = `atlas3:${entry.mapId}:water`;
        mesh.renderOrder = 2;
        content.add(mesh);
        pickables.push(mesh);
      }

      if (plan.terrain) {
        geometries.push(plan.terrain);
        const mesh = new THREE.Mesh(plan.terrain, this.getMaterial('terrain'));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.mapId = entry.mapId;
        mesh.name = `atlas3:${entry.mapId}:terrain`;
        content.add(mesh);
      }

      applyWorldTransformToGroup(pivot, content, entry, source.bounds);
      this.rootGroup.add(pivot);

      this.groups.set(entry.mapId, {
        mapId: entry.mapId,
        pivot,
        content,
        pickables,
        scenePlan: plan,
        buildSignature: sig,
        geometries,
        cutoutSignature: cSig,
      });
    }
  }

  getGroup(mapId: string): AtlasThreeMapGroupNode | undefined {
    return this.groups.get(mapId);
  }

  getAllPickables(): readonly THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const g of this.groups.values()) {
      for (const p of g.pickables) out.push(p);
    }
    return out;
  }

  getActiveEditorElevationY(): number {
    if (!this.activeEditorMapId) return 0;
    const g = this.groups.get(this.activeEditorMapId);
    return g ? g.pivot.position.y : 0;
  }

  getRenderedIds(): string[] {
    const out = new Set<string>();
    for (const g of this.groups.values()) {
      for (const id of g.scenePlan.ids) out.add(id);
    }
    return [...out].sort();
  }

  getStats(): AtlasThreeMultiMapStats {
    let liveGeometryCount = 0;
    for (const g of this.groups.values()) {
      liveGeometryCount += g.geometries.length;
    }
    return {
      activeMapIds: [...this.groups.keys()],
      activeEditorMapId: this.activeEditorMapId,
      groupCount: this.groups.size,
      liveGeometryCount,
      clearRootCount: this.clearRootCount,
      incrementalSyncCount: this.incrementalSyncCount,
    };
  }

  /** Teardown all groups and release every GPU BufferGeometry cleanly (budget = 0). */
  dispose(): void {
    for (const node of this.groups.values()) {
      this.disposeGroupNode(node);
    }
    this.groups.clear();
    this.activeEditorMapId = null;
  }

  private disposeGroupNode(node: AtlasThreeMapGroupNode): void {
    this.rootGroup.remove(node.pivot);
    for (const geo of node.geometries) {
      geo.dispose();
    }
    node.geometries.length = 0;
    node.pickables.length = 0;
  }
}
