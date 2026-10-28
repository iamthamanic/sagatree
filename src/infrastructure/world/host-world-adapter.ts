/**
 * host-world-adapter — Binds infra HostWorldPorts to an injected host implementation (MIG-313).
 * Location: src/infrastructure/world/host-world-adapter.ts
 *
 * Production UI still calls Supabase `world-*-service` facades. This adapter is the
 * typed cutover seam: tests and future host transport inject a HostWorldPorts
 * implementation. No server/ imports; no client role elevation.
 */

import type { HostWorldPorts } from './host-world-ports.contract';
import { HOST_WORLD_RPC_NAMES } from './host-world-ports.contract';

export type HostWorldAdapter = HostWorldPorts & {
  readonly transport: 'host';
  readonly rpcNames: typeof HOST_WORLD_RPC_NAMES;
};

/**
 * Wrap an injected HostWorldPorts implementation. Callers must supply a
 * verified-actor-backed implementation (host composition / test double).
 */
export function createHostWorldAdapter(ports: HostWorldPorts): HostWorldAdapter {
  return {
    transport: 'host',
    rpcNames: HOST_WORLD_RPC_NAMES,
    listOwnedWorlds: (actorId) => ports.listOwnedWorlds(actorId),
    getWorld: (actorId, worldId) => ports.getWorld(actorId, worldId),
    createOwnedWorld: (actorId, title) => ports.createOwnedWorld(actorId, title),
    updateOwnedWorld: (actorId, worldId, title) => ports.updateOwnedWorld(actorId, worldId, title),
    deleteOwnedWorld: (actorId, worldId) => ports.deleteOwnedWorld(actorId, worldId),
    getWorldMap: (actorId, worldProfileId, playerView) =>
      ports.getWorldMap(actorId, worldProfileId, playerView),
    saveWorldMap: (actorId, worldProfileId, expectedRevision, mapData) =>
      ports.saveWorldMap(actorId, worldProfileId, expectedRevision, mapData),
    ensureWorldAtlasRoot: (actorId, worldProfileId) =>
      ports.ensureWorldAtlasRoot(actorId, worldProfileId),
    listWorldAtlasMaps: (actorId, worldProfileId, playerView, sagaPublicId) =>
      ports.listWorldAtlasMaps(actorId, worldProfileId, playerView, sagaPublicId),
    getWorldAtlasMap: (actorId, mapId, playerView, sagaPublicId) =>
      ports.getWorldAtlasMap(actorId, mapId, playerView, sagaPublicId),
    upsertWorldAtlasMap: (actorId, input) => ports.upsertWorldAtlasMap(actorId, input),
    listWorldPlaces: (actorId, worldProfileId, playerView, sagaPublicId) =>
      ports.listWorldPlaces(actorId, worldProfileId, playerView, sagaPublicId),
    listWorldPlaceMapLinks: (actorId, worldProfileId, playerView, sagaPublicId) =>
      ports.listWorldPlaceMapLinks(actorId, worldProfileId, playerView, sagaPublicId),
    upsertWorldPlace: (actorId, input) => ports.upsertWorldPlace(actorId, input),
    upsertWorldPlaceMapLink: (actorId, input) => ports.upsertWorldPlaceMapLink(actorId, input),
    createWorldNodeWithMaps: (actorId, input) => ports.createWorldNodeWithMaps(actorId, input),
    renameWorldNode: (actorId, input) => ports.renameWorldNode(actorId, input),
    reparentWorldNode: (actorId, input) => ports.reparentWorldNode(actorId, input),
    duplicateWorldNode: (actorId, input) => ports.duplicateWorldNode(actorId, input),
    previewWorldNodeConsequences: (actorId, input) =>
      ports.previewWorldNodeConsequences(actorId, input),
    archiveWorldNodeSubtree: (actorId, input) => ports.archiveWorldNodeSubtree(actorId, input),
    deleteWorldNode: (actorId, input) => ports.deleteWorldNode(actorId, input),
    publishWorldAsset: (actorId, input) => ports.publishWorldAsset(actorId, input),
  };
}
