/**
 * atlas-scene-scatter — ATL3-D01 (#1327) deterministic suggestive scenery scatter.
 * Location: src/domains/world/atlas/atlas-scene-scatter.ts
 *
 * Pure domain — no React, no Three.js, no Host SDKs.
 * Generates reproducible, non-persisted `suggestive` vegetation, rock, and
 * micro-prop instances around canonical features while respecting canonical
 * clearance (rooms, paths, walls, buildings, water) and quality instance budgets.
 */

import { sampleHeightfield } from './atlas-heightfield';
import type { AtlasGraphicsPresetId } from './atlas-renderer-target';
import { resolveAtlasPerfBudgetMaxInstances } from './atlas-perf-budgets';
import type { AtlasMapScale } from './atlas-map-pins';
import type { UnifiedCanvasDoc } from './unified-canvas-doc';

export type AtlasScatterKind =
  | 'oak'
  | 'birch'
  | 'pine'
  | 'bush'
  | 'rock'
  | 'mountain'
  | 'flower'
  | 'barrel'
  | 'crate'
  | 'rubble';

export type AtlasScatterInstance = {
  readonly id: string;
  readonly kind: AtlasScatterKind;
  readonly authority: 'suggestive';
  readonly x: number;
  readonly y: number;
  readonly elevation: number;
  readonly scale: number;
  readonly rotationRad: number;
  readonly tintVariant: number;
};

export type AtlasScatterPlan = {
  readonly format: 'atl3-d01-scatter-plan-v1';
  readonly seed: string;
  readonly presetId: AtlasGraphicsPresetId;
  readonly maxBudget: number;
  readonly instances: readonly AtlasScatterInstance[];
};

function fnv1a(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pointInPolygon(
  x: number,
  y: number,
  pts: readonly (readonly [number, number])[],
): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i]![0];
    const yi = pts[i]![1];
    const xj = pts[j]![0];
    const yj = pts[j]![1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function roomPoints(room: UnifiedCanvasDoc['rooms'][number]): readonly (readonly [number, number])[] {
  if (room.points && room.points.length >= 3) return room.points;
  return [
    [room.x, room.y],
    [room.x + room.w, room.y],
    [room.x + room.w, room.y + room.h],
    [room.x, room.y + room.h],
  ];
}

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 1e-9) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function isWaterMaterial(material: string | undefined): boolean {
  const m = (material ?? '').toLowerCase();
  return m === 'wasser' || m === 'water';
}

function isLandMaterial(material: string | undefined): boolean {
  const m = (material ?? '').toLowerCase();
  return m === 'gras' || m === 'grass' || m === 'moos' || m === 'moss' || m === 'erde' || m === 'earth' || m === 'wald';
}

function isStoneOrMountainMaterial(material: string | undefined): boolean {
  const m = (material ?? '').toLowerCase();
  return m === 'stein' || m === 'stone' || m === 'fels' || m === 'schnee';
}

function isPavedOrInteriorMaterial(material: string | undefined): boolean {
  const m = (material ?? '').toLowerCase();
  return m === 'pflaster' || m === 'paving' || m === 'holz' || m === 'wood';
}

function maxScatterForPreset(presetId: AtlasGraphicsPresetId): number {
  const raw = resolveAtlasPerfBudgetMaxInstances(presetId);
  if (presetId === 'high') return Math.min(raw, 720);
  if (presetId === 'balanced') return Math.min(raw, 460);
  return Math.min(raw, 120);
}

/**
 * Deterministically scatter suggestive vegetation, mountains, boulders, and
 * micro-props around canonical features without mutating or inventing canon.
 */
