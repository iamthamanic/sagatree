/**
 * atlas-spatial-containment — SCM-01: Spatial Containment Model, Relations & Invariants (INV-1..6).
 * Location: src/domains/world/atlas/atlas-spatial-containment.ts
 *
 * Pure domain — NO React, NO Three.js, NO Host SDK, NO window/localStorage (BR-005).
 *
 * Formalizes `.qa/design/sws-containment-model.md` and `.qa/design/world-model-terminology.md`:
 *  - Three spatial relation types: CONTAINED | CARVED | freeland (deprecated alias: FLOWING)
 *  - Six domain-enforced invariants: INV-1..INV-6
 *  - Fail-closed validation (cycles, shear, missing topography root, uncontained children,
 *    inverted topography dependencies, non-finite geometry)
 *  - Complements SWS-01 (`atlas-world-space.ts`) and SWS-02 (`atlas-geometry-ownership.ts`).
 */
import {
  anchorHasShear,
  isAtlasWorldError,
  resolveWorldChain,
  type AtlasWorldSpaceNode,
} from './atlas-world-space';

/** Canonical routing/exterior relation identifier (`.qa/design/world-model-terminology.md`). */
export const SPATIAL_RELATION_FREELAND = 'freeland' as const;

/**
 * @deprecated Use {@link SPATIAL_RELATION_FREELAND} (`'freeland'`).
 */
export const SPATIAL_RELATION_FLOWING = 'FLOWING' as const;

/**
 * The three spatial relation types governing growth & removal behavior (SCM §2).
 * `'FLOWING'` is a deprecated alias for `'freeland'` retained for backwards compatibility.
 */
export type SpatialRelationKind =
  | 'CONTAINED'
  | 'CARVED'
  | 'freeland'
  | /** @deprecated Use `'freeland'` */ 'FLOWING';

/** True for canonical `'freeland'` as well as its deprecated `'FLOWING'` alias. */
export function isFreelandRelation(relation: SpatialRelationKind): boolean {
  return relation === 'freeland' || relation === 'FLOWING';
}

/** Semantic structure role in the unified world containment graph. */
export type SpatialStructureRole =
  | 'world'
  | 'continent'
  | 'country'
  | 'landmass'
  | 'political'
  | 'settlement'
  | 'forest'
  | 'building'
  | 'room'
  | 'mountain'
  | 'dungeon'
  | 'tunnel'
  | 'river'
  | 'road'
  | 'coast'
  | 'prop';

export type SpatialPoint2D = readonly [number, number];

export type SpatialBounds2D = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

export type SpatialEntityStatus = 'active' | 'archived';

/** One physical or geopolitical structure inside the single unified World Space. */
export type SpatialEntityNode = {
  readonly id: string;
  readonly mapId: string;
  readonly featureId: string;
  readonly labelDe: string;
  readonly role: SpatialStructureRole;
  /** Optional explicit relation override; inferred via `resolveRelation` when omitted. */
  readonly relation?: SpatialRelationKind;
  /** Carrier entity in the containment graph; null ONLY for `rootTopographyId`. */
  readonly carrierId: string | null;
  readonly boundsWorld: SpatialBounds2D;
  readonly polygonWorld?: readonly SpatialPoint2D[];
  /** Polyline for freeland entities (river / road / coast). */
  readonly polylineWorld?: readonly SpatialPoint2D[];
  /** Routed/clipped segments for freeland entities after topography edits. */
  readonly clippedSegmentsWorld?: readonly (readonly SpatialPoint2D[])[];
  /** Hollowed interior cavity bounds for CARVED structures inside a solid mass. */
  readonly cavityBoundsWorld?: SpatialBounds2D;
  readonly status: SpatialEntityStatus;
  /** Set during soft-cascade removal so archived children remain recoverable (SCM §5). */
  readonly archivedByEntityId?: string | null;
  readonly archivedReasonDe?: string | null;
};

/**
 * Single authoritative geometric-topological world model (INV-1 / INV-5).
 * Serializable plain record so atomic transaction snapshots & undo are pure data.
 */
