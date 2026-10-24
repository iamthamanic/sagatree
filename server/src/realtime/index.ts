/**
 * Realtime session rooms — authorized join, durable snapshot, revision resync (MIG-021).
 * Location: server/src/realtime/index.ts
 *
 * Colyseus / WS adapters call into this use-case (GATE-03). Membership is re-checked on
 * every join/resync; a cached room id never elevates a revoked actor. Projection role and
 * reveal grants come from authoritative membership — never from client join payloads.
 * Outbound payloads pass through MIG-024 projections before fan-out.
 */
import type { Actor } from '../modules/identity/index.ts';
import type {
  SessionCommittedPublication,
  SessionPorts,
  SessionRuntimeState,
} from '../modules/session/index.ts';
import {
  projectSessionSnapshot,
  type ProjectionActor,
  type ProjectionRole,
  type SessionProjection,
} from '../projections/index.ts';

export type RealtimeJoinInput = {
  readonly sessionId: string;
  readonly roomId?: string;
  /** Client's last applied revision (0 = full snapshot). */
  readonly clientRevision?: number;
  /**
   * Client-claimed role / reveals are ignored for authorization and projection.
   * Kept optional only for transport DTO compatibility; server derives privileges.
   */
  readonly claimedRole?: string;
  readonly claimedRevealedObjectIds?: readonly string[];
};

export type RealtimeSyncPayload = {
  readonly sessionId: string;
  readonly roomId: string;
  readonly revision: number;
  readonly role: ProjectionRole;
  readonly snapshot: SessionProjection;
  readonly events: readonly Record<string, unknown>[];
  /** True when payload was rebuilt from durable store (e.g. after host restart). */
  readonly reconstructed: boolean;
};

export type RealtimeFanoutMessage = {
  readonly sessionId: string;
  readonly roomId: string;
  readonly actorId: string;
  readonly revision: number;
  readonly kind: string;
  readonly projection: SessionProjection;
};

export type RealtimeResult =
  | { readonly ok: true; readonly sync: RealtimeSyncPayload }
  | {
      readonly ok: false;
      readonly error: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'SESSION_NOT_FOUND' | 'INVALID_PAYLOAD';
    };

export type RealtimeSessionRooms = {
  readonly join: (actor: Actor, input: RealtimeJoinInput) => RealtimeResult;
  readonly resync: (actor: Actor, input: RealtimeJoinInput) => RealtimeResult;
  readonly leave: (
    actor: Actor,
    sessionId: string,
  ) => { readonly ok: true } | { readonly ok: false; readonly error: 'UNAUTHENTICATED' };
  /** Fan-out after durable commit — never called for denied/replayed commands. */
  readonly onCommitted: (event: SessionCommittedPublication) => void;
  readonly occupants: (sessionId: string) => readonly string[];
  readonly roomIdFor: (sessionId: string) => string | null;
};

type Occupant = {
  readonly actorId: string;
  readonly role: ProjectionRole;
};

function roomIdForSession(sessionId: string): string {
  return `session:${sessionId}`;
}

function projectRuntimeSnapshot(
  snapshot: SessionRuntimeState,
  actor: ProjectionActor,
  events: readonly Record<string, unknown>[],
): SessionProjection {
  return projectSessionSnapshot(
    {
      revision: snapshot.revision,
      objects: [],
      shared: {
        sessionId: snapshot.sessionId,
        status: snapshot.status,
        roster: snapshot.roster,
        gameplay: snapshot.gameplay,
        updatedAt: snapshot.updatedAt,
        gmNotes: (snapshot.gameplay as { gmNotes?: string } | undefined)?.gmNotes,
      },
      events,
    },
    actor,
  );
}

/**
 * In-process authorized room registry. Mount via host bootstrap (HTTP/WS adapters).
 * Business logic stays here — never trust client-claimed GM/reveal fields.
 */
