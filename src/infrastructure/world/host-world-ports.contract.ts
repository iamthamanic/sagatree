/**
 * Host-aligned world ports contract (MIG-313 / #812).
 * Location: src/infrastructure/world/host-world-ports.contract.ts
 *
 * Transport-free DTO mirror of `server/src/modules/world` public ports for all
 * 17 world/atlas/place RPCs + profile CRUD + map-pin/atlas asset publish.
 * Frontend Supabase adapters remain live until cutover; this file documents the
 * host shape for parity checks without importing the Node host package.
 */

import type { HostWorldReadDto, HostWorldReadPort, HostWorldReadResult } from './host-world-read.contract';

export type { HostWorldReadDto, HostWorldReadPort, HostWorldReadResult };

/** Opaque JSON map payload — same shape host stores in world_maps.map_data. */
export type HostWorldMapDto = {
  readonly worldId: string;
  readonly revision: number;
  readonly mapData: Readonly<Record<string, unknown>>;
  readonly playerView: boolean;
};

export type HostWorldAtlasMapSummary = {
  readonly id: string;
  readonly worldProfileId: string;
  readonly parentMapId: string | null;
  readonly kind: string;
  readonly title: string;
  readonly sortOrder: number;
  readonly revision: number;
};

export type HostWorldAtlasMapVm = HostWorldAtlasMapSummary & {
  readonly bounds: Readonly<Record<string, unknown>>;
  readonly layers: Readonly<Record<string, unknown>>;
  readonly basemapStoragePath: string | null;
  readonly azgaarMapStoragePath: string | null;
  readonly generatorMeta: Readonly<Record<string, unknown>>;
};

/** Place / link / mutation DTOs — opaque records matching host VMs (no owner leak). */
export type HostWorldPlaceVm = Readonly<Record<string, unknown>> & {
  readonly id: string;
  readonly worldProfileId: string;
  readonly name: string;
  readonly kind: string;
};

export type HostWorldPlaceMapLinkVm = Readonly<Record<string, unknown>> & {
  readonly id: string;
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
};

/** Mutation inputs — field names align with host store inputs (parentPlaceId, confirm, …). */
export type HostUpsertWorldAtlasMapInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
};

export type HostCreateWorldNodeInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly kind: string;
  readonly name: string;
  readonly idempotencyKey: string;
};

export type HostCreateWorldNodeResult = Readonly<Record<string, unknown>> & {
  readonly targetPlaceId: string;
  readonly worldProfileId: string;
};

export type HostRenameWorldNodeInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly name: string;
};

export type HostReparentWorldNodeInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly placeId: string;
};

export type HostDuplicateWorldNodeInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly placeId: string;
};

export type HostPreviewWorldNodeConsequencesInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
};

export type HostArchiveWorldNodeSubtreeInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly placeId: string;
};

export type HostDeleteWorldNodeInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly placeId: string;
};

export type HostUpsertWorldPlaceInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly kind: string;
  readonly name: string;
};

export type HostUpsertWorldPlaceMapLinkInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
};

/** Map-pin / atlas basemap bytes — host assets, never a SQL table row. */
export type HostWorldAssetPublishInput = {
  readonly worldProfileId: string;
  readonly kind: 'map-pin' | 'world-atlas';
  readonly bytes: Uint8Array;
  readonly contentType: string;
};

export type HostWorldAssetPublishResult = {
  readonly assetId: string;
  readonly contentType: string;
  /** Opaque storage reference (successor of Supabase bucket path). */
  readonly storageRef: string;
};

/**
 * Full infra→host port surface for MIG-313.
 * Actor is a verified identity id string — never a client-supplied role.
 */
