/**
 * world-place.types — semantic place identity for Donalu world model.
 * Location: src/domains/world/places/world-place.types.ts
 */

export const WORLD_PLACE_KINDS = [
  'continent',
  'realm',
  'region',
  'settlement',
  'district',
  'site',
  'building',
  'interior',
  'dungeon',
  'area',
] as const;

export type WorldPlaceKind = (typeof WORLD_PLACE_KINDS)[number];

export const WORLD_PLACE_STATUSES = ['draft', 'canonical', 'archived'] as const;
export type WorldPlaceStatus = (typeof WORLD_PLACE_STATUSES)[number];

export const WORLD_PLACE_MAP_USAGES = [
  'overview',
  'footprint',
  'entrance',
  'interior',
  'dungeon',
  'battlemap',
] as const;

export type WorldPlaceMapUsage = (typeof WORLD_PLACE_MAP_USAGES)[number];

export type WorldPlaceVm = {
  readonly id: string;
  readonly worldProfileId: string;
  readonly parentPlaceId: string | null;
  readonly kind: WorldPlaceKind;
  readonly name: string;
  readonly description: string | null;
  readonly status: WorldPlaceStatus;
  readonly seedKey: string | null;
  readonly sortOrder: number;
  readonly revision: number;
  /** Present when listed via saga player filter */
  readonly bindingReveal?: string;
  readonly bindingAssetId?: string;
};

export type WorldPlaceMapLinkVm = {
  readonly id: string;
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
  readonly usage: WorldPlaceMapUsage;
  readonly featureId: string | null;
  readonly anchor: Readonly<Record<string, unknown>>;
};

export type UpsertWorldPlaceInput = {
  readonly worldProfileId: string;
  readonly placeId?: string | null;
  readonly parentPlaceId?: string | null;
  readonly kind: WorldPlaceKind;
  readonly name: string;
  readonly description?: string | null;
  readonly status?: WorldPlaceStatus;
  readonly seedKey?: string | null;
  readonly sortOrder?: number;
};

export function isWorldPlaceKind(value: unknown): value is WorldPlaceKind {
  return typeof value === 'string' && (WORLD_PLACE_KINDS as readonly string[]).includes(value);
}

export function isWorldPlaceStatus(value: unknown): value is WorldPlaceStatus {
  return typeof value === 'string' && (WORLD_PLACE_STATUSES as readonly string[]).includes(value);
}

export function isWorldPlaceMapUsage(value: unknown): value is WorldPlaceMapUsage {
  return typeof value === 'string' && (WORLD_PLACE_MAP_USAGES as readonly string[]).includes(value);
}
