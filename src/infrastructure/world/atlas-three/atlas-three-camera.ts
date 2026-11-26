/**
 * atlas-three-camera — Productive Three.js camera rig with exact projection-anchored zoom,
 * continuous logarithmic auto-pitch, and frame-rate-independent damping.
 * Location: src/infrastructure/world/atlas-three/atlas-three-camera.ts
 *
 * Pure math (no Three.js, no DOM): drives Diorama (oblique with continuous zoom-based pitch curve),
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

export type AtlasThreeWorldPoint3 = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
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

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function clampAtlasThreePitch(mode: AtlasThreeCameraMode, pitch: number): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  if (mode === 'diorama-oblique') return clamp(pitch, 0.52, 1.38);
  return clamp(pitch, 0.34, 1.42);
}

export function defaultAtlasThreePitch(mode: AtlasThreeCameraMode): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  if (mode === 'diorama-oblique') return 0.96;
  return 0.82;
}

/**
 * Continuous C1 logarithmic auto-pitch curve across the ENTIRE supported zoom journey
 * (`span` from `0.10` room interior up to `1200+` planet overview):
 *  - World / Continent (`span >= 350`): elevated cartographic overview (~66° Diorama / ~60° Perspective)
 *  - Country / Region (`span ~ 35..140`): balanced 3D diorama relief (~52°–58°)
 *  - Settlement (`span ~ 2.5..12`, e.g. Dornhain): sculptural diorama (~45°–49°) showing facades & plaza
 *  - Building / Room interior (`span <= 1.2`, e.g. Taverne / Schankraum): gently rises to ~56°–61°
 *    so cutaway interiors, walls, tables, and floor details stay unobstructed and legible.
 *  - `ortho-topdown` always remains exact `Math.PI / 2` (true top-down).
 */
export function autoAtlasThreePitchForSpan(
  mode: AtlasThreeCameraMode,
  span: number,
): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  const safeSpan = clamp(span, 0.08, 2400);
  const logSpan = Math.log(safeSpan);

  // Broad macro curve: settlement (~4 wu) -> world (~800 wu)
  const macroT = smoothstep(Math.log(3.2), Math.log(780), logSpan);
  // Interior readability lift: building/room (~1.6 wu -> 0.14 wu) gently raises camera angle
  const interiorT = 1 - smoothstep(Math.log(0.16), Math.log(2.2), logSpan);

  if (mode === 'perspective') {
    const base = 0.68 + macroT * 0.38; // ~39° at village -> ~61° at planet
    const interiorLift = interiorT * 0.24; // rises smoothly to ~53° inside rooms
    return clampAtlasThreePitch(mode, base + interiorLift);
  }

  // diorama-oblique
  const base = 0.78 + macroT * 0.40; // ~44.7° at village -> ~67.6° at planet
  const interiorLift = interiorT * 0.24; // rises smoothly to ~58.5° inside cutaway rooms
  return clampAtlasThreePitch(mode, base + interiorLift);
}

/**
 * Format a truthful, scale-grounded German HUD readout for the current camera span
 * instead of a saturated fake percentage (`2500%`).
 *
 * Meaning: visible vertical ground span (`2 * span` world units), calibrated to SagaTree's
 * Bottom-Up Default World (~1 world unit ≈ 1.4 km on planet scale; at settlement/interior
 * single-document mode, displays local map meter scale).
 */
export function formatAtlasTruthfulScaleHud(
  span: number,
  options?: { readonly isWorldSceneGraph?: boolean },
): {
  readonly shortLabel: string;
  readonly zoomLevel: number;
  readonly detailTitleDe: string;
} {
  const safeSpan = clamp(Number.isFinite(span) ? span : 430, 0.05, 2400);
  const isWorld = options?.isWorldSceneGraph ?? true;
  // Logarithmic map zoom index Z1 (span ~1024) .. Z15 (span ~0.06)
  const zoomLevel = Math.round(clamp(1 + Math.log2(1024 / safeSpan), 1, 15) * 10) / 10;
  const visibleWidthWu = safeSpan * 2;

  if (!isWorld) {
    // Local single-map document (1000 local units)
    const pct = Math.max(10, Math.min(1200, Math.round((220 / Math.max(16, safeSpan)) * 100)));
    return {
      shortLabel: `${pct}%`,
      zoomLevel,
      detailTitleDe: `Einzelkarte · Sichtbereich ${Math.round(visibleWidthWu)} Karteneinheiten (Klick zentriert)`,
    };
  }

  // World-space calibrated physical scale (~1 world unit ≈ 1250 m in Dornhain hierarchy)
  const visibleMeters = visibleWidthWu * 1250;
  let shortLabel: string;
  let scaleText: string;
  if (visibleMeters >= 100_000) {
    const km = Math.round(visibleMeters / 10_000) * 10;
    shortLabel = `~${km} km`;
    scaleText = `ca. ${km} km Sichthöhe`;
  } else if (visibleMeters >= 10_000) {
    const km = Math.round(visibleMeters / 1000);
    shortLabel = `~${km} km`;
    scaleText = `ca. ${km} km Sichthöhe`;
  } else if (visibleMeters >= 1_000) {
    const km = Math.round(visibleMeters / 100) / 10;
    shortLabel = `~${km.toFixed(1).replace('.', ',')} km`;
    scaleText = `ca. ${km.toFixed(1).replace('.', ',')} km Sichthöhe`;
  } else {
    const m = Math.max(10, Math.round(visibleMeters / 10) * 10);
    shortLabel = `~${m} m`;
    scaleText = `ca. ${m} m Sichthöhe`;
  }

  return {
    shortLabel,
    zoomLevel,
    detailTitleDe: `Weltmaßstab Z${zoomLevel.toFixed(1)} · ${scaleText} (Span ${safeSpan < 10 ? safeSpan.toFixed(2) : Math.round(safeSpan)} WE · Klick zentriert)`,
  };
}