export function buildAtlasSceneScatter(input: {
  readonly doc: UnifiedCanvasDoc;
  readonly seed: string;
  readonly mapScale: AtlasMapScale;
  readonly presetId: AtlasGraphicsPresetId;
  /** Optional suggestive terrain relief sampler (x, y) -> world Y elevation. */
  readonly elevationSampler?: (x: number, y: number) => number;
  /** Optional local-space rects reserved for detailed child maps (prevents coarse trees covering settlements). */
  readonly exclusionRects?: ReadonlyArray<{
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  }>;
}): AtlasScatterPlan {
  const { doc, seed, mapScale, presetId, elevationSampler, exclusionRects } = input;
  const maxBudget = maxScatterForPreset(presetId);
  const rng = mulberry32(fnv1a(`atl3-d01|${seed}|${mapScale}`));
  const instances: AtlasScatterInstance[] = [];

  const inExclusionRect = (x: number, y: number, pad = 12): boolean => {
    if (!exclusionRects || exclusionRects.length === 0) return false;
    for (const r of exclusionRects) {
      if (x >= r.minX - pad && x <= r.maxX + pad && y >= r.minY - pad && y <= r.maxY + pad) {
        return true;
      }
    }
    return false;
  };

  if (mapScale === 'world' ? doc.layers.terrain === false : doc.layers.objects === false) {
    return { format: 'atl3-d01-scatter-plan-v1', seed, presetId, maxBudget, instances };
  }

  const landPolys: Array<{
    readonly pts: readonly (readonly [number, number])[];
    readonly material: string;
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
  }> = [];
  const pavedPolys: Array<readonly (readonly [number, number])[]> = [];
  const waterPolys: Array<readonly (readonly [number, number])[]> = [];

  for (const room of doc.rooms) {
    if (room.id === 'g.ocean' || room.id === 'w.ocean') continue;
    const pts = roomPoints(room);
    if (isWaterMaterial(room.material)) {
      waterPolys.push(pts);
      continue;
    }
    if (isPavedOrInteriorMaterial(room.material)) {
      pavedPolys.push(pts);
      continue;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [px, py] of pts) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    landPolys.push({ pts, material: room.material, minX, maxX, minY, maxY });
  }

  const hf = doc.heightfield ?? null;
  const waterLevel = hf?.waterLevel ?? -3;

  const isNearStroke = (x: number, y: number, pad: number): boolean => {
    for (const s of doc.strokes) {
      const clearance = Math.max(6, s.width * 0.65 + pad);
      for (let i = 0; i + 1 < s.points.length; i += 1) {
        const a = s.points[i]!;
        const b = s.points[i + 1]!;
        if (distToSegment(x, y, a[0], a[1], b[0], b[1]) < clearance) return true;
      }
    }
    return false;
  };

  const isNearObject = (x: number, y: number, minPad: number): boolean => {
    for (const o of doc.objects) {
      const footprint =
        o.type === 'haus' || o.type === 'turm'
          ? Math.max(32, o.size * 55)
          : Math.max(14, o.size * 24);
      if (Math.hypot(x - o.x, y - o.y) < footprint + minPad) return true;
    }
    return false;
  };

  const isNearWall = (x: number, y: number, pad: number): boolean => {
    for (const w of doc.walls) {
      if (distToSegment(x, y, w.x1, w.y1, w.x2, w.y2) < Math.max(4, w.width + pad)) {
        return true;
      }
    }
    return false;
  };

  const elevationAt = (x: number, y: number): number => {
    if (elevationSampler) {
      const s = elevationSampler(x, y);
      if (Number.isFinite(s)) return s;
    }
    if (!hf) return 0;
    const sampled = sampleHeightfield(hf, x, y);
    return sampled !== null && Number.isFinite(sampled) ? sampled : 0;
  };

  const pushInst = (
    kind: AtlasScatterKind,
    x: number,
    y: number,
    elevation: number,
    scale: number,
  ): void => {
    if (instances.length >= maxBudget) return;
    instances.push({
      id: `scat-${instances.length}`,
      kind,
      authority: 'suggestive',
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      elevation: Math.round(elevation * 100) / 100,
      scale: Math.round(scale * 1000) / 1000,
      rotationRad: Math.round(rng() * Math.PI * 2 * 1000) / 1000,
      tintVariant: Math.floor(rng() * 4),
    });
  };

  if (mapScale === 'interior') {
    // Subtle suggestive dungeon rubble strictly inside stone/earth/moss rooms — NEVER scatter pebbles on hardwood tavern floors!
    const targetCount = Math.min(maxBudget, presetId === 'high' ? 42 : presetId === 'balanced' ? 24 : 10);
    const rooms = doc.rooms.filter(
      (r) =>
        r.id !== 'g.ocean' &&
        r.id !== 'w.ocean' &&
        !isWaterMaterial(r.material) &&
        !isPavedOrInteriorMaterial(r.material),
    );
    let attempts = 0;
    while (instances.length < targetCount && attempts < targetCount * 8 && rooms.length > 0) {
      attempts += 1;
      const room = rooms[Math.floor(rng() * rooms.length)]!;
      const x = room.x + 8 + rng() * Math.max(4, room.w - 16);
      const y = room.y + 8 + rng() * Math.max(4, room.h - 16);
      if (isNearWall(x, y, 8) || isNearObject(x, y, 10)) continue;
      pushInst('rubble', x, y, -0.35, 0.22 + rng() * 0.3);
    }
    return { format: 'atl3-d01-scatter-plan-v1', seed, presetId, maxBudget, instances };
  }

  if (mapScale === 'world') {
    // Rich world/continent/country landmarks: mountain ranges on elevated rock/hills + dense forest groves.
    const targetTrees = Math.floor(maxBudget * 0.62);
    const targetMountains = Math.floor(maxBudget * 0.22);
    const targetRocks = Math.floor(maxBudget * 0.14);

    // 1) Mountains along high heightfield ridges or stone polygons.
    if (hf) {
      const attempts = targetMountains * 10;
      for (let a = 0; a < attempts && instances.length < targetMountains; a += 1) {
        const x = hf.originX + rng() * (hf.cols - 1) * hf.cellSize;
        const y = hf.originZ + rng() * (hf.rows - 1) * hf.cellSize;
        const elev = elevationAt(x, y);
        if (elev < 11) continue;
        if (isNearStroke(x, y, 14) || isNearObject(x, y, 14)) continue;
        const scale = 0.55 + Math.min(1.1, (elev - 10) / 22) * (0.75 + rng() * 0.45);
        pushInst('mountain', x, y, elev - 1.5, scale);
      }
    }

    for (const poly of landPolys) {
      if (!isStoneOrMountainMaterial(poly.material)) continue;
      const count = Math.min(18, Math.max(5, Math.floor((poly.maxX - poly.minX) * (poly.maxY - poly.minY) / 3600)));
      for (let i = 0; i < count * 3 && instances.length < targetMountains + 24; i += 1) {
        const x = poly.minX + rng() * (poly.maxX - poly.minX);
        const y = poly.minY + rng() * (poly.maxY - poly.minY);
        if (!pointInPolygon(x, y, poly.pts)) continue;
        if (inExclusionRect(x, y, 16)) continue;
        if (isNearStroke(x, y, 10) || isNearObject(x, y, 10)) continue;
        const elev = Math.max(0, elevationAt(x, y));
        pushInst('mountain', x, y, elev, 0.5 + rng() * 0.65);
      }
    }

    // 2) Clustered fantasy forests + bushes + coastal boulders on land polygons.
    const grassPolys = landPolys.filter((p) => isLandMaterial(p.material));
    const treeGoal = instances.length + targetTrees;
    let attempts = 0;
    while (instances.length < treeGoal && attempts < targetTrees * 8 && grassPolys.length > 0) {
      attempts += 1;
      const poly = grassPolys[Math.floor(rng() * grassPolys.length)]!;
      const x = poly.minX + rng() * (poly.maxX - poly.minX);
      const y = poly.minY + rng() * (poly.maxY - poly.minY);
      if (!pointInPolygon(x, y, poly.pts)) continue;
      if (waterPolys.some((wp) => pointInPolygon(x, y, wp))) continue;
      if (pavedPolys.some((pp) => pointInPolygon(x, y, pp))) continue;
      if (inExclusionRect(x, y, 16)) continue;
      if (isNearStroke(x, y, 10) || isNearObject(x, y, 10)) continue;
      const elev = elevationAt(x, y);
      if (elevationSampler && elev < 1.2) continue;
      if (hf && elev < waterLevel + 1.2) continue;
      if (elev > 16) continue;
      const r = rng();
      const kind: AtlasScatterKind =
        elev > 8 || r < 0.42 ? 'pine' : r < 0.78 ? 'oak' : r < 0.92 ? 'birch' : 'bush';
      const baseScale = kind === 'bush' ? 0.35 + rng() * 0.25 : 0.44 + rng() * 0.4;
      pushInst(kind, x, y, Math.max(0.5, elev), baseScale);
    }

    const rockGoal = Math.min(maxBudget, instances.length + targetRocks);
    let rockAttempts = 0;
    while (instances.length < rockGoal && rockAttempts < targetRocks * 8 && landPolys.length > 0) {
      rockAttempts += 1;
      const poly = landPolys[Math.floor(rng() * landPolys.length)]!;
      const x = poly.minX + rng() * (poly.maxX - poly.minX);
      const y = poly.minY + rng() * (poly.maxY - poly.minY);
      if (!pointInPolygon(x, y, poly.pts)) continue;
      if (inExclusionRect(x, y, 12)) continue;
      if (isNearStroke(x, y, 8) || isNearObject(x, y, 8)) continue;
      const elev = Math.max(0, elevationAt(x, y));
      pushInst('rock', x, y, elev, 0.25 + rng() * 0.35);
    }

    return { format: 'atl3-d01-scatter-plan-v1', seed, presetId, maxBudget, instances };
  }

  // Settlement scale (e.g., Dornhain): V8-grade perimeter woods, bushes, wildflowers, boulders, and cozy village props!
  const treeTarget = Math.floor(maxBudget * 0.46);
  const bushTarget = Math.floor(maxBudget * 0.28);
  const propTarget = Math.floor(maxBudget * 0.16);

  // Scatter trees & bushes across the terrain hills and grass areas outside paved squares/buildings.
  const boundsMinX = hf ? hf.originX + 18 : 120;
  const boundsMaxX = hf ? hf.originX + (hf.cols - 1) * hf.cellSize - 18 : 880;
  const boundsMinY = hf ? hf.originZ + 18 : 160;
  const boundsMaxY = hf ? hf.originZ + (hf.rows - 1) * hf.cellSize - 18 : 840;

  let attempts = 0;
  while (instances.length < treeTarget && attempts < treeTarget * 10) {
    attempts += 1;
    const x = boundsMinX + rng() * (boundsMaxX - boundsMinX);
    const y = boundsMinY + rng() * (boundsMaxY - boundsMinY);
    if (waterPolys.some((wp) => pointInPolygon(x, y, wp))) continue;
    if (pavedPolys.some((pp) => pointInPolygon(x, y, pp))) continue;
    if (inExclusionRect(x, y, 14)) continue;
    if (isNearStroke(x, y, 16) || isNearObject(x, y, 16) || isNearWall(x, y, 14)) continue;
    const elev = elevationAt(x, y);
    const onLandRoom = landPolys.some((lp) => pointInPolygon(x, y, lp.pts));
    if (hf && !elevationSampler && elev < waterLevel + 0.8 && !onLandRoom) continue;
    const r = rng();
    const kind: AtlasScatterKind = elev > 10 || r < 0.38 ? 'pine' : r < 0.78 ? 'oak' : 'birch';
    const scale = 0.48 + rng() * 0.42;
    pushInst(kind, x, y, Math.max(-0.4, elev), scale);
  }

  const bushGoal = Math.min(maxBudget, instances.length + bushTarget);
  attempts = 0;
  while (instances.length < bushGoal && attempts < bushTarget * 10) {
    attempts += 1;
    const x = boundsMinX + rng() * (boundsMaxX - boundsMinX);
    const y = boundsMinY + rng() * (boundsMaxY - boundsMinY);
    if (waterPolys.some((wp) => pointInPolygon(x, y, wp))) continue;
    if (pavedPolys.some((pp) => pointInPolygon(x, y, pp))) continue;
    if (inExclusionRect(x, y, 10)) continue;
    if (isNearStroke(x, y, 8) || isNearObject(x, y, 8) || isNearWall(x, y, 8)) continue;
    const elev = elevationAt(x, y);
    const onLandRoom = landPolys.some((lp) => pointInPolygon(x, y, lp.pts));
    if (hf && !elevationSampler && elev < waterLevel + 0.5 && !onLandRoom) continue;
    const kind: AtlasScatterKind = rng() < 0.52 ? 'bush' : rng() < 0.82 ? 'flower' : 'rock';
    const scale = kind === 'flower' ? 0.35 + rng() * 0.3 : 0.32 + rng() * 0.36;
    pushInst(kind, x, y, Math.max(-0.4, elev), scale);
  }

  // Cozy village clutter (barrels/crates) tucked close to canonical houses/towers (suggestive only).
  const buildings = doc.objects.filter((o) => o.type === 'haus' || o.type === 'turm');
  const propGoal = Math.min(maxBudget, instances.length + propTarget);
  for (const b of buildings) {
    if (instances.length >= propGoal) break;
    const ringCount = presetId === 'high' ? 4 : 2;
    const rad = Math.max(28, b.size * 52);
    for (let i = 0; i < ringCount && instances.length < propGoal; i += 1) {
      const angle = rng() * Math.PI * 2;
      const dist = rad + 6 + rng() * 14;
      const x = b.x + Math.cos(angle) * dist;
      const y = b.y + Math.sin(angle) * dist;
      if (inExclusionRect(x, y, 4)) continue;
      if (isNearStroke(x, y, 4) || isNearWall(x, y, 4)) continue;
      const elev = Math.max(-0.4, elevationAt(x, y));
      pushInst(rng() < 0.55 ? 'barrel' : 'crate', x, y, elev, 0.24 + rng() * 0.12);
    }
  }

  return { format: 'atl3-d01-scatter-plan-v1', seed, presetId, maxBudget, instances };
}
