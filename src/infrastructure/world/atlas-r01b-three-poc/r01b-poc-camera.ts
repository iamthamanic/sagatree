/**
 * r01b-poc-camera — ATL3-R01B (#1296) camera parity for the isolated Three.js PoC.
 * Location: src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-camera.ts
 *
 * Pure math (no Three, no DOM): mirrors `cameraEyeBasis()` / `cameraMatrices()` of the
 * productive custom-WebGL runtime (ADR-ST-10) so A/B captures use identical framing.
 * Research only — never imported by product code (see ADR-ST-11).
 */

export type R01bCameraMode = 'ortho-topdown' | 'diorama-oblique' | 'perspective';

export type R01bView = {
  readonly mode: R01bCameraMode;
  /** Canvas x (world x). */
  readonly x: number;
  /** Canvas y (world z). */
  readonly z: number;
  /** Half view height in world units (custom runtime `cameraState.span`). */
  readonly span: number;
  readonly yawRad: number;
  readonly pitchRad: number;
};

export type R01bCameraRig = {
  readonly eye: readonly [number, number, number];
  readonly at: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  /** Eye → focus distance used by the custom runtime (`d`). */
  readonly distance: number;
  readonly near: number;
  readonly far: number;
  readonly perspective: boolean;
  readonly fovYDeg: number;
  /** Ortho half extents (only meaningful when `perspective` is false). */
  readonly halfHeight: number;
  readonly halfWidth: number;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Same pitch clamps as `clampPitchForMode` in the custom runtime. */
export function r01bClampPitch(mode: R01bCameraMode, pitch: number): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  if (mode === 'diorama-oblique') return clamp(pitch, 0.61, 1.22);
  return clamp(pitch, 0.35, 1.35);
}

/** Camera rig identical to the productive runtime (incl. the R01B near-plane fix). */
export function r01bCameraRig(view: R01bView, aspect: number): R01bCameraRig {
  const safeAspect = Math.max(0.2, aspect);
  const pitch = r01bClampPitch(view.mode, view.pitchRad);
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
  const up: readonly [number, number, number] = topdown ? [-forward[0], 0, -forward[1]] : [0, 1, 0];
  return {
    eye,
    at,
    up,
    distance,
    near: perspective ? Math.max(0.2, distance * 0.02) : 0.1,
    far: Math.max(8000, distance * 4 + 200),
    perspective,
    fovYDeg: 50,
    halfHeight: view.span,
    halfWidth: view.span * safeAspect,
  };
}

/** Focus-relative fog band (same idea as the R01B custom-runtime fix (a)). */
export function r01bFogBand(
  rig: R01bCameraRig,
  look: 'outdoor' | 'indoor',
): { readonly near: number; readonly far: number } {
  const d = rig.distance;
  // V8 ratios (city 18..40 @ d=22, crypt 13..32): fog starts behind the focus point.
  return look === 'indoor' ? { near: d * 0.95, far: d * 2.6 } : { near: d * 0.9, far: d * 3.2 };
}
