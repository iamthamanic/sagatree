/**
 * atlas-product-camera — ATL2-D03 product 3D camera modes (custom WebGL).
 * Location: src/domains/world/atlas/atlas-product-camera.ts
 *
 * Pure domain — no React / Host. Presentation-only; never geometry SoT.
 */

export const ATLAS_PRODUCT_CAMERA_MODES = [
  'ortho-topdown',
  'diorama-oblique',
  'perspective',
] as const;

export type AtlasProductCameraMode = (typeof ATLAS_PRODUCT_CAMERA_MODES)[number];

export type AtlasProductCameraState = {
  readonly mode: AtlasProductCameraMode;
  readonly x: number;
  readonly z: number;
  readonly span: number;
  readonly yawRad: number;
  /** Pitch from horizon; π/2 = top-down looking down. */
  readonly pitchRad: number;
};

/** Diorama pitch band (radians from horizontal). ~60° default. */
export const ATLAS_DIORAMA_PITCH_MIN = 0.61; // ~35°
export const ATLAS_DIORAMA_PITCH_MAX = 1.22; // ~70°
export const ATLAS_DIORAMA_PITCH_DEFAULT = 1.05; // ~60°
export const ATLAS_PERSPECTIVE_PITCH_MIN = 0.35;
export const ATLAS_PERSPECTIVE_PITCH_MAX = 1.35;
export const ATLAS_PERSPECTIVE_FOV_Y = (50 * Math.PI) / 180;

const MODE_SET = new Set<string>(ATLAS_PRODUCT_CAMERA_MODES);

export function isAtlasProductCameraMode(v: unknown): v is AtlasProductCameraMode {
  return typeof v === 'string' && MODE_SET.has(v);
}

export function defaultAtlasProductCameraState(
  seed?: Partial<AtlasProductCameraState>,
): AtlasProductCameraState {
  const mode = isAtlasProductCameraMode(seed?.mode) ? seed.mode : 'ortho-topdown';
  return clampAtlasProductCamera({
    mode,
    x: typeof seed?.x === 'number' && Number.isFinite(seed.x) ? seed.x : 500,
    z: typeof seed?.z === 'number' && Number.isFinite(seed.z) ? seed.z : 500,
    span: typeof seed?.span === 'number' && Number.isFinite(seed.span) ? seed.span : 530,
    yawRad: typeof seed?.yawRad === 'number' && Number.isFinite(seed.yawRad) ? seed.yawRad : 0,
    pitchRad:
      typeof seed?.pitchRad === 'number' && Number.isFinite(seed.pitchRad)
        ? seed.pitchRad
        : pitchForMode(mode),
  });
}

export function pitchForMode(mode: AtlasProductCameraMode): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  if (mode === 'diorama-oblique') return ATLAS_DIORAMA_PITCH_DEFAULT;
  return 0.95;
}

export function clampPitchForMode(mode: AtlasProductCameraMode, pitchRad: number): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  if (mode === 'diorama-oblique') {
    return Math.min(ATLAS_DIORAMA_PITCH_MAX, Math.max(ATLAS_DIORAMA_PITCH_MIN, pitchRad));
  }
  return Math.min(ATLAS_PERSPECTIVE_PITCH_MAX, Math.max(ATLAS_PERSPECTIVE_PITCH_MIN, pitchRad));
}

export function clampAtlasProductCamera(
  state: AtlasProductCameraState,
): AtlasProductCameraState {
  const mode = isAtlasProductCameraMode(state.mode) ? state.mode : 'ortho-topdown';
  return {
    mode,
    x: Number.isFinite(state.x) ? state.x : 500,
    z: Number.isFinite(state.z) ? state.z : 500,
    span: Math.min(8000, Math.max(0.5, Number.isFinite(state.span) ? state.span : 530)),
    yawRad: Number.isFinite(state.yawRad) ? state.yawRad : 0,
    pitchRad: clampPitchForMode(mode, Number.isFinite(state.pitchRad) ? state.pitchRad : pitchForMode(mode)),
  };
}

export function cycleAtlasProductCameraMode(
  mode: AtlasProductCameraMode,
): AtlasProductCameraMode {
  const i = ATLAS_PRODUCT_CAMERA_MODES.indexOf(mode);
  return ATLAS_PRODUCT_CAMERA_MODES[(i + 1) % ATLAS_PRODUCT_CAMERA_MODES.length]!;
}

export function atlasProductCameraModeLabelDe(mode: AtlasProductCameraMode): string {
  if (mode === 'ortho-topdown') return 'Draufsicht (Ortho)';
  if (mode === 'diorama-oblique') return 'Diorama (Schräg)';
  return 'Perspektive';
}

export function parseAtlasProductCameraState(raw: unknown): AtlasProductCameraState | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!isAtlasProductCameraMode(o.mode)) return null;
  if (
    typeof o.x !== 'number' ||
    typeof o.z !== 'number' ||
    typeof o.span !== 'number' ||
    typeof o.yawRad !== 'number' ||
    typeof o.pitchRad !== 'number'
  ) {
    return null;
  }
  return clampAtlasProductCamera({
    mode: o.mode,
    x: o.x,
    z: o.z,
    span: o.span,
    yawRad: o.yawRad,
    pitchRad: o.pitchRad,
  });
}

export function interpolateAtlasProductCamera(
  a: AtlasProductCameraState,
  b: AtlasProductCameraState,
  t: number,
): AtlasProductCameraState {
  const u = Math.min(1, Math.max(0, t));
  const smooth = u * u * (3 - 2 * u);
  const mode = u < 0.5 ? a.mode : b.mode;
  return clampAtlasProductCamera({
    mode,
    x: a.x + (b.x - a.x) * smooth,
    z: a.z + (b.z - a.z) * smooth,
    span: Math.exp(
      Math.log(Math.max(0.5, a.span)) +
        (Math.log(Math.max(0.5, b.span)) - Math.log(Math.max(0.5, a.span))) * smooth,
    ),
    yawRad: a.yawRad + (b.yawRad - a.yawRad) * smooth,
    pitchRad: a.pitchRad + (b.pitchRad - a.pitchRad) * smooth,
  });
}

/** Apply mode switch keeping target/span/yaw; pitch snaps into mode band. */
export function withAtlasProductCameraMode(
  state: AtlasProductCameraState,
  mode: AtlasProductCameraMode,
): AtlasProductCameraState {
  return clampAtlasProductCamera({
    ...state,
    mode,
    pitchRad: pitchForMode(mode),
  });
}
