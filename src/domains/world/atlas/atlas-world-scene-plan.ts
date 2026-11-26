/**
 * atlas-world-scene-plan — SWS-03: Renderer-independent Multi-Map Scene Plan + Continuous LOD.
 * Location: src/domains/world/atlas/atlas-world-scene-plan.ts
 *
 * Pure domain — no React / Three.js / DOM / Host.
 *
 * ADR-SWS-01 §5 & §6:
 *  - Consumes the map graph + `AtlasWorldCameraState` + viewport dimensions.
 *  - Composes exact world transforms via SWS-01 `resolveWorldChain` / `localToWorld`.
 *  - Drives LOD via camera Screen-Space Error (SSE) with hysteresis (`sseRefinePx > sseCoarsenPx`),
 *    NOT breadcrumb depth.
 *  - Emits Replacement-Refinement cutouts (`cutoutRectsLocal`) on parents when detailed
 *    children take over, preventing duplicate geometry / Z-fighting (Checklist D4).
 *  - Decouples `activeEditorMapId` (editor context) from rendered groups (Checklist D5).
 *  - Enforces Multi-Map budget (`maxActiveMaps`, default 6 per Vertical Slice A.2)
 *    and excludes unlocated / broken-chain maps honestly (Checklist A5).
 */
import type { AtlasWorldCameraState } from './atlas-world-camera';
import {
  isAtlasWorldError,
  localToWorld,
  resolveWorldChain,
  type AtlasWorldSpaceNode,
  type AtlasWorldTransformError,
} from './atlas-world-space';
import { parentAnchorAabb, type MapSketchStatus, type ParentSpatialAnchor } from './map-frame';
import { DEFAULT_ATLAS_BOUNDS, type WorldAtlasBounds } from './world-atlas.types';

export type AtlasWorldSceneMapInput = AtlasWorldSpaceNode & {
  readonly status?: MapSketchStatus;
  readonly isPortal?: boolean;
};

export type AtlasWorldTransform2D = {
  /** World-space position of the map's local center (500, 500 for default bounds). */
  readonly centerX: number;
  readonly centerY: number;
  /** World units per local unit along X and Y. */
  readonly scaleX: number;
  readonly scaleY: number;
  /** Total accumulated rotation in world plane (radians). */
  readonly rotationRad: number;
  /** World-space span (max of width, height) of the entire map frame. */
  readonly worldSpan: number;
};

export type AtlasWorldAabb = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

export type AtlasLocalCutoutRect = {
  readonly childMapId: string;
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

export type AtlasSceneMapLodState = 'coarse' | 'active';

export type AtlasWorldSceneGroupPlan = {
  readonly mapId: string;
  readonly parentMapId: string | null;
  readonly depth: number;
  readonly lodState: AtlasSceneMapLodState;
  readonly ssePx: number;
  /** 0..1 opacity / detail blend factor for smooth additive fade-in. */
  readonly detailWeight: number;
  readonly worldTransform: AtlasWorldTransform2D;
  readonly worldAabb: AtlasWorldAabb;
  /**
   * Local-space rects on THIS map where an active child replaces coarse parent
   * geometry (Replacement-Refinement against Z-fighting, ADR-SWS-01 §5.2 / D4).
   */
  readonly cutoutRectsLocal: readonly AtlasLocalCutoutRect[];
};

export type AtlasWorldSceneExclusionReason =
  | AtlasWorldTransformError
  | 'culled'
  | 'portal'
  | 'below-sse'
  | 'budget';

export type AtlasWorldSceneExclusion = {
  readonly mapId: string;
  readonly reason: AtlasWorldSceneExclusionReason;
};

export type AtlasWorldScenePlanConfig = {
  /** Maximum simultaneously rendered maps (Vertical Slice A.2 default = 6). */
  readonly maxActiveMaps: number;
  /** Screen-space span (px) above which a child map refines into view. */
  readonly sseRefinePx: number;
  /** Screen-space span (px) below which an already-active child coarsens out (hysteresis). */
  readonly sseCoarsenPx: number;
  /** Screen-space span (px) above which a child punches a replacement cutout on its parent. */
  readonly sseReplaceParentPx: number;
  /** Extra frustum padding ratio around camera view AABB for prefetch/continuity. */
  readonly frustumPadRatio: number;
};

export const DEFAULT_ATLAS_WORLD_SCENE_PLAN_CONFIG: AtlasWorldScenePlanConfig = {
  maxActiveMaps: 6,
  sseRefinePx: 140,
  sseCoarsenPx: 95,
  sseReplaceParentPx: 220,
  frustumPadRatio: 0.35,
};

export type AtlasWorldScenePlan = {
  readonly rootMapId: string | null;
  /** Deepest visible active map containing camera focus (editor context, D5). */
  readonly activeEditorMapId: string | null;
  readonly entries: readonly AtlasWorldSceneGroupPlan[];
  readonly excluded: readonly AtlasWorldSceneExclusion[];
  readonly budget: {
    readonly maxActiveMaps: number;
    readonly activeCount: number;
    readonly candidateCount: number;
  };
};

function aabbIntersects(a: AtlasWorldAabb, b: AtlasWorldAabb): boolean {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);
}

