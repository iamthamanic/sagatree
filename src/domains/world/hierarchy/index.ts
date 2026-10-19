/**
 * world/hierarchy — Canonical WorldNodeKind contract (Epic #712 / #714).
 * Location: src/domains/world/hierarchy/index.ts
 */

export {
  BUILDING_SUBTYPES,
  COUNTRY_SUBTYPES,
  PLACE_SUBTYPES,
  ROOM_SUBTYPES,
  WORLD_NODE_KINDS,
  WORLD_NODE_LABELS_DE,
  WORLD_NODE_STATUSES,
  isBuildingSubtype,
  isCountrySubtype,
  isPlaceSubtype,
  isRoomSubtype,
  isSubtypeForKind,
  isWorldNodeKind,
  isWorldNodeStatus,
  type BuildingSubtype,
  type CountrySubtype,
  type PlaceSubtype,
  type RoomSubtype,
  type WorldNodeKind,
  type WorldNodeKindLabelsDe,
  type WorldNodeStatus,
  type WorldNodeSubtype,
} from './world-node.types';

export {
  assertHierarchyEdge,
  canPromoteToCanonical,
  isAllowedParent,
  kindSiblingOrder,
  labelDeForKind,
  missingAncestorKinds,
  placeholderNameStem,
  requiredParentKind,
  statusAfterRename,
  worldNodeRank,
} from './world-hierarchy';

export {
  ALL_KIND_MAPPINGS,
  mappingForMapKind,
  mappingForPlaceKind,
  mappingForPrototypeNavKind,
  recommendedLegacyMapKind,
  tryNodeKindFromPlaceKind,
  type KindMappingRow,
  type KindMappingStatus,
} from './legacy-kind-map';

export {
  planWorldNodeCreate,
  type WorldNodeCreatePlan,
  type WorldNodeCreatePlanInput,
  type WorldNodeCreatePlanStep,
} from './create-plan';

export {
  buildMutationConsequences,
  planRenameStatus,
  planReparent,
  wouldCreateReparentCycle,
  type MutationConsequences,
  type ReparentPlan,
  type ReparentPlanInput,
} from './mutations';
export {
  DONALU_WORLD_PUBLIC_ID,
  buildMigrationDryRun,
  type MigrationAction,
  type MigrationDryRunReport,
  type MigrationMapRow,
  type MigrationPlaceRow,
  type MigrationPlanItem,
} from './migration-plan';

export {
  AMBIGUOUS_PLACE_KINDS,
  SYNTHETIC_SAMPLE_ID_PREFIX,
  assertNoSyntheticSampleIds,
  assertWorldScope,
  buildParentChain,
  buildScopedMigrationDryRun,
  buildWorldScopedInventory,
  countOrphanSettlementsForWorld,
  filterInventoryByWorld,
  isAmbiguousPlaceKind,
  isSyntheticSampleId,
  matchesWorldScope,
  migrationRowsFromInventory,
  pickPrimaryMapId,
  type AmbiguousPlaceKind,
  type AmbiguousReviewEntry,
  type InventoryLinkRow,
  type InventoryMapRow,
  type InventoryPlaceRow,
  type InventorySagaLocationBinding,
  type InventorySagaRow,
  type OrphanWorldSettlementRow,
  type WorldScope,
  type WorldScopedInventoryReport,
  type WorldScopedPlaceRecord,
} from './world-scoped-inventory';