export function createRealtimeSessionRooms(deps: {
  readonly session: SessionPorts;
  /** Optional transport sink for projected commit fan-out (WS/Colyseus). */
  readonly onFanout?: (message: RealtimeFanoutMessage) => void;
}): RealtimeSessionRooms {
  const rooms = new Map<string, { roomId: string; occupants: Map<string, Occupant> }>();

  function requireActor(actor: Actor | null | undefined): actor is Actor {
    return Boolean(actor?.actorId);
  }

  function ensureRoom(sessionId: string) {
    let room = rooms.get(sessionId);
    if (!room) {
      room = { roomId: roomIdForSession(sessionId), occupants: new Map() };
      rooms.set(sessionId, room);
    }
    return room;
  }

  function authoritativeRole(actor: Actor, sessionId: string): ProjectionRole | null {
    const membership = deps.session.store.resolveMembership(actor.actorId, sessionId);
    if (!membership.ok) return null;
    // Writers are GM-equivalent for projection; readers are players. Spectators are not
    // session_members — they never join via this path without a future explicit grant table.
    return membership.canWrite ? 'gm' : 'player';
  }

  function buildSync(
    actor: Actor,
    input: RealtimeJoinInput,
    options: { readonly reconstructed: boolean },
  ): RealtimeResult {
    if (!requireActor(actor)) return { ok: false, error: 'UNAUTHENTICATED' };
    if (!input.sessionId || typeof input.sessionId !== 'string') {
      return { ok: false, error: 'INVALID_PAYLOAD' };
    }
    // Room id is a cache key only — membership is authoritative.
    if (input.roomId && input.roomId !== roomIdForSession(input.sessionId)) {
      return { ok: false, error: 'FORBIDDEN' };
    }

    const role = authoritativeRole(actor, input.sessionId);
    if (!role) return { ok: false, error: 'FORBIDDEN' };

    const snap = deps.session.queries.getSnapshot(actor, input.sessionId);
    if (!snap.ok) {
      return {
        ok: false,
        error: snap.error === 'SESSION_NOT_FOUND' ? 'SESSION_NOT_FOUND' : 'FORBIDDEN',
      };
    }

    const clientRevision =
      typeof input.clientRevision === 'number' && Number.isFinite(input.clientRevision)
        ? Math.max(0, Math.floor(input.clientRevision))
        : 0;

    const since = deps.session.store.listEventsSince(actor.actorId, input.sessionId, clientRevision);
    if (!since.ok) {
      return {
        ok: false,
        error: since.error === 'SESSION_NOT_FOUND' ? 'SESSION_NOT_FOUND' : 'FORBIDDEN',
      };
    }

    // Reveals are server-owned; clients cannot self-grant party visibility via join payload.
    const projectionActor: ProjectionActor = {
      actorId: actor.actorId,
      role,
      revealedObjectIds: [],
    };
    const eventRecords = since.events.map((event) => ({
      id: `EV-${event.revision}`,
      revision: event.revision,
      kind: event.kind,
      actorUserId: event.actorUserId,
      payload: event.payload,
    }));
    const projected = projectRuntimeSnapshot(snap.snapshot, projectionActor, eventRecords);

    const room = ensureRoom(input.sessionId);
    room.occupants.set(actor.actorId, { actorId: actor.actorId, role });

    return {
      ok: true,
      sync: {
        sessionId: input.sessionId,
        roomId: room.roomId,
        revision: snap.snapshot.revision,
        role,
        snapshot: projected,
        events: projected.events,
        reconstructed: options.reconstructed,
      },
    };
  }

  return {
    join(actor, input) {
      return buildSync(actor, input, { reconstructed: false });
    },

    resync(actor, input) {
      return buildSync(actor, input, { reconstructed: true });
    },

    leave(actor, sessionId) {
      if (!requireActor(actor)) return { ok: false, error: 'UNAUTHENTICATED' };
      const room = rooms.get(sessionId);
      room?.occupants.delete(actor.actorId);
      if (room && room.occupants.size === 0) rooms.delete(sessionId);
      return { ok: true };
    },

    onCommitted(event) {
      const room = rooms.get(event.sessionId);
      if (!room || room.occupants.size === 0) return;
      for (const occupant of room.occupants.values()) {
        const projectionActor: ProjectionActor = {
          actorId: occupant.actorId,
          role: occupant.role,
          revealedObjectIds: [],
        };
        const projected = projectRuntimeSnapshot(event.snapshot, projectionActor, [
          {
            id: `EV-${event.revision}`,
            revision: event.revision,
            kind: event.kind,
            actorUserId: event.actorUserId,
            payload: event.payload,
          },
        ]);
        deps.onFanout?.({
          sessionId: event.sessionId,
          roomId: room.roomId,
          actorId: occupant.actorId,
          revision: event.revision,
          kind: event.kind,
          projection: projected,
        });
      }
    },

    occupants(sessionId) {
      const room = rooms.get(sessionId);
      return room ? [...room.occupants.keys()] : [];
    },

    roomIdFor(sessionId) {
      return rooms.get(sessionId)?.roomId ?? null;
    },
  };
}
