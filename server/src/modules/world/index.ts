/**
 * world module public API — policy-guarded read + owned create (MIG-012 / #873).
 * Location: server/src/modules/world/index.ts
 *
 * Lorekeeper Map-graph quarantine is exported for MIG-413 fixtures only —
 * not a public HTTP activation surface.
 */
import { randomUUID } from 'node:crypto';
import type { Actor } from '../identity/index.ts';
import type { PolicyDecision, PolicyOp, PolicyResource } from '../permissions/index.ts';
import type { WorldReadStore } from './internal/world-read-store.ts';
import type { WorldWriteStore } from './internal/world-write-store.ts';
import { WorldMapStore, type WorldMapDto } from './internal/world-map-store.ts';
import {
  WorldAtlasStore,
  type UpsertWorldAtlasMapInput,
  type WorldAtlasMapSummary,
  type WorldAtlasMapVm,
} from './internal/world-atlas-store.ts';
import {
  WorldPlacesStore,
  type ArchiveWorldNodeSubtreeInput,
  type ArchiveWorldNodeSubtreeResult,
  type CreateWorldNodeInput,
  type CreateWorldNodeResult,
  type DeleteWorldNodeInput,
  type DeleteWorldNodeResult,
  type DuplicateWorldNodeInput,
  type DuplicateWorldNodeResult,
  type PreviewWorldNodeConsequencesInput,
  type PreviewWorldNodeConsequencesResult,
  type RenameWorldNodeInput,
  type ReparentWorldNodeInput,
  type ReparentWorldNodeResult,
  type UpsertWorldPlaceInput,
  type UpsertWorldPlaceMapLinkInput,
  type WorldPlaceMapLinkVm,
  type WorldPlaceVm,
} from './internal/world-places-store.ts';
import { createPartyRevealedAtlasMapIds } from './internal/atlas-party-projection.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';

export type { WorldReadStore, WorldStoredRow } from './internal/world-read-store.ts';
export type { WorldWriteStore } from './internal/world-write-store.ts';
export type { WorldMapDto } from './internal/world-map-store.ts';
export type {
  UpsertWorldAtlasMapInput,
  WorldAtlasMapSummary,
  WorldAtlasMapVm,
} from './internal/world-atlas-store.ts';
export type {
  ArchiveWorldNodeSubtreeInput,
  ArchiveWorldNodeSubtreeResult,
  CreateWorldNodeInput,
  CreateWorldNodeResult,
  DeleteWorldNodeInput,
  DeleteWorldNodeResult,
  DuplicateWorldNodeInput,
  DuplicateWorldNodeResult,
  PreviewWorldNodeConsequencesInput,
  PreviewWorldNodeConsequencesResult,
  RenameWorldNodeInput,
  ReparentWorldNodeInput,
  ReparentWorldNodeResult,
  UpsertWorldPlaceInput,
  UpsertWorldPlaceMapLinkInput,
  WorldPlaceMapLinkVm,
  WorldPlaceVm,
} from './internal/world-places-store.ts';
export { createSqliteWorldWriteStore } from './internal/world-write-store.ts';

export {
  LOREKEEPER_PUBLIC_ACTIVATION_AUTHORIZED,
  createLoreGraphStore,
  createRelationship,
  getMemories,
  getNPCContext,
  getSessionContext,
  getWorldGraph,
  type Edge,
  type LoreGraphStore,
  type Memory,
  type WorldNode,
} from './internal/lorekeeper-quarantine.ts';

function actorIdentityIds(actor: Actor): readonly string[] {
  const ids = [actor.actorId];
  if (
    actor.kind === 'remote-account' &&
    Array.isArray(actor.linkedSoloActorIds) &&
    actor.linkedSoloActorIds.length > 0
  ) {
    return [...ids, ...actor.linkedSoloActorIds];
  }
  return ids;
}

/** Public world read DTO — no owner id / ORM / HTTP types. */
export type WorldReadDto = {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
};

