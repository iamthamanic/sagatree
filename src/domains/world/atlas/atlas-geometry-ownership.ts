/**
 * atlas-geometry-ownership — SWS-02: Single Source of Truth per physical structure.
 * Location: src/domains/world/atlas/atlas-geometry-ownership.ts
 *
 * Pure domain — no React / Three.js / Host / Node built-ins.
 *
 * ADR-SWS-01 §4: each physical structure has exactly ONE authoritative level.
 * Coarser levels are DERIVED (bottom-up generalisation), never independently
 * authored — so the same river/coast/road is identical on every level.
 *
 * Two refinement directions (never mixed per structure):
 *  - bottom-up  : finest level is authoritative, coarser = derived (default for
 *                 physical geography: coast, river, terrain, political border).
 *  - top-down   : coarse level is authoritative, finer = procedural infill
 *                 (only where no coarse truth exists: dungeons, scatter).
 */
import {
  childLocalToParentPoint,
  type ParentSpatialAnchor,
} from './map-frame';
import {
  roomFromPolygon,
  type UnifiedCanvasMaterial,
  type UnifiedCanvasObject,
  type UnifiedCanvasRoom,
  type UnifiedCanvasStroke,
} from './unified-canvas-doc';
import { DEFAULT_ATLAS_BOUNDS, type WorldAtlasBounds } from './world-atlas.types';

/** Physische Struktur-Klassen mit genau einem autoritativen Owner. */
export type AtlasGeometryStructureKind =
  | 'landmass'        // Landmasse / Küste
  | 'political'       // politische Grenze
  | 'terrain'         // Höhenfeld
  | 'river'           // Fluss
  | 'road'            // Straße / Weg
  | 'forest'          // Wald
  | 'building'        // Gebäude-Footprint
  | 'room'            // Raum-Wände / Möbel
  | 'dungeon';        // prozedurale Dungeon-Geometrie

export type AtlasGeometryDirection = 'bottom-up' | 'top-down';

export type AtlasGeometryOwner = {
  readonly structure: AtlasGeometryStructureKind;
  readonly direction: AtlasGeometryDirection;
  /** ID der autoritativen Map (feinste Ebene bei bottom-up). */
  readonly authoritativeMapId: string;
  /**
   * Optionale stabile ID der konkreten physischen Struktur (z. B. `river.nordfluss`
   * oder `building.tavern`), damit mehrere getrennte Flüsse/Gebäude in einer
   * Multi-Ort-Welt jeweils genau eine autoritative Quelle behalten.
   */
  readonly structureId?: string;
  /** Optionale fachliche Notiz / Konflikt-Auflösung. */
  readonly note?: string;
};

/**
 * Verbindliche Richtung pro Struktur-Klasse (Single Source of Truth).
 * bottom-up = physische Geographie; top-down = prozeduraler Infill.
 */
export const ATLAS_GEOMETRY_STRUCTURE_DIRECTION: Readonly<
  Record<AtlasGeometryStructureKind, AtlasGeometryDirection>
> = {
  landmass: 'bottom-up',
  political: 'bottom-up',
  terrain: 'bottom-up',
  river: 'bottom-up',
  road: 'bottom-up',
  forest: 'bottom-up',
  building: 'bottom-up',
  room: 'bottom-up',
  // Dungeon ist prozeduraler Infill: die grobe Ebene kennt nur den Eingang.
  dungeon: 'top-down',
};

/** Material → Struktur-Heuristik (nur Default; explizite Hints schlagen Heuristik). */
export function inferStructureFromMaterial(
  material: UnifiedCanvasMaterial,
): AtlasGeometryStructureKind | null {
  switch (material) {
    case 'wasser':
      return null; // Ozean vs. Fluss nicht aus Material allein ableitbar (Heuristik-Stopp).
    case 'pflaster':
      return 'road';
    case 'gras':
    case 'erde':
    case 'sand':
      return 'landmass';
    case 'stein':
      return null; // Stein kann Gebäude, Berg oder Straße sein.
    case 'holz':
      return 'building';
    default:
      return null;
  }
}

