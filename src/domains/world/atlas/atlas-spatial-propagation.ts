/**
 * atlas-spatial-propagation — SCM-02: Upward Growth, CARVED Cavities, freeland Routing & Atomic Apply.
 * Location: src/domains/world/atlas/atlas-spatial-propagation.ts
 *
 * Pure domain — NO React, NO Three.js, NO Host SDK (BR-005).
 *
 * Implements `.qa/design/sws-containment-model.md` §2, §3, §4, §7 & `.qa/design/world-model-terminology.md`:
 *  - Upward growth propagation stopping at the first accommodating ancestor (INV-3, SCM-01/02)
 *  - CARVED cavity hollowing inside solid mass; outer contour grows ONLY on breach (SCM-03)
 *  - freeland polyline rerouting / Liang-Barsky clipping against topography changes (SCM-04, INV-5)
 *  - Fail-closed reparent/cycle/topography-inversion guards (SCM-08)
 *  - Atomic `applyWorldOperation` with Pre-/Post-Invariant check & rollback (INV-6)
 */
import {
  SPATIAL_EPSILON,
  boundsContains,
  boundsFromPoints,
  boundsIntersects,
  boundsUnion,
  expandBoundsToFit,
  isFiniteSpatialBounds,
  isFreelandRelation,
  listDescendantEntities,
  remapPolygonToBounds,
  resolveCarrierChain,
  resolveRelation,
  validateSpatialInvariants,
  type SpatialBounds2D,
  type SpatialEntityNode,
  type SpatialEntityStatus,
  type SpatialInvariantViolation,
  type SpatialPoint2D,
  type SpatialRelationKind,
  type SpatialStructureRole,
  type SpatialWorldModel,
} from './atlas-spatial-containment';

export type SpatialEditIntent =
  | {
      readonly kind: 'resize_or_move';
      readonly entityId: string;
      readonly nextBoundsWorld: SpatialBounds2D;
      readonly nextPolygonWorld?: readonly SpatialPoint2D[];
      readonly nextPolylineWorld?: readonly SpatialPoint2D[];
      /** Optional margin added when a carrier grows to enclose the edited child. */
      readonly growPadding?: number;
    }
  | {
      readonly kind: 'reparent';
      readonly entityId: string;
      readonly nextCarrierId: string;
      readonly growPadding?: number;
    }
  | {
      readonly kind: 'remove';
      readonly entityId: string;
    }
  | {
      readonly kind: 'restore';
      readonly entityId: string;
    };

export type SpatialChangeKind =
  | 'update_target'
  | 'grow_carrier'
  | 'carve_cavity'
  | 'reroute_flowing'
  | 'cap_flowing'
  | 'archive_target'
  | 'archive_cascade'
  | 'restore_entity'
  | 'reparent_entity';

export type SpatialEntityChange = {
  readonly entityId: string;
  readonly mapId: string;
  readonly featureId: string;
  readonly labelDe: string;
  readonly role: SpatialStructureRole;
  readonly relation: SpatialRelationKind;
  readonly kind: SpatialChangeKind;
  readonly prevBoundsWorld: SpatialBounds2D;
  readonly nextBoundsWorld: SpatialBounds2D;
  readonly nextPolygonWorld?: readonly SpatialPoint2D[];
  readonly nextPolylineWorld?: readonly SpatialPoint2D[];
  readonly nextClippedSegmentsWorld?: readonly (readonly SpatialPoint2D[])[];
  readonly nextCavityBoundsWorld?: SpatialBounds2D;
  readonly nextCarrierId?: string | null;
  readonly nextStatus?: SpatialEntityStatus;
  readonly archivedByEntityId?: string | null;
  readonly archivedReasonDe?: string | null;
};

export type SpatialConfirmationKind = 'none' | 'grow' | 'cascade';

export type SpatialCascadeCounts = {
  readonly continents: number;
  readonly countries: number;
  readonly settlements: number;
  readonly buildings: number;
  readonly rooms: number;
  readonly other: number;
  readonly total: number;
  readonly flowingAffected: number;
};

export type WorldOperationPlan = {
  readonly intent: SpatialEditIntent;
  readonly targetEntityId: string;
  readonly targetRelation: SpatialRelationKind;
  readonly requiresConfirmation: SpatialConfirmationKind;
  /** Ordered IDs of ancestors grown during upward propagation (direct parent first). */
  readonly grownCarrierIds: readonly string[];
  /** Ordered IDs of entities archived by soft-cascade (excluding target). */
  readonly archivedDescendantIds: readonly string[];
  /** Ordered IDs of FLOWING entities rerouted or capped. */
  readonly reroutedFlowingIds: readonly string[];
  readonly cascadeCounts: SpatialCascadeCounts;
  readonly changes: readonly SpatialEntityChange[];
  /** Distinct mapIds touched by this atomic operation. */
  readonly affectedMapIds: readonly string[];
  /** Ready-to-render German summary for the confirmation dialog. */
  readonly summaryDe: string;
};

export type SpatialPlanFailureCode =
  | 'pre-invariant-failed'
  | 'entity-not-found'
  | 'entity-archived'
  | 'entity-not-archived'
  | 'cannot-remove-root'
  | 'invalid-geometry'
  | 'cycle-rejected'
  | 'topography-inversion-rejected'
  | 'flowing-cannot-grow-topography'
  | 'missing-carrier';

export type SpatialPropagationPlanResult =
  | { readonly ok: true; readonly plan: WorldOperationPlan }
  | {
      readonly ok: false;
      readonly code: SpatialPlanFailureCode;
      readonly violations: readonly SpatialInvariantViolation[];
      readonly reasonDe: string;
    };

export type ApplyWorldOperationResult =
  | {
      readonly ok: true;
      readonly world: SpatialWorldModel;
      readonly appliedChangeCount: number;
      readonly affectedMapIds: readonly string[];
    }
  | {
      readonly ok: false;
      readonly world: SpatialWorldModel;
      readonly code: 'pre-invariant-failed' | 'post-invariant-failed';
      readonly violations: readonly SpatialInvariantViolation[];
      readonly reasonDe: string;
    };

const TOPOGRAPHY_ROLES: ReadonlySet<SpatialStructureRole> = new Set([
  'world',
  'continent',
  'landmass',
  'mountain',
]);

const FORBIDDEN_CARRIERS_FOR_TOPOGRAPHY: ReadonlySet<SpatialStructureRole> = new Set([
  'river',
  'road',
  'coast',
  'building',
  'room',
  'prop',
]);

const EMPTY_CASCADE_COUNTS: SpatialCascadeCounts = {
  continents: 0,
  countries: 0,
  settlements: 0,
  buildings: 0,
  rooms: 0,
  other: 0,
  total: 0,
  flowingAffected: 0,
};

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

// ─── Liang-Barsky 2D Segment & Polyline Clipping (Pure Domain) ───────────────

