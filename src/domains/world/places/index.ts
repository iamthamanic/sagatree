/**
 * world/places domain public API.
 * Location: src/domains/world/places/index.ts
 */

export {
  WORLD_PLACE_KINDS,
  WORLD_PLACE_MAP_USAGES,
  WORLD_PLACE_STATUSES,
  isWorldPlaceKind,
  isWorldPlaceMapUsage,
  isWorldPlaceStatus,
  type UpsertWorldPlaceInput,
  type WorldPlaceKind,
  type WorldPlaceMapLinkVm,
  type WorldPlaceMapUsage,
  type WorldPlaceStatus,
  type WorldPlaceVm,
} from './world-place.types';

export {
  parseWorldPlaceList,
  parseWorldPlaceMapLinkList,
  parseWorldPlaceMapLinkVm,
  parseWorldPlaceVm,
  pickPrimaryMapIdForPlace,
  placeHasDetailMap,
} from './parse-world-place';

export {
  BASIC_BUILDING_SEED_KEY,
  BASIC_BUILDING_STAMP_SIZE,
  SETTLEMENT_PRESETS,
  placeKindForAuthor,
  seedKeyForAuthor,
  settlementPresetById,
  stampSizeForAuthor,
  type AtlasPlaceAuthorKind,
  type SettlementPreset,
  type SettlementPresetId,
} from './settlement-presets';

export {
  anchorPointFromLink,
  buildAtlasPlaceNav,
  resolveAtlasLodFromPlaces,
  type AtlasLodStage,
  type AtlasPlaceNavItem,
} from './atlas-place-nav';
