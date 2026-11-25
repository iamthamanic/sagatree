/**
 * atlas-three — Productive Three.js Atlas infrastructure barrel (ADR-ST-11).
 * Location: src/infrastructure/world/atlas-three/index.ts
 */
export {
  autoAtlasThreePitchForSpan,
  buildAtlasThreeCameraRig,
  buildAtlasThreeFogBand,
  clampAtlasThreePitch,
  dampAtlasThreeView,
  defaultAtlasThreePitch,
  interpolateAtlasThreeView,
  type AtlasThreeCameraMode,
  type AtlasThreeCameraRig,
  type AtlasThreeCameraView,
} from './atlas-three-camera';

export {
  ATLAS_THREE_SURFACES,
  AtlasThreeGeoBuilder,
  atlasThreeFloorSurface,
  buildAtlasThreeScenePlan,
  type AtlasThreeAoDisc,
  type AtlasThreeLook,
  type AtlasThreeScatterBatch,
  type AtlasThreeScenePlan,
  type AtlasThreeSurfaceKey,
  type AtlasThreeSurfaceSpec,
} from './atlas-three-scene';

export {
  AtlasThreeRuntime,
  type AtlasThreeLightingMode,
  type AtlasThreeProjectedPin,
  type AtlasThreeRuntimeConfig,
  type AtlasThreeStyleMode,
} from './atlas-three-runtime';

export {
  ATLAS_PBR_KINDS,
  AtlasPbrTextureLibrary,
  type AtlasPbrKind,
  type AtlasPbrTextureSet,
} from './pbr-textures';