export type SpatialWorldModel = {
  readonly rootTopographyId: string;
  readonly entities: Readonly<Record<string, SpatialEntityNode>>;
  /** Optional linked SWS-01 map anchor graph verified jointly for cycle/shear safety. */
  readonly mapNodes?: Readonly<Record<string, AtlasWorldSpaceNode>>;
};

export type SpatialInvariantId = 'INV-1' | 'INV-2' | 'INV-3' | 'INV-4' | 'INV-5' | 'INV-6';

export type SpatialInvariantViolationCode =
  | 'missing-root-topography'
  | 'multiple-roots'
  | 'invalid-root-role'
  | 'carrier-cycle'
  | 'missing-carrier'
  | 'map-anchor-cycle'
  | 'map-anchor-shear'
  | 'map-anchor-invalid'
  | 'containment-overflow'
  | 'carved-breach'
  | 'active-child-in-archived-carrier'
  | 'topography-dependency-inverted'
  | 'invalid-geometry'
  | 'empty-flowing-path';

export type SpatialInvariantViolation = {
  readonly invariant: SpatialInvariantId;
  readonly code: SpatialInvariantViolationCode;
  readonly entityId: string;
  readonly carrierId?: string | null;
  readonly reasonDe: string;
};

export type SpatialInvariantValidationResult =
  | { readonly ok: true; readonly violations: readonly [] }
  | { readonly ok: false; readonly violations: readonly SpatialInvariantViolation[] };

export type SpatialContainmentCheckResult = {
  readonly fits: boolean;
  readonly entityId: string;
  readonly relation: SpatialRelationKind;
  readonly carrierId: string | null;
  readonly violations: readonly SpatialInvariantViolation[];
  readonly overflow: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  };
};

export const SPATIAL_EPSILON = 1e-6 as const;

const ROOT_TOPOGRAPHY_ROLES: ReadonlySet<SpatialStructureRole> = new Set([
  'world',
  'landmass',
  'continent',
]);

const TOPOGRAPHY_ROLES: ReadonlySet<SpatialStructureRole> = new Set([
  'world',
  'continent',
  'landmass',
  'mountain',
]);

const SOLID_MASS_ROLES: ReadonlySet<SpatialStructureRole> = new Set([
  'mountain',
  'dungeon',
  'tunnel',
]);

const FREELAND_ROLES: ReadonlySet<SpatialStructureRole> = new Set([
  'river',
  'road',
  'coast',
]);

const NON_TOPOGRAPHY_CARRIER_FORBIDDEN_FOR_TOPOGRAPHY: ReadonlySet<SpatialStructureRole> = new Set([
  'river',
  'road',
  'coast',
  'building',
  'room',
  'prop',
]);

// ─── Pure 2D Geometry Helpers ────────────────────────────────────────────────

export function isFiniteSpatialBounds(b: SpatialBounds2D | null | undefined): b is SpatialBounds2D {
  if (!b) return false;
  return (
    Number.isFinite(b.minX) &&
    Number.isFinite(b.minY) &&
    Number.isFinite(b.maxX) &&
    Number.isFinite(b.maxY) &&
    b.maxX >= b.minX &&
    b.maxY >= b.minY
  );
}

export function boundsContains(
  outer: SpatialBounds2D,
  inner: SpatialBounds2D,
  eps: number = SPATIAL_EPSILON,
): boolean {
  return (
    inner.minX >= outer.minX - eps &&
    inner.minY >= outer.minY - eps &&
    inner.maxX <= outer.maxX + eps &&
    inner.maxY <= outer.maxY + eps
  );
}

export function boundsIntersects(
  a: SpatialBounds2D,
  b: SpatialBounds2D,
  eps: number = SPATIAL_EPSILON,
): boolean {
  return !(
    a.maxX < b.minX - eps ||
    b.maxX < a.minX - eps ||
    a.maxY < b.minY - eps ||
    b.maxY < a.minY - eps
  );
}