/**
 * Compute Liang-Barsky parametric entry/exit `[t0, t1]` where segment `a -> b`
 * lies INSIDE `rect`. Returns `null` if the segment does not intersect `rect`.
 */
export function liangBarskySegmentInterval(
  a: SpatialPoint2D,
  b: SpatialPoint2D,
  rect: SpatialBounds2D,
): readonly [number, number] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const checks: readonly (readonly [number, number])[] = [
    [-dx, a[0] - rect.minX],
    [dx, rect.maxX - a[0]],
    [-dy, a[1] - rect.minY],
    [dy, rect.maxY - a[1]],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) <= 1e-12) {
      if (q < -SPATIAL_EPSILON) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  if (t1 < t0) return null;
  return [Math.max(0, t0), Math.min(1, t1)] as const;
}

function lerpPoint(a: SpatialPoint2D, b: SpatialPoint2D, t: number): SpatialPoint2D {
  return [round6(a[0] + (b[0] - a[0]) * t), round6(a[1] + (b[1] - a[1]) * t)] as const;
}

/** Clip segment `a -> b` to remain INSIDE `bounds`. Returns null if completely outside. */
export function clipSegmentInsideBounds(
  a: SpatialPoint2D,
  b: SpatialPoint2D,
  bounds: SpatialBounds2D,
): readonly [SpatialPoint2D, SpatialPoint2D] | null {
  const hit = liangBarskySegmentInterval(a, b, bounds);
  if (!hit) return null;
  const [t0, t1] = hit;
  if (t1 - t0 <= 1e-9) return null;
  return [lerpPoint(a, b, t0), lerpPoint(a, b, t1)] as const;
}

/**
 * Clip segment `a -> b` to remain OUTSIDE `rect` (Liang-Barsky complement).
 * Returns 0, 1, or 2 sub-segments.
 */
export function clipSegmentOutsideRect(
  a: SpatialPoint2D,
  b: SpatialPoint2D,
  rect: SpatialBounds2D,
): readonly (readonly [SpatialPoint2D, SpatialPoint2D])[] {
  const hit = liangBarskySegmentInterval(a, b, rect);
  if (!hit) return [[a, b]];
  const [t0, t1] = hit;
  const out: (readonly [SpatialPoint2D, SpatialPoint2D])[] = [];
  if (t0 > 1e-6) {
    out.push([a, lerpPoint(a, b, t0)]);
  }
  if (t1 < 1 - 1e-6) {
    out.push([lerpPoint(a, b, t1), b]);
  }
  return out;
}

function stitchSegmentsToPolylines(
  segments: readonly (readonly [SpatialPoint2D, SpatialPoint2D])[],
): readonly (readonly SpatialPoint2D[])[] {
  const result: SpatialPoint2D[][] = [];
  for (const [p0, p1] of segments) {
    const prev = result[result.length - 1];
    if (prev) {
      const tail = prev[prev.length - 1]!;
      if (Math.hypot(tail[0] - p0[0], tail[1] - p0[1]) <= 1e-4) {
        if (Math.hypot(tail[0] - p1[0], tail[1] - p1[1]) > 1e-6) {
          prev.push(p1);
        }
        continue;
      }
    }
    if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 1e-6) {
      result.push([p0, p1]);
    }
  }
  return result;
}

/** Clip a polyline so all resulting sub-polylines stay INSIDE `bounds` (coastal capping). */
export function clipPolylineInsideBounds(
  points: readonly SpatialPoint2D[],
  bounds: SpatialBounds2D,
): readonly (readonly SpatialPoint2D[])[] {
  if (points.length < 2) return [];
  const kept: (readonly [SpatialPoint2D, SpatialPoint2D])[] = [];
  for (let i = 0; i + 1 < points.length; i += 1) {
    const seg = clipSegmentInsideBounds(points[i]!, points[i + 1]!, bounds);
    if (seg) kept.push(seg);
  }
  return stitchSegmentsToPolylines(kept);
}

/**
 * Clip a polyline outside a list of cutout rectangles (Liang-Barsky).
 * Shared by SCM-04 FLOWING routing/capping AND SWS Multi-Map cutout filtering (Finding M-2).
 */
export function clipPolylineOutsideRects(
  points: readonly SpatialPoint2D[],
  rects: readonly SpatialBounds2D[],
): readonly (readonly SpatialPoint2D[])[] {
  if (points.length < 2) return [];
  if (rects.length === 0) return [points];

  let segments: (readonly [SpatialPoint2D, SpatialPoint2D])[] = [];
  for (let i = 0; i + 1 < points.length; i += 1) {
    segments.push([points[i]!, points[i + 1]!]);
  }
  for (const rect of rects) {
    const next: (readonly [SpatialPoint2D, SpatialPoint2D])[] = [];
    for (const [a, b] of segments) {
      for (const sub of clipSegmentOutsideRect(a, b, rect)) {
        next.push(sub);
      }
    }
    segments = next;
    if (segments.length === 0) break;
  }
  return stitchSegmentsToPolylines(segments);
}

// ─── FLOWING Re-Routing & Capping Against Changed Topography (SCM-04) ────────

function pointNearBoundary(p: SpatialPoint2D, b: SpatialBounds2D, tol = 2): boolean {
  return (
    Math.abs(p[0] - b.minX) <= tol ||
    Math.abs(p[0] - b.maxX) <= tol ||
    Math.abs(p[1] - b.minY) <= tol ||
    Math.abs(p[1] - b.maxY) <= tol
  );
}

function clampPointToBounds(p: SpatialPoint2D, b: SpatialBounds2D): SpatialPoint2D {
  return [
    round6(Math.max(b.minX, Math.min(b.maxX, p[0]))),
    round6(Math.max(b.minY, Math.min(b.maxY, p[1]))),
  ] as const;
}

/**
 * Re-route an active FLOWING entity when a landmass/carrier grows or shifts:
 *  - If an endpoint was anchored to the old coastline edge, extend it smoothly to the new coast.
 *  - If the topography shrank, cap the polyline cleanly to the updated bounds (never delete!).
 */
