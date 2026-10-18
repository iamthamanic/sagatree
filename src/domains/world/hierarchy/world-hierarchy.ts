/**
 * world-hierarchy — Parent matrix, ranks, DE labels (Epic #712 / #714).
 * Location: src/domains/world/hierarchy/world-hierarchy.ts
 */
import {
  WORLD_NODE_KINDS,
  WORLD_NODE_LABELS_DE,
  isWorldNodeKind,
  type WorldNodeKind,
  type WorldNodeStatus,
} from './world-node.types';

/** Strict organizational rank (lower = higher in tree). World root = -1 (virtual). */
export function worldNodeRank(kind: WorldNodeKind): number {
  return WORLD_NODE_KINDS.indexOf(kind);
}

export function labelDeForKind(kind: WorldNodeKind): (typeof WORLD_NODE_LABELS_DE)[number] {
  const hit = WORLD_NODE_LABELS_DE.find((row) => row.kind === kind);
  if (!hit) {
    throw new Error(`missing DE label for WorldNodeKind ${kind}`);
  }
  return hit;
}

/**
 * Immediate required parent kind for a child.
 * Continent parents the WorldProfile (null place parent).
 */
export function requiredParentKind(child: WorldNodeKind): WorldNodeKind | null {
  if (child === 'continent') return null;
  if (child === 'country') return 'continent';
  if (child === 'place') return 'country';
  if (child === 'building') return 'place';
  return 'building';
}

/**
 * Whether `parentKind` may be the immediate parent of `childKind`.
 * Pass `parentKind = null` only for continent (world-profile root).
 */
export function isAllowedParent(
  childKind: WorldNodeKind,
  parentKind: WorldNodeKind | null,
): boolean {
  const required = requiredParentKind(childKind);
  if (required === null) return parentKind === null;
  return parentKind === required;
}

/** Reject self-parent and any non-immediate / cross-level edge. */
export function assertHierarchyEdge(
  childKind: WorldNodeKind,
  parentKind: WorldNodeKind | null,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (!isWorldNodeKind(childKind)) {
    return { ok: false, reason: 'unknown_child_kind' };
  }
  if (parentKind !== null && !isWorldNodeKind(parentKind)) {
    return { ok: false, reason: 'unknown_parent_kind' };
  }
  if (parentKind !== null && parentKind === childKind) {
    return { ok: false, reason: 'self_parent' };
  }
  if (!isAllowedParent(childKind, parentKind)) {
    return {
      ok: false,
      reason: `expected_parent_${requiredParentKind(childKind) ?? 'world_profile'}`,
    };
  }
  return { ok: true };
}

/** Default sibling sort key among kinds (category order never changes). */
export function kindSiblingOrder(kind: WorldNodeKind): number {
  return worldNodeRank(kind);
}

/**
 * Placeholder rename → draft. Canonical only via explicit promotion (later RPCs).
 * Pure status transition helper — no persistence.
 */
export function statusAfterRename(current: WorldNodeStatus): WorldNodeStatus {
  if (current === 'placeholder') return 'draft';
  return current;
}

export function canPromoteToCanonical(current: WorldNodeStatus): boolean {
  return current === 'draft' || current === 'placeholder';
}

/** Neutral placeholder name stem (DE); numbering is sibling-scoped at RPC time. */
export function placeholderNameStem(kind: WorldNodeKind): string {
  if (kind === 'continent') return 'Unbenannter Kontinent';
  if (kind === 'country') return 'Unbenanntes Land';
  if (kind === 'place') return 'Unbenannter Ort';
  if (kind === 'building') return 'Unbenanntes Gebäude';
  return 'Unbenannter Raum';
}

/**
 * Missing ancestors from a desired child up to (but not including) an existing tip.
 * When tip is null, returns full chain continent→…→parent of child.
 */
export function missingAncestorKinds(
  childKind: WorldNodeKind,
  existingTipKind: WorldNodeKind | null,
): readonly WorldNodeKind[] {
  const chain: WorldNodeKind[] = [];
  let cursor: WorldNodeKind | null = requiredParentKind(childKind);
  while (cursor !== null) {
    if (existingTipKind !== null && worldNodeRank(cursor) <= worldNodeRank(existingTipKind)) {
      break;
    }
    chain.unshift(cursor);
    cursor = requiredParentKind(cursor);
  }
  return chain;
}
