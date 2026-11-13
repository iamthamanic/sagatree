/**
 * atlas-renderer-target — ATL2-D01 productive 3D renderer decision (pure domain).
 * Location: src/domains/world/atlas/atlas-renderer-target.ts
 *
 * Records the single productive 3D target for Phase D. No React / Host SDKs.
 */

/** Known 3D renderer candidates inventory (product vs parallel). */
export type AtlasRendererCandidateId =
  | 'custom-webgl-prototype-runtime'
  | 'three-spatial-viewport'
  | 'unified-three-poc';

/** Graphics quality presets for degradable devices (AU / CE performance). */
export type AtlasGraphicsPresetId = 'high' | 'balanced' | 'lite';

export type AtlasGraphicsPreset = {
  readonly id: AtlasGraphicsPresetId;
  readonly labelDe: string;
  readonly maxPixelRatio: number;
  /** Prefer AtlasLite3D software projection when WebGL init fails or preset is lite. */
  readonly preferSoftwareFallback: boolean;
  readonly antialias: boolean;
};

export const ATLAS_GRAPHICS_PRESETS: readonly AtlasGraphicsPreset[] = [
  {
    id: 'high',
    labelDe: 'Hoch — volle WebGL-Qualität',
    maxPixelRatio: 2,
    preferSoftwareFallback: false,
    antialias: true,
  },
  {
    id: 'balanced',
    labelDe: 'Ausgewogen — begrenztes Pixelverhältnis',
    maxPixelRatio: 1.5,
    preferSoftwareFallback: false,
    antialias: true,
  },
  {
    id: 'lite',
    labelDe: 'Sparsam — Software-Fallback bevorzugt',
    maxPixelRatio: 1,
    preferSoftwareFallback: true,
    antialias: false,
  },
] as const;

/** Sole productive 3D target after ATL2-D01 (Epic #1196). */
export const ATLAS_PRODUCT_3D_TARGET: AtlasRendererCandidateId =
  'custom-webgl-prototype-runtime';

export const ATLAS_PRODUCT_3D_MODULE_PATH =
  'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs' as const;

export const ATLAS_PRODUCT_3D_HOST_PATH =
  'src/app/world/atlas/unified/AtlasNative3dEditor.tsx' as const;

/** Parallel inventory — must not be a second product chrome path. */
export const ATLAS_PARALLEL_THREE_VIEWPORT_PATH =
  'src/app/world/atlas/unified/AtlasSpatialViewport.tsx' as const;

export type AtlasRendererDecision = {
  readonly target: AtlasRendererCandidateId;
  readonly issue: 1212;
  readonly reasonDe: string;
  readonly rollbackDe: string;
  readonly retireParallelIn: 'atl2-h-cleanup' | 'none';
};

export const ATLAS_RENDERER_DECISION: AtlasRendererDecision = {
  target: ATLAS_PRODUCT_3D_TARGET,
  issue: 1212,
  reasonDe:
    'Produkt-3D ist bereits die gesteuerte custom-WebGL-Runtime (AtlasGL + AtlasLite3D). ' +
    'AtlasSpatialViewport (Three.js) ist ungenutzt im Produkt-Chrome; ein Tausch würde ' +
    'Nav/Tools/Golden-Parität ohne gemessenen Gewinn riskieren.',
  rollbackDe:
    'Bei kritischem Regression: Draufsicht (Canvas2D) bleibt Authoring-Quelle; 3D-Ansicht ' +
    'kann auf controlled seed ohne Mutation zurückfallen. Parallel-Three nicht reaktivieren.',
  retireParallelIn: 'atl2-h-cleanup',
};

export function resolveAtlasGraphicsPreset(
  id: AtlasGraphicsPresetId,
): AtlasGraphicsPreset {
  const found = ATLAS_GRAPHICS_PRESETS.find((p) => p.id === id);
  if (!found) return ATLAS_GRAPHICS_PRESETS[1]!;
  return found;
}

export function clampAtlasPixelRatio(
  devicePixelRatio: number,
  preset: AtlasGraphicsPreset,
): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(preset.maxPixelRatio, dpr);
}

export function isProductAtlasRendererTarget(id: AtlasRendererCandidateId): boolean {
  return id === ATLAS_PRODUCT_3D_TARGET;
}
