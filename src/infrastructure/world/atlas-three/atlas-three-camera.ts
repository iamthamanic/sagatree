/**
 * atlas-three-camera — Productive Three.js camera rig (V01 / ATL3-C01 parity).
 * Location: src/infrastructure/world/atlas-three/atlas-three-camera.ts
 *
 * Pure math (no DOM): drives Diorama (oblique), Synthetic Satellite (ortho-topdown),
 * and Perspective exploration cameras over the exact same canonical Three.js scene.
 */

export type AtlasThreeCameraMode = 'ortho-topdown' | 'diorama-oblique' | 'perspective';

export type AtlasThreeCameraView = {
  readonly mode: AtlasThreeCameraMode;
  readonly x: number;
  readonly z: number;
  readonly span: number;
  readonly yawRad: number;
  readonly pitchRad: number;
};

export type AtlasThreeCameraRig = {
  readonly eye: readonly [number, number, number];
  readonly at: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly distance: number;
  readonly near: number;
  readonly far: number;
  readonly perspective: boolean;
  readonly fovYDeg: number;
  readonly halfHeight: number;
  readonly halfWidth: number;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function clampAtlasThreePitch(mode: AtlasThreeCameraMode, pitch: number): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  if (mode === 'diorama-oblique') return clamp(pitch, 0.55, 1.25);
  return clamp(pitch, 0.32, 1.38);
}

export function defaultAtlasThreePitch(mode: AtlasThreeCameraMode): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  if (mode === 'diorama-oblique') return 1.02;
  return 0.88;
}

export function buildAtlasThreeCameraRig(
  view: AtlasThreeCameraView,
  aspect: number,
): AtlasThreeCameraRig {
  const safeAspect = Math.max(0.2, aspect);
  const pitch = clampAtlasThreePitch(view.mode, view.pitchRad);
  const forward: readonly [number, number] = [Math.sin(view.yawRad), Math.cos(view.yawRad)];
  const perspective = view.mode === 'perspective';
  const distance = view.span * (perspective ? 2.4 : 3.0);
  const at: readonly [number, number, number] = [view.x, 0, view.z];
  const topdown = view.mode === 'ortho-topdown';
  const eye: readonly [number, number, number] = topdown
    ? [view.x, distance + 5, view.z]
    : [
        view.x + forward[0] * Math.cos(pitch) * distance,
        Math.sin(pitch) * distance + 5,
        view.z + forward[1] * Math.cos(pitch) * distance,
      ];
  const up: readonly [number, number, number] = topdown
    ? [-forward[0], 0, -forward[1]]
    : [0, 1, 0];

  return {
    eye,
    at,
    up,
    distance,
    near: perspective ? Math.max(0.2, distance * 0.02) : 0.1,
    far: Math.max(8000, distance * 4 + 400),
    perspective,
    fovYDeg: 48,
    halfHeight: view.span,
    halfWidth: view.span * safeAspect,
  };
}

export function buildAtlasThreeFogBand(
  rig: AtlasThreeCameraRig,
  look: 'outdoor' | 'indoor',
): { readonly near: number; readonly far: number } {
  const d = rig.distance;
  return look === 'indoor'
    ? { near: d * 0.95, far: d * 2.8 }
    : { near: d * 0.95, far: d * 3.6 };
}

/** Smooth V17-style exponential span + linear focus camera interpolation. */
export function interpolateAtlasThreeView(
  from: AtlasThreeCameraView,
  to: AtlasThreeCameraView,
  t: number,
): AtlasThreeCameraView {
  const k = clamp(t, 0, 1);
  const e = k * k * (3 - 2 * k);
  const logFrom = Math.log(Math.max(1, from.span));
  const logTo = Math.log(Math.max(1, to.span));
  return {
    mode: to.mode,
    x: from.x + (to.x - from.x) * e,
    z: from.z + (to.z - from.z) * e,
    span: Math.exp(logFrom + (logTo - logFrom) * e),
    yawRad: from.yawRad + (to.yawRad - from.yawRad) * e,
    pitchRad: from.pitchRad + (to.pitchRad - from.pitchRad) * e,
  };
}