export type HostWorldPorts = HostWorldReadPort & {
  readonly createOwnedWorld: (
    actorId: string,
    title: string,
  ) => Promise<HostWorldReadResult<{ readonly id: string; readonly title: string; readonly createdAt: string }>>;
  readonly updateOwnedWorld: (
    actorId: string,
    worldId: string,
    title: string,
  ) => Promise<HostWorldReadResult<HostWorldReadDto>>;
  readonly deleteOwnedWorld: (
    actorId: string,
    worldId: string,
  ) => Promise<HostWorldReadResult<{ readonly deleted: true }>>;

  readonly getWorldMap: (
    actorId: string,
    worldProfileId: string,
    playerView?: boolean,
  ) => Promise<HostWorldReadResult<HostWorldMapDto>>;
  readonly saveWorldMap: (
    actorId: string,
    worldProfileId: string,
    expectedRevision: number | null,
    mapData: Readonly<Record<string, unknown>>,
  ) => Promise<HostWorldReadResult<HostWorldMapDto>>;

  readonly ensureWorldAtlasRoot: (
    actorId: string,
    worldProfileId: string,
  ) => Promise<HostWorldReadResult<readonly HostWorldAtlasMapSummary[]>>;
  readonly listWorldAtlasMaps: (
    actorId: string,
    worldProfileId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => Promise<HostWorldReadResult<readonly HostWorldAtlasMapSummary[]>>;
  readonly getWorldAtlasMap: (
    actorId: string,
    mapId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => Promise<HostWorldReadResult<HostWorldAtlasMapVm>>;
  readonly upsertWorldAtlasMap: (
    actorId: string,
    input: HostUpsertWorldAtlasMapInput,
  ) => Promise<HostWorldReadResult<HostWorldAtlasMapVm>>;

  readonly listWorldPlaces: (
    actorId: string,
    worldProfileId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => Promise<HostWorldReadResult<readonly HostWorldPlaceVm[]>>;
  readonly listWorldPlaceMapLinks: (
    actorId: string,
    worldProfileId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => Promise<HostWorldReadResult<readonly HostWorldPlaceMapLinkVm[]>>;
  readonly upsertWorldPlace: (
    actorId: string,
    input: HostUpsertWorldPlaceInput,
  ) => Promise<HostWorldReadResult<HostWorldPlaceVm>>;
  readonly upsertWorldPlaceMapLink: (
    actorId: string,
    input: HostUpsertWorldPlaceMapLinkInput,
  ) => Promise<HostWorldReadResult<HostWorldPlaceMapLinkVm>>;

  readonly createWorldNodeWithMaps: (
    actorId: string,
    input: HostCreateWorldNodeInput,
  ) => Promise<HostWorldReadResult<HostCreateWorldNodeResult>>;
  readonly renameWorldNode: (
    actorId: string,
    input: HostRenameWorldNodeInput,
  ) => Promise<HostWorldReadResult<HostWorldPlaceVm>>;
  readonly reparentWorldNode: (
    actorId: string,
    input: HostReparentWorldNodeInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;
  readonly duplicateWorldNode: (
    actorId: string,
    input: HostDuplicateWorldNodeInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;
  readonly previewWorldNodeConsequences: (
    actorId: string,
    input: HostPreviewWorldNodeConsequencesInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;
  readonly archiveWorldNodeSubtree: (
    actorId: string,
    input: HostArchiveWorldNodeSubtreeInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;
  readonly deleteWorldNode: (
    actorId: string,
    input: HostDeleteWorldNodeInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;

  /**
   * Storage successor for `world-map-pins` / `world-atlas` buckets.
   * Must not write pin/atlas bytes into world SQL tables.
   */
  readonly publishWorldAsset: (
    actorId: string,
    input: HostWorldAssetPublishInput,
  ) => Promise<HostWorldReadResult<HostWorldAssetPublishResult>>;
};

/** Canonical RPC names from infra-world inventory — 1:1 with host command wrappers. */
export const HOST_WORLD_RPC_NAMES = [
  'archive_world_node_subtree',
  'create_world_node_with_maps',
  'delete_world_node',
  'duplicate_world_node',
  'ensure_world_atlas_root',
  'get_world_atlas_map',
  'get_world_map',
  'list_world_atlas_maps',
  'list_world_place_map_links',
  'list_world_places',
  'preview_world_node_consequences',
  'rename_world_node',
  'reparent_world_node',
  'save_world_map',
  'upsert_world_atlas_map',
  'upsert_world_place',
  'upsert_world_place_map_link',
] as const;

export type HostWorldRpcName = (typeof HOST_WORLD_RPC_NAMES)[number];
