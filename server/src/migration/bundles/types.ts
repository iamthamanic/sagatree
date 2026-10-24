/**
 * Versioned host export/import bundle types (MIG-502 / #843).
 * Location: server/src/migration/bundles/types.ts
 */

export const BUNDLE_FORMAT = 'sagatree-host-bundle' as const;
export const BUNDLE_FORMAT_VERSION = 1 as const;

export type BundleAssetMeta = {
  readonly id: string;
  readonly ownerUserId: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly checksumSha256: string;
  readonly storageKey: string;
  readonly publicId?: string;
};

export type BundleAtlasNode = {
  readonly id: string;
  readonly publicId: string;
  readonly label: string;
  /** When null/undefined, geometry is missing — never invent coordinates. */
  readonly geometry: { readonly x: number; readonly y: number } | null;
};

export type BundleNpc = {
  readonly id: string;
  readonly publicId: string;
  readonly worldId: string;
  readonly displayName: string;
};

export type BundleInventoryItem = {
  readonly id: string;
  readonly publicId: string;
  readonly ownerCharacterId: string;
  readonly definitionId: string;
};

export type BundlePayload = {
  readonly format: typeof BUNDLE_FORMAT;
  readonly formatVersion: typeof BUNDLE_FORMAT_VERSION;
  readonly exportedAt: string;
  readonly sourceOwnerUserId: string;
  readonly worlds: readonly Record<string, unknown>[];
  readonly projects: readonly Record<string, unknown>[];
  readonly projectMembers: readonly Record<string, unknown>[];
  readonly sagaDefinitions: readonly Record<string, unknown>[];
  readonly sagaDefinitionVersions: readonly Record<string, unknown>[];
  readonly assets: readonly BundleAssetMeta[];
  /** Opaque storageKey → base64 bytes (keys must be safe tokens). */
  readonly assetBytes: Readonly<Record<string, string>>;
  readonly atlasNodes: readonly BundleAtlasNode[];
  readonly npcs: readonly BundleNpc[];
  readonly inventory: readonly BundleInventoryItem[];
  /** Explicit missing geometry ids (reported, not invented). */
  readonly missingAtlasGeometryIds: readonly string[];
};

export type SignedBundle = BundlePayload & {
  readonly checksumSha256: string;
};

export type BundleResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export type ImportReport = {
  readonly worldIds: readonly string[];
  readonly projectIds: readonly string[];
  readonly sagaIds: readonly string[];
  readonly assetIds: readonly string[];
  readonly missingAtlasGeometryIds: readonly string[];
  readonly payloadChecksum: string;
};
