/**
 * map-frame — Independent primary-map frames + parent spatial anchors (#722).
 * Location: src/domains/world/atlas/map-frame.ts
 *
 * Child maps never inherit parent bounds by default. LOD drill requires a
 * grounded parent-space anchor. Abstract 0…1000 is not meters until calibrated.
 */
import { DEFAULT_ATLAS_BOUNDS, type WorldAtlasBounds } from './world-atlas.types';

export const MAP_FRAME_META_KEY = 'mapFrame' as const;
export const MAP_STATUS_META_KEY = 'mapStatus' as const;

export type MapSketchStatus = 'unlocated' | 'unsketched' | 'ready';

/** Authoritative feature owners — one source per geometry class. */
export type AtlasFeatureOwner = 'political' | 'terrain' | 'room_geometry';

export const ATLAS_FEATURE_OWNERS: Readonly<Record<AtlasFeatureOwner, string>> = {
  political: 'Political borders / realms (vector overlay; not landmass)',
  terrain: 'Coast / elevation / biomes (terrain layer)',
  room_geometry: 'Shared room walls authored once on the room primary map',
};

/**
 * Parent-space placement of a child map's local frame.
 * Coordinates are in the parent map's local units (abstract until calibrated).
 */
export type ParentSpatialAnchor = {
  readonly parentMapId: string;
  readonly centerX: number;
  readonly centerY: number;
  /** Extent of the child footprint in parent space (half-width / half-height). */
  readonly extentX: number;
  readonly extentY: number;
  /** Rotation radians in parent plane; default 0. */
  readonly rotationRad: number;
  /**
   * When set, world units ↔ meters. Until then UI must not claim m/km.
   * Null = uncalibrated abstract frame.
   */
  readonly metersPerUnit: number | null;
};

export type MapFrameMeta = {
  readonly status: MapSketchStatus;
  readonly parentAnchor: ParentSpatialAnchor | null;
  readonly featureOwnerHints?: Readonly<Partial<Record<AtlasFeatureOwner, string>>>;
};

export function independentPrimaryBounds(): WorldAtlasBounds {
  return { ...DEFAULT_ATLAS_BOUNDS };
}

export function isFinitePositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export function parseParentSpatialAnchor(raw: unknown): ParentSpatialAnchor | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.parentMapId !== 'string' || !o.parentMapId.trim()) return null;
  const centerX = Number(o.centerX);
  const centerY = Number(o.centerY);
  const extentX = Number(o.extentX);
  const extentY = Number(o.extentY);
  const rotationRad = o.rotationRad == null ? 0 : Number(o.rotationRad);
  if (![centerX, centerY, extentX, extentY, rotationRad].every(Number.isFinite)) return null;
  if (extentX <= 0 || extentY <= 0) return null;
  const mpu = o.metersPerUnit;
  const metersPerUnit =
    mpu == null ? null : typeof mpu === 'number' && Number.isFinite(mpu) && mpu > 0 ? mpu : null;
  return {
    parentMapId: o.parentMapId.trim(),
    centerX,
    centerY,
    extentX,
    extentY,
    rotationRad,
    metersPerUnit,
  };
}

export function parseMapSketchStatus(raw: unknown): MapSketchStatus {
  if (raw === 'ready' || raw === 'unsketched' || raw === 'unlocated') return raw;
  return 'unlocated';
}

