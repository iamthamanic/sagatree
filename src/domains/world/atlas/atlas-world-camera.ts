/**
 * atlas-world-camera — SWS-05: Unified World Camera State (shared 2D + 3D).
 * Location: src/domains/world/atlas/atlas-world-camera.ts
 *
 * Pure domain — no React / Three.js / DOM / Host.
 *
 * ADR-SWS-01 §7.1:
 *  - ONE shared `AtlasWorldCameraState` in World Space for 2D (ortho-topdown)
 *    and 3D (diorama-oblique / perspective).
 *  - Mode switches preserve `focusWorld`, `yawRad`, and `span` (never hard-reset
 *    `yawRad` to 0 on top-down switch; Checklist E1 / E2).
 */
import {
  isAtlasWorldError,
  localToWorld,
  worldToLocal,
  type AtlasWorldSpaceNode,
} from './atlas-world-space';

export type AtlasWorldCameraProjection = 'ortho-topdown' | 'diorama-oblique' | 'perspective';

export type AtlasWorldCameraState = {
  readonly focusWorld: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  /** Half-height span of view in world units. */
  readonly span: number;
  /** Orientation around vertical axis (radians). Preserved across mode switches. */
  readonly yawRad: number;
  /** Pitch angle (radians; PI/2 = straight overhead). */
  readonly pitchRad: number;
  readonly projection: AtlasWorldCameraProjection;
};

export const ATLAS_WORLD_CAMERA_MIN_SPAN = 0.02;
export const ATLAS_WORLD_CAMERA_MAX_SPAN = 2400;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function clampWorldCameraPitch(
  projection: AtlasWorldCameraProjection,
  pitchRad: number,
): number {
  if (projection === 'ortho-topdown') return Math.PI / 2;
  if (projection === 'diorama-oblique') return clamp(pitchRad, 0.52, 1.32);
  return clamp(pitchRad, 0.3, 1.42);
}

export function defaultWorldCameraPitch(projection: AtlasWorldCameraProjection): number {
  if (projection === 'ortho-topdown') return Math.PI / 2;
  if (projection === 'diorama-oblique') return 0.94;
  return 0.78;
}

export function createAtlasWorldCameraState(
  init?: Partial<AtlasWorldCameraState>,
): AtlasWorldCameraState {
  const projection: AtlasWorldCameraProjection = init?.projection ?? 'diorama-oblique';
  return {
    focusWorld: {
      x: Number.isFinite(init?.focusWorld?.x) ? init!.focusWorld!.x : 500,
      y: Number.isFinite(init?.focusWorld?.y) ? init!.focusWorld!.y : 500,
      z: Number.isFinite(init?.focusWorld?.z) ? init!.focusWorld!.z : 0,
    },
    span: clamp(
      Number.isFinite(init?.span) ? init!.span! : 430,
      ATLAS_WORLD_CAMERA_MIN_SPAN,
      ATLAS_WORLD_CAMERA_MAX_SPAN,
    ),
    yawRad: Number.isFinite(init?.yawRad) ? init!.yawRad! : 0.42,
    pitchRad: clampWorldCameraPitch(
      projection,
      Number.isFinite(init?.pitchRad) ? init!.pitchRad! : defaultWorldCameraPitch(projection),
    ),
    projection,
  };
}

/**
 * Switch camera projection (2D ortho-topdown ↔ 3D diorama ↔ perspective).
 * Preserves focusWorld, yawRad, and span verbatim — NEVER resets yawRad to 0 (E2).
 */
export function switchWorldCameraProjection(
  state: AtlasWorldCameraState,
  nextProjection: AtlasWorldCameraProjection,
  options?: { readonly pitchRad?: number },
): AtlasWorldCameraState {
  const nextPitch = clampWorldCameraPitch(
    nextProjection,
    options?.pitchRad ?? defaultWorldCameraPitch(nextProjection),
  );
  return {
    focusWorld: { ...state.focusWorld },
    span: state.span,
    yawRad: state.yawRad,
    pitchRad: nextPitch,
    projection: nextProjection,
  };
}