export function buildAtlasThreeCameraRig(
  view: AtlasThreeCameraView,
  aspect: number,
): AtlasThreeCameraRig {
  const safeAspect = Math.max(0.2, aspect);
  const pitch = clampAtlasThreePitch(view.mode, view.pitchRad);
  const forward: readonly [number, number] = [Math.sin(view.yawRad), Math.cos(view.yawRad)];
  const perspective = view.mode === 'perspective';
  // Perspective distance calibrated so vertical visible ground height at target matches `2 * span`
  // (fovY = 46° => tan(23°) = 0.4244748 => dist = span / tan(23°) ≈ 2.3558 * span)
  const fovYDeg = 46;
  const tanHalfFov = Math.tan((fovYDeg * Math.PI) / 360);
  const distance = perspective ? view.span / tanHalfFov : view.span * 3.0;
  const targetY = Number.isFinite(view.y) ? view.y! : 0;
  const at: readonly [number, number, number] = [view.x, targetY, view.z];
  const topdown = view.mode === 'ortho-topdown';
  // Pure geometric eye placement (zero non-linear eyeLift kink!) so pitch & projection stay 100% consistent
  const eye: readonly [number, number, number] = topdown
    ? [view.x, targetY + distance, view.z]
    : [
        view.x + forward[0] * Math.cos(pitch) * distance,
        targetY + Math.sin(pitch) * distance,
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
    near: perspective ? Math.max(0.002, distance * 0.008) : Math.max(0.002, distance * 0.004),
    far: Math.max(26000, distance * 8 + 4000),
    perspective,
    fovYDeg,
    halfHeight: view.span,
    halfWidth: view.span * safeAspect,
  };
}

