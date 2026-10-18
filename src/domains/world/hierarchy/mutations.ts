/**
 * mutations — Pure validators for world-node rename/reparent/archive (#716).
 * Location: src/domains/world/hierarchy/mutations.ts
 */
import { assertHierarchyEdge, statusAfterRename } from './world-hierarchy';
import {
  isWorldNodeKind,
  isWorldNodeStatus,
  type WorldNodeKind,
  type WorldNodeStatus,
} from './world-node.types';

export type ReparentPlanInput = {
  readonly childKind: WorldNodeKind;
  readonly childId: string;
  readonly newParentId: string | null;
  readonly newParentKind: WorldNodeKind | null;
  /** All descendant place ids of the child (not including child). */
  readonly childDescendantIds: readonly string[];
};

export type ReparentPlan =
  | { readonly ok: true; readonly requiresRelocate: true }
  | { readonly ok: false; readonly reason: string };

/** Rename: trim name; derive next status (placeholder→draft). */
export function planRenameStatus(
  current: WorldNodeStatus,
  nextName: string,
): { readonly ok: true; readonly status: WorldNodeStatus; readonly name: string } | {
  readonly ok: false;
  readonly reason: string;
} {
  if (!isWorldNodeStatus(current)) return { ok: false, reason: 'unknown_status' };
  const name = nextName.trim();
  if (!name) return { ok: false, reason: 'empty_name' };
  return { ok: true, status: statusAfterRename(current), name };
}

/** True when moving child under newParent would create a cycle. */
export function wouldCreateReparentCycle(input: {
  readonly childId: string;
  readonly newParentId: string | null;
  readonly childDescendantIds: readonly string[];
}): boolean {
  if (input.newParentId === null) return false;
  if (input.newParentId === input.childId) return true;
  return input.childDescendantIds.includes(input.newParentId);
}

/**
 * Validate a reparent edge. Spatial relocate is always required when parent changes
 * (map parent chain updates + unlocated) — UI confirms via RPC flag.
 */
export function planReparent(input: ReparentPlanInput): ReparentPlan {
  if (!isWorldNodeKind(input.childKind)) {
    return { ok: false, reason: 'unknown_child_kind' };
  }
  if (input.newParentKind !== null && !isWorldNodeKind(input.newParentKind)) {
    return { ok: false, reason: 'unknown_parent_kind' };
  }
  const edge = assertHierarchyEdge(input.childKind, input.newParentKind);
  if (edge.ok === false) {
    return { ok: false, reason: edge.reason };
  }
  if (
    wouldCreateReparentCycle({
      childId: input.childId,
      newParentId: input.newParentId,
      childDescendantIds: input.childDescendantIds,
    })
  ) {
    return { ok: false, reason: 'cycle' };
  }
  return { ok: true, requiresRelocate: true };
}

export type MutationConsequences = {
  readonly childCount: number;
  readonly sagaBindingCount: number;
  readonly requiresConfirm: boolean;
};

export function buildMutationConsequences(input: {
  readonly childCount: number;
  readonly sagaBindingCount: number;
}): MutationConsequences {
  const childCount = Math.max(0, input.childCount);
  const sagaBindingCount = Math.max(0, input.sagaBindingCount);
  return {
    childCount,
    sagaBindingCount,
    requiresConfirm: childCount > 0 || sagaBindingCount > 0,
  };
}
