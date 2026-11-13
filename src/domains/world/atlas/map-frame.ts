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

/**
 * Normalize optional physical calibration. Negative / non-finite → null (uncalibrated).
 * Never invent meters; UI must stay abstract until a positive value is set.
 */
export function normalizeMetersPerUnit(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
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
  const metersPerUnit = normalizeMetersPerUnit(o.metersPerUnit);
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

type AtlasPoint = { readonly x: number; readonly y: number };

/**
 * Map a point from child local bounds into parent map space using the anchor.
 * Invertible with {@link mapPointParentToChild} for the same bounds + anchor.
 */
export function mapPointChildToParent(
  point: AtlasPoint,
  anchor: ParentSpatialAnchor,
  childBounds: WorldAtlasBounds = independentPrimaryBounds(),
): AtlasPoint {
  const width = childBounds.maxX - childBounds.minX;
  const height = childBounds.maxY - childBounds.minY;
  const midX = (childBounds.minX + childBounds.maxX) / 2;
  const midY = (childBounds.minY + childBounds.maxY) / 2;
  const nx = width === 0 ? 0 : (2 * (point.x - midX)) / width;
  const ny = height === 0 ? 0 : (2 * (point.y - midY)) / height;
  const lx = nx * anchor.extentX;
  const ly = ny * anchor.extentY;
  const cos = Math.cos(anchor.rotationRad);
  const sin = Math.sin(anchor.rotationRad);
  return {
    x: anchor.centerX + lx * cos - ly * sin,
    y: anchor.centerY + lx * sin + ly * cos,
  };
}

/**
 * Inverse of {@link mapPointChildToParent} — parent space → child local bounds.
 */
export function mapPointParentToChild(
  point: AtlasPoint,
  anchor: ParentSpatialAnchor,
  childBounds: WorldAtlasBounds = independentPrimaryBounds(),
): AtlasPoint {
  const dx = point.x - anchor.centerX;
  const dy = point.y - anchor.centerY;
  const cos = Math.cos(anchor.rotationRad);
  const sin = Math.sin(anchor.rotationRad);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  const nx = anchor.extentX === 0 ? 0 : lx / anchor.extentX;
  const ny = anchor.extentY === 0 ? 0 : ly / anchor.extentY;
  const width = childBounds.maxX - childBounds.minX;
  const height = childBounds.maxY - childBounds.minY;
  const midX = (childBounds.minX + childBounds.maxX) / 2;
  const midY = (childBounds.minY + childBounds.maxY) / 2;
  return {
    x: midX + (nx * width) / 2,
    y: midY + (ny * height) / 2,
  };
}

/** Round-trip probe for locate transforms (domain acceptance for ATL2-E02). */
export function assertInvertibleParentChildMap(
  anchor: ParentSpatialAnchor,
  sample: AtlasPoint,
  childBounds: WorldAtlasBounds = independentPrimaryBounds(),
  epsilon = 1e-9,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  const parent = mapPointChildToParent(sample, anchor, childBounds);
  const back = mapPointParentToChild(parent, anchor, childBounds);
  if (
    !Number.isFinite(parent.x) ||
    !Number.isFinite(parent.y) ||
    !Number.isFinite(back.x) ||
    !Number.isFinite(back.y)
  ) {
    return { ok: false, reason: 'Transform nicht endlich' };
  }
  if (Math.abs(back.x - sample.x) > epsilon || Math.abs(back.y - sample.y) > epsilon) {
    return { ok: false, reason: 'Transform nicht invertierbar' };
  }
  return { ok: true };
}