function reconcileFlowingAgainstGrownOrChangedBounds(
  flow: SpatialEntityNode,
  prevCarrierBounds: SpatialBounds2D,
  nextCarrierBounds: SpatialBounds2D,
): {
  readonly kind: 'reroute_flowing' | 'cap_flowing';
  readonly nextPolyline: readonly SpatialPoint2D[];
  readonly nextSegments: readonly (readonly SpatialPoint2D[])[];
  readonly nextBounds: SpatialBounds2D;
} | null {
  const sourceSegments: readonly (readonly SpatialPoint2D[])[] =
    flow.clippedSegmentsWorld && flow.clippedSegmentsWorld.length > 0
      ? flow.clippedSegmentsWorld.filter((seg) => seg.length >= 2)
      : flow.polylineWorld && flow.polylineWorld.length >= 2
        ? [flow.polylineWorld]
        : [];
  if (sourceSegments.length === 0) return null;

  const shrunk =
    nextCarrierBounds.minX > prevCarrierBounds.minX + SPATIAL_EPSILON ||
    nextCarrierBounds.maxX < prevCarrierBounds.maxX - SPATIAL_EPSILON ||
    nextCarrierBounds.minY > prevCarrierBounds.minY + SPATIAL_EPSILON ||
    nextCarrierBounds.maxY < prevCarrierBounds.maxY - SPATIAL_EPSILON;

  if (shrunk) {
    const clipped: (readonly SpatialPoint2D[])[] = [];
    for (const seg of sourceSegments) {
      for (const piece of clipPolylineInsideBounds(seg, nextCarrierBounds)) {
        clipped.push(piece);
      }
    }
    if (clipped.length > 0) {
      const main = clipped[0]!;
      const b = boundsFromPoints(clipped.flat()) ?? flow.boundsWorld;
      return {
        kind: 'cap_flowing',
        nextPolyline: main,
        nextSegments: clipped,
        nextBounds: b,
      };
    }
    // Fallback: clamp path along the surviving coastline edge so FLOWING is capped, never deleted
    const clamped = sourceSegments[0]!.map((pt) => clampPointToBounds(pt, nextCarrierBounds));
    const b = boundsFromPoints(clamped) ?? nextCarrierBounds;
    return {
      kind: 'cap_flowing',
      nextPolyline: clamped,
      nextSegments: [clamped],
      nextBounds: b,
    };
  }

  // Carrier grew: extend any endpoint sitting on an expanded edge to follow the new coastline
  let changed = false;
  const nextSegments: (readonly SpatialPoint2D[])[] = sourceSegments.map((seg) =>
    seg.map((pt, idx) => {
      const isEndpoint = idx === 0 || idx === seg.length - 1;
      if (!isEndpoint || !pointNearBoundary(pt, prevCarrierBounds)) return pt;
      let nx = pt[0];
      let ny = pt[1];
      if (Math.abs(pt[0] - prevCarrierBounds.minX) <= 2 && nextCarrierBounds.minX < prevCarrierBounds.minX) {
        nx = nextCarrierBounds.minX;
        changed = true;
      } else if (Math.abs(pt[0] - prevCarrierBounds.maxX) <= 2 && nextCarrierBounds.maxX > prevCarrierBounds.maxX) {
        nx = nextCarrierBounds.maxX;
        changed = true;
      }
      if (Math.abs(pt[1] - prevCarrierBounds.minY) <= 2 && nextCarrierBounds.minY < prevCarrierBounds.minY) {
        ny = nextCarrierBounds.minY;
        changed = true;
      } else if (Math.abs(pt[1] - prevCarrierBounds.maxY) <= 2 && nextCarrierBounds.maxY > prevCarrierBounds.maxY) {
        ny = nextCarrierBounds.maxY;
        changed = true;
      }
      return [round6(nx), round6(ny)] as const;
    }),
  );

  if (!changed) return null;
  const b = boundsFromPoints(nextSegments.flat()) ?? flow.boundsWorld;
  return {
    kind: 'reroute_flowing',
    nextPolyline: nextSegments[0]!,
    nextSegments,
    nextBounds: b,
  };
}

// ─── German Dialog Summary Builders ──────────────────────────────────────────

function buildGrowthSummaryDe(
  targetLabelDe: string,
  grownLabelsDe: readonly string[],
): string {
  if (grownLabelsDe.length === 0) {
    return `„${targetLabelDe}“ wird innerhalb der bestehenden Grenzen aktualisiert.`;
  }
  if (grownLabelsDe.length === 1) {
    return `Das geht über die aktuelle Grenze hinaus und erweitert „${grownLabelsDe[0]}“. Bestätigen?`;
  }
  return `Das geht über die aktuelle Grenze hinaus und erweitert die Kette: ${grownLabelsDe.join(' → ')}. Bestätigen?`;
}

// ─── Main Planner (`planPropagation`) ────────────────────────────────────────

function collectAffectedMapIds(changes: readonly SpatialEntityChange[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of changes) {
    if (!seen.has(ch.mapId)) {
      seen.add(ch.mapId);
      out.push(ch.mapId);
    }
  }
  return out;
}

/**
 * Plan a complete, atomic `WorldOperationPlan` for a `SpatialEditIntent`.
 * Enforces INV-1..INV-5 fail-closed before returning a plan.
 */
export function planPropagation(
  world: SpatialWorldModel,
  intent: SpatialEditIntent,
): SpatialPropagationPlanResult {
  const preCheck = validateSpatialInvariants(world);
  if (!preCheck.ok) {
    return {
      ok: false,
      code: 'pre-invariant-failed',
      violations: preCheck.violations,
      reasonDe: `Weltmodell verletzt räumliche Invarianten vor Bearbeitung (${preCheck.violations[0]?.reasonDe ?? 'unbekannt'}).`,
    };
  }

  const target = world.entities[intent.entityId];
  if (!target) {
    return {
      ok: false,
      code: 'entity-not-found',
      violations: [
        {
          invariant: 'INV-1',
          code: 'missing-carrier',
          entityId: intent.entityId,
          reasonDe: `Struktur „${intent.entityId}“ nicht gefunden.`,
        },
      ],
      reasonDe: `Struktur „${intent.entityId}“ existiert nicht im Weltmodell.`,
    };
  }

  if (intent.kind === 'resize_or_move') {
    return planResizeOrMove(world, target, intent);
  }
  if (intent.kind === 'reparent') {
    return planReparent(world, target, intent);
  }
  if (intent.kind === 'remove') {
    return planRemoveCascade(world, target, intent);
  }
  return planRestore(world, target, intent);
}