/**
 * Pan camera in screen/world plane respecting current yawRad.
 */
export function panWorldCamera(
  state: AtlasWorldCameraState,
  deltaRightWorld: number,
  deltaForwardWorld: number,
): AtlasWorldCameraState {
  const cos = Math.cos(state.yawRad);
  const sin = Math.sin(state.yawRad);
  return {
    ...state,
    focusWorld: {
      x: state.focusWorld.x + (deltaRightWorld * cos + deltaForwardWorld * sin),
      y: state.focusWorld.y + (-deltaRightWorld * sin + deltaForwardWorld * cos),
      z: state.focusWorld.z,
    },
  };
}

/**
 * Zoom camera around an arbitrary world anchor point (cursor-pinned zoom).
 */
export function zoomWorldCameraToward(
  state: AtlasWorldCameraState,
  factor: number,
  anchorWorld?: { readonly x: number; readonly y: number },
): AtlasWorldCameraState {
  if (!Number.isFinite(factor) || factor <= 0) return state;
  const nextSpan = clamp(
    state.span * factor,
    ATLAS_WORLD_CAMERA_MIN_SPAN,
    ATLAS_WORLD_CAMERA_MAX_SPAN,
  );
  if (!anchorWorld || !Number.isFinite(anchorWorld.x) || !Number.isFinite(anchorWorld.y)) {
    return { ...state, span: nextSpan };
  }
  const ratio = nextSpan / state.span;
  return {
    ...state,
    span: nextSpan,
    focusWorld: {
      x: anchorWorld.x + (state.focusWorld.x - anchorWorld.x) * ratio,
      y: anchorWorld.y + (state.focusWorld.y - anchorWorld.y) * ratio,
      z: state.focusWorld.z,
    },
  };
}

/**
 * Derive 2D canvas viewport transform from the single shared `AtlasWorldCameraState` (E1).
 */
export function projectWorldCameraTo2dViewport(
  state: AtlasWorldCameraState,
  viewport: { readonly width: number; readonly height: number },
): {
  readonly centerX: number;
  readonly centerY: number;
  readonly scalePxPerWorldUnit: number;
  readonly yawRad: number;
} {
  const h = Math.max(1, viewport.height);
  return {
    centerX: state.focusWorld.x,
    centerY: state.focusWorld.y,
    scalePxPerWorldUnit: h / (2 * Math.max(ATLAS_WORLD_CAMERA_MIN_SPAN, state.span)),
    yawRad: state.yawRad,
  };
}

/**
 * Convert Unified World Camera focus into a specific map's local coordinates via SWS-01.
 */
export function worldCameraFocusInMapLocal(
  state: AtlasWorldCameraState,
  nodes: ReadonlyMap<string, AtlasWorldSpaceNode> | Readonly<Record<string, AtlasWorldSpaceNode>>,
  mapId: string,
): { readonly ok: true; readonly x: number; readonly y: number } | { readonly ok: false } {
  const res = worldToLocal(nodes, mapId, { x: state.focusWorld.x, y: state.focusWorld.y });
  if (isAtlasWorldError(res)) return { ok: false };
  return { ok: true, x: res.value.x, y: res.value.y };
}

/**
 * Build a Unified World Camera centered on a local point of `mapId` via SWS-01.
 */
export function focusWorldCameraOnMapLocal(
  state: AtlasWorldCameraState,
  nodes: ReadonlyMap<string, AtlasWorldSpaceNode> | Readonly<Record<string, AtlasWorldSpaceNode>>,
  mapId: string,
  localPoint: { readonly x: number; readonly y: number },
  nextSpan?: number,
): AtlasWorldCameraState | null {
  const res = localToWorld(nodes, mapId, localPoint);
  if (isAtlasWorldError(res)) return null;
  return {
    ...state,
    focusWorld: { x: res.value.x, y: res.value.y, z: state.focusWorld.z },
    ...(nextSpan !== undefined
      ? { span: clamp(nextSpan, ATLAS_WORLD_CAMERA_MIN_SPAN, ATLAS_WORLD_CAMERA_MAX_SPAN) }
      : {}),
  };
}
