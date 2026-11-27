/**
 * atlas-three — Productive Three.js Atlas infrastructure barrel (ADR-ST-11).
 * Location: src/infrastructure/world/atlas-three/index.ts
 */
export {
  autoAtlasThreePitchForSpan,
  buildAtlasThreeCameraRig,
  buildAtlasThreeFogBand,
  clampAtlasThreePitch,
  computeVisibleGroundSpanWu,
  dampAtlasThreeView,
  defaultAtlasThreePitch,
  formatAtlasTruthfulScaleHud,
  interpolateAtlasThreeView,
  projectWorldPointWithRig,
  solveAnchoredCameraFocus,
  unprojectNdcToPlaneWithRig,
  type AtlasThreeCameraMode,
  type AtlasThreeCameraRig,
  type AtlasThreeCameraView,
  type AtlasThreeWorldPoint3,
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
  AtlasThreeMultiMapGraph,
  applyLocalCutoutFilter,
  applyWorldTransformToGroup,
  computeMacroOverlayTargetOpacity,
  computeMacroWaterTargetOpacity,
  type AtlasThreeGroupOpacitySnapshot,
  type AtlasThreeMapGroupNode,
  type AtlasThreeMultiMapStats,
  type AtlasThreeWorldMapSource,
} from './atlas-three-multimap';

export {
  AtlasThreeWorldTerrain,
  buildTerrainChunkGeometry,
  type AtlasThreeWorldTerrainStats,
} from './atlas-three-world-terrain';

export {
  bindAtlasUnifiedInput,
  classifyUnifiedWheelGesture,
  normalizeWheelDelta,
  safariGestureScaleToZoomDelta,
  type AtlasUnifiedInputCallbacks,
  type NormalizedWheelInput,
  type SafariGestureEventLike,
  type UnifiedWheelAction,
} from './atlas-unified-input';

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