export function extractMapFrameFromGeneratorMeta(
  meta: Readonly<Record<string, unknown>> | null | undefined,
): MapFrameMeta {
  const rawStatus = meta?.[MAP_STATUS_META_KEY] ?? meta?.mapStatus;
  let status: MapSketchStatus;
  if (rawStatus === 'ready' || rawStatus === 'unsketched' || rawStatus === 'unlocated') {
    status = rawStatus;
  } else {
    // Missing status: world / Golden roots are playable; child sketches stay unlocated (#722).
    const seed = typeof meta?.seed === 'string' ? meta.seed : '';
    const scale = typeof meta?.scale === 'string' ? meta.scale : '';
    const golden = meta?.golden === true;
    status =
      golden || scale === 'world' || seed.startsWith('dornhain.unified') ? 'ready' : 'unlocated';
  }
  const frameRaw = meta?.[MAP_FRAME_META_KEY];
  const parentAnchor =
    frameRaw && typeof frameRaw === 'object'
      ? parseParentSpatialAnchor((frameRaw as Record<string, unknown>).parentAnchor)
      : parseParentSpatialAnchor(meta?.parentAnchor);
  return { status, parentAnchor };
}

export function mergeMapFrameIntoGeneratorMeta(
  meta: Readonly<Record<string, unknown>> | null | undefined,
  frame: MapFrameMeta,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(meta ?? {}) };
  base[MAP_STATUS_META_KEY] = frame.status;
  base[MAP_FRAME_META_KEY] = {
    parentAnchor: frame.parentAnchor,
  };
  return base;
}

/** Child primary map seed meta — independent frame, not located on parent yet. */
export function unlocatedChildMapGeneratorMeta(
  extra?: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return mergeMapFrameIntoGeneratorMeta(
    {
      engine: 'unified_canvas',
      ...(extra ?? {}),
    },
    { status: 'unlocated', parentAnchor: null },
  );
}

/**
 * LOD may enter a child map only when a grounded parent-space anchor exists.
 * Camera zoom alone must never invent geography.
 */
export function canLodEnterChildMap(frame: MapFrameMeta): boolean {
  if (frame.status === 'unlocated') return false;
  const a = frame.parentAnchor;
  if (!a) return false;
  return a.extentX > 0 && a.extentY > 0 && Number.isFinite(a.centerX) && Number.isFinite(a.centerY);
}

/**
 * Validate a parent spatial transform before mutation (#752).
 * Zero/NaN extents and missing parentMapId fail closed.
 */
export function assertParentSpatialAnchor(
  raw: unknown,
): { readonly ok: true; readonly anchor: ParentSpatialAnchor } | { readonly ok: false; readonly reason: string } {
  const anchor = parseParentSpatialAnchor(raw);
  if (!anchor) {
    return { ok: false, reason: 'Ungültiger oder unvollständiger Raumanker' };
  }
  if (anchor.extentX <= 0 || anchor.extentY <= 0) {
    return { ok: false, reason: 'Anker-Ausdehnung muss positiv sein' };
  }
  return { ok: true, anchor };
}

/**
 * Product WebGL drill: world root always allowed; child requires grounded link
 * and must not invent LOD into unlocated maps.
 */
export function canWebglDrillSelect(input: {
  readonly worldRoot: boolean;
  readonly located: boolean;
  readonly mapId: string | null;
}): boolean {
  if (input.worldRoot) return true;
  if (!input.mapId) return false;
  return input.located === true;
}

/** True when place-map link has a numeric anchor usable for drill. */
export function isGroundedLinkAnchor(anchor: Readonly<Record<string, unknown>> | null | undefined): boolean {
  if (!anchor) return false;
  const x = Number(anchor.x);
  const y = Number(anchor.y);
  return Number.isFinite(x) && Number.isFinite(y);
}

/** UI zoom caption — never claim m/km until metersPerUnit is set. */
export function atlasZoomCaption(percent: number, metersPerUnit: number | null): string {
  const p = Math.round(percent);
  if (metersPerUnit != null && metersPerUnit > 0) {
    return `${p}% · kalibriert`;
  }
  return `${p}%`;
}

export const UNLOCATED_MAP_HINT_DE = 'Ausschnitt noch nicht festgelegt';

/** Longer product chrome copy — never implies scale-true drill while unlocated. */
export const UNLOCATED_DRILL_BLOCKED_DE =
  'Ausschnitt noch nicht festgelegt — Verorte den Ausschnitt auf der Elternkarte, bevor Zoom dorthin wechselt.';

