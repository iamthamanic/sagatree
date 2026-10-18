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
