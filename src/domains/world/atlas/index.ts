/**
 * world/atlas domain public API (#702).
 * Location: src/domains/world/atlas/index.ts
 */

export {
  DEFAULT_ATLAS_BOUNDS,
  EMPTY_ATLAS_LAYERS,
  isWorldAtlasMapKind,
  type WorldAtlasBounds,
  type WorldAtlasFeatureCollection,
  type WorldAtlasMapKind,
  type WorldAtlasMapSummary,
  type WorldAtlasMapVm,
} from './world-atlas.types';

export {
  parseWorldAtlasBounds,
  parseWorldAtlasLayers,
  parseWorldAtlasMapList,
  parseWorldAtlasMapSummary,
  parseWorldAtlasMapVm,
} from './validate-world-atlas';

export {
  UNIFIED_CANVAS_FORMAT,
  UNIFIED_CANVAS_MAX_BYTES,
  UNIFIED_CANVAS_META_KEY,
  assertUnifiedCanvasDocSize,
  defaultUnifiedCanvasLayers,
  emptyUnifiedCanvasDoc,
  extractUnifiedCanvasFromGeneratorMeta,
  mergeUnifiedCanvasIntoGeneratorMeta,
  parseUnifiedCanvasDoc,
  serializeUnifiedCanvasDoc,
  unifiedCanvasDocByteLength,
  type UnifiedCanvasDoc,
  type UnifiedCanvasLayerId,
  type UnifiedCanvasMaterial,
  type UnifiedCanvasObject,
  type UnifiedCanvasRoom,
  type UnifiedCanvasStampType,
  type UnifiedCanvasStroke,
  type UnifiedCanvasTool,
  type UnifiedCanvasWall,
} from './unified-canvas-doc';

export {
  applyMapEdit,
  applyMapEdits,
  pickObjectAt,
  pickRoomAt,
  type MapEditOperation,
  type MapTransform,
} from './map-edit-ops';

export {
  ATLAS_TOOL_REGISTRY,
  atlasToolsForKind,
  atlasToolToWebglRuntimeId,
  assertWebglToolCommit,
  isAtlasToolAllowed,
  resolveWebglToolAfterKindChange,
  webglRuntimeIdToAtlasTool,
  webglToolChromeForKind,
  type AtlasToolDef,
  type AtlasToolId,
  type WebglRuntimeToolId,
  type WebglToolChromeItem,
} from './atlas-tool-registry';

export {
  DORNHAIN_SETTLEMENT_FOCUS,
  DORNHAIN_STARTER_CANVAS,
  DORNHAIN_STARTER_GRID,
  DORNHAIN_UNIFIED_SEED,
  DORNHAIN_WORLD_ANCHOR,
  DORNHAIN_WORLD_LAYER_TITLE,
  buildDornhainUnifiedCanvasDoc,
  buildDornhainUnifiedGeneratorMeta,
  isSettlementLodId,
  normalizeDornhainWorldLayerTitle,
  shouldUpgradeDornhainUnifiedToWorld,
} from './dornhain-unified-starter';

export {
  ATLAS_PROTOTYPE_HOTSPOTS,
  ATLAS_PROTOTYPE_LAYER_LABELS,
  ATLAS_PROTOTYPE_LEVELS,
  atlasPrototypeApplyLod,
  atlasPrototypeBrushSize,
  atlasPrototypeContentVisible,
  atlasPrototypeHotspotVisible,
  atlasPrototypeLevelFromView,
  atlasPrototypeLevelRect,
  atlasPrototypeNextLevel,
  atlasPrototypeStampSize,
  atlasSpanFromScale,
  type AtlasLodVisibility,
  type AtlasPrototypeHotspot,
  type AtlasPrototypeLevel,
  type AtlasPrototypeLevelId,
} from './atlas-prototype-lod';

export {
  DUNGEON_GENERATOR_VERSION,
  DUNGEON_META_KEY,
  buildDungeonGeneratorMeta,
  dungeonNeedsReforgeConfirm,
  extractDungeonMetaFromGeneratorMeta,
  generateDungeon,
  mergeDungeonMetaIntoGeneratorMeta,
  validateDungeonConnectivity,
  type DungeonGenerateParams,
  type DungeonGenerateResult,
  type DungeonGeneratorMeta,
  type DungeonThemeKey,
} from './dungeon-generator';

export {
  WEBGL_RUNTIME_META_KEY,
  LEGACY_WEBGL_LOCAL_STORAGE_KEY,
  STAMP_TO_PROP,
  emptyWebglRuntime,
  extractWebglRuntimeFromGeneratorMeta,
  mergeWebglRuntimeIntoGeneratorMeta,
  parseWebglRuntimeState,
  readLegacyWebglLocalStorage,
  resolveProductCanvasDoc,
  syncCanvasDocIntoWebglRuntime,
  syncWebglPropsIntoCanvasDoc,
  type WebglRuntimeState,
} from './webgl-runtime-bridge';

export {
  ATLAS_FEATURE_OWNERS,
  MAP_FRAME_META_KEY,
  MAP_STATUS_META_KEY,
  UNLOCATED_MAP_HINT_DE,
  assertParentSpatialAnchor,
  atlasZoomCaption,
  canLodEnterChildMap,
  canWebglDrillSelect,
  extractMapFrameFromGeneratorMeta,
  independentPrimaryBounds,
  isGroundedLinkAnchor,
  mergeMapFrameIntoGeneratorMeta,
  parseMapSketchStatus,
  parseParentSpatialAnchor,
  unlocatedChildMapGeneratorMeta,
  type AtlasFeatureOwner,
  type MapFrameMeta,
  type MapSketchStatus,
  type ParentSpatialAnchor,
} from './map-frame';

export {
  atlasPersistStatusLabelDe,
  isAtlasRevisionConflictMessage,
  reduceAtlasPersistStatus,
  type AtlasPersistEvent,
  type AtlasPersistStatus,
} from './atlas-persist-state';
