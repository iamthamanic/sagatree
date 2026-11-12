/**
 * atlas-selection — multi-select + layer lock helpers (ATL2-C03).
 * Location: src/domains/world/atlas/atlas-selection.ts
 *
 * Pure domain — no React. Geometry IDs only; not WorldNode ids.
 */
import { applyMapEdit } from './map-edit-ops';
import type {
  UnifiedCanvasDoc,
  UnifiedCanvasLayerId,
  UnifiedCanvasLayersVisible,
} from './unified-canvas-doc';

export type AtlasLayerLocks = Readonly<Partial<Record<UnifiedCanvasLayerId, boolean>>>;

export type AtlasFeatureKind =
  | 'object'
  | 'room'
  | 'wall'
  | 'door'
  | 'stroke';

export type AtlasFeatureRef = {
  readonly kind: AtlasFeatureKind;
  readonly id: string;
};

/** Layer that gates hit-test / edit for a feature kind. */
export function layerForFeatureKind(kind: AtlasFeatureKind): UnifiedCanvasLayerId {
  if (kind === 'object') return 'objects';
  if (kind === 'stroke') return 'drawings';
  return 'interior';
}

export function isLayerVisible(
  layers: UnifiedCanvasLayersVisible,
  layerId: UnifiedCanvasLayerId,
): boolean {
  return layers[layerId] !== false;
}

export function isLayerLocked(
  locks: AtlasLayerLocks | null | undefined,
  layerId: UnifiedCanvasLayerId,
): boolean {
  return locks?.[layerId] === true;
}

export function canHitFeature(
  layers: UnifiedCanvasLayersVisible,
  locks: AtlasLayerLocks | null | undefined,
  kind: AtlasFeatureKind,
  opts?: { readonly forEdit?: boolean },
): boolean {
  const layer = layerForFeatureKind(kind);
  if (!isLayerVisible(layers, layer)) return false;
  if (opts?.forEdit && isLayerLocked(locks, layer)) return false;
  return true;
}

export function toggleSelection(
  selected: readonly string[],
  id: string,
  additive: boolean,
): readonly string[] {
  if (!additive) return [id];
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  return [...selected, id];
}

export function featuresInRect(
  doc: UnifiedCanvasDoc,
  rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  layers: UnifiedCanvasLayersVisible,
): readonly AtlasFeatureRef[] {
  const x2 = rect.x + rect.w;
  const y2 = rect.y + rect.h;
  const out: AtlasFeatureRef[] = [];
  const inBox = (x: number, y: number) => x >= rect.x && x <= x2 && y >= rect.y && y <= y2;
  if (canHitFeature(layers, null, 'object')) {
    for (const o of doc.objects) {
      if (inBox(o.x, o.y)) out.push({ kind: 'object', id: o.id });
    }
  }
  if (canHitFeature(layers, null, 'room')) {
    for (const r of doc.rooms) {
      if (r.id === 'w.ocean') continue;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      if (inBox(cx, cy)) out.push({ kind: 'room', id: r.id });
    }
  }
  if (canHitFeature(layers, null, 'wall')) {
    for (const w of doc.walls) {
      if (inBox((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2)) out.push({ kind: 'wall', id: w.id });
    }
  }
  if (canHitFeature(layers, null, 'stroke')) {
    for (const s of doc.strokes) {
      const p = s.points[0];
      if (p && inBox(p[0], p[1])) out.push({ kind: 'stroke', id: s.id });
    }
  }
  return out;
}

/** Translate all selected geometry by (dx, dy). Skips locked layers via caller. */
export function translateSelected(
  doc: UnifiedCanvasDoc,
  ids: readonly string[],
  dx: number,
  dy: number,
): UnifiedCanvasDoc {
  if (!(Number.isFinite(dx) && Number.isFinite(dy)) || ids.length === 0) return doc;
  let next = doc;
  const idSet = new Set(ids);
  for (const o of doc.objects) {
    if (!idSet.has(o.id)) continue;
    next = applyMapEdit(next, { op: 'move_object', id: o.id, x: o.x + dx, y: o.y + dy });
  }
  for (const r of doc.rooms) {
    if (!idSet.has(r.id) || r.id === 'w.ocean') continue;
    next = applyMapEdit(next, { op: 'move_room', id: r.id, x: r.x + dx, y: r.y + dy });
  }
  for (const w of doc.walls) {
    if (!idSet.has(w.id)) continue;
    next = applyMapEdit(next, {
      op: 'move_wall',
      id: w.id,
      x1: w.x1 + dx,
      y1: w.y1 + dy,
      x2: w.x2 + dx,
      y2: w.y2 + dy,
    });
  }
  return next;
}

export function defaultLayerLocks(): AtlasLayerLocks {
  return {};
}

export function setLayerLock(
  locks: AtlasLayerLocks,
  layerId: UnifiedCanvasLayerId,
  locked: boolean,
): AtlasLayerLocks {
  return { ...locks, [layerId]: locked };
}