export const LOCATE_INVALID_RECT_DE =
  'Ausschnitt ungültig — ziehe ein Rechteck mit positiver Breite und Höhe.';

/**
 * Build a parent-space anchor from an axis-aligned rectangle on the parent map
 * (drag-to-locate). Extent is half-width / half-height in parent units.
 */
export function parentAnchorFromParentRect(input: {
  readonly parentMapId: string;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly rotationRad?: number;
  readonly metersPerUnit?: number | null;
}):
  | { readonly ok: true; readonly anchor: ParentSpatialAnchor }
  | { readonly ok: false; readonly reason: string } {
  const parentMapId = input.parentMapId.trim();
  if (!parentMapId) {
    return { ok: false, reason: 'Elternkarte fehlt' };
  }
  const minX = Number(input.minX);
  const minY = Number(input.minY);
  const maxX = Number(input.maxX);
  const maxY = Number(input.maxY);
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    return { ok: false, reason: LOCATE_INVALID_RECT_DE };
  }
  const width = Math.abs(maxX - minX);
  const height = Math.abs(maxY - minY);
  if (width <= 0 || height <= 0) {
    return { ok: false, reason: LOCATE_INVALID_RECT_DE };
  }
  if (input.metersPerUnit !== undefined && input.metersPerUnit !== null) {
    const probe = calibrateParentSpatialMeters(
      {
        parentMapId,
        centerX: 0,
        centerY: 0,
        extentX: 1,
        extentY: 1,
        rotationRad: 0,
        metersPerUnit: null,
      },
      input.metersPerUnit,
    );
    if (probe.ok === false) return { ok: false, reason: probe.reason };
  }
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return assertParentSpatialAnchor({
    parentMapId,
    centerX,
    centerY,
    extentX: width / 2,
    extentY: height / 2,
    rotationRad: input.rotationRad ?? 0,
    metersPerUnit: input.metersPerUnit ?? null,
  });
}

/**
 * Child map becomes LOD-enterable after a valid parent rect.
 * Empty child canvas → `unsketched` (honest until content exists).
 */
export function locateChildMapFrame(input: {
  readonly parentMapId: string;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly rotationRad?: number;
  readonly metersPerUnit?: number | null;
}):
  | { readonly ok: true; readonly frame: MapFrameMeta; readonly anchor: ParentSpatialAnchor }
  | { readonly ok: false; readonly reason: string } {
  const built = parentAnchorFromParentRect(input);
  if (built.ok === false) {
    return { ok: false, reason: built.reason };
  }
  return {
    ok: true,
    anchor: built.anchor,
    frame: { status: 'unsketched', parentAnchor: built.anchor },
  };
}

/** Smallest positive extent accepted by parse/assert (parent units). */
export const MIN_PARENT_ANCHOR_EXTENT = Number.EPSILON;

export const CALIBRATION_INVALID_DE =
  'Kalibrierung ungültig — metersPerUnit muss positiv sein oder null (unkalibriert).';

/**
 * Set or clear metersPerUnit on an existing anchor. Negative / zero / NaN fail closed.
 * Does not invent geography — only stores an optional scale factor.
 */
export function calibrateParentSpatialMeters(
  anchor: ParentSpatialAnchor,
  metersPerUnit: number | null,
):
  | { readonly ok: true; readonly anchor: ParentSpatialAnchor }
  | { readonly ok: false; readonly reason: string } {
  if (metersPerUnit == null) {
    return { ok: true, anchor: { ...anchor, metersPerUnit: null } };
  }
  if (typeof metersPerUnit !== 'number' || !Number.isFinite(metersPerUnit) || metersPerUnit <= 0) {
    return { ok: false, reason: CALIBRATION_INVALID_DE };
  }
  return { ok: true, anchor: { ...anchor, metersPerUnit } };
}

