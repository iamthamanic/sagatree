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
import type { HostDatabase } from '../../persistence/open-database.ts';

export type { WorldReadStore, WorldStoredRow } from './internal/world-read-store.ts';
export type { WorldWriteStore } from './internal/world-write-store.ts';
export type { WorldMapDto } from './internal/world-map-store.ts';
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
}): WorldPorts {
  const { authorize, store, writeStore, db, actorCanAccessWorld } = deps;
  const maps =
    db && actorCanAccessWorld
      ? new WorldMapStore(db, actorCanAccessWorld)
      : db
        ? new WorldMapStore(db, () => false)
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
  };
}