export type AtlasGeometryConflictKind =
  | 'multiple-owners'
  | 'direction-mismatch'
  | 'unlocated-owner';

export type AtlasGeometryConflict = {
  readonly structure: AtlasGeometryStructureKind;
  readonly structureId?: string;
  readonly kind: AtlasGeometryConflictKind;
  readonly mapIds: readonly string[];
  readonly reasonDe: string;
};

export const GEOMETRY_OWNERSHIP_CONFLICT_DE =
  'Geometrie-Konflikt: mehrere autoritative Quellen für dieselbe Struktur.';
export const GEOMETRY_OWNERSHIP_UNLOCATED_DE =
  'Struktur ohne verortete autoritative Karte — keine Ableitung möglich.';
export const GEOMETRY_OWNERSHIP_DIRECTION_MISMATCH_DE =
  'Richtungs-Konflikt: Struktur nutzt nicht die verbindliche Ableitungsrichtung.';

/**
 * Validate ownership assignments fail-closed:
 *  - Every owner must reference a non-empty `authoritativeMapId`.
 *  - Every owner's `direction` must match `ATLAS_GEOMETRY_STRUCTURE_DIRECTION[structure]`.
 *  - No bottom-up structure (or named `structureId`) may have >1 distinct authoritative map.
 * Returns the list of conflicts (empty = consistent).
 */
export function findGeometryOwnershipConflicts(
  owners: readonly AtlasGeometryOwner[],
): readonly AtlasGeometryConflict[] {
  const conflicts: AtlasGeometryConflict[] = [];
  const byScope = new Map<
    string,
    {
      readonly structure: AtlasGeometryStructureKind;
      readonly structureId?: string;
      readonly mapIds: Set<string>;
    }
  >();

  for (const o of owners) {
    const mapId = o.authoritativeMapId.trim();
    if (!mapId) {
      conflicts.push({
        structure: o.structure,
        ...(o.structureId ? { structureId: o.structureId } : {}),
        kind: 'unlocated-owner',
        mapIds: [],
        reasonDe: GEOMETRY_OWNERSHIP_UNLOCATED_DE,
      });
      continue;
    }

    const expectedDir = ATLAS_GEOMETRY_STRUCTURE_DIRECTION[o.structure];
    if (o.direction !== expectedDir) {
      conflicts.push({
        structure: o.structure,
        ...(o.structureId ? { structureId: o.structureId } : {}),
        kind: 'direction-mismatch',
        mapIds: [mapId],
        reasonDe: GEOMETRY_OWNERSHIP_DIRECTION_MISMATCH_DE,
      });
      continue;
    }

    // Named physical structures must always have a single owner; unnamed top-down
    // procedural infills (e.g. separate dungeons) may live on multiple maps.
    if (expectedDir === 'top-down' && !o.structureId) {
      continue;
    }

    const scopeKey = o.structureId ? `${o.structure}:${o.structureId}` : o.structure;
    let bucket = byScope.get(scopeKey);
    if (!bucket) {
      bucket = {
        structure: o.structure,
        ...(o.structureId ? { structureId: o.structureId } : {}),
        mapIds: new Set<string>(),
      };
      byScope.set(scopeKey, bucket);
    }
    bucket.mapIds.add(mapId);
  }

  for (const bucket of byScope.values()) {
    if (bucket.mapIds.size > 1) {
      conflicts.push({
        structure: bucket.structure,
        ...(bucket.structureId ? { structureId: bucket.structureId } : {}),
        kind: 'multiple-owners',
        mapIds: [...bucket.mapIds],
        reasonDe: GEOMETRY_OWNERSHIP_CONFLICT_DE,
      });
    }
  }

  return conflicts;
}