export type WorldReadOk<T> = { readonly ok: true; readonly value: T };
export type WorldReadErr = { readonly ok: false; readonly error: string };
export type WorldReadResult<T> = WorldReadOk<T> | WorldReadErr;

export type WorldReadPort = {
  readonly listOwnedWorlds: (actor: Actor) => WorldReadResult<readonly WorldReadDto[]>;
  readonly getWorld: (actor: Actor, worldId: string) => WorldReadResult<WorldReadDto>;
};

export type WorldPorts = {
  readonly moduleId: 'world';
  readonly read: WorldReadPort;
  /** Allocate an owner-bound world for a new play group (use-case coordinated). */
  readonly createOwnedWorld: (
    actor: Actor,
    title: string,
  ) => WorldReadResult<{ id: string; title: string; createdAt: string }>;
  readonly getWorldMap: (
    actor: Actor,
    worldProfileId: string,
    playerView?: boolean,
  ) => WorldReadResult<WorldMapDto>;
  readonly saveWorldMap: (
    actor: Actor,
    worldProfileId: string,
    expectedRevision: number | null,
    mapData: Record<string, unknown>,
  ) => WorldReadResult<WorldMapDto>;
  readonly ensureWorldAtlasRoot: (
    actor: Actor,
    worldProfileId: string,
  ) => WorldReadResult<readonly WorldAtlasMapSummary[]>;
  readonly listWorldAtlasMaps: (
    actor: Actor,
    worldProfileId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => WorldReadResult<readonly WorldAtlasMapSummary[]>;
  readonly getWorldAtlasMap: (
    actor: Actor,
    mapId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => WorldReadResult<WorldAtlasMapVm>;
  readonly upsertWorldAtlasMap: (
    actor: Actor,
    input: UpsertWorldAtlasMapInput,
  ) => WorldReadResult<WorldAtlasMapVm>;
  readonly listWorldPlaces: (
    actor: Actor,
    worldProfileId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => WorldReadResult<readonly WorldPlaceVm[]>;
  readonly listWorldPlaceMapLinks: (
    actor: Actor,
    worldProfileId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => WorldReadResult<readonly WorldPlaceMapLinkVm[]>;
  readonly upsertWorldPlace: (
    actor: Actor,
    input: UpsertWorldPlaceInput,
  ) => WorldReadResult<WorldPlaceVm>;
  readonly upsertWorldPlaceMapLink: (
    actor: Actor,
    input: UpsertWorldPlaceMapLinkInput,
  ) => WorldReadResult<WorldPlaceMapLinkVm>;
  readonly createWorldNodeWithMaps: (
    actor: Actor,
    input: CreateWorldNodeInput,
  ) => WorldReadResult<CreateWorldNodeResult>;
  readonly renameWorldNode: (
    actor: Actor,
    input: RenameWorldNodeInput,
  ) => WorldReadResult<WorldPlaceVm>;
  readonly reparentWorldNode: (
    actor: Actor,
    input: ReparentWorldNodeInput,
  ) => WorldReadResult<ReparentWorldNodeResult>;
  readonly duplicateWorldNode: (
    actor: Actor,
    input: DuplicateWorldNodeInput,
  ) => WorldReadResult<DuplicateWorldNodeResult>;
  readonly previewWorldNodeConsequences: (
    actor: Actor,
    input: PreviewWorldNodeConsequencesInput,
  ) => WorldReadResult<PreviewWorldNodeConsequencesResult>;
  readonly archiveWorldNodeSubtree: (
    actor: Actor,
    input: ArchiveWorldNodeSubtreeInput,
  ) => WorldReadResult<ArchiveWorldNodeSubtreeResult>;
  readonly deleteWorldNode: (
    actor: Actor,
    input: DeleteWorldNodeInput,
  ) => WorldReadResult<DeleteWorldNodeResult>;
  /** Owner-only world edit check (promote-to-world / map write parity). */
  readonly canEditWorld: (actorIds: readonly string[], worldId: string) => boolean;
  /** Append a promoted lore fact into worlds.payload.modules.promotedLore (#876). */
  readonly appendPromotedLoreFact: (
    worldId: string,
    fact: Record<string, unknown>,
  ) => { readonly ok: true } | { readonly ok: false; readonly error: string };
};

type AuthorizeFn = (op: PolicyOp, actor: Actor, resource?: PolicyResource) => PolicyDecision;

function toDto(row: { id: string; title: string; createdAt: string }): WorldReadDto {
  return { id: row.id, title: row.title, createdAt: row.createdAt };
}

/**
 * Guarded world read/write port. Callers outside this module must not import
 * `world/internal` or `world/persistence` — only this barrel.
 */
export function createWorldPorts(deps: {
  readonly authorize: AuthorizeFn;
  readonly store: WorldReadStore;
  readonly writeStore?: WorldWriteStore;
  readonly db?: HostDatabase;
  /** Project-module read: GM/member on a project bound to the world. */
  readonly actorCanAccessWorld?: (actorIds: readonly string[], worldId: string) => boolean;
  readonly resolveSagaProjectForWorld?: (worldId: string, sagaPublicId: string) => string | null;
  readonly isActiveProjectMember?: (projectId: string, actorIds: readonly string[]) => boolean;
}): WorldPorts {
  const {
    authorize,
    store,
    writeStore,
    db,
    actorCanAccessWorld,
    resolveSagaProjectForWorld,
    isActiveProjectMember,
  } = deps;
  const maps =
    db && actorCanAccessWorld
      ? new WorldMapStore(db, actorCanAccessWorld)
      : db
        ? new WorldMapStore(db, () => false)
        : null;
  const atlas =
    db && actorCanAccessWorld && resolveSagaProjectForWorld && isActiveProjectMember
      ? new WorldAtlasStore(db, {
          canAccessWorld: actorCanAccessWorld,
          resolveSagaProject: resolveSagaProjectForWorld,
          isActiveProjectMember,
          partyRevealedMapIds: createPartyRevealedAtlasMapIds(db),
        })
      : null;
  const places =
    db && actorCanAccessWorld && resolveSagaProjectForWorld && isActiveProjectMember
      ? new WorldPlacesStore(db, {
          canAccessWorld: actorCanAccessWorld,
          resolveSagaProject: resolveSagaProjectForWorld,
          isActiveProjectMember,
        })
      : null;

  const read: WorldReadPort = {
    listOwnedWorlds(actor: Actor): WorldReadResult<readonly WorldReadDto[]> {
      if (!actor?.actorId) return { ok: false, error: 'missing-actor' };
      // Owner-scoped list: empty resource filter must not widen — only actor's rows.
      const rows = store.listByOwner(actor.actorId);
      return { ok: true, value: rows.map(toDto) };
    },

    getWorld(actor: Actor, worldId: string): WorldReadResult<WorldReadDto> {
      if (!actor?.actorId) return { ok: false, error: 'missing-actor' };
      const id = typeof worldId === 'string' ? worldId.trim() : '';
      if (!id) return { ok: false, error: 'missing-world' };

      const decision = authorize('world.read', actor, { worldId: id });
      if (!decision.allow) {
        // Fail closed without projecting private attributes (Fall 2).
        return { ok: false, error: decision.reason === 'missing-world' ? 'missing-world' : 'not-authorized' };
      }

      const row = store.findById(id);
      if (!row) return { ok: false, error: 'world-not-found' };
      return { ok: true, value: toDto(row) };
    },
  };

  return {
    moduleId: 'world',
    read,
    createOwnedWorld(actor, title) {
      if (!actor?.actorId) return { ok: false, error: 'missing-actor' };
      if (!writeStore) return { ok: false, error: 'store-unavailable' };
      // Owner is always the authenticated actor — no client-supplied owner elevation.
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const safeTitle = typeof title === 'string' && title.trim() ? title.trim() : 'World';
      try {
        writeStore.insertOwned({
          id,
          ownerUserId: actor.actorId,
          title: safeTitle,
          createdAt,
        });
      } catch {
        return { ok: false, error: 'P0001' };
      }
      return { ok: true, value: { id, title: safeTitle, createdAt } };
    },

    getWorldMap(actor, worldProfileId, playerView = false) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!maps) return { ok: false, error: 'store-unavailable' };
      const id = typeof worldProfileId === 'string' ? worldProfileId.trim() : '';
      if (!id) return { ok: false, error: '22023' };
      const ids = actorIdentityIds(actor);
      // Do not reveal existence: missing and unauthorized both → 42501 (legacy parity).
      if (!maps.worldExists(id) || !maps.canReadWorld(ids, id)) {
        return { ok: false, error: '42501' };
      }
      const canEdit = maps.canEditWorld(ids, id);
      const forcePlayer = !canEdit || playerView === true;
      return { ok: true, value: maps.getMap(id, forcePlayer) };
    },

    ensureWorldAtlasRoot(actor, worldProfileId) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!atlas) return { ok: false, error: 'store-unavailable' };
      const worldId = typeof worldProfileId === 'string' ? worldProfileId.trim() : '';
      if (!worldId) return { ok: false, error: '22023' };
      const ids = actorIdentityIds(actor);
      return atlas.ensureRoot(ids, worldId);
    },

    listWorldAtlasMaps(actor, worldProfileId, playerView = false, sagaPublicId = null) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!atlas) return { ok: false, error: 'store-unavailable' };
      const worldId = typeof worldProfileId === 'string' ? worldProfileId.trim() : '';
      if (!worldId) return { ok: false, error: '22023' };
      if (sagaPublicId !== null && sagaPublicId !== undefined && typeof sagaPublicId !== 'string') {
        return { ok: false, error: '22023' };
      }
      const saga =
        typeof sagaPublicId === 'string' && sagaPublicId.trim().length > 0
          ? sagaPublicId.trim()
          : null;
      const ids = actorIdentityIds(actor);
      return atlas.listMaps(ids, worldId, playerView, saga);
    },

    getWorldAtlasMap(actor, mapId, playerView = false, sagaPublicId = null) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!atlas) return { ok: false, error: 'store-unavailable' };
      const id = typeof mapId === 'string' ? mapId.trim() : '';
      if (!id) return { ok: false, error: '22023' };
      if (sagaPublicId !== null && sagaPublicId !== undefined && typeof sagaPublicId !== 'string') {
        return { ok: false, error: '22023' };
      }
      const saga = typeof sagaPublicId === 'string' ? sagaPublicId.trim() : null;
      const ids = actorIdentityIds(actor);
      return atlas.getMap(ids, id, playerView, saga === '' ? null : saga);
    },

    upsertWorldAtlasMap(actor, input) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!atlas) return { ok: false, error: 'store-unavailable' };
      const worldProfileId =
        typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
      if (!worldProfileId) return { ok: false, error: '22023' };
      const ids = actorIdentityIds(actor);
      return atlas.upsertMap(ids, { ...input, worldProfileId });
    },

    listWorldPlaces(actor, worldProfileId, playerView = false, sagaPublicId = null) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!places) return { ok: false, error: 'store-unavailable' };
      const worldId = typeof worldProfileId === 'string' ? worldProfileId.trim() : '';
      if (!worldId) return { ok: false, error: '22023' };
      if (sagaPublicId !== null && sagaPublicId !== undefined && typeof sagaPublicId !== 'string') {
        return { ok: false, error: '22023' };
      }
      const saga =
        typeof sagaPublicId === 'string' && sagaPublicId.trim().length > 0
          ? sagaPublicId.trim()
          : null;
      const ids = actorIdentityIds(actor);
      return places.listPlaces(ids, worldId, playerView, saga);
    },

    listWorldPlaceMapLinks(actor, worldProfileId, playerView = false, sagaPublicId = null) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!places) return { ok: false, error: 'store-unavailable' };
      const worldId = typeof worldProfileId === 'string' ? worldProfileId.trim() : '';
      if (!worldId) return { ok: false, error: '22023' };
      if (sagaPublicId !== null && sagaPublicId !== undefined && typeof sagaPublicId !== 'string') {
        return { ok: false, error: '22023' };
      }
      const saga =
        typeof sagaPublicId === 'string' && sagaPublicId.trim().length > 0
          ? sagaPublicId.trim()
          : null;
      const ids = actorIdentityIds(actor);
      return places.listMapLinks(ids, worldId, playerView, saga);
    },

    upsertWorldPlace(actor, input) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!places) return { ok: false, error: 'store-unavailable' };
      const worldProfileId =
        typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
      if (!worldProfileId) return { ok: false, error: '22023' };
      const ids = actorIdentityIds(actor);
      return places.upsertPlace(ids, { ...input, worldProfileId });
    },

    upsertWorldPlaceMapLink(actor, input) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!places) return { ok: false, error: 'store-unavailable' };
      const worldProfileId =
        typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
      if (!worldProfileId) return { ok: false, error: '22023' };
      const ids = actorIdentityIds(actor);
      return places.upsertMapLink(ids, { ...input, worldProfileId });
    },

    createWorldNodeWithMaps(actor, input) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!places) return { ok: false, error: 'store-unavailable' };
      const worldProfileId =
        typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
      if (!worldProfileId) return { ok: false, error: '22023' };
      const ids = actorIdentityIds(actor);
      return places.createWorldNodeWithMaps(ids, { ...input, worldProfileId });
    },

    renameWorldNode(actor, input) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!places) return { ok: false, error: 'store-unavailable' };
      const worldProfileId =
        typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
      if (!worldProfileId) return { ok: false, error: '22023' };
      const ids = actorIdentityIds(actor);
      return places.renameWorldNode(ids, { ...input, worldProfileId });
    },

    reparentWorldNode(actor, input) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!places) return { ok: false, error: 'store-unavailable' };
      const worldProfileId =
        typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
      if (!worldProfileId) return { ok: false, error: '22023' };
      const ids = actorIdentityIds(actor);
      return places.reparentWorldNode(ids, { ...input, worldProfileId });
    },

    duplicateWorldNode(actor, input) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!places) return { ok: false, error: 'store-unavailable' };
      const worldProfileId =
        typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
      if (!worldProfileId) return { ok: false, error: '22023' };
      const ids = actorIdentityIds(actor);
      return places.duplicateWorldNode(ids, { ...input, worldProfileId });
    },

    previewWorldNodeConsequences(actor, input) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!places) return { ok: false, error: 'store-unavailable' };
      const worldProfileId =
        typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
      if (!worldProfileId) return { ok: false, error: '22023' };
      const ids = actorIdentityIds(actor);
      return places.previewWorldNodeConsequences(ids, { ...input, worldProfileId });
    },

    archiveWorldNodeSubtree(actor, input) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!places) return { ok: false, error: 'store-unavailable' };
      const worldProfileId =
        typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
      if (!worldProfileId) return { ok: false, error: '22023' };
      const ids = actorIdentityIds(actor);
      return places.archiveWorldNodeSubtree(ids, { ...input, worldProfileId });
    },

    deleteWorldNode(actor, input) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!places) return { ok: false, error: 'store-unavailable' };
      const worldProfileId =
        typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
      if (!worldProfileId) return { ok: false, error: '22023' };
      const ids = actorIdentityIds(actor);
      return places.deleteWorldNode(ids, { ...input, worldProfileId });
    },

    saveWorldMap(actor, worldProfileId, expectedRevision, mapData) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      if (!maps) return { ok: false, error: 'store-unavailable' };
      const id = typeof worldProfileId === 'string' ? worldProfileId.trim() : '';
      if (!id) return { ok: false, error: '22023' };
      const ids = actorIdentityIds(actor);
      if (!maps.worldExists(id) || !maps.canEditWorld(ids, id)) {
        return { ok: false, error: '42501' };
      }
      if (!mapData || typeof mapData !== 'object' || Array.isArray(mapData)) {
        return { ok: false, error: '22023' };
      }
      return maps.saveMap(id, expectedRevision, mapData);
    },

    canEditWorld(actorIds, worldId) {
      if (!maps) return false;
      const id = typeof worldId === 'string' ? worldId.trim() : '';
      if (!id) return false;
      return maps.canEditWorld(actorIds, id);
    },

    appendPromotedLoreFact(worldId, fact) {
      if (!db) return { ok: false, error: 'store-unavailable' };
      const id = typeof worldId === 'string' ? worldId.trim() : '';
      if (!id) return { ok: false, error: '22023' };
      const world = db
        .prepare(`SELECT payload FROM worlds WHERE id = ?`)
        .get(id) as { payload: string } | undefined;
      if (!world) return { ok: false, error: '22023' };
      let payload: Record<string, unknown> = {};
      try {
        const parsed: unknown = JSON.parse(world.payload || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          payload = { ...(parsed as Record<string, unknown>) };
        }
      } catch {
        payload = {};
      }
      const modules =
        payload.modules && typeof payload.modules === 'object' && !Array.isArray(payload.modules)
          ? { ...(payload.modules as Record<string, unknown>) }
          : {};
      const promotedLore =
        modules.promotedLore &&
        typeof modules.promotedLore === 'object' &&
        !Array.isArray(modules.promotedLore)
          ? { ...(modules.promotedLore as Record<string, unknown>) }
          : {};
      const facts = Array.isArray(promotedLore.facts) ? [...promotedLore.facts] : [];
      const factId = String(fact.id ?? '');
      const exists = facts.some(
        (f) =>
          f &&
          typeof f === 'object' &&
          !Array.isArray(f) &&
          String((f as { id?: unknown }).id ?? '') === factId,
      );
      if (!exists) {
        facts.push(fact);
        promotedLore.facts = facts;
        modules.promotedLore = promotedLore;
        payload.modules = modules;
        db.prepare(`UPDATE worlds SET payload = ? WHERE id = ?`).run(
          JSON.stringify(payload),
          id,
        );
      }
      return { ok: true };
    },
  };
}

