/**
 * Item model3d asset contract — stable model3d key + GLB helpers (#141).
 * Domain-pure: no React, no backend clients, no network.
 * Location: src/domains/items/model3d-assets.ts
 */

export const ITEM_MODEL3D_KIND = 'model3d' as const;
export type ItemModel3dKind = typeof ITEM_MODEL3D_KIND;

export const ITEM_MODEL3D_ORIGINS = ['upload', 'meshy'] as const;
export type ItemModel3dOrigin = (typeof ITEM_MODEL3D_ORIGINS)[number];

export const ITEM_MODEL3D_ASSET_KEY_PREFIX = 'model3d:';
export const ITEM_MODEL3D_MAX_BYTES = 50 * 1024 * 1024;
export const ITEM_MODEL3D_MIME = 'model/gltf-binary' as const;
export type ItemModel3dMime = typeof ITEM_MODEL3D_MIME;

/** Manifest fields the UI may show; provider task ids stay infrastructure-only. */
export interface ItemModel3dAssetRecord {
  id: string;
  kind: ItemModel3dKind;
  definitionId: string;
  ownerUserId: string;
  worldProfileId: string | null;
  mime: ItemModel3dMime;
  byteSize: number;
  storagePath: string;
  origin: ItemModel3dOrigin;
  createdAt: string;
}

export type ItemModel3dJobStatus =
  | 'queued'
  | 'waiting'
  | 'generating'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export function buildItemModel3dAssetKey(assetId: string): string {
  if (!assetId.trim()) throw new Error('assetId is required');
  return `${ITEM_MODEL3D_ASSET_KEY_PREFIX}${assetId.trim()}`;
}

export function parseItemModel3dAssetKey(model3d: string | undefined | null): string | null {
  if (!model3d || typeof model3d !== 'string') return null;
  const trimmed = model3d.trim();
  if (!trimmed.startsWith(ITEM_MODEL3D_ASSET_KEY_PREFIX)) return null;
  const id = trimmed.slice(ITEM_MODEL3D_ASSET_KEY_PREFIX.length).trim();
  return id || null;
}

export function isAllowedItemModel3dMime(value: string): value is ItemModel3dMime {
  return value === ITEM_MODEL3D_MIME || value === 'application/octet-stream';
}

/** GLB magic: ASCII "glTF" at offset 0. */
export function sniffItemModel3dGlb(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4
    && bytes[0] === 0x67
    && bytes[1] === 0x6c
    && bytes[2] === 0x54
    && bytes[3] === 0x46
  );
}

/**
 * Owner/world-scoped storage object path. Random filename — never user-supplied paths.
 * personal: `{userId}/{definitionId}/{uuid}.glb`
 * world: `{userId}/world/{worldId}/{definitionId}/{uuid}.glb`
 */
export function buildItemModel3dStoragePath(options: {
  ownerUserId: string;
  definitionId: string;
  worldProfileId?: string | null;
  assetId: string;
}): string {
  if (options.worldProfileId) {
    return `${options.ownerUserId}/world/${options.worldProfileId}/${options.definitionId}/${options.assetId}.glb`;
  }
  return `${options.ownerUserId}/${options.definitionId}/${options.assetId}.glb`;
}