type Vec3 = readonly [number, number, number];

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize3(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function buildCameraBasis(rig: AtlasThreeCameraRig): {
  readonly right: Vec3;
  readonly camUp: Vec3;
  readonly forward: Vec3; // unit vector from eye toward at
} {
  const forward = normalize3(sub3(rig.at, rig.eye));
  const right = normalize3(cross3(forward, rig.up));
  const camUp = cross3(right, forward);
  return { right, camUp, forward };
}

/**
 * Pure projection of a 3D world point through `AtlasThreeCameraRig` into OpenGL NDC `[-1, 1]`.
 * Matches `THREE.PerspectiveCamera` / `THREE.OrthographicCamera` `lookAt` projection exactly.
 */
export function projectWorldPointWithRig(
  rig: AtlasThreeCameraRig,
  point: AtlasThreeWorldPoint3,
): { readonly ndcX: number; readonly ndcY: number; readonly depth: number; readonly visible: boolean } {
  const { right, camUp, forward } = buildCameraBasis(rig);
  const rel: Vec3 = [point.x - rig.eye[0], point.y - rig.eye[1], point.z - rig.eye[2]];
  const cx = dot3(rel, right);
  const cy = dot3(rel, camUp);
  const cz = dot3(rel, forward); // positive in front of camera

  if (rig.perspective) {
    if (cz <= 1e-6) {
      return { ndcX: 0, ndcY: 0, depth: cz, visible: false };
    }
    const tanHalfFov = Math.tan((rig.fovYDeg * Math.PI) / 360);
    const aspect = rig.halfWidth / Math.max(1e-6, rig.halfHeight);
    const ndcX = cx / (cz * tanHalfFov * aspect);
    const ndcY = cy / (cz * tanHalfFov);
    return {
      ndcX,
      ndcY,
      depth: cz,
      visible: cz >= rig.near && cz <= rig.far && Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1,
    };
  }

  const ndcX = cx / Math.max(1e-6, rig.halfWidth);
  const ndcY = cy / Math.max(1e-6, rig.halfHeight);
  return {
    ndcX,
    ndcY,
    depth: cz,
    visible: cz >= rig.near && cz <= rig.far && Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1,
  };
}

/**
 * Cast a ray from NDC `(ndcX, ndcY)` through `rig` and intersect the horizontal plane `y = planeY`.
 * Pure analytical counterpart to `THREE.Raycaster.setFromCamera().intersectPlane`.
 */
export function unprojectNdcToPlaneWithRig(
  rig: AtlasThreeCameraRig,
  ndcX: number,
  ndcY: number,
  planeY: number,
): { readonly x: number; readonly z: number } | null {
  const { right, camUp, forward } = buildCameraBasis(rig);
  if (rig.perspective) {
    const tanHalfFov = Math.tan((rig.fovYDeg * Math.PI) / 360);
    const aspect = rig.halfWidth / Math.max(1e-6, rig.halfHeight);
    const dx = ndcX * tanHalfFov * aspect;
    const dy = ndcY * tanHalfFov;
    const dir: Vec3 = [
      forward[0] + right[0] * dx + camUp[0] * dy,
      forward[1] + right[1] * dx + camUp[1] * dy,
      forward[2] + right[2] * dx + camUp[2] * dy,
    ];
    if (Math.abs(dir[1]) < 1e-7) return null;
    const t = (planeY - rig.eye[1]) / dir[1];
    if (t <= 0) return null;
    return {
      x: rig.eye[0] + dir[0] * t,
      z: rig.eye[2] + dir[2] * t,
    };
  }

  // Orthographic ray originates on the near/eye plane offset by (ndcX * halfWidth, ndcY * halfHeight)
  const ox = rig.eye[0] + right[0] * (ndcX * rig.halfWidth) + camUp[0] * (ndcY * rig.halfHeight);
  const oy = rig.eye[1] + right[1] * (ndcX * rig.halfWidth) + camUp[1] * (ndcY * rig.halfHeight);
  const oz = rig.eye[2] + right[2] * (ndcX * rig.halfWidth) + camUp[2] * (ndcY * rig.halfHeight);
  if (Math.abs(forward[1]) < 1e-7) return null;
  const t = (planeY - oy) / forward[1];
  return {
    x: ox + forward[0] * t,
    z: oz + forward[2] * t,
  };
}

/**
 * Exact projection-based cursor-anchor solver (Phase A):
 *
 * Given a candidate camera view `(mode, span, yawRad, pitchRad)`, a fixed 3D world anchor
 * `anchorWorld = (ax, ay, az)`, and the screen NDC `(targetNdcX, targetNdcY)` where that point
 * MUST remain pinned, solves `(x, z, y)` so `projectWorldPointWithRig(rig, anchorWorld)` equals
 * `(targetNdcX, targetNdcY)` to sub-pixel accuracy (`< 0.05 px`) — even under oblique pitch,
 * arbitrary yaw, aspect ratio, perspective projection, pitch changes, and sloping terrain elevation!
 */
export function solveAnchoredCameraFocus(input: {
  readonly view: AtlasThreeCameraView;
  readonly anchorWorld: AtlasThreeWorldPoint3;
  readonly targetNdcX: number;
  readonly targetNdcY: number;
  readonly aspect: number;
  readonly sampleFocusElevation?: (x: number, z: number) => number;
}): { readonly x: number; readonly z: number; readonly y: number } {
  const { view, anchorWorld, targetNdcX, targetNdcY, aspect, sampleFocusElevation } = input;
  const pitch = clampAtlasThreePitch(view.mode, view.pitchRad);
  const probeRig = buildAtlasThreeCameraRig(view, aspect);
  // Guarantee the camera eye stays safely above an elevated 3D anchor (e.g. mountain peak / roof)
  // at tight zoom spans so perspective rays never invert behind the camera.
  const minFyForAnchor = anchorWorld.y - Math.sin(pitch) * probeRig.distance * 0.5;
  const resolveFy = (x: number, z: number): number => {
    const raw = sampleFocusElevation
      ? sampleFocusElevation(x, z)
      : Number.isFinite(view.y)
        ? view.y!
        : 0;
    return Math.max(raw, minFyForAnchor);
  };

  let fx = view.x;
  let fz = view.z;
  let fy = resolveFy(fx, fz);

  for (let iter = 0; iter < 6; iter += 1) {
    const rig = buildAtlasThreeCameraRig({ ...view, x: fx, z: fz, y: fy }, aspect);
    const hit = unprojectNdcToPlaneWithRig(rig, targetNdcX, targetNdcY, anchorWorld.y);
    if (!hit) break;
    const dx = anchorWorld.x - hit.x;
    const dz = anchorWorld.z - hit.z;
    fx += dx;
    fz += dz;
    const nextFy = resolveFy(fx, fz);
    const dy = Math.abs(nextFy - fy);
    fy = nextFy;
    if (Math.hypot(dx, dz) < 1e-5 && dy < 1e-5) break;
  }

  return { x: fx, z: fz, y: fy };
}

export function buildAtlasThreeFogBand(
  rig: AtlasThreeCameraRig,
  look: 'outdoor' | 'indoor',
): { readonly near: number; readonly far: number; readonly expDensity: number } {
  const d = Math.max(80, rig.distance);
  if (look === 'indoor') {
    return {
      near: d * 1.15,
      far: d * 4.2,
      expDensity: 0.2 / d,
    };
  }
  return {
    near: d * 1.65,
    far: d * 7.0,
    expDensity: 0.072 / d,
  };
}

/** Smooth exponential span + linear focus camera interpolation. */
export function interpolateAtlasThreeView(
  from: AtlasThreeCameraView,
  to: AtlasThreeCameraView,
  t: number,
): AtlasThreeCameraView {
  const k = clamp(t, 0, 1);
  const e = k * k * (3 - 2 * k);
  const logFrom = Math.log(Math.max(0.05, from.span));
  const logTo = Math.log(Math.max(0.05, to.span));
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
 * Critically damped frame-rate-independent inertia step for wheel zoom and pan damping.
 * When `anchor` is provided, every intermediate damped frame re-solves `(x, z, y)` through
 * `solveAnchoredCameraFocus` so the anchored 3D world point stays pinned to the cursor pixel
 * across EVERY intermediate frame (zero mid-zoom bowing or drift!).
 */
export function dampAtlasThreeView(
  current: AtlasThreeCameraView,
  target: AtlasThreeCameraView,
  dtSeconds: number,
  speed = 12,
  anchor?: {
    readonly anchorWorld: AtlasThreeWorldPoint3;
    readonly targetNdcX: number;
    readonly targetNdcY: number;
    readonly aspect: number;
    readonly sampleFocusElevation?: (x: number, z: number) => number;
  } | null,
): { readonly next: AtlasThreeCameraView; readonly settled: boolean } {
  const alpha = 1 - Math.exp(-Math.max(0.001, Math.min(0.1, dtSeconds)) * speed);
  const logCur = Math.log(Math.max(0.05, current.span));
  const logTgt = Math.log(Math.max(0.05, target.span));
  const nspan = Math.exp(logCur + (logTgt - logCur) * alpha);
  const nyaw = current.yawRad + (target.yawRad - current.yawRad) * alpha;
  const npitch = current.pitchRad + (target.pitchRad - current.pitchRad) * alpha;

  const epsSpan = Math.min(0.04, target.span * 0.0015);
  const angleSettled =
    Math.abs(nyaw - target.yawRad) < 0.0004 &&
    Math.abs(npitch - target.pitchRad) < 0.0004 &&
    Math.abs(nspan - target.span) < epsSpan;

  if (anchor) {
    const baseView: AtlasThreeCameraView = angleSettled
      ? { ...target }
      : {
          mode: target.mode,
          x: current.x + (target.x - current.x) * alpha,
          z: current.z + (target.z - current.z) * alpha,
          y: current.y,
          span: nspan,
          yawRad: nyaw,
          pitchRad: npitch,
        };
    const solved = solveAnchoredCameraFocus({
      view: baseView,
      anchorWorld: anchor.anchorWorld,
      targetNdcX: anchor.targetNdcX,
      targetNdcY: anchor.targetNdcY,
      aspect: anchor.aspect,
      sampleFocusElevation: anchor.sampleFocusElevation,
    });
    return {
      next: {
        ...baseView,
        x: solved.x,
        z: solved.z,
        y: solved.y,
      },
      settled: angleSettled,
    };
  }

  const nx = current.x + (target.x - current.x) * alpha;
  const nz = current.z + (target.z - current.z) * alpha;
  const curY = Number.isFinite(current.y) ? current.y! : 0;
  const tgtY = Number.isFinite(target.y) ? target.y! : 0;
  const ny = curY + (tgtY - curY) * alpha;

  const epsPos = Math.min(0.04, target.span * 0.002);
  const settled =
    angleSettled &&
    Math.abs(nx - target.x) < epsPos &&
    Math.abs(nz - target.z) < epsPos &&
    Math.abs(ny - tgtY) < 0.001;

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