export function boundsUnion(a: SpatialBounds2D, b: SpatialBounds2D): SpatialBounds2D {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function expandBoundsToFit(
  outer: SpatialBounds2D,
  required: SpatialBounds2D,
  padding = 0,
): SpatialBounds2D {
  const pad = Math.max(0, padding);
  return {
    minX: required.minX < outer.minX ? round6(required.minX - pad) : outer.minX,
    minY: required.minY < outer.minY ? round6(required.minY - pad) : outer.minY,
    maxX: required.maxX > outer.maxX ? round6(required.maxX + pad) : outer.maxX,
    maxY: required.maxY > outer.maxY ? round6(required.maxY + pad) : outer.maxY,
  };
}

export function computeBoundsOverflow(
  outer: SpatialBounds2D,
  inner: SpatialBounds2D,
): { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number } {
  return {
    left: Math.max(0, outer.minX - inner.minX),
    right: Math.max(0, inner.maxX - outer.maxX),
    top: Math.max(0, outer.minY - inner.minY),
    bottom: Math.max(0, inner.maxY - outer.maxY),
  };
}

export function boundsFromPoints(points: readonly SpatialPoint2D[]): SpatialBounds2D | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function rectPointsFromBounds(b: SpatialBounds2D): readonly SpatialPoint2D[] {
  return [
    [b.minX, b.minY],
    [b.maxX, b.minY],
    [b.maxX, b.maxY],
    [b.minX, b.maxY],
  ];
}

/** Smoothly remap polygon vertices when a container expands from `prev` to `next`. */
export function remapPolygonToBounds(
  polygon: readonly SpatialPoint2D[],
  prev: SpatialBounds2D,
  next: SpatialBounds2D,
): readonly SpatialPoint2D[] {
  const prevW = prev.maxX - prev.minX;
  const prevH = prev.maxY - prev.minY;
  const nextW = next.maxX - next.minX;
  const nextH = next.maxY - next.minY;
  return polygon.map(([px, py]) => {
    const u = prevW > 1e-9 ? (px - prev.minX) / prevW : 0.5;
    const v = prevH > 1e-9 ? (py - prev.minY) / prevH : 0.5;
    return [round6(next.minX + u * nextW), round6(next.minY + v * nextH)] as const;
  });
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function pointInBounds(
  p: SpatialPoint2D,
  b: SpatialBounds2D,
  eps: number = SPATIAL_EPSILON,
): boolean {
  return p[0] >= b.minX - eps && p[0] <= b.maxX + eps && p[1] >= b.minY - eps && p[1] <= b.maxY + eps;
}

// ─── Relation Resolution (SCM §2) ────────────────────────────────────────────

/**
 * Resolve the authoritative spatial relation type of an entity (`CONTAINED` | `CARVED` | `freeland`).
 * Explicit entity `relation` wins (including deprecated `'FLOWING'` alias); otherwise deterministic
 * role + carrier default applies.
 */
export function resolveRelation(
  world: SpatialWorldModel,
  entityId: string,
): SpatialRelationKind {
  const entity = world.entities[entityId];
  if (!entity) return 'CONTAINED';
  if (entity.relation) return entity.relation;
  if (FREELAND_ROLES.has(entity.role)) return 'freeland';
  if (entity.role === 'dungeon' || entity.role === 'tunnel') return 'CARVED';
  if (entity.role === 'room' || entity.role === 'building') {
    const carrier = entity.carrierId ? world.entities[entity.carrierId] : null;
    if (carrier && SOLID_MASS_ROLES.has(carrier.role)) return 'CARVED';
  }
  return 'CONTAINED';
}

/** Collect ancestor chain `[entity, carrier, ..., root]`; detects cycles fail-closed. */
export function resolveCarrierChain(
  world: SpatialWorldModel,
  entityId: string,
):
  | { readonly ok: true; readonly chain: readonly SpatialEntityNode[] }
  | { readonly ok: false; readonly code: 'carrier-cycle' | 'missing-carrier'; readonly atEntityId: string } {
  const start = world.entities[entityId];
  if (!start) return { ok: false, code: 'missing-carrier', atEntityId: entityId };
  const visited = new Set<string>();
  const chain: SpatialEntityNode[] = [];
  let cur: SpatialEntityNode | undefined = start;
  while (cur) {
    if (visited.has(cur.id)) {
      return { ok: false, code: 'carrier-cycle', atEntityId: cur.id };
    }
    visited.add(cur.id);
    chain.push(cur);
    if (cur.carrierId === null) break;
    const next = world.entities[cur.carrierId];
    if (!next) {
      return { ok: false, code: 'missing-carrier', atEntityId: cur.id };
    }
    cur = next;
  }
  return { ok: true, chain };
}

// ─── Single-Entity Containment Check (SCM §7) ────────────────────────────────

/**
 * Evaluate whether `nextBoundsWorld` fits inside `entityId`'s carrier without
 * triggering growth propagation or violating invariants.
 */
export function checkContainment(
  world: SpatialWorldModel,
  entityId: string,
  nextBoundsWorld: SpatialBounds2D,
): SpatialContainmentCheckResult {
  const entity = world.entities[entityId];
  const zeroOverflow = { left: 0, right: 0, top: 0, bottom: 0 };
  if (!entity) {
    return {
      fits: false,
      entityId,
      relation: 'CONTAINED',
      carrierId: null,
      violations: [
        {
          invariant: 'INV-1',
          code: 'missing-carrier',
          entityId,
          reasonDe: `Struktur "${entityId}" existiert nicht im Weltmodell.`,
        },
      ],
      overflow: zeroOverflow,
    };
  }
  const relation = resolveRelation(world, entityId);
  if (!isFiniteSpatialBounds(nextBoundsWorld)) {
    return {
      fits: false,
      entityId,
      relation,
      carrierId: entity.carrierId,
      violations: [
        {
          invariant: 'INV-6',
          code: 'invalid-geometry',
          entityId,
          carrierId: entity.carrierId,
          reasonDe: `Ungültige Geometrie für "${entity.labelDe}".`,
        },
      ],
      overflow: zeroOverflow,
    };
  }

  if (entity.carrierId === null) {
    return {
      fits: true,
      entityId,
      relation,
      carrierId: null,
      violations: [],
      overflow: zeroOverflow,
    };
  }

  const carrier = world.entities[entity.carrierId];
  if (!carrier) {
    return {
      fits: false,
      entityId,
      relation,
      carrierId: entity.carrierId,
      violations: [
        {
          invariant: 'INV-2',
          code: 'missing-carrier',
          entityId,
          carrierId: entity.carrierId,
          reasonDe: `Träger "${entity.carrierId}" für "${entity.labelDe}" fehlt.`,
        },
      ],
      overflow: zeroOverflow,
    };
  }

  if (carrier.status === 'archived') {
    return {
      fits: false,
      entityId,
      relation,
      carrierId: carrier.id,
      violations: [
        {
          invariant: 'INV-4',
          code: 'active-child-in-archived-carrier',
          entityId,
          carrierId: carrier.id,
          reasonDe: `Träger "${carrier.labelDe}" ist archiviert — "${entity.labelDe}" kann darin nicht aktiv liegen.`,
        },
      ],
      overflow: zeroOverflow,
    };
  }

  if (isFreelandRelation(relation)) {
    const intersects = boundsIntersects(carrier.boundsWorld, nextBoundsWorld);
    return {
      fits: intersects,
      entityId,
      relation,
      carrierId: carrier.id,
      violations: intersects
        ? []
        : [
            {
              invariant: 'INV-2',
              code: 'containment-overflow',
              entityId,
              carrierId: carrier.id,
              reasonDe: `Freiland-Struktur „${entity.labelDe}“ (freeland) schneidet die Topografie von „${carrier.labelDe}“ nicht mehr.`,
            },
          ],
      overflow: computeBoundsOverflow(carrier.boundsWorld, nextBoundsWorld),
    };
  }

  const overflow = computeBoundsOverflow(carrier.boundsWorld, nextBoundsWorld);
  const fits = boundsContains(carrier.boundsWorld, nextBoundsWorld);
  if (fits) {
    return {
      fits: true,
      entityId,
      relation,
      carrierId: carrier.id,
      violations: [],
      overflow,
    };
  }

  return {
    fits: false,
    entityId,
    relation,
    carrierId: carrier.id,
    violations: [
      {
        invariant: 'INV-2',
        code: relation === 'CARVED' ? 'carved-breach' : 'containment-overflow',
        entityId,
        carrierId: carrier.id,
        reasonDe:
          relation === 'CARVED'
            ? `"${entity.labelDe}" durchbricht die äußere Grenze der Masse "${carrier.labelDe}".`
            : `"${entity.labelDe}" überschreitet die Grenze von "${carrier.labelDe}".`,
      },
    ],
    overflow,
  };
}

// ─── Full World Invariant Validation (INV-1 .. INV-6) ────────────────────────

/**
 * Validate ALL six Spatial Containment Invariants fail-closed on `world`.
 * Also enforces SWS-01 cycle & shear guards whenever `world.mapNodes` is present.
 */
export function validateSpatialInvariants(
  world: SpatialWorldModel,
): SpatialInvariantValidationResult {
  const violations: SpatialInvariantViolation[] = [];

  // INV-1 + INV-5: Single active root topography
  const root = world.entities[world.rootTopographyId];
  if (!root || root.status !== 'active' || root.carrierId !== null) {
    violations.push({
      invariant: 'INV-1',
      code: 'missing-root-topography',
      entityId: world.rootTopographyId,
      reasonDe: 'Topografie-Wurzel fehlt, ist archiviert oder hat einen fremden Träger.',
    });
  } else if (!ROOT_TOPOGRAPHY_ROLES.has(root.role)) {
    violations.push({
      invariant: 'INV-5',
      code: 'invalid-root-role',
      entityId: root.id,
      reasonDe: `Wurzel "${root.labelDe}" hat Rolle "${root.role}", muss aber Topografie (world/continent/landmass) sein.`,
    });
  }

  // Optional SWS-01 Map Anchor Guard check (cycles + shear)
  if (world.mapNodes) {
    for (const mapId of Object.keys(world.mapNodes)) {
      const node = world.mapNodes[mapId]!;
      if (node.parentAnchor && anchorHasShear(node.parentAnchor)) {
        violations.push({
          invariant: 'INV-1',
          code: 'map-anchor-shear',
          entityId: mapId,
          reasonDe: `Karten-Anchor "${mapId}" verletzt die Scherungs-Regel (Rotation mit nicht-uniformen Extents).`,
        });
      }
      const chain = resolveWorldChain(world.mapNodes, mapId);
      if (isAtlasWorldError(chain)) {
        violations.push({
          invariant: 'INV-1',
          code:
            chain.error === 'cycle'
              ? 'map-anchor-cycle'
              : chain.error === 'shear'
                ? 'map-anchor-shear'
                : 'map-anchor-invalid',
          entityId: chain.atMapId,
          reasonDe: `Karten-Hierarchie-Fehler (${chain.error}) bei "${chain.atMapId}".`,
        });
      }
    }
  }

  const activeRoots: string[] = [];

  for (const entity of Object.values(world.entities)) {
    // INV-6: Finite geometry
    if (!isFiniteSpatialBounds(entity.boundsWorld) || !entity.id.trim() || !entity.mapId.trim()) {
      violations.push({
        invariant: 'INV-6',
        code: 'invalid-geometry',
        entityId: entity.id || '<unbenannt>',
        carrierId: entity.carrierId,
        reasonDe: `Ungültige Bounds oder fehlende Identität bei "${entity.labelDe || entity.id}".`,
      });
      continue;
    }

    if (entity.carrierId === null) {
      if (entity.status === 'active') activeRoots.push(entity.id);
      continue;
    }

    // Cycle / missing carrier guard (INV-1 / INV-2)
    const chainRes = resolveCarrierChain(world, entity.id);
    if ('code' in chainRes) {
      violations.push({
        invariant: 'INV-2',
        code: chainRes.code,
        entityId: entity.id,
        carrierId: entity.carrierId,
        reasonDe:
          chainRes.code === 'carrier-cycle'
            ? `Zyklus im Containment-Graphen bei "${entity.labelDe}" erkannt.`
            : `Träger "${entity.carrierId}" von "${entity.labelDe}" existiert nicht.`,
      });
      continue;
    }

    const carrier = world.entities[entity.carrierId]!;
    const relation = resolveRelation(world, entity.id);

    // INV-5: Topography must never depend on freeland or building/room/prop carriers
    if (
      TOPOGRAPHY_ROLES.has(entity.role) &&
      NON_TOPOGRAPHY_CARRIER_FORBIDDEN_FOR_TOPOGRAPHY.has(carrier.role)
    ) {
      violations.push({
        invariant: 'INV-5',
        code: 'topography-dependency-inverted',
        entityId: entity.id,
        carrierId: carrier.id,
        reasonDe: `Topografie "${entity.labelDe}" darf nicht von "${carrier.labelDe}" (${carrier.role}) abhängen.`,
      });
    }

    if (entity.status === 'archived') {
      continue;
    }

    // INV-4: Active non-freeland child cannot reside in an archived carrier
    if (carrier.status === 'archived' && !isFreelandRelation(relation)) {
      violations.push({
        invariant: 'INV-4',
        code: 'active-child-in-archived-carrier',
        entityId: entity.id,
        carrierId: carrier.id,
        reasonDe: `Aktive Struktur "${entity.labelDe}" liegt in archiviertem Träger "${carrier.labelDe}".`,
      });
      continue;
    }

    if (isFreelandRelation(relation)) {
      const hasMainLine = Boolean(entity.polylineWorld && entity.polylineWorld.length >= 2);
      const hasSegments = Boolean(
        entity.clippedSegmentsWorld &&
          entity.clippedSegmentsWorld.some((seg) => seg.length >= 2),
      );
      if (!hasMainLine && !hasSegments) {
        violations.push({
          invariant: 'INV-2',
          code: 'empty-flowing-path',
          entityId: entity.id,
          carrierId: carrier.id,
          reasonDe: `Freiland-Struktur „${entity.labelDe}“ (freeland) hat keinen gültigen Pfad.`,
        });
      }
      continue;
    }

    // INV-2 + INV-3: Active CONTAINED / CARVED must lie inside its carrier
    const effectiveBounds =
      relation === 'CARVED' && entity.cavityBoundsWorld && isFiniteSpatialBounds(entity.cavityBoundsWorld)
        ? boundsUnion(entity.boundsWorld, entity.cavityBoundsWorld)
        : entity.boundsWorld;

    if (!boundsContains(carrier.boundsWorld, effectiveBounds)) {
      violations.push({
        invariant: 'INV-2',
        code: relation === 'CARVED' ? 'carved-breach' : 'containment-overflow',
        entityId: entity.id,
        carrierId: carrier.id,
        reasonDe:
          relation === 'CARVED'
            ? `Eingeschnittene Struktur "${entity.labelDe}" ragt aus der Masse "${carrier.labelDe}" heraus.`
            : `"${entity.labelDe}" liegt außerhalb seines Trägers "${carrier.labelDe}".`,
      });
    }
  }

  if (activeRoots.length > 1) {
    violations.push({
      invariant: 'INV-1',
      code: 'multiple-roots',
      entityId: activeRoots[1]!,
      reasonDe: `Mehrere aktive Welt-Wurzeln gefunden (${activeRoots.join(', ')}) — INV-1 erlaubt nur eine Welt.`,
    });
  }

  return violations.length === 0 ? { ok: true, violations: [] } : { ok: false, violations };
}

/** Collect all direct children of `carrierId` in deterministic ID order. */
export function listDirectContainedChildren(
  world: SpatialWorldModel,
  carrierId: string,
  options?: { readonly includeArchived?: boolean },
): readonly SpatialEntityNode[] {
  const includeArchived = options?.includeArchived === true;
  return Object.values(world.entities)
    .filter(
      (e) =>
        e.carrierId === carrierId &&
        (includeArchived || e.status === 'active'),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Collect all transitive descendants of `carrierId` (BFS, cycle-safe, deterministic). */
export function listDescendantEntities(
  world: SpatialWorldModel,
  carrierId: string,
  options?: { readonly includeArchived?: boolean },
): readonly SpatialEntityNode[] {
  const visited = new Set<string>([carrierId]);
  const queue: string[] = [carrierId];
  const out: SpatialEntityNode[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const children = listDirectContainedChildren(world, cur, options);
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      out.push(child);
      queue.push(child.id);
    }
  }
  return out;
}