function summarizeCascadeCountsDe(counts: SpatialCascadeCounts): string {
  const parts: string[] = [];
  if (counts.continents > 0) {
    parts.push(`${counts.continents} ${counts.continents === 1 ? 'Kontinent' : 'Kontinente'}`);
  }
  if (counts.countries > 0) {
    parts.push(`${counts.countries} ${counts.countries === 1 ? 'Land' : 'Länder'}`);
  }
  if (counts.settlements > 0) {
    parts.push(`${counts.settlements} ${counts.settlements === 1 ? 'Stadt' : 'Städte'}`);
  }
  if (counts.buildings > 0) {
    parts.push(`${counts.buildings} ${counts.buildings === 1 ? 'Haus' : 'Häuser'}`);
  }
  if (counts.rooms > 0) {
    parts.push(`${counts.rooms} ${counts.rooms === 1 ? 'Raum' : 'Räume'}`);
  }
  if (counts.other > 0) {
    parts.push(`${counts.other} ${counts.other === 1 ? 'weiteres Element' : 'weitere Elemente'}`);
  }
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]!}`;
}

function countCascadeDescendants(
  descendants: readonly SpatialEntityNode[],
  flowingAffected: number,
): SpatialCascadeCounts {
  let continents = 0;
  let countries = 0;
  let settlements = 0;
  let buildings = 0;
  let rooms = 0;
  let other = 0;
  for (const d of descendants) {
    if (d.role === 'continent') continents += 1;
    else if (d.role === 'country' || d.role === 'political') countries += 1;
    else if (d.role === 'settlement') settlements += 1;
    else if (d.role === 'building') buildings += 1;
    else if (d.role === 'room') rooms += 1;
    else other += 1;
  }
  return {
    continents,
    countries,
    settlements,
    buildings,
    rooms,
    other,
    total: descendants.length,
    flowingAffected,
  };
}

/**
 * Downward Soft-Cascade Removal (SCM §5 / INV-4 / SCM-05):
 *  - Archives target + all CONTAINED/CARVED descendants (`archivedByEntityId = target.id`, recoverable!)
 *  - Never deletes FLOWING entities (rivers/roads/coasts): caps/reroutes them outside removed bounds
 *    and reparents orphaned FLOWING entities to the nearest surviving active ancestor.
 */
function planRemoveCascade(
  world: SpatialWorldModel,
  target: SpatialEntityNode,
  intent: Extract<SpatialEditIntent, { kind: 'remove' }>,
): SpatialPropagationPlanResult {
  if (target.id === world.rootTopographyId || target.carrierId === null) {
    return {
      ok: false,
      code: 'cannot-remove-root',
      violations: [
        {
          invariant: 'INV-1',
          code: 'missing-root-topography',
          entityId: target.id,
          reasonDe: `Die Welt-Topografie-Wurzel „${target.labelDe}“ kann nicht entfernt werden.`,
        },
      ],
      reasonDe: `Die Welt-Topografie-Wurzel „${target.labelDe}“ kann nicht entfernt werden (INV-1/INV-5).`,
    };
  }

  if (target.status === 'archived') {
    return {
      ok: false,
      code: 'entity-archived',
      violations: [],
      reasonDe: `„${target.labelDe}“ ist bereits archiviert.`,
    };
  }

  const targetRelation = resolveRelation(world, target.id);
  const allDescendants = listDescendantEntities(world, target.id, { includeArchived: false });
  const toArchive: SpatialEntityNode[] = [];
  const descendantFlowing: SpatialEntityNode[] = [];

  for (const d of allDescendants) {
    if (isFreelandRelation(resolveRelation(world, d.id))) {
      descendantFlowing.push(d);
    } else {
      toArchive.push(d);
    }
  }

  const archiveIds = new Set<string>([target.id, ...toArchive.map((d) => d.id)]);
  const removedRects: SpatialBounds2D[] = [target.boundsWorld];

  // Nearest surviving active ancestor for reparenting FLOWING entities that depended on removed carrier
  const chainRes = resolveCarrierChain(world, target.id);
  const survivingAncestor =
    chainRes.ok
      ? chainRes.chain.slice(1).find((n) => !archiveIds.has(n.id) && n.status === 'active') ??
        world.entities[world.rootTopographyId]
      : world.entities[world.rootTopographyId];

  const changes: SpatialEntityChange[] = [
    {
      entityId: target.id,
      mapId: target.mapId,
      featureId: target.featureId,
      labelDe: target.labelDe,
      role: target.role,
      relation: targetRelation,
      kind: 'archive_target',
      prevBoundsWorld: target.boundsWorld,
      nextBoundsWorld: target.boundsWorld,
      nextStatus: 'archived',
      archivedByEntityId: target.id,
      archivedReasonDe: `Entfernt durch Nutzeraktion auf „${target.labelDe}“ (rückholbar).`,
    },
  ];

  const archivedDescendantIds: string[] = [];
  for (const child of toArchive) {
    archivedDescendantIds.push(child.id);
    changes.push({
      entityId: child.id,
      mapId: child.mapId,
      featureId: child.featureId,
      labelDe: child.labelDe,
      role: child.role,
      relation: resolveRelation(world, child.id),
      kind: 'archive_cascade',
      prevBoundsWorld: child.boundsWorld,
      nextBoundsWorld: child.boundsWorld,
      nextStatus: 'archived',
      archivedByEntityId: target.id,
      archivedReasonDe: `Verwaist/archiviert durch Entfernen von „${target.labelDe}“ (rückholbar).`,
    });
  }

  // Reconcile BOTH descendant freeland entities AND external active freeland entities crossing target
  const reroutedFlowingIds: string[] = [];
  const handledFlowing = new Set<string>();
  const candidateFlowing: SpatialEntityNode[] = [...descendantFlowing];
  for (const e of Object.values(world.entities)) {
    if (e.status !== 'active' || archiveIds.has(e.id)) continue;
    if (!isFreelandRelation(resolveRelation(world, e.id))) continue;
    if (boundsIntersects(e.boundsWorld, target.boundsWorld)) {
      candidateFlowing.push(e);
    }
  }

  for (const flow of candidateFlowing) {
    if (handledFlowing.has(flow.id)) continue;
    handledFlowing.add(flow.id);
    const sourceSegments: readonly (readonly SpatialPoint2D[])[] =
      flow.clippedSegmentsWorld && flow.clippedSegmentsWorld.length > 0
        ? flow.clippedSegmentsWorld.filter((seg) => seg.length >= 2)
        : flow.polylineWorld && flow.polylineWorld.length >= 2
          ? [flow.polylineWorld]
          : [];
    if (sourceSegments.length === 0) continue;

    const remainingSegments: (readonly SpatialPoint2D[])[] = [];
    for (const seg of sourceSegments) {
      for (const piece of clipPolylineOutsideRects(seg, removedRects)) {
        remainingSegments.push(piece);
      }
    }
    const fallbackCarrierBounds = survivingAncestor?.boundsWorld ?? target.boundsWorld;
    // Never delete freeland structures: if clipped outside removed bounds leaves surviving segments, keep them;
    // otherwise cap along the nearest surviving perimeter edge so the waterway/road terminates cleanly.
    let finalSegments: readonly (readonly SpatialPoint2D[])[];
    if (remainingSegments.length > 0) {
      finalSegments = remainingSegments;
    } else {
      const startPt = sourceSegments[0]![0]!;
      const edgePt: SpatialPoint2D = [
        round6(Math.max(fallbackCarrierBounds.minX, Math.min(fallbackCarrierBounds.maxX, target.boundsWorld.minX))),
        round6(Math.max(fallbackCarrierBounds.minY, Math.min(fallbackCarrierBounds.maxY, startPt[1]))),
      ];
      const capPt: SpatialPoint2D = [
        edgePt[0],
        round6(Math.min(fallbackCarrierBounds.maxY, edgePt[1] + 1)),
      ];
      finalSegments = [[edgePt, capPt]];
    }
    const primaryLine = finalSegments[0]!;
    const nextBounds = boundsFromPoints(finalSegments.flat()) ?? flow.boundsWorld;
    const needsReparent = Boolean(flow.carrierId && archiveIds.has(flow.carrierId) && survivingAncestor);

    reroutedFlowingIds.push(flow.id);
    changes.push({
      entityId: flow.id,
      mapId: flow.mapId,
      featureId: flow.featureId,
      labelDe: flow.labelDe,
      role: flow.role,
      relation: 'freeland',
      kind: 'cap_flowing',
      prevBoundsWorld: flow.boundsWorld,
      nextBoundsWorld: nextBounds,
      nextPolylineWorld: primaryLine,
      nextClippedSegmentsWorld: finalSegments,
      ...(needsReparent && survivingAncestor ? { nextCarrierId: survivingAncestor.id } : {}),
    });
  }

  const cascadeCounts = countCascadeDescendants(toArchive, reroutedFlowingIds.length);
  const itemsText = summarizeCascadeCountsDe(cascadeCounts);
  let summaryDe: string;
  if (itemsText && reroutedFlowingIds.length > 0) {
    summaryDe = `„${target.labelDe}“ enthält ${itemsText}. Diese werden verwaist/archiviert (rückholbar); ${reroutedFlowingIds.length} ${reroutedFlowingIds.length === 1 ? 'Verlauf wird' : 'Verläufe werden'} gekappt/umgeleitet. Bestätigen?`;
  } else if (itemsText) {
    summaryDe = `„${target.labelDe}“ enthält ${itemsText}. Diese werden mitentfernt (archiviert, rückholbar). Bestätigen?`;
  } else if (reroutedFlowingIds.length > 0) {
    summaryDe = `Entfernen von „${target.labelDe}“ kappt/leitet ${reroutedFlowingIds.length} kreuzende ${reroutedFlowingIds.length === 1 ? 'Struktur' : 'Strukturen'} um. Bestätigen?`;
  } else {
    summaryDe = `„${target.labelDe}“ wird archiviert (rückholbar).`;
  }

  return {
    ok: true,
    plan: {
      intent,
      targetEntityId: target.id,
      targetRelation,
      requiresConfirmation:
        archivedDescendantIds.length > 0 || reroutedFlowingIds.length > 0 ? 'cascade' : 'none',
      grownCarrierIds: [],
      archivedDescendantIds,
      reroutedFlowingIds,
      cascadeCounts,
      changes,
      affectedMapIds: collectAffectedMapIds(changes),
      summaryDe,
    },
  };
}

/**
 * Restore a soft-cascaded entity AND all children archived under `archivedByEntityId === target.id`.
 * Fail-closed if `target`'s own carrier is currently archived (INV-4).
 */
function planRestore(
  world: SpatialWorldModel,
  target: SpatialEntityNode,
  intent: Extract<SpatialEditIntent, { kind: 'restore' }>,
): SpatialPropagationPlanResult {
  if (target.status !== 'archived') {
    return {
      ok: false,
      code: 'entity-not-archived',
      violations: [],
      reasonDe: `„${target.labelDe}“ ist bereits aktiv.`,
    };
  }

  const carrier = target.carrierId ? world.entities[target.carrierId] : null;
  if (carrier && carrier.status === 'archived') {
    return {
      ok: false,
      code: 'entity-archived',
      violations: [
        {
          invariant: 'INV-4',
          code: 'active-child-in-archived-carrier',
          entityId: target.id,
          carrierId: carrier.id,
          reasonDe: `Träger „${carrier.labelDe}“ ist noch archiviert — bitte zuerst „${carrier.labelDe}“ wiederherstellen.`,
        },
      ],
      reasonDe: `Träger „${carrier.labelDe}“ ist archiviert und muss zuerst wiederhergestellt werden.`,
    };
  }

  const changes: SpatialEntityChange[] = [
    {
      entityId: target.id,
      mapId: target.mapId,
      featureId: target.featureId,
      labelDe: target.labelDe,
      role: target.role,
      relation: resolveRelation(world, target.id),
      kind: 'restore_entity',
      prevBoundsWorld: target.boundsWorld,
      nextBoundsWorld: target.boundsWorld,
      nextStatus: 'active',
      archivedByEntityId: null,
      archivedReasonDe: null,
    },
  ];

  for (const e of Object.values(world.entities)) {
    if (e.id === target.id) continue;
    if (e.status === 'archived' && e.archivedByEntityId === target.id) {
      changes.push({
        entityId: e.id,
        mapId: e.mapId,
        featureId: e.featureId,
        labelDe: e.labelDe,
        role: e.role,
        relation: resolveRelation(world, e.id),
        kind: 'restore_entity',
        prevBoundsWorld: e.boundsWorld,
        nextBoundsWorld: e.boundsWorld,
        nextStatus: 'active',
        archivedByEntityId: null,
        archivedReasonDe: null,
      });
    }
  }

  // If restored entity exceeds current carrier bounds, expand ancestors cleanly (INV-2/3)
  const grownCarrierIds: string[] = [];
  if (carrier && !isFreelandRelation(resolveRelation(world, target.id))) {
    const chainRes = resolveCarrierChain(world, target.id);
    if (chainRes.ok) {
      let required = target.boundsWorld;
      for (const anc of chainRes.chain.slice(1)) {
        if (boundsContains(anc.boundsWorld, required)) break;
        const expanded = expandBoundsToFit(anc.boundsWorld, required, 0);
        changes.push({
          entityId: anc.id,
          mapId: anc.mapId,
          featureId: anc.featureId,
          labelDe: anc.labelDe,
          role: anc.role,
          relation: resolveRelation(world, anc.id),
          kind: 'grow_carrier',
          prevBoundsWorld: anc.boundsWorld,
          nextBoundsWorld: expanded,
          ...(anc.polygonWorld
            ? { nextPolygonWorld: remapPolygonToBounds(anc.polygonWorld, anc.boundsWorld, expanded) }
            : {}),
        });
        grownCarrierIds.push(anc.id);
        required = expanded;
      }
    }
  }

  return {
    ok: true,
    plan: {
      intent,
      targetEntityId: target.id,
      targetRelation: resolveRelation(world, target.id),
      requiresConfirmation: grownCarrierIds.length > 0 ? 'grow' : 'none',
      grownCarrierIds,
      archivedDescendantIds: [],
      reroutedFlowingIds: [],
      cascadeCounts: EMPTY_CASCADE_COUNTS,
      changes,
      affectedMapIds: collectAffectedMapIds(changes),
      summaryDe: `„${target.labelDe}“ (${changes.length} ${changes.length === 1 ? 'Struktur' : 'Strukturen'}) wird wiederhergestellt.`,
    },
  };
}

function planResizeOrMove(
  world: SpatialWorldModel,
  target: SpatialEntityNode,
  intent: Extract<SpatialEditIntent, { kind: 'resize_or_move' }>,
): SpatialPropagationPlanResult {
  if (target.status === 'archived') {
    return {
      ok: false,
      code: 'entity-archived',
      violations: [
        {
          invariant: 'INV-4',
          code: 'active-child-in-archived-carrier',
          entityId: target.id,
          reasonDe: `Archivierte Struktur „${target.labelDe}“ muss zuerst wiederhergestellt werden.`,
        },
      ],
      reasonDe: `„${target.labelDe}“ ist archiviert und kann nicht direkt bearbeitet werden.`,
    };
  }

  if (!isFiniteSpatialBounds(intent.nextBoundsWorld)) {
    return {
      ok: false,
      code: 'invalid-geometry',
      violations: [
        {
          invariant: 'INV-6',
          code: 'invalid-geometry',
          entityId: target.id,
          reasonDe: `Ungültige Ziel-Geometrie für „${target.labelDe}“.`,
        },
      ],
      reasonDe: `Ungültige Ziel-Bounds für „${target.labelDe}“.`,
    };
  }

  const relation = resolveRelation(world, target.id);
  const pad = Math.max(0, intent.growPadding ?? 0);
  const changes: SpatialEntityChange[] = [];
  const grownCarrierIds: string[] = [];
  const grownLabelsDe: string[] = [];
  const reroutedFlowingIds: string[] = [];
  const changedTopographyBounds = new Map<
    string,
    { readonly prev: SpatialBounds2D; readonly next: SpatialBounds2D }
  >();

  // Case A: freeland (river/road/coast) — depends on topography, NEVER grows topography (INV-5)
  if (isFreelandRelation(relation)) {
    const carrier = target.carrierId ? world.entities[target.carrierId] : null;
    const rawLine = intent.nextPolylineWorld ?? target.polylineWorld;
    if (!rawLine || rawLine.length < 2) {
      return {
        ok: false,
        code: 'invalid-geometry',
        violations: [
          {
            invariant: 'INV-2',
            code: 'empty-flowing-path',
            entityId: target.id,
            carrierId: target.carrierId,
            reasonDe: `Freiland-Struktur „${target.labelDe}“ (freeland) benötigt mindestens 2 Punkte.`,
          },
        ],
        reasonDe: `Freiland-Struktur „${target.labelDe}“ (freeland) hat keinen gültigen Pfad.`,
      };
    }
    const effectiveBounds = boundsFromPoints(rawLine) ?? intent.nextBoundsWorld;
    const clipped =
      carrier && !boundsContains(carrier.boundsWorld, effectiveBounds)
        ? clipPolylineInsideBounds(rawLine, carrier.boundsWorld)
        : [rawLine];
    const finalLine = clipped[0] ?? rawLine.map((pt) => (carrier ? clampPointToBounds(pt, carrier.boundsWorld) : pt));
    const finalBounds = boundsFromPoints(clipped.length > 0 ? clipped.flat() : finalLine) ?? effectiveBounds;

    changes.push({
      entityId: target.id,
      mapId: target.mapId,
      featureId: target.featureId,
      labelDe: target.labelDe,
      role: target.role,
      relation: 'freeland',
      kind: clipped.length > 0 && clipped[0] !== rawLine ? 'cap_flowing' : 'update_target',
      prevBoundsWorld: target.boundsWorld,
      nextBoundsWorld: finalBounds,
      nextPolylineWorld: finalLine,
      nextClippedSegmentsWorld: clipped.length > 0 ? clipped : [finalLine],
    });
    reroutedFlowingIds.push(target.id);

    return {
      ok: true,
      plan: {
        intent,
        targetEntityId: target.id,
        targetRelation: 'freeland',
        requiresConfirmation: 'none',
        grownCarrierIds: [],
        archivedDescendantIds: [],
        reroutedFlowingIds,
        cascadeCounts: { ...EMPTY_CASCADE_COUNTS, flowingAffected: 1 },
        changes,
        affectedMapIds: collectAffectedMapIds(changes),
        summaryDe: `Verlauf von „${target.labelDe}“ wird entlang der Topografie angepasst.`,
      },
    };
  }

  // Target geometry update (CONTAINED or CARVED)
  const targetNextPolygon =
    intent.nextPolygonWorld ??
    (target.polygonWorld
      ? remapPolygonToBounds(target.polygonWorld, target.boundsWorld, intent.nextBoundsWorld)
      : undefined);

  changes.push({
    entityId: target.id,
    mapId: target.mapId,
    featureId: target.featureId,
    labelDe: target.labelDe,
    role: target.role,
    relation,
    kind: 'update_target',
    prevBoundsWorld: target.boundsWorld,
    nextBoundsWorld: intent.nextBoundsWorld,
    ...(targetNextPolygon ? { nextPolygonWorld: targetNextPolygon } : {}),
  });

  if (TOPOGRAPHY_ROLES.has(target.role) || target.role === 'country' || target.role === 'settlement') {
    changedTopographyBounds.set(target.id, {
      prev: target.boundsWorld,
      next: intent.nextBoundsWorld,
    });
  }

  // Walk carrier chain upward (INV-3)
  const chainRes = resolveCarrierChain(world, target.id);
  if ('code' in chainRes) {
    return {
      ok: false,
      code: chainRes.code === 'carrier-cycle' ? 'cycle-rejected' : 'missing-carrier',
      violations: [
        {
          invariant: 'INV-2',
          code: chainRes.code,
          entityId: chainRes.atEntityId,
          reasonDe: `Träger-Kette ungültig (${chainRes.code}) bei „${chainRes.atEntityId}“.`,
        },
      ],
      reasonDe: `Träger-Kette ungültig (${chainRes.code}).`,
    };
  }

  let requiredBounds = intent.nextBoundsWorld;
  const ancestors = chainRes.chain.slice(1); // [directCarrier, grandCarrier, ..., root]

  for (let i = 0; i < ancestors.length; i += 1) {
    const carrier = ancestors[i]!;
    const isDirectCarvedMass = i === 0 && relation === 'CARVED';

    if (isDirectCarvedMass) {
      const nextCavity = carrier.cavityBoundsWorld
        ? boundsUnion(carrier.cavityBoundsWorld, requiredBounds)
        : requiredBounds;

      if (boundsContains(carrier.boundsWorld, requiredBounds)) {
        // SCM-03: Hollow out solid mass WITHOUT changing outer contour! Stop upward escalation.
        changes.push({
          entityId: carrier.id,
          mapId: carrier.mapId,
          featureId: carrier.featureId,
          labelDe: carrier.labelDe,
          role: carrier.role,
          relation: resolveRelation(world, carrier.id),
          kind: 'carve_cavity',
          prevBoundsWorld: carrier.boundsWorld,
          nextBoundsWorld: carrier.boundsWorld,
          nextCavityBoundsWorld: nextCavity,
        });
        break;
      }

      // SCM-03 outer breach: hollow cavity AND expand outer contour of solid mass, then escalate!
      const nextCarrierBounds = expandBoundsToFit(carrier.boundsWorld, requiredBounds, pad);
      const nextCarrierPoly = carrier.polygonWorld
        ? remapPolygonToBounds(carrier.polygonWorld, carrier.boundsWorld, nextCarrierBounds)
        : undefined;
      changes.push({
        entityId: carrier.id,
        mapId: carrier.mapId,
        featureId: carrier.featureId,
        labelDe: carrier.labelDe,
        role: carrier.role,
        relation: resolveRelation(world, carrier.id),
        kind: 'grow_carrier',
        prevBoundsWorld: carrier.boundsWorld,
        nextBoundsWorld: nextCarrierBounds,
        ...(nextCarrierPoly ? { nextPolygonWorld: nextCarrierPoly } : {}),
        nextCavityBoundsWorld: nextCavity,
      });
      grownCarrierIds.push(carrier.id);
      grownLabelsDe.push(carrier.labelDe);
      changedTopographyBounds.set(carrier.id, {
        prev: carrier.boundsWorld,
        next: nextCarrierBounds,
      });
      requiredBounds = nextCarrierBounds;
      continue;
    }

    // Standard CONTAINED upward check: STOP at first ancestor that accommodates without growing (INV-3)
    if (boundsContains(carrier.boundsWorld, requiredBounds)) {
      break;
    }

    const nextCarrierBounds = expandBoundsToFit(carrier.boundsWorld, requiredBounds, pad);
    const nextCarrierPoly = carrier.polygonWorld
      ? remapPolygonToBounds(carrier.polygonWorld, carrier.boundsWorld, nextCarrierBounds)
      : undefined;
    changes.push({
      entityId: carrier.id,
      mapId: carrier.mapId,
      featureId: carrier.featureId,
      labelDe: carrier.labelDe,
      role: carrier.role,
      relation: resolveRelation(world, carrier.id),
      kind: 'grow_carrier',
      prevBoundsWorld: carrier.boundsWorld,
      nextBoundsWorld: nextCarrierBounds,
      ...(nextCarrierPoly ? { nextPolygonWorld: nextCarrierPoly } : {}),
    });
    grownCarrierIds.push(carrier.id);
    grownLabelsDe.push(carrier.labelDe);
    changedTopographyBounds.set(carrier.id, {
      prev: carrier.boundsWorld,
      next: nextCarrierBounds,
    });
    requiredBounds = nextCarrierBounds;
  }

  // SCM-04: Reconcile any active freeland entities crossing changed topography/landmasses
  if (changedTopographyBounds.size > 0) {
    for (const entity of Object.values(world.entities)) {
      if (entity.status !== 'active') continue;
      if (!isFreelandRelation(resolveRelation(world, entity.id))) continue;
      // Find first changed carrier/landmass matching this freeland entity
      let delta = entity.carrierId ? changedTopographyBounds.get(entity.carrierId) : undefined;
      if (!delta) {
        for (const [, entry] of changedTopographyBounds) {
          if (boundsIntersects(entry.prev, entity.boundsWorld) || boundsIntersects(entry.next, entity.boundsWorld)) {
            delta = entry;
            break;
          }
        }
      }
      if (!delta) continue;
      const rerouted = reconcileFlowingAgainstGrownOrChangedBounds(entity, delta.prev, delta.next);
      if (!rerouted) continue;
      changes.push({
        entityId: entity.id,
        mapId: entity.mapId,
        featureId: entity.featureId,
        labelDe: entity.labelDe,
        role: entity.role,
        relation: 'freeland',
        kind: rerouted.kind,
        prevBoundsWorld: entity.boundsWorld,
        nextBoundsWorld: rerouted.nextBounds,
        nextPolylineWorld: rerouted.nextPolyline,
        nextClippedSegmentsWorld: rerouted.nextSegments,
      });
      reroutedFlowingIds.push(entity.id);
    }
  }

  return {
    ok: true,
    plan: {
      intent,
      targetEntityId: target.id,
      targetRelation: relation,
      requiresConfirmation: grownCarrierIds.length > 0 ? 'grow' : 'none',
      grownCarrierIds,
      archivedDescendantIds: [],
      reroutedFlowingIds,
      cascadeCounts: {
        ...EMPTY_CASCADE_COUNTS,
        flowingAffected: reroutedFlowingIds.length,
      },
      changes,
      affectedMapIds: collectAffectedMapIds(changes),
      summaryDe: buildGrowthSummaryDe(target.labelDe, grownLabelsDe),
    },
  };
}

function planReparent(
  world: SpatialWorldModel,
  target: SpatialEntityNode,
  intent: Extract<SpatialEditIntent, { kind: 'reparent' }>,
): SpatialPropagationPlanResult {
  if (intent.nextCarrierId === target.id) {
    return {
      ok: false,
      code: 'cycle-rejected',
      violations: [
        {
          invariant: 'INV-2',
          code: 'carrier-cycle',
          entityId: target.id,
          carrierId: intent.nextCarrierId,
          reasonDe: `Selbst-Zyklus abgelehnt: „${target.labelDe}“ kann nicht sein eigener Träger sein.`,
        },
      ],
      reasonDe: `Selbst-Zyklus abgelehnt: „${target.labelDe}“ kann nicht sein eigener Träger sein.`,
    };
  }

  const nextCarrier = world.entities[intent.nextCarrierId];
  if (!nextCarrier) {
    return {
      ok: false,
      code: 'missing-carrier',
      violations: [
        {
          invariant: 'INV-2',
          code: 'missing-carrier',
          entityId: target.id,
          carrierId: intent.nextCarrierId,
          reasonDe: `Ziel-Träger „${intent.nextCarrierId}“ existiert nicht.`,
        },
      ],
      reasonDe: `Ziel-Träger „${intent.nextCarrierId}“ existiert nicht.`,
    };
  }
  if (nextCarrier.status === 'archived') {
    return {
      ok: false,
      code: 'entity-archived',
      violations: [
        {
          invariant: 'INV-4',
          code: 'active-child-in-archived-carrier',
          entityId: target.id,
          carrierId: nextCarrier.id,
          reasonDe: `Ziel-Träger „${nextCarrier.labelDe}“ ist archiviert.`,
        },
      ],
      reasonDe: `Ziel-Träger „${nextCarrier.labelDe}“ ist archiviert.`,
    };
  }

  // INV-5: Topography cannot be reparented under river/road/building/room/prop
  if (
    TOPOGRAPHY_ROLES.has(target.role) &&
    FORBIDDEN_CARRIERS_FOR_TOPOGRAPHY.has(nextCarrier.role)
  ) {
    return {
      ok: false,
      code: 'topography-inversion-rejected',
      violations: [
        {
          invariant: 'INV-5',
          code: 'topography-dependency-inverted',
          entityId: target.id,
          carrierId: nextCarrier.id,
          reasonDe: `Topografie „${target.labelDe}“ darf nicht unter „${nextCarrier.labelDe}“ (${nextCarrier.role}) liegen.`,
        },
      ],
      reasonDe: `INV-5 verletzt: Topografie „${target.labelDe}“ darf nicht von „${nextCarrier.labelDe}“ abhängen.`,
    };
  }

  // Cycle check: walk from nextCarrier up to root; if target.id appears → cycle! (SCM-08)
  const carrierChain = resolveCarrierChain(world, nextCarrier.id);
  if (!carrierChain.ok || carrierChain.chain.some((n) => n.id === target.id)) {
    return {
      ok: false,
      code: 'cycle-rejected',
      violations: [
        {
          invariant: 'INV-2',
          code: 'carrier-cycle',
          entityId: target.id,
          carrierId: nextCarrier.id,
          reasonDe: `Zyklus abgelehnt: „${nextCarrier.labelDe}“ liegt bereits unterhalb von „${target.labelDe}“.`,
        },
      ],
      reasonDe: `Zyklus im Containment-Graphen abgelehnt (SCM-08 / INV-2).`,
    };
  }

  // Simulate reparent and check upward growth along new carrier chain
  const pad = Math.max(0, intent.growPadding ?? 0);
  const relation = resolveRelation(world, target.id);
  const changes: SpatialEntityChange[] = [
    {
      entityId: target.id,
      mapId: target.mapId,
      featureId: target.featureId,
      labelDe: target.labelDe,
      role: target.role,
      relation,
      kind: 'reparent_entity',
      prevBoundsWorld: target.boundsWorld,
      nextBoundsWorld: target.boundsWorld,
      nextCarrierId: nextCarrier.id,
    },
  ];
  const grownCarrierIds: string[] = [];
  const grownLabelsDe: string[] = [];

  if (!isFreelandRelation(relation)) {
    let required = target.boundsWorld;
    for (const anc of carrierChain.chain) {
      if (boundsContains(anc.boundsWorld, required)) break;
      const expanded = expandBoundsToFit(anc.boundsWorld, required, pad);
      changes.push({
        entityId: anc.id,
        mapId: anc.mapId,
        featureId: anc.featureId,
        labelDe: anc.labelDe,
        role: anc.role,
        relation: resolveRelation(world, anc.id),
        kind: 'grow_carrier',
        prevBoundsWorld: anc.boundsWorld,
        nextBoundsWorld: expanded,
        ...(anc.polygonWorld
          ? { nextPolygonWorld: remapPolygonToBounds(anc.polygonWorld, anc.boundsWorld, expanded) }
          : {}),
      });
      grownCarrierIds.push(anc.id);
      grownLabelsDe.push(anc.labelDe);
      required = expanded;
    }
  }

  return {
    ok: true,
    plan: {
      intent,
      targetEntityId: target.id,
      targetRelation: relation,
      requiresConfirmation: grownCarrierIds.length > 0 ? 'grow' : 'none',
      grownCarrierIds,
      archivedDescendantIds: [],
      reroutedFlowingIds: [],
      cascadeCounts: EMPTY_CASCADE_COUNTS,
      changes,
      affectedMapIds: collectAffectedMapIds(changes),
      summaryDe:
        grownLabelsDe.length > 0
          ? buildGrowthSummaryDe(target.labelDe, grownLabelsDe)
          : `„${target.labelDe}“ wird „${nextCarrier.labelDe}“ zugeordnet.`,
    },
  };
}

// ─── Atomic Apply with Pre-/Post-Invariant Verification & Rollback (INV-6) ───

/**
 * Apply a `WorldOperationPlan` atomically.
 * Checks Pre- and Post-Invariants (`validateSpatialInvariants`).
 * If ANY invariant fails after applying changes, rolls back cleanly and returns
 * the untouched input `world` (INV-6 fail-closed guarantee).
 */
export function applyWorldOperation(
  world: SpatialWorldModel,
  plan: WorldOperationPlan,
): ApplyWorldOperationResult {
  const pre = validateSpatialInvariants(world);
  if (!pre.ok) {
    return {
      ok: false,
      world,
      code: 'pre-invariant-failed',
      violations: pre.violations,
      reasonDe: `Transaktion abgebrochen: Vorbedingung verletzt (${pre.violations[0]?.reasonDe ?? 'Invarianten-Fehler'}).`,
    };
  }

  const nextEntities: Record<string, SpatialEntityNode> = { ...world.entities };
  for (const ch of plan.changes) {
    const existing = nextEntities[ch.entityId];
    if (!existing) continue;
    nextEntities[ch.entityId] = {
      ...existing,
      boundsWorld: ch.nextBoundsWorld,
      ...(ch.nextPolygonWorld !== undefined ? { polygonWorld: ch.nextPolygonWorld } : {}),
      ...(ch.nextPolylineWorld !== undefined ? { polylineWorld: ch.nextPolylineWorld } : {}),
      ...(ch.nextClippedSegmentsWorld !== undefined
        ? { clippedSegmentsWorld: ch.nextClippedSegmentsWorld }
        : {}),
      ...(ch.nextCavityBoundsWorld !== undefined
        ? { cavityBoundsWorld: ch.nextCavityBoundsWorld }
        : {}),
      ...(ch.nextCarrierId !== undefined ? { carrierId: ch.nextCarrierId } : {}),
      ...(ch.nextStatus !== undefined ? { status: ch.nextStatus } : {}),
      ...(ch.archivedByEntityId !== undefined ? { archivedByEntityId: ch.archivedByEntityId } : {}),
      ...(ch.archivedReasonDe !== undefined ? { archivedReasonDe: ch.archivedReasonDe } : {}),
    };
  }

  const nextWorld: SpatialWorldModel = {
    ...world,
    entities: nextEntities,
  };

  const post = validateSpatialInvariants(nextWorld);
  if (!post.ok) {
    // INV-6 fail-closed rollback: return untouched original `world`
    return {
      ok: false,
      world,
      code: 'post-invariant-failed',
      violations: post.violations,
      reasonDe: `Transaktion zurückgerollt: Nachbedingung verletzt (${post.violations[0]?.reasonDe ?? 'Invarianten-Fehler'}).`,
    };
  }

  return {
    ok: true,
    world: nextWorld,
    appliedChangeCount: plan.changes.length,
    affectedMapIds: plan.affectedMapIds,
  };
}
