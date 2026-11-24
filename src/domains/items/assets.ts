/**
 * Item thumbnail asset contract — stable assetKey + prompt helpers (#140).
 * Domain-pure: no React, no backend clients, no network.
 * Location: src/domains/items/assets.ts
 */

export const ITEM_THUMBNAIL_KIND = 'thumbnail2d' as const;
export type ItemThumbnailKind = typeof ITEM_THUMBNAIL_KIND;

export const ITEM_THUMBNAIL_ORIGINS = ['upload', 'meshy'] as const;
export type ItemThumbnailOrigin = (typeof ITEM_THUMBNAIL_ORIGINS)[number];

export const ITEM_THUMBNAIL_ASSET_KEY_PREFIX = 'thumbnail2d:';
export const ITEM_THUMBNAIL_MAX_BYTES = 10 * 1024 * 1024;
export const ITEM_THUMBNAIL_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type ItemThumbnailMime = (typeof ITEM_THUMBNAIL_ALLOWED_MIME)[number];

/** Manifest fields the UI may show; provider task ids stay infrastructure-only. */
export interface ItemThumbnailAssetRecord {
  id: string;
  kind: ItemThumbnailKind;
  definitionId: string;
  ownerUserId: string;
  worldProfileId: string | null;
  mime: ItemThumbnailMime;
  byteSize: number;
  storagePath: string;
  origin: ItemThumbnailOrigin;
  createdAt: string;
}

export type ItemThumbnailJobStatus =
  | 'queued'
  | 'waiting'
  | 'generating'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export interface ItemThumbnailPromptInput {
  name: string;
  description: string;
  setting?: string;
  kindKey?: string;
  userExtra?: string;
}

const ART_DIRECTION =
  'single centered inventory item illustration, isolated object, clean quiet neutral background, no text, no logos, no watermarks, no brand or artist style names';

/**
 * Build the Meshy text-to-image prompt from item fields + fixed art direction.
 * Truncates to Meshy's 600-char limit; never injects built-in brand/artist styles.
 */
export function buildItemThumbnailPrompt(input: ItemThumbnailPromptInput): string {
  const name = sanitizePromptPart(input.name, 80) || 'item';
  const description = sanitizePromptPart(input.description, 220);
  const setting = sanitizePromptPart(input.setting ?? '', 60);
  const kind = sanitizePromptPart(input.kindKey ?? '', 40);
  const extra = sanitizePromptPart(input.userExtra ?? '', 120);

  const parts = [
    `Inventory icon of ${name}`,
    description ? `: ${description}` : '',
    kind ? `. Kind: ${kind}` : '',
    setting ? `. Setting: ${setting}` : '',
    extra ? `. Details: ${extra}` : '',
    `. Style: ${ART_DIRECTION}.`,
  ];

  return parts.join('').slice(0, 600);
}

export function buildItemThumbnailAssetKey(assetId: string): string {
  if (!assetId.trim()) throw new Error('assetId is required');
  return `${ITEM_THUMBNAIL_ASSET_KEY_PREFIX}${assetId.trim()}`;
}

export function parseItemThumbnailAssetKey(assetKey: string | undefined | null): string | null {
  if (!assetKey || typeof assetKey !== 'string') return null;
  const trimmed = assetKey.trim();
  if (!trimmed.startsWith(ITEM_THUMBNAIL_ASSET_KEY_PREFIX)) return null;
  const id = trimmed.slice(ITEM_THUMBNAIL_ASSET_KEY_PREFIX.length).trim();
  return id || null;
}

export function isAllowedItemThumbnailMime(value: string): value is ItemThumbnailMime {
  return (ITEM_THUMBNAIL_ALLOWED_MIME as readonly string[]).includes(value);
}

/** PNG / JPEG / WebP magic-byte sniff (first bytes only). */
export function sniffItemThumbnailMime(bytes: Uint8Array): ItemThumbnailMime | null {
  if (bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // RIFF....WEBP
  if (
    bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export function extensionForItemThumbnailMime(mime: ItemThumbnailMime): 'png' | 'jpg' | 'webp' {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Owner/world-scoped storage object path. Random filename — never user-supplied paths.
 * personal: `{userId}/{definitionId}/{uuid}.{ext}`
 * world: `{userId}/world/{worldId}/{definitionId}/{uuid}.{ext}`
 */
export function buildItemThumbnailStoragePath(options: {
  ownerUserId: string;
  definitionId: string;
  worldProfileId?: string | null;
  assetId: string;
  mime: ItemThumbnailMime;
}): string {
  const ext = extensionForItemThumbnailMime(options.mime);
  const base = `${options.ownerUserId}/${options.definitionId}/${options.assetId}.${ext}`;
  if (options.worldProfileId) {
    return `${options.ownerUserId}/world/${options.worldProfileId}/${options.definitionId}/${options.assetId}.${ext}`;
  }
  return base;
}

function sanitizePromptPart(value: string, max: number): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
