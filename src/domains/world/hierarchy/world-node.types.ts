/**
 * world-node.types — Canonical WorldNodeKind + subtypes (Epic #712 / #714).
 * Location: src/domains/world/hierarchy/world-node.types.ts
 *
 * World root remains WorldProfile (no world_places row). Hierarchy nodes are
 * continent → country → place → building → room. Subtypes do not add levels.
 */

/** Child node kinds stored under a WorldProfile (not including the world root). */
export const WORLD_NODE_KINDS = [
  'continent',
  'country',
  'place',
  'building',
  'room',
] as const;

export type WorldNodeKind = (typeof WORLD_NODE_KINDS)[number];

export const WORLD_NODE_STATUSES = [
  'placeholder',
  'draft',
  'canonical',
  'archived',
] as const;

export type WorldNodeStatus = (typeof WORLD_NODE_STATUSES)[number];

/** Place subtypes (hierarchy level stays `place`). */
export const PLACE_SUBTYPES = [
  'city',
  'village',
  'wilderness',
  'forest',
  'mountain',
] as const;

export type PlaceSubtype = (typeof PLACE_SUBTYPES)[number];

/** Building subtypes (hierarchy level stays `building`). */
export const BUILDING_SUBTYPES = [
  'house',
  'fortress',
  'cave',
  'dungeon',
  'ruin',
] as const;

export type BuildingSubtype = (typeof BUILDING_SUBTYPES)[number];

/** Room subtypes (hierarchy level stays `room`). */
export const ROOM_SUBTYPES = ['chamber', 'hall', 'corridor'] as const;

export type RoomSubtype = (typeof ROOM_SUBTYPES)[number];

export type WorldNodeSubtype = PlaceSubtype | BuildingSubtype | RoomSubtype;

export type WorldNodeKindLabelsDe = {
  readonly kind: WorldNodeKind;
  readonly singular: string;
  readonly plural: string;
  readonly category: string;
};

export const WORLD_NODE_LABELS_DE: readonly WorldNodeKindLabelsDe[] = [
  { kind: 'continent', singular: 'Kontinent', plural: 'Kontinente', category: 'Kontinente' },
  { kind: 'country', singular: 'Land', plural: 'Länder', category: 'Länder' },
  { kind: 'place', singular: 'Ort', plural: 'Orte', category: 'Orte' },
  { kind: 'building', singular: 'Gebäude', plural: 'Gebäude', category: 'Gebäude' },
  { kind: 'room', singular: 'Raum', plural: 'Räume', category: 'Räume' },
] as const;

export function isWorldNodeKind(value: unknown): value is WorldNodeKind {
  return typeof value === 'string' && (WORLD_NODE_KINDS as readonly string[]).includes(value);
}

export function isWorldNodeStatus(value: unknown): value is WorldNodeStatus {
  return typeof value === 'string' && (WORLD_NODE_STATUSES as readonly string[]).includes(value);
}

export function isPlaceSubtype(value: unknown): value is PlaceSubtype {
  return typeof value === 'string' && (PLACE_SUBTYPES as readonly string[]).includes(value);
}

export function isBuildingSubtype(value: unknown): value is BuildingSubtype {
  return typeof value === 'string' && (BUILDING_SUBTYPES as readonly string[]).includes(value);
}

export function isRoomSubtype(value: unknown): value is RoomSubtype {
  return typeof value === 'string' && (ROOM_SUBTYPES as readonly string[]).includes(value);
}

export function isSubtypeForKind(
  kind: WorldNodeKind,
  subtype: unknown,
): subtype is WorldNodeSubtype {
  if (kind === 'place') return isPlaceSubtype(subtype);
  if (kind === 'building') return isBuildingSubtype(subtype);
  if (kind === 'room') return isRoomSubtype(subtype);
  return subtype == null;
}
