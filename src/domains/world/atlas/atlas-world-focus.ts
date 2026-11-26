/**
 * atlas-world-focus — Pure-domain spatial focus resolution for continuous in-world navigation.
 * Location: src/domains/world/atlas/atlas-world-focus.ts
 *
 * Pure domain — NO React, NO Three.js, NO DOM, NO Host SDK (BR-005).
 *
 * Computes real World-Space focus coordinates, focus-chain ancestors, and a target-sized
 * camera span strictly from persisted `ParentSpatialAnchor` chains (never hardcoded coordinates).
 * Unlocated maps return an honest, non-destructive `unlocated` outcome in German.
 */
import {
  isAtlasWorldError,
  resolveWorldChain,
  type AtlasWorldSpaceNode,
} from './atlas-world-space';
import {
  computeMapWorldTransform,
  type AtlasWorldAabb,
  type AtlasWorldSceneMapInput,
} from './atlas-world-scene-plan';

export type AtlasWorldFocusTarget =
  | {
      readonly ok: true;
      readonly mapId: string;
      readonly depth: number;
      readonly centerWorld: { readonly x: number; readonly y: number };
      readonly worldSpan: number;
      readonly recommendedCameraSpan: number;
      readonly aabb: AtlasWorldAabb;
      readonly focusChainMapIds: readonly string[];
    }
  | {
      readonly ok: false;
      readonly mapId: string;
      readonly reason: 'unlocated' | 'missing' | 'cycle' | 'invalid';
      readonly reasonDe: string;
    };

export type AtlasWorldFocusIntent = {
  readonly targetMapId: string;
  readonly targetPlaceId: string | null;
  readonly labelDe: string;
  readonly requestedAtMs: number;
  readonly phase: 'flying' | 'arrived';
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Derive a comfortable framing camera span directly from the target map's real World-Space span.
 * Never returns a generic huge world span for a small settlement or building.
 */
export function recommendedWorldCameraSpan(input: {
  readonly depth: number;
  readonly worldSpan: number;
}): number {
  const { depth, worldSpan } = input;
  if (depth <= 1) {
    return 530;
  }
  const safeSpan = Math.max(0.02, worldSpan);
  // Continent-scale (>= 160 world units): frame continent comfortably with ocean margin
  if (safeSpan >= 160) {
    return Math.round(clamp(safeSpan * 0.44, 65, 280) * 100) / 100;
  }
  // Country / region-scale (30..160 world units): show realm borders + neighboring context
  if (safeSpan >= 30) {
    return Math.round(clamp(safeSpan * 0.42, 16, 65) * 100) / 100;
  }
  // Settlement / village-scale (2..30 world units): show full town clearly on shared ground
  if (safeSpan >= 2) {
    return Math.round(clamp(safeSpan * 0.38, 1.4, 14) * 1000) / 1000;
  }
  // Building / interior / room-scale (< 2 world units): frame building/room at realistic readable scale
  // without making a single building look like another vast landscape
  const minRoomSpan = depth >= 6 ? 0.09 : 0.16;
  return Math.round(clamp(safeSpan * 0.72, minRoomSpan, 1.4) * 10000) / 10000;
}

/**
 * Resolve a target map's World-Space focus position, framing span, and ancestor chain
 * strictly from the live `ParentSpatialAnchor` graph.
 */
export function resolveWorldFocusTarget(input: {
  readonly maps: readonly AtlasWorldSceneMapInput[];
  readonly targetMapId: string;
  readonly labelDe?: string;
}): AtlasWorldFocusTarget {
  const { maps, targetMapId, labelDe } = input;
  const displayName = labelDe?.trim() || 'Diese Karte';
  const nodes = new Map<string, AtlasWorldSceneMapInput>();
  for (const m of maps) {
    nodes.set(m.id, m);
  }
  const target = nodes.get(targetMapId);
  if (!target) {
    return {
      ok: false,
      mapId: targetMapId,
      reason: 'missing',
      reasonDe: `„${displayName}“ ist in der aktuellen Weltkarte nicht geladen. Öffne die Karte zum Bearbeiten.`,
    };
  }
  if (target.status === 'unlocated') {
    return {
      ok: false,
      mapId: targetMapId,
      reason: 'unlocated',
      reasonDe: `„${displayName}“ ist noch nicht auf der Weltkarte verortet. Zum Bearbeiten oder Verorten kannst du die Karte direkt öffnen.`,
    };
  }

  const wt = computeMapWorldTransform(nodes as ReadonlyMap<string, AtlasWorldSpaceNode>, targetMapId);
  if (wt.ok === false) {
    const err = (wt as { readonly error: string }).error;
    if (err === 'unlocated') {
      return {
        ok: false,
        mapId: targetMapId,
        reason: 'unlocated',
        reasonDe: `„${displayName}“ ist noch nicht auf der Weltkarte verortet. Zum Bearbeiten oder Verorten kannst du die Karte direkt öffnen.`,
      };
    }
    return {
      ok: false,
      mapId: targetMapId,
      reason: err === 'cycle' ? 'cycle' : err === 'missing' ? 'missing' : 'invalid',
      reasonDe: `„${displayName}“ hat keinen gültigen Welt-Anker (${err}). Du kannst die Karte direkt zum Bearbeiten öffnen.`,
    };
  }

  const chainRes = resolveWorldChain(nodes as ReadonlyMap<string, AtlasWorldSpaceNode>, targetMapId);
  if (isAtlasWorldError(chainRes)) {
    return {
      ok: false,
      mapId: targetMapId,
      reason: 'invalid',
      reasonDe: `„${displayName}“ hat keine vollständige Elternkette. Du kannst die Karte direkt zum Bearbeiten öffnen.`,
    };
  }

  const focusChainMapIds = [...chainRes.value].reverse().map((n) => n.id);
  const recommendedCameraSpan = recommendedWorldCameraSpan({
    depth: wt.depth,
    worldSpan: wt.transform.worldSpan,
  });

  return {
    ok: true,
    mapId: targetMapId,
    depth: wt.depth,
    centerWorld: {
      x: wt.transform.centerX,
      y: wt.transform.centerY,
    },
    worldSpan: wt.transform.worldSpan,
    recommendedCameraSpan,
    aabb: wt.aabb,
    focusChainMapIds,
  };
}
