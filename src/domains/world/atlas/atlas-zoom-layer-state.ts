/**
 * atlas-zoom-layer-state — SCM-05: Pure Zoom-Driven Layer Hierarchy Indicator (SCM-07).
 * Location: src/domains/world/atlas/atlas-zoom-layer-state.ts
 *
 * Pure domain — NO React, NO Three.js, NO DOM (BR-005).
 *
 * Implements `.qa/design/sws-containment-model.md` §8:
 * The layer tree indicator is a pure function of `AtlasWorldCameraState` + active
 * `AtlasWorldScenePlan.activeEditorMapId`, NOT a manual collapsible state.
 */

export type AtlasZoomLayerNavNode = {
  readonly id: string;
  readonly label: string;
  readonly sub?: string;
  readonly parentId: string | null;
  readonly primaryMapId: string | null;
};

export type AtlasZoomLayerState = {
  readonly activeMapId: string | null;
  readonly activePlaceId: string | null;
  readonly isWorldRoot: boolean;
  readonly activeLabelDe: string;
  /** 1 = Welt, 2 = Kontinent, 3 = Land, 4 = Ort, 5 = Gebäude, 6 = Raum. */
  readonly activeDepth: number;
  /** Ordered ancestor place IDs from topmost child down to `activePlaceId`. */
  readonly activeBreadcrumbPlaceIds: readonly string[];
};

/**
 * Derive the highlighted layer node & breadcrumb trail strictly from the camera-driven
 * `activeEditorMapId` (from `AtlasWorldScenePlan`) and the persisted hierarchy tree.
 */
export function deriveZoomLayerHierarchyState(input: {
  readonly activeEditorMapId: string | null;
  readonly worldRootMapId: string | null;
  readonly worldLabelDe: string;
  readonly nodes: readonly AtlasZoomLayerNavNode[];
  readonly fallbackPlaceId?: string | null;
}): AtlasZoomLayerState {
  const { activeEditorMapId, worldRootMapId, worldLabelDe, nodes, fallbackPlaceId = null } = input;
  const byId = new Map<string, AtlasZoomLayerNavNode>();
  const byPrimaryMapId = new Map<string, AtlasZoomLayerNavNode>();
  for (const n of nodes) {
    byId.set(n.id, n);
  }
  // Prefer the shallowest/owner node for each primaryMapId (so e.g. `Dornhain` is never
  // overwritten by a child landmark like `Whisper Road` that shares Dornhain's map).
  for (const n of nodes) {
    if (!n.primaryMapId) continue;
    const parent = n.parentId ? byId.get(n.parentId) : null;
    const parentSharesMap = Boolean(parent && parent.primaryMapId === n.primaryMapId);
    if (!byPrimaryMapId.has(n.primaryMapId) && !parentSharesMap) {
      byPrimaryMapId.set(n.primaryMapId, n);
    }
  }
  for (const n of nodes) {
    if (n.primaryMapId && !byPrimaryMapId.has(n.primaryMapId)) {
      byPrimaryMapId.set(n.primaryMapId, n);
    }
  }

  let matched: AtlasZoomLayerNavNode | null = null;
  if (activeEditorMapId && activeEditorMapId !== worldRootMapId) {
    matched = byPrimaryMapId.get(activeEditorMapId) ?? null;
  } else if (!activeEditorMapId && fallbackPlaceId) {
    matched = byId.get(fallbackPlaceId) ?? null;
  }

  if (!matched) {
    return {
      activeMapId: activeEditorMapId ?? worldRootMapId ?? null,
      activePlaceId: null,
      isWorldRoot: true,
      activeLabelDe: worldLabelDe || 'Welt',
      activeDepth: 1,
      activeBreadcrumbPlaceIds: [],
    };
  }

  // Walk parentId chain safely (cycle-guarded) to compute depth & breadcrumb trail
  const trail: string[] = [];
  const visited = new Set<string>();
  let cur: AtlasZoomLayerNavNode | undefined = matched;
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    trail.unshift(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }

  return {
    activeMapId: activeEditorMapId ?? matched.primaryMapId ?? null,
    activePlaceId: matched.id,
    isWorldRoot: false,
    activeLabelDe: matched.label,
    activeDepth: 1 + trail.length,
    activeBreadcrumbPlaceIds: trail,
  };
}
