/**
 * atlas-three-camera — Productive Three.js camera rig with Google-Maps inertia & auto-pitch.
 * Location: src/infrastructure/world/atlas-three/atlas-three-camera.ts
 *
 * Pure math (no DOM): drives Diorama (oblique with smooth zoom-based pitch curve),
 * Synthetic Satellite (ortho-topdown), and Perspective exploration cameras over
 * the exact same canonical Three.js scene.
 */

export type AtlasThreeCameraMode = 'ortho-topdown' | 'diorama-oblique' | 'perspective';

export type AtlasThreeCameraView = {
  readonly mode: AtlasThreeCameraMode;
  readonly x: number;
  readonly z: number;
  /** Optional target elevation Y (world units, defaults to 0). */
  readonly y?: number;
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
  if (mode === 'diorama-oblique') return clamp(pitch, 0.52, 1.32);
  return clamp(pitch, 0.3, 1.42);
}

export function defaultAtlasThreePitch(mode: AtlasThreeCameraMode): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  if (mode === 'diorama-oblique') return 0.94;
  return 0.78;
}

/**
 * Google-Maps / Apple-Maps style automatic pitch curve:
 * - Wide overview (span >= 750) tilts slightly higher (~66°) for clean cartography
 * - Mid country/region (span ~ 320) rests in classic 3D Diorama (~53°)
 * - Close settlement/village (span <= 140) leans down (~39°) for dramatic 3D buildings & mountains
 */
export function autoAtlasThreePitchForSpan(
  mode: AtlasThreeCameraMode,
  span: number,
): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  const logSpan = Math.log(clamp(span, 24, 2400));
  const lo = Math.log(65);
  const hi = Math.log(950);
  const t = clamp((logSpan - lo) / (hi - lo), 0, 1);
  const smooth = t * t * (3 - 2 * t);
  if (mode === 'perspective') {
    return clampAtlasThreePitch(mode, 0.52 + smooth * 0.56);
  }
  return clampAtlasThreePitch(mode, 0.68 + smooth * 0.48);
}

export function buildAtlasThreeCameraRig(
  view: AtlasThreeCameraView,
  aspect: number,
): AtlasThreeCameraRig {
  const safeAspect = Math.max(0.2, aspect);
  const pitch = clampAtlasThreePitch(view.mode, view.pitchRad);
  const forward: readonly [number, number] = [Math.sin(view.yawRad), Math.cos(view.yawRad)];
  const perspective = view.mode === 'perspective';
  const distance = view.span * (perspective ? 2.25 : 3.0);
  const targetY = Number.isFinite(view.y) ? view.y! : 0;
  const eyeLift = Math.min(5, view.span * 0.12);
  const at: readonly [number, number, number] = [view.x, targetY, view.z];
  const topdown = view.mode === 'ortho-topdown';
  const eye: readonly [number, number, number] = topdown
    ? [view.x, targetY + distance + eyeLift, view.z]
    : [
        view.x + forward[0] * Math.cos(pitch) * distance,
        targetY + Math.sin(pitch) * distance + eyeLift,
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
    near: perspective ? Math.max(0.0005, distance * 0.005) : Math.max(0.0005, distance * 0.002),
    far: Math.max(26000, distance * 8 + 4000),
    perspective,
    fovYDeg: 46,
    halfHeight: view.span,
    halfWidth: view.span * safeAspect,
  };
}

export function buildAtlasThreeFogBand(
  rig: AtlasThreeCameraRig,
  look: 'outdoor' | 'indoor',
): { readonly near: number; readonly far: number; readonly expDensity: number } {
  const d = Math.max(120, rig.distance);
  if (look === 'indoor') {
    return {
      near: d * 1.15,
      far: d * 4.2,
      expDensity: 0.22 / d,
    };
  }
  return {
    near: d * 1.5,
    far: d * 6.5,
    expDensity: 0.085 / d,
  };
}

/** Smooth V17-style exponential span + linear focus camera interpolation. */
export function interpolateAtlasThreeView(
  from: AtlasThreeCameraView,
  to: AtlasThreeCameraView,
  t: number,
): AtlasThreeCameraView {
  const k = clamp(t, 0, 1);
  const e = k * k * (3 - 2 * k);
  const logFrom = Math.log(Math.max(0.02, from.span));
  const logTo = Math.log(Math.max(0.02, to.span));
  const yFrom = Number.isFinite(from.y) ? from.y! : 0;
  const yTo = Number.isFinite(to.y) ? to.y! : 0;
  return {
    mode: to.mode,
    x: from.x + (to.x - from.x) * e,
    z: from.z + (to.z - from.z) * e,
    y: yFrom + (yTo - yFrom) * e,
    span: Math.exp(logFrom + (logTo - logFrom) * e),
    yawRad: from.yawRad + (to.yawRad - from.yawRad) * e,
    pitchRad: from.pitchRad + (to.pitchRad - from.pitchRad) * e,
  };
}

/**
 * Critically damped frame-rate-independent inertia step for buttery Google-Maps
 * wheel zoom and pan damping.
 */
export function dampAtlasThreeView(
  current: AtlasThreeCameraView,
  target: AtlasThreeCameraView,
  dtSeconds: number,
  speed = 12,
): { readonly next: AtlasThreeCameraView; readonly settled: boolean } {
  const alpha = 1 - Math.exp(-Math.max(0.001, Math.min(0.1, dtSeconds)) * speed);
  const nx = current.x + (target.x - current.x) * alpha;
  const nz = current.z + (target.z - current.z) * alpha;
  const curY = Number.isFinite(current.y) ? current.y! : 0;
  const tgtY = Number.isFinite(target.y) ? target.y! : 0;
  const ny = curY + (tgtY - curY) * alpha;
  const logCur = Math.log(Math.max(0.02, current.span));
  const logTgt = Math.log(Math.max(0.02, target.span));
  const nspan = Math.exp(logCur + (logTgt - logCur) * alpha);
  const nyaw = current.yawRad + (target.yawRad - current.yawRad) * alpha;
  const npitch = current.pitchRad + (target.pitchRad - current.pitchRad) * alpha;

  const epsPos = Math.min(0.04, target.span * 0.002);
  const settled =
    Math.abs(nx - target.x) < epsPos &&
    Math.abs(nz - target.z) < epsPos &&
    Math.abs(ny - tgtY) < 0.001 &&
    Math.abs(nspan - target.span) < Math.min(0.04, target.span * 0.002) &&
    Math.abs(nyaw - target.yawRad) < 0.0004 &&
    Math.abs(npitch - target.pitchRad) < 0.0004;

  return {
    next: settled
      ? { ...target }
      : {
          mode: target.mode,
          x: nx,
          z: nz,
          y: ny,
          span: nspan,
          yawRad: nyaw,
          pitchRad: npitch,
        },
    settled,
  };
}
