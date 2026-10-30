/**
 * marketplace client-trust — Reject privileged client fields; whitelist update patches (#675).
 * Location: src/domains/marketplace/client-trust.ts
 * Pure domain rules — no React, no Supabase.
 *
 * Hand parsers (not Zod): frontend has no zod dependency; issue #675 Non-Goals /
 * Assumptions allow equivalent hand parsers / shared helpers at this boundary.
 */

import type {
  CreateMarketplaceItemDTO,
  MarketplaceItemType,
  UpdateMarketplaceItemDTO,
} from './contracts/marketplace.types';

/** Counters / ownership / elevated fields clients must never set. */
export const MARKETPLACE_PRIVILEGED_CLIENT_KEYS = [
  'author_id',
  'owner_user_id',
  'rating',
  'downloads',
  'roles',
  'permissions',
  'is_admin',
  'id',
  'created_at',
  'updated_at',
] as const;

export type MarketplacePrivilegedClientKey =
  (typeof MARKETPLACE_PRIVILEGED_CLIENT_KEYS)[number];

const PRIVILEGED = new Set<string>(MARKETPLACE_PRIVILEGED_CLIENT_KEYS);

const UPDATE_ALLOWED = new Set([
  'title',
  'description',
  'data',
  'price',
  'image_url',
  'tags',
]);

const CREATE_ALLOWED = new Set([
  'type',
  'title',
  'description',
  'data',
  'price',
  'image_url',
  'tags',
]);

const ITEM_TYPES: ReadonlySet<MarketplaceItemType> = new Set([
  'world',
  'adventure',
  'character',
  'item',
  'ruleset',
]);

function isMarketplaceItemType(value: string): value is MarketplaceItemType {
  return ITEM_TYPES.has(value as MarketplaceItemType);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function findMarketplacePrivilegedClientKeys(
  input: unknown,
): MarketplacePrivilegedClientKey[] {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return [];
  }
  const found: MarketplacePrivilegedClientKey[] = [];
  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (PRIVILEGED.has(key)) {
      found.push(key as MarketplacePrivilegedClientKey);
    }
  }
  return found;
}

export function assertNoMarketplacePrivilegedClientKeys(input: unknown): void {
  const found = findMarketplacePrivilegedClientKeys(input);
  if (found.length > 0) {
    throw new Error(
      `Client darf privilegierte Felder nicht setzen: ${found.join(', ')}`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Strip to allowlisted update fields; throw if privileged keys are present.
 * Never spreads unknown keys into a DB update payload.
 */
export function whitelistMarketplaceUpdatePatch(
  dto: UpdateMarketplaceItemDTO | Record<string, unknown>,
): UpdateMarketplaceItemDTO {
  assertNoMarketplacePrivilegedClientKeys(dto);
  if (!isRecord(dto)) {
    throw new Error('Ungültiges Update-DTO');
  }

  const patch: UpdateMarketplaceItemDTO = {};
  for (const key of Object.keys(dto)) {
    if (!UPDATE_ALLOWED.has(key)) {
      throw new Error(`Unbekanntes Update-Feld: ${key}`);
    }
  }

  if (typeof dto.title === 'string') patch.title = dto.title;
  if (typeof dto.description === 'string') patch.description = dto.description;
  if (isRecord(dto.data)) patch.data = dto.data;
  if (typeof dto.price === 'number' && Number.isFinite(dto.price) && dto.price >= 0) {
    patch.price = dto.price;
  }
  if (typeof dto.image_url === 'string') patch.image_url = dto.image_url;
  if (isStringArray(dto.tags)) patch.tags = dto.tags;

  return patch;
}

/**
 * Validate create DTO shape; reject privileged keys. Server still sets author_id / counters.
 */
export function whitelistMarketplaceCreateDto(
  dto: CreateMarketplaceItemDTO | Record<string, unknown>,
): CreateMarketplaceItemDTO {
  assertNoMarketplacePrivilegedClientKeys(dto);
  if (!isRecord(dto)) {
    throw new Error('Ungültiges Create-DTO');
  }

  for (const key of Object.keys(dto)) {
    if (!CREATE_ALLOWED.has(key)) {
      throw new Error(`Unbekanntes Create-Feld: ${key}`);
    }
  }

  if (typeof dto.type !== 'string' || !isMarketplaceItemType(dto.type)) {
    throw new Error('Ungültiger Marketplace-Typ');
  }
  if (typeof dto.title !== 'string' || dto.title.trim().length === 0) {
    throw new Error('Titel ist erforderlich');
  }
  if (!isRecord(dto.data)) {
    throw new Error('data muss ein Objekt sein');
  }

  const out: CreateMarketplaceItemDTO = {
    type: dto.type,
    title: dto.title.trim(),
    data: dto.data,
  };

  if (typeof dto.description === 'string') out.description = dto.description;
  if (typeof dto.price === 'number' && Number.isFinite(dto.price) && dto.price >= 0) {
    out.price = dto.price;
  }
  if (typeof dto.image_url === 'string') out.image_url = dto.image_url;
  if (isStringArray(dto.tags)) out.tags = dto.tags;

  return out;
}
