/**
 * primary-map-links — Six-level primary-map + WorldNode parent invariants (ATL2-E01 / #1219).
 * Location: src/domains/world/hierarchy/primary-map-links.ts
 *
 * Pure rules: world root map + continent→country→place→building→room each own
 * exactly one primary map; child map.parentMapId equals parent primary (or world root).
 */
import { assertHierarchyEdge, requiredParentKind, worldNodeRank } from './world-hierarchy';
import {
  isSubtypeForKind,
  isWorldNodeKind,
  WORLD_NODE_KINDS,
  type WorldNodeKind,
  type WorldNodeSubtype,
} from './world-node.types';

/** Six product levels including the virtual world root (no world_places row). */
export const ATLAS_HIERARCHY_LEVELS = [
  'world',
  'continent',
  'country',
  'place',
  'building',
  'room',
] as const;

export type AtlasHierarchyLevel = (typeof ATLAS_HIERARCHY_LEVELS)[number];

export type PrimaryMapNodeLink = {
  readonly placeId: string;
  readonly kind: WorldNodeKind;
  readonly parentPlaceId: string | null;
  readonly primaryMapId: string;
  /** world_atlas_maps.parent_map_id for the primary map */
  readonly primaryMapParentId: string | null;
};

export type PrimaryMapLinkGraph = {
  readonly worldProfileId: string;
  readonly worldRootMapId: string;
  readonly nodes: readonly PrimaryMapNodeLink[];
};

export type PrimaryMapLinkCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string; readonly placeId?: string };

/**
 * Expected parent_map_id for a node's primary map.
 * Continent (or null parent) → world root. Deeper nodes require the parent's
 * primary map — missing parent primary fails closed (no silent root skip).
 */
export function expectedPrimaryMapParentId(input: {
  readonly kind: WorldNodeKind;
  readonly parentPlaceId: string | null;
  readonly parentPrimaryMapId: string | null;
  readonly worldRootMapId: string;
}): { readonly ok: true; readonly parentMapId: string } | { readonly ok: false; readonly reason: string } {
  if (input.kind === 'continent' || input.parentPlaceId == null) {
    const root = input.worldRootMapId.trim();
    if (!root) return { ok: false, reason: 'missing_world_root_map' };
    return { ok: true, parentMapId: root };
  }
  const parentPrimary =
    typeof input.parentPrimaryMapId === 'string' ? input.parentPrimaryMapId.trim() : '';
  if (!parentPrimary) {
    return { ok: false, reason: 'missing_parent_primary_map' };
  }
  return { ok: true, parentMapId: parentPrimary };
}

/** Reject unknown / mismatched subtype for Place/Building/Room/Country. */
export function assertCreateSubtype(
  kind: WorldNodeKind,
  subtype: unknown,
): PrimaryMapLinkCheck {
  if (subtype == null || subtype === '') return { ok: true };
  if (!isSubtypeForKind(kind, subtype)) {
    return { ok: false, reason: 'subtype_mismatch' };
  }
  return { ok: true };
}

/**
 * Validate a persisted six-level (or partial) primary-map graph.
 * - Every node has a non-empty primaryMapId
 * - Hierarchy edges obey assertHierarchyEdge (no skip / self-parent)
 * - Continent primary parents world root; deeper nodes parent parent's primary
 * - No duplicate place or primary map ids
 */
