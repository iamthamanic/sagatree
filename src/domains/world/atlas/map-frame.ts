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
  const status = parseMapSketchStatus(meta?.[MAP_STATUS_META_KEY] ?? meta?.mapStatus);
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