type Point2 = { readonly x: number; readonly y: number };

function childBoundsHalfExtents(bounds: WorldAtlasBounds): {
  readonly midX: number;
  readonly midY: number;
  readonly halfW: number;
  readonly halfH: number;
} {
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const halfW = (bounds.maxX - bounds.minX) / 2;
  const halfH = (bounds.maxY - bounds.minY) / 2;
  return { midX, midY, halfW, halfH };
}

/**
 * Map a point in child-local map space → parent map space using the spatial anchor.
 * Child bounds default to the independent primary frame (0…1000).
 */
export function childLocalToParentPoint(
  anchor: ParentSpatialAnchor,
  local: Point2,
  childBounds: WorldAtlasBounds = DEFAULT_ATLAS_BOUNDS,
): Point2 {
  const { midX, midY, halfW, halfH } = childBoundsHalfExtents(childBounds);
  const nx = halfW > 0 ? (local.x - midX) / halfW : 0;
  const ny = halfH > 0 ? (local.y - midY) / halfH : 0;
  const cos = Math.cos(anchor.rotationRad);
  const sin = Math.sin(anchor.rotationRad);
  const dx = nx * anchor.extentX;
  const dy = ny * anchor.extentY;
  return {
    x: anchor.centerX + dx * cos - dy * sin,
    y: anchor.centerY + dx * sin + dy * cos,
  };
}

/**
 * Inverse of `childLocalToParentPoint` — required for World→Child navigation / locate parity.
 */
export function parentPointToChildLocal(
  anchor: ParentSpatialAnchor,
  parent: Point2,
  childBounds: WorldAtlasBounds = DEFAULT_ATLAS_BOUNDS,
): Point2 {
  const { midX, midY, halfW, halfH } = childBoundsHalfExtents(childBounds);
  const cos = Math.cos(anchor.rotationRad);
  const sin = Math.sin(anchor.rotationRad);
  const rx = parent.x - anchor.centerX;
  const ry = parent.y - anchor.centerY;
  const dx = rx * cos + ry * sin;
  const dy = -rx * sin + ry * cos;
  const nx = anchor.extentX > 0 ? dx / anchor.extentX : 0;
  const ny = anchor.extentY > 0 ? dy / anchor.extentY : 0;
  return {
    x: midX + nx * halfW,
    y: midY + ny * halfH,
  };
}

/**
 * Axis-aligned footprint AABB of an anchor in parent space.
 * Includes rotation: OBB half-extents project via |eX·cos|+|eY·sin| / |eX·sin|+|eY·cos|.
 */
export function parentAnchorAabb(anchor: ParentSpatialAnchor): {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
} {
  const cos = Math.cos(anchor.rotationRad);
  const sin = Math.sin(anchor.rotationRad);
  const halfW = Math.abs(anchor.extentX * cos) + Math.abs(anchor.extentY * sin);
  const halfH = Math.abs(anchor.extentX * sin) + Math.abs(anchor.extentY * cos);
  return {
    minX: anchor.centerX - halfW,
    minY: anchor.centerY - halfH,
    maxX: anchor.centerX + halfW,
    maxY: anchor.centerY + halfH,
  };
}

/** True when two parent-space anchor AABBs overlap (inclusive edges). */
export function parentAnchorsOverlapAabb(a: ParentSpatialAnchor, b: ParentSpatialAnchor): boolean {
  const aa = parentAnchorAabb(a);
  const bb = parentAnchorAabb(b);
  return !(aa.maxX < bb.minX || bb.maxX < aa.minX || aa.maxY < bb.minY || bb.maxY < aa.minY);
}

/**
 * Honest UI gate: unlocated / missing anchor must never claim scale-true drill.
 */
export function unlocatedBlocksScaleTrueDrill(frame: MapFrameMeta): boolean {
  return frame.status === 'unlocated' || !canLodEnterChildMap(frame);
}