function pointInAabb(x: number, y: number, b: AtlasWorldAabb): boolean {
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
}

/** Euclidean distance from a point to an axis-aligned bounding box (0 when inside). */
function distancePointToAabb(x: number, y: number, b: AtlasWorldAabb): number {
  const dx = x < b.minX ? b.minX - x : x > b.maxX ? x - b.maxX : 0;
  const dy = y < b.minY ? b.minY - y : y > b.maxY ? y - b.maxY : 0;
  return Math.hypot(dx, dy);
}

/**
 * Compute world-space transform and AABB for a single map via SWS-01 `localToWorld`.
 */
export function computeMapWorldTransform(
  nodes: ReadonlyMap<string, AtlasWorldSpaceNode>,
  mapId: string,
):
  | {
      readonly ok: true;
      readonly depth: number;
      readonly transform: AtlasWorldTransform2D;
      readonly aabb: AtlasWorldAabb;
    }
  | { readonly ok: false; readonly error: AtlasWorldTransformError } {
  const chainRes = resolveWorldChain(nodes, mapId);
  if (isAtlasWorldError(chainRes)) return { ok: false, error: chainRes.error };

  const node = nodes.get(mapId)!;
  const bounds: WorldAtlasBounds = node.bounds ?? DEFAULT_ATLAS_BOUNDS;
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const localW = Math.max(1e-9, bounds.maxX - bounds.minX);
  const localH = Math.max(1e-9, bounds.maxY - bounds.minY);

  const c = localToWorld(nodes, mapId, { x: midX, y: midY });
  const c00 = localToWorld(nodes, mapId, { x: bounds.minX, y: bounds.minY });
  const c10 = localToWorld(nodes, mapId, { x: bounds.maxX, y: bounds.minY });
  const c11 = localToWorld(nodes, mapId, { x: bounds.maxX, y: bounds.maxY });
  const c01 = localToWorld(nodes, mapId, { x: bounds.minX, y: bounds.maxY });
  if (
    isAtlasWorldError(c) ||
    isAtlasWorldError(c00) ||
    isAtlasWorldError(c10) ||
    isAtlasWorldError(c11) ||
    isAtlasWorldError(c01)
  ) {
    return { ok: false, error: 'invalid' };
  }

  const worldW = Math.hypot(c10.value.x - c00.value.x, c10.value.y - c00.value.y);
  const worldH = Math.hypot(c01.value.x - c00.value.x, c01.value.y - c00.value.y);
  const rotationRad = Math.atan2(c10.value.y - c00.value.y, c10.value.x - c00.value.x);

  const xs = [c00.value.x, c10.value.x, c11.value.x, c01.value.x];
  const ys = [c00.value.y, c10.value.y, c11.value.y, c01.value.y];

  return {
    ok: true,
    depth: chainRes.depth,
    transform: {
      centerX: c.value.x,
      centerY: c.value.y,
      scaleX: worldW / localW,
      scaleY: worldH / localH,
      rotationRad,
      worldSpan: Math.max(worldW, worldH),
    },
    aabb: {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    },
  };
}

/**
 * Build a deterministic, renderer-independent `AtlasWorldScenePlan`.
 */
