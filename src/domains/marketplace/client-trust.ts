/**
 * marketplace client-trust — Reject privileged client fields; whitelist update patches (#675).
 * Location: src/domains/marketplace/client-trust.ts
 * Pure domain rules — no React, no Supabase.
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

const UPDATE_ALLOWED = [
  'title',
  'description',
  'data',
  'price',
  'image_url',
  'tags',
] as const;

const CREATE_ALLOWED = [
  'type',
  'title',
  'description',
  'data',
  'price',
  'image_url',
  'tags',
] as const;

const ITEM_TYPES = new Set<string>([
  'world',
  'adventure',
  'character',
  'item',
  'ruleset',
]);

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
    if (!(UPDATE_ALLOWED as readonly string[]).includes(key)) {
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
  if (Array.isArray(dto.tags) && dto.tags.every((t) => typeof t === 'string')) {
    patch.tags = dto.tags as string[];
  }

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
    if (!(CREATE_ALLOWED as readonly string[]).includes(key)) {
      throw new Error(`Unbekanntes Create-Feld: ${key}`);
    }
  }

  if (typeof dto.type !== 'string' || !ITEM_TYPES.has(dto.type)) {
    throw new Error('Ungültiger Marketplace-Typ');
  }
  if (typeof dto.title !== 'string' || dto.title.trim().length === 0) {
    throw new Error('Titel ist erforderlich');
  }
  if (!isRecord(dto.data)) {
    throw new Error('data muss ein Objekt sein');
  }

  const out: CreateMarketplaceItemDTO = {
    type: dto.type as MarketplaceItemType,
    title: dto.title.trim(),
    data: dto.data,
  };

  if (typeof dto.description === 'string') out.description = dto.description;
  if (typeof dto.price === 'number' && Number.isFinite(dto.price) && dto.price >= 0) {
    out.price = dto.price;
  }
  if (typeof dto.image_url === 'string') out.image_url = dto.image_url;
  if (Array.isArray(dto.tags) && dto.tags.every((t) => typeof t === 'string')) {
    out.tags = dto.tags as string[];
  }

  return out;
}