/** Stub ports when persistence is unavailable (tests / boot failure paths). */
export function createWorldPortsStub(): WorldPorts {
  return {
    moduleId: 'world',
    read: {
      listOwnedWorlds: () => ({ ok: false, error: 'store-unavailable' }),
      getWorld: () => ({ ok: false, error: 'store-unavailable' }),
    },
    createOwnedWorld: () => ({ ok: false, error: 'store-unavailable' }),
    getWorldMap: () => ({ ok: false, error: 'store-unavailable' }),
    saveWorldMap: () => ({ ok: false, error: 'store-unavailable' }),
    ensureWorldAtlasRoot: () => ({ ok: false, error: 'store-unavailable' }),
    listWorldAtlasMaps: () => ({ ok: false, error: 'store-unavailable' }),
    getWorldAtlasMap: () => ({ ok: false, error: 'store-unavailable' }),
    upsertWorldAtlasMap: () => ({ ok: false, error: 'store-unavailable' }),
    listWorldPlaces: () => ({ ok: false, error: 'store-unavailable' }),
    listWorldPlaceMapLinks: () => ({ ok: false, error: 'store-unavailable' }),
    upsertWorldPlace: () => ({ ok: false, error: 'store-unavailable' }),
    upsertWorldPlaceMapLink: () => ({ ok: false, error: 'store-unavailable' }),
    createWorldNodeWithMaps: () => ({ ok: false, error: 'store-unavailable' }),
    renameWorldNode: () => ({ ok: false, error: 'store-unavailable' }),
    reparentWorldNode: () => ({ ok: false, error: 'store-unavailable' }),
    duplicateWorldNode: () => ({ ok: false, error: 'store-unavailable' }),
    previewWorldNodeConsequences: () => ({ ok: false, error: 'store-unavailable' }),
    archiveWorldNodeSubtree: () => ({ ok: false, error: 'store-unavailable' }),
    deleteWorldNode: () => ({ ok: false, error: 'store-unavailable' }),
    canEditWorld: () => false,
    appendPromotedLoreFact: () => ({ ok: false, error: 'store-unavailable' }),
  };
}