/**
 * Content fingerprint for an ownership assignment — used to invalidate the
 * derived-coarse cache when the authoritative fine level changes (ADR §4.4).
 */
export function geometryOwnershipFingerprint(owners: readonly AtlasGeometryOwner[]): string {
  const parts = owners
    .map(
      (o) =>
        `${o.structure}:${o.structureId ?? '*'}:${o.direction}:${o.authoritativeMapId.trim()}`,
    )
    .sort();
  return parts.join('|');
}

// ─── Bottom-Up Derivation Primitives (ADR-SWS-01 §4.3) ───────────────────────

export type AtlasDerivedGeometryRef = {
  readonly derivedFeatureId: string;
  readonly sourceMapId: string;
  readonly sourceFeatureId: string;
  readonly structure: AtlasGeometryStructureKind;
  readonly fingerprint: string;
};

/** Deterministic FNV-1a 32-bit hex digest (pure JS, no Node crypto). */
export function computeGeometryDerivedFingerprint(
  sourceMapId: string,
  payload: unknown,
): string {
  const input = `${sourceMapId}|${canonicalSerialize(payload)}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function canonicalSerialize(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '0';
    // Stabilize floating-point noise at 1e-6 precision.
    return String(Math.round(value * 1e6) / 1e6);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalSerialize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    return `{${Object.keys(rec)
      .filter((k) => rec[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalSerialize(rec[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Calibrated child `metersPerUnit` derived from parent `metersPerUnit` and anchor.
 * Returns null if parent is uncalibrated or anchor has non-positive extent.
 */
export function deriveCalibratedChildMetersPerUnit(
  parentMetersPerUnit: number | null,
  anchor: Pick<ParentSpatialAnchor, 'extentX' | 'extentY'>,
  childBounds: WorldAtlasBounds = DEFAULT_ATLAS_BOUNDS,
): number | null {
  if (
    parentMetersPerUnit == null ||
    !Number.isFinite(parentMetersPerUnit) ||
    parentMetersPerUnit <= 0
  ) {
    return null;
  }
  const childW = childBounds.maxX - childBounds.minX;
  if (!Number.isFinite(childW) || childW <= 0 || anchor.extentX <= 0) return null;
  const derived = ((2 * anchor.extentX) / childW) * parentMetersPerUnit;
  return Number.isFinite(derived) && derived > 0 ? derived : null;
}

/** Project a list of child `[x, y]` tuples into parent local coordinates. */
export function projectChildPointsToParent(
  anchor: ParentSpatialAnchor,
  points: readonly (readonly [number, number])[],
  childBounds: WorldAtlasBounds = DEFAULT_ATLAS_BOUNDS,
): readonly (readonly [number, number])[] {
  return points.map(([x, y]) => {
    const p = childLocalToParentPoint(anchor, { x, y }, childBounds);
    return [roundCoord(p.x), roundCoord(p.y)] as const;
  });
}

function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function pointSegmentDistance(
  p: readonly [number, number],
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-12) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Deterministic Ramer-Douglas-Peucker simplification for coarse derivation of
 * rivers, roads, and coastlines (bottom-up generalisation).
 */
export function simplifyPolylineRdp(
  points: readonly (readonly [number, number])[],
  epsilon: number,
): readonly (readonly [number, number])[] {
  if (points.length <= 2 || !Number.isFinite(epsilon) || epsilon <= 0) {
    return points.slice();
  }
  let maxDist = -1;
  let index = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = pointSegmentDistance(points[i]!, first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = simplifyPolylineRdp(points.slice(0, index + 1), epsilon);
    const right = simplifyPolylineRdp(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

/**
 * Derive a coarse parent `UnifiedCanvasRoom` (landmass/building/plaza footprint)
 * directly from an authoritative child room via its `ParentSpatialAnchor`.
 */
export function deriveCoarseRoomFromChild(
  anchor: ParentSpatialAnchor,
  room: UnifiedCanvasRoom,
  derivedId: string,
  options?: {
    readonly childBounds?: WorldAtlasBounds;
    readonly simplifyEpsilon?: number;
  },
): UnifiedCanvasRoom | null {
  const bounds = options?.childBounds ?? DEFAULT_ATLAS_BOUNDS;
  const sourcePts: readonly (readonly [number, number])[] =
    room.points && room.points.length >= 3
      ? room.points
      : [
          [room.x, room.y],
          [room.x + room.w, room.y],
          [room.x + room.w, room.y + room.h],
          [room.x, room.y + room.h],
        ];
  let projected = projectChildPointsToParent(anchor, sourcePts, bounds);
  if (options?.simplifyEpsilon && options.simplifyEpsilon > 0 && projected.length > 4) {
    const simplified = simplifyPolylineRdp(projected, options.simplifyEpsilon);
    if (simplified.length >= 3) projected = simplified;
  }
  const built = roomFromPolygon(derivedId, room.material, projected);
  if (!built) return null;
  return room.secret ? { ...built, secret: true } : built;
}

/**
 * Derive a coarse parent `UnifiedCanvasStroke` (river/road) from an authoritative
 * child stroke. Preserves exact projected coordinates in parent space.
 */
export function deriveCoarseStrokeFromChild(
  anchor: ParentSpatialAnchor,
  stroke: UnifiedCanvasStroke,
  derivedId: string,
  options?: {
    readonly childBounds?: WorldAtlasBounds;
    readonly simplifyEpsilon?: number;
    readonly minWidth?: number;
    readonly maxWidth?: number;
  },
): UnifiedCanvasStroke | null {
  if (stroke.points.length < 2) return null;
  const bounds = options?.childBounds ?? DEFAULT_ATLAS_BOUNDS;
  let projected = projectChildPointsToParent(anchor, stroke.points, bounds);
  if (options?.simplifyEpsilon && options.simplifyEpsilon > 0 && projected.length > 2) {
    projected = simplifyPolylineRdp(projected, options.simplifyEpsilon);
  }
  if (projected.length < 2) return null;
  const childW = Math.max(1, bounds.maxX - bounds.minX);
  const scale = (2 * anchor.extentX) / childW;
  const minW = options?.minWidth ?? 2;
  const maxW = options?.maxWidth ?? 14;
  const width = roundCoord(Math.max(minW, Math.min(maxW, stroke.width * scale)));
  return {
    id: derivedId,
    material: stroke.material,
    width,
    points: projected,
  };
}

/**
 * Derive a coarse parent `UnifiedCanvasObject` (settlement/landmark/forest stamp)
 * from an authoritative child object via its `ParentSpatialAnchor`.
 */
export function deriveCoarseObjectFromChild(
  anchor: ParentSpatialAnchor,
  obj: UnifiedCanvasObject,
  derivedId: string,
  options?: {
    readonly childBounds?: WorldAtlasBounds;
    readonly minSize?: number;
    readonly maxSize?: number;
  },
): UnifiedCanvasObject {
  const bounds = options?.childBounds ?? DEFAULT_ATLAS_BOUNDS;
  const p = childLocalToParentPoint(anchor, { x: obj.x, y: obj.y }, bounds);
  const childW = Math.max(1, bounds.maxX - bounds.minX);
  const scale = (2 * anchor.extentX) / childW;
  const minS = options?.minSize ?? 0.25;
  const maxS = options?.maxSize ?? 0.75;
  const size = roundCoord(Math.max(minS, Math.min(maxS, obj.size * Math.sqrt(Math.max(scale, 0.01)))));
  return {
    id: derivedId,
    type: obj.type,
    x: roundCoord(p.x),
    y: roundCoord(p.y),
    size,
    ...(obj.angle !== undefined ? { angle: roundCoord(obj.angle + anchor.rotationRad) } : {}),
    ...(obj.secret ? { secret: true } : {}),
  };
}
