/**
 * world/hierarchy — Canonical WorldNodeKind contract (Epic #712 / #714).
 * Location: src/domains/world/hierarchy/index.ts
 */

export {
  BUILDING_SUBTYPES,
  PLACE_SUBTYPES,
  ROOM_SUBTYPES,
  WORLD_NODE_KINDS,
  WORLD_NODE_LABELS_DE,
  WORLD_NODE_STATUSES,
  isBuildingSubtype,
  isPlaceSubtype,
  isRoomSubtype,
  isSubtypeForKind,
  isWorldNodeKind,
  isWorldNodeStatus,
  type BuildingSubtype,
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