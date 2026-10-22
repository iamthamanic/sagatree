/**
 * world module public API — policy-guarded read port (MIG-012).
 * Location: server/src/modules/world/index.ts
 */
import type { Actor } from '../identity/index.ts';
import type { PolicyDecision, PolicyOp, PolicyResource } from '../permissions/index.ts';
import type { WorldReadStore } from './internal/world-read-store.ts';

export type { WorldReadStore, WorldStoredRow } from './internal/world-read-store.ts';

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
};

type AuthorizeFn = (op: PolicyOp, actor: Actor, resource?: PolicyResource) => PolicyDecision;

function toDto(row: { id: string; title: string; createdAt: string }): WorldReadDto {
  return { id: row.id, title: row.title, createdAt: row.createdAt };
}

/**
 * Guarded world read port. Callers outside this module must not import
 * `world/internal` or `world/persistence` — only this barrel.
 */
export function createWorldPorts(deps: {
  readonly authorize: AuthorizeFn;
  readonly store: WorldReadStore;
}): WorldPorts {
  const { authorize, store } = deps;

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

  return { moduleId: 'world', read };
}

/** Stub ports when persistence is unavailable (tests / boot failure paths). */
export function createWorldPortsStub(): WorldPorts {
  return {
    moduleId: 'world',
    read: {
      listOwnedWorlds: () => ({ ok: false, error: 'store-unavailable' }),
      getWorld: () => ({ ok: false, error: 'store-unavailable' }),
    },
  };
}