export function assertPrimaryMapLinkGraph(graph: PrimaryMapLinkGraph): PrimaryMapLinkCheck {
  const worldRoot = typeof graph.worldRootMapId === 'string' ? graph.worldRootMapId.trim() : '';
  if (!worldRoot) return { ok: false, reason: 'missing_world_root_map' };

  const byId = new Map<string, PrimaryMapNodeLink>();
  const primaryMaps = new Set<string>();

  for (const node of graph.nodes) {
    if (!isWorldNodeKind(node.kind)) {
      return { ok: false, reason: 'unknown_kind', placeId: node.placeId };
    }
    const placeId = node.placeId.trim();
    const primaryMapId = node.primaryMapId.trim();
    if (!placeId) return { ok: false, reason: 'empty_place_id' };
    if (!primaryMapId) {
      return { ok: false, reason: 'missing_primary_map', placeId };
    }
    if (byId.has(placeId)) {
      return { ok: false, reason: 'duplicate_place', placeId };
    }
    if (primaryMaps.has(primaryMapId)) {
      return { ok: false, reason: 'duplicate_primary_map', placeId };
    }
    if (primaryMapId === worldRoot) {
      return { ok: false, reason: 'primary_equals_world_root', placeId };
    }
    byId.set(placeId, node);
    primaryMaps.add(primaryMapId);
  }

  for (const node of byId.values()) {
    const parent = node.parentPlaceId ? byId.get(node.parentPlaceId) : null;
    const parentKind: WorldNodeKind | null = parent ? parent.kind : null;
    if (node.parentPlaceId && !parent) {
      // Parent may be outside the snapshot — still require map parent when parent is present.
      // Cross-snapshot parents are host-enforced; domain only checks edges when parent is known.
    } else {
      const edge = assertHierarchyEdge(node.kind, parentKind);
      if (edge.ok === false) {
        return { ok: false, reason: edge.reason, placeId: node.placeId };
      }
    }

    // When parent is in-graph (or root continent), parent_map_id must match exactly.
    if (node.parentPlaceId == null || parent) {
      const expected = expectedPrimaryMapParentId({
        kind: node.kind,
        parentPlaceId: node.parentPlaceId,
        parentPrimaryMapId: parent?.primaryMapId ?? null,
        worldRootMapId: worldRoot,
      });
      if (expected.ok === false) {
        return { ok: false, reason: expected.reason, placeId: node.placeId };
      }
      if (node.primaryMapParentId !== expected.parentMapId) {
        return { ok: false, reason: 'primary_map_parent_mismatch', placeId: node.placeId };
      }
    }
  }

  return { ok: true };
}

/**
 * True when `nodes` contain a contiguous path from continent… to `tipKind`
 * with correct immediate parents (used for Golden / create proofs).
 */
export function assertContiguousHierarchyPath(
  nodes: readonly Pick<PrimaryMapNodeLink, 'kind' | 'parentPlaceId' | 'placeId'>[],
  tipKind: WorldNodeKind,
): PrimaryMapLinkCheck {
  if (!isWorldNodeKind(tipKind)) return { ok: false, reason: 'unknown_kind' };
  const tip = nodes.find((n) => n.kind === tipKind);
  if (!tip) return { ok: false, reason: 'missing_tip' };

  let cursor: (typeof nodes)[number] | undefined = tip;
  let expectedParent: WorldNodeKind | null = requiredParentKind(tipKind);
  const seen = new Set<string>();

  while (cursor) {
    if (seen.has(cursor.placeId)) return { ok: false, reason: 'cycle', placeId: cursor.placeId };
    seen.add(cursor.placeId);
    if (expectedParent === null) {
      if (cursor.parentPlaceId != null) {
        return { ok: false, reason: 'continent_must_root', placeId: cursor.placeId };
      }
      break;
    }
    if (!cursor.parentPlaceId) {
      return { ok: false, reason: 'missing_parent', placeId: cursor.placeId };
    }
    const parent = nodes.find((n) => n.placeId === cursor!.parentPlaceId);
    if (!parent) return { ok: false, reason: 'parent_not_in_path', placeId: cursor.placeId };
    if (parent.kind !== expectedParent) {
      return { ok: false, reason: 'level_skip', placeId: cursor.placeId };
    }
    expectedParent = requiredParentKind(parent.kind);
    cursor = parent;
  }

  return { ok: true };
}

/** Ordered kinds from continent to room (excludes virtual world). */
export function canonicalNodeKindChain(): readonly WorldNodeKind[] {
  return WORLD_NODE_KINDS;
}

export function hierarchyLevelRank(level: AtlasHierarchyLevel): number {
  return ATLAS_HIERARCHY_LEVELS.indexOf(level);
}

export function nodeKindToHierarchyLevel(kind: WorldNodeKind): AtlasHierarchyLevel {
  return kind;
}

/** Immutable identity: rename/reparent must keep placeId and primaryMapId. */
export function assertImmutableNodeIdentity(input: {
  readonly beforePlaceId: string;
  readonly afterPlaceId: string;
  readonly beforePrimaryMapId: string;
  readonly afterPrimaryMapId: string;
}): PrimaryMapLinkCheck {
  if (input.beforePlaceId !== input.afterPlaceId) {
    return { ok: false, reason: 'place_id_changed' };
  }
  if (input.beforePrimaryMapId !== input.afterPrimaryMapId) {
    return { ok: false, reason: 'primary_map_id_changed' };
  }
  return { ok: true };
}

export function isDeeperKind(a: WorldNodeKind, b: WorldNodeKind): boolean {
  return worldNodeRank(a) > worldNodeRank(b);
}

export type { WorldNodeSubtype };