export function buildAtlasWorldScenePlan(input: {
  readonly maps: readonly AtlasWorldSceneMapInput[];
  readonly camera: AtlasWorldCameraState;
  readonly viewportPx: { readonly width: number; readonly height: number };
  readonly previousPlan?: AtlasWorldScenePlan | null;
  /** Optional explicit in-world focus target (World → … → target gets budget priority). */
  readonly focusTargetMapId?: string | null;
  readonly config?: Partial<AtlasWorldScenePlanConfig>;
}): AtlasWorldScenePlan {
  const cfg: AtlasWorldScenePlanConfig = {
    ...DEFAULT_ATLAS_WORLD_SCENE_PLAN_CONFIG,
    ...(input.config ?? {}),
  };
  const safeRefine = Math.max(1, cfg.sseRefinePx);
  const safeCoarsen = Math.min(safeRefine, Math.max(1, cfg.sseCoarsenPx));

  const nodes = new Map<string, AtlasWorldSceneMapInput>();
  for (const m of input.maps) {
    nodes.set(m.id, m);
  }

  // Resolve explicit requested focus chain (World → … → focusTargetMapId) so in-world
  // navigation never gets starved by `below-sse` or `maxActiveMaps` budget during flight/arrival.
  const requestedFocusChainIds = new Set<string>();
  const requestedTargetId = input.focusTargetMapId ?? null;
  if (requestedTargetId && nodes.has(requestedTargetId)) {
    const chainRes = resolveWorldChain(nodes, requestedTargetId);
    if (!isAtlasWorldError(chainRes)) {
      for (const n of chainRes.value) {
        requestedFocusChainIds.add(n.id);
      }
    }
  }

  const prevActiveIds = new Set(
    (input.previousPlan?.entries ?? []).map((e) => e.mapId),
  );

  const vpW = Math.max(1, input.viewportPx.width);
  const vpH = Math.max(1, input.viewportPx.height);
  const aspect = vpW / vpH;
  const pad = 1 + Math.max(0, cfg.frustumPadRatio);
  const halfH = input.camera.span * pad;
  const halfW = input.camera.span * aspect * pad;
  const viewAabb: AtlasWorldAabb = {
    minX: input.camera.focusWorld.x - halfW,
    minY: input.camera.focusWorld.y - halfH,
    maxX: input.camera.focusWorld.x + halfW,
    maxY: input.camera.focusWorld.y + halfH,
  };

  type Candidate = {
    readonly map: AtlasWorldSceneMapInput;
    readonly depth: number;
    readonly parentMapId: string | null;
    readonly ssePx: number;
    readonly effectiveSsePx: number;
    readonly transform: AtlasWorldTransform2D;
    readonly aabb: AtlasWorldAabb;
    readonly containsFocus: boolean;
    readonly meetsSse: boolean;
    readonly onRequestedFocusPath: boolean;
  };

  const allValidById = new Map<string, Candidate>();
  const candidates: Candidate[] = [];
  const excluded: AtlasWorldSceneExclusion[] = [];
  let rootMapId: string | null = null;

  for (const m of input.maps) {
    if (m.status === 'unlocated') {
      excluded.push({ mapId: m.id, reason: 'unlocated' });
      continue;
    }
    if (m.isPortal) {
      excluded.push({ mapId: m.id, reason: 'portal' });
      continue;
    }
    const wt = computeMapWorldTransform(nodes, m.id);
    if (wt.ok === false) {
      excluded.push({ mapId: m.id, reason: (wt as { readonly error: AtlasWorldTransformError }).error });
      continue;
    }
    const okWt = wt as {
      readonly ok: true;
      readonly depth: number;
      readonly transform: AtlasWorldTransform2D;
      readonly aabb: AtlasWorldAabb;
    };
    if (okWt.depth === 1 && !rootMapId) rootMapId = m.id;

    // Screen-Space Error (projected pixel span of map frame)
    const ssePx = (okWt.transform.worldSpan / Math.max(1e-6, input.camera.span * 2)) * vpH;
    const wasActive = prevActiveIds.has(m.id);
    const threshold = wasActive ? safeCoarsen : safeRefine;
    const containsFocus = pointInAabb(input.camera.focusWorld.x, input.camera.focusWorld.y, okWt.aabb);
    const onRequestedFocusPath = requestedFocusChainIds.has(m.id);
    const inView = okWt.depth === 1 || onRequestedFocusPath || aabbIntersects(okWt.aabb, viewAabb);

    // Foveated / focus-weighted reveal: maps directly under or near the camera focus center
    // begin revealing smoothly ahead of peripheral maps (without lowering global `sseRefinePx`
    // across the entire frustum!). Peripheral maps stay at `focusBoost = 1.0`.
    const distToFocus = distancePointToAabb(
      input.camera.focusWorld.x,
      input.camera.focusWorld.y,
      okWt.aabb,
    );
    const centralRadius = Math.max(1e-4, input.camera.span * 0.9);
    const focusProximity = Math.max(0, 1 - distToFocus / centralRadius);
    const smoothProximity = focusProximity * focusProximity * (3 - 2 * focusProximity);
    const focusBoost = 1 + smoothProximity * 0.2;
    const effectiveSsePx = ssePx * focusBoost;

    // Explicit focus path stays eligible once reasonably approaching or arrived; ordinary maps
    // use focus-weighted SSE against the unchanged refine/coarsen thresholds.
    const meetsSse =
      okWt.depth === 1 ||
      effectiveSsePx >= threshold ||
      (onRequestedFocusPath && (ssePx >= 28 || m.id === requestedTargetId));

    const cand: Candidate = {
      map: m,
      depth: okWt.depth,
      parentMapId: m.parentAnchor?.parentMapId ?? null,
      ssePx,
      effectiveSsePx,
      transform: okWt.transform,
      aabb: okWt.aabb,
      containsFocus,
      meetsSse,
      onRequestedFocusPath,
    };
    allValidById.set(m.id, cand);

    if (!inView) {
      excluded.push({ mapId: m.id, reason: 'culled' });
      continue;
    }

    if (!meetsSse) {
      // Deferred check: may still be retained below as a keep-coarse carrier of an active descendant!
      continue;
    }

    candidates.push(cand);
  }

  // Phase 2.2 (keep-coarse): ensure every ancestor carrier of an active candidate is retained
  // (never discard a continent/country carrier beneath an active child due to `below-sse`!).
  const candidateIds = new Set(candidates.map((c) => c.map.id));
  const carrierOfActiveIds = new Set<string>();
  for (const c of [...candidates]) {
    let pid = c.parentMapId;
    const visited = new Set<string>([c.map.id]);
    while (pid && !visited.has(pid)) {
      visited.add(pid);
      carrierOfActiveIds.add(pid);
      const anc = allValidById.get(pid);
      if (!anc) break;
      if (!candidateIds.has(anc.map.id)) {
        candidates.push(anc);
        candidateIds.add(anc.map.id);
      }
      pid = anc.parentMapId;
    }
  }

  // Record honest `below-sse` exclusions for in-view maps that were neither refined nor carriers
  for (const cand of allValidById.values()) {
    if (candidateIds.has(cand.map.id)) continue;
    if (cand.depth > 1 && aabbIntersects(cand.aabb, viewAabb)) {
      excluded.push({ mapId: cand.map.id, reason: 'below-sse' });
    }
  }

  // Compute the focus ancestor chain (World → … → deepest focus-containing candidate, plus
  // explicit `focusTargetMapId` chain) so carrier maps along the focus path ALWAYS survive budget!
  const focusChainIds = new Set<string>(requestedFocusChainIds);
  const deepestFocus = [...candidates]
    .filter((c) => c.containsFocus)
    .sort((a, b) => (b.depth !== a.depth ? b.depth - a.depth : a.transform.worldSpan - b.transform.worldSpan))[0];
  if (deepestFocus) {
    let cur: Candidate | undefined = deepestFocus;
    const visited = new Set<string>();
    while (cur && !visited.has(cur.map.id)) {
      visited.add(cur.map.id);
      focusChainIds.add(cur.map.id);
      cur = cur.parentMapId ? allValidById.get(cur.parentMapId) : undefined;
    }
  }

  // Enforce multi-map budget:
  //  1. World Root (depth 1) always kept
  //  2. Explicit requested focus path (World → … → focusTargetMapId) always prioritized
  //  3. Camera focus carrier chain (World → … → active focused map) always prioritized
  //  4. Keep-coarse carriers of visible descendants prioritized ahead of non-focus leaf details
  //  5. Remaining visible maps by depth DESC, effectiveSsePx DESC
  const sortedForBudget = [...candidates].sort((a, b) => {
    if (a.depth === 1 && b.depth !== 1) return -1;
    if (b.depth === 1 && a.depth !== 1) return 1;
    if (a.onRequestedFocusPath !== b.onRequestedFocusPath) {
      return a.onRequestedFocusPath ? -1 : 1;
    }
    const aFocus = focusChainIds.has(a.map.id);
    const bFocus = focusChainIds.has(b.map.id);
    if (aFocus !== bFocus) return aFocus ? -1 : 1;
    if (aFocus && bFocus && a.depth !== b.depth) return b.depth - a.depth;
    const aCarrier = carrierOfActiveIds.has(a.map.id);
    const bCarrier = carrierOfActiveIds.has(b.map.id);
    if (aCarrier !== bCarrier) return aCarrier ? -1 : 1;
    if (aCarrier && bCarrier && a.depth !== b.depth) return a.depth - b.depth;
    if (b.depth !== a.depth) return b.depth - a.depth;
    if (b.effectiveSsePx !== a.effectiveSsePx) return b.effectiveSsePx - a.effectiveSsePx;
    return a.map.id.localeCompare(b.map.id);
  });

  const kept = sortedForBudget.slice(0, Math.max(1, cfg.maxActiveMaps));
  const dropped = sortedForBudget.slice(Math.max(1, cfg.maxActiveMaps));
  for (const d of dropped) {
    excluded.push({ mapId: d.map.id, reason: 'budget' });
  }

  // Build replacement-refinement cutouts on parent maps for active children exceeding replace threshold
  const cutoutsByParent = new Map<string, AtlasLocalCutoutRect[]>();
  for (const c of kept) {
    if (!c.parentMapId || !c.map.parentAnchor) continue;
    if (c.effectiveSsePx < cfg.sseReplaceParentPx && !c.onRequestedFocusPath) continue;
    const rect = parentAnchorAabb(c.map.parentAnchor as ParentSpatialAnchor);
    const list = cutoutsByParent.get(c.parentMapId) ?? [];
    list.push({
      childMapId: c.map.id,
      minX: rect.minX,
      minY: rect.minY,
      maxX: rect.maxX,
      maxY: rect.maxY,
    });
    cutoutsByParent.set(c.parentMapId, list);
  }

  // Deterministic render order: shallowest (root) → deepest, then stable mapId
  const ordered = [...kept].sort((a, b) =>
    a.depth !== b.depth ? a.depth - b.depth : a.map.id.localeCompare(b.map.id),
  );

  const entries: AtlasWorldSceneGroupPlan[] = ordered.map((c) => {
    const cutouts = cutoutsByParent.get(c.map.id) ?? [];
    const rawWeight =
      c.depth === 1
        ? 1
        : Math.max(
            0,
            Math.min(
              1,
              (c.effectiveSsePx - safeCoarsen) / Math.max(1, cfg.sseReplaceParentPx - safeCoarsen),
            ),
          );
    // Keep explicitly focused target smoothly visible upon arrival even at wider framing spans
    const detailWeight =
      c.onRequestedFocusPath && c.containsFocus
        ? Math.max(rawWeight, c.map.id === requestedTargetId ? 1 : 0.85)
        : rawWeight;
    return {
      mapId: c.map.id,
      parentMapId: c.parentMapId,
      depth: c.depth,
      lodState: cutouts.length > 0 ? 'coarse' : 'active',
      ssePx: Math.round(c.ssePx * 100) / 100,
      detailWeight: Math.round(detailWeight * 1000) / 1000,
      worldTransform: c.transform,
      worldAabb: c.aabb,
      cutoutRectsLocal: cutouts,
    };
  });

  // Editor context (`activeEditorMapId`): deepest kept map containing camera focus, fallback to root.
  // When an explicit `focusTargetMapId` is requested and its map is active + contains focus
  // (e.g. clicking "Taverne Zum Flüstern" while its nested "Schankraum" is visible inside),
  // keep `activeEditorMapId` aligned with the requested target until the user zooms deeper or focuses the child.
  const focusMatches = ordered.filter((c) => c.containsFocus);
  const requestedFocusMatch =
    requestedTargetId &&
    focusMatches.find((c) => c.map.id === requestedTargetId);
  const activeEditorMapId = requestedFocusMatch
    ? requestedFocusMatch.map.id
    : focusMatches.length > 0
      ? focusMatches[focusMatches.length - 1]!.map.id
      : (entries[0]?.mapId ?? rootMapId);

  return {
    rootMapId,
    activeEditorMapId,
    entries,
    excluded,
    budget: {
      maxActiveMaps: cfg.maxActiveMaps,
      activeCount: entries.length,
      candidateCount: candidates.length,
    },
  };
}
