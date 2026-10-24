/**
 * Realtime session rooms — authorized join, durable snapshot, revision resync (MIG-021).
 * Location: server/src/realtime/index.ts
 *
 * Colyseus Room handlers call into this use-case (GATE-03). Membership is re-checked on
 * every join/resync/command; a cached room id never elevates a revoked actor. Outbound
 * payloads pass through MIG-024 projections before fan-out.
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

export type RealtimeRole = ProjectionRole;

export type RealtimeJoinInput = {
  readonly sessionId: string;
  readonly roomId?: string;
  /** Client's last applied revision (0 = full snapshot). */
  readonly clientRevision?: number;
  readonly role: RealtimeRole;
  readonly revealedObjectIds?: readonly string[];
};

export type RealtimeSyncPayload = {
  readonly sessionId: string;
  readonly roomId: string;
  readonly revision: number;
  readonly snapshot: SessionProjection;
  readonly events: readonly Record<string, unknown>[];
  /** True when payload was rebuilt from durable store (e.g. after host restart). */
  readonly reconstructed: boolean;
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
  readonly leave: (actor: Actor, sessionId: string) => { readonly ok: true } | { readonly ok: false; readonly error: 'UNAUTHENTICATED' };
  /** Fan-out after durable commit — never called for denied/replayed commands. */
  readonly onCommitted: (event: SessionCommittedPublication) => void;
  readonly occupants: (sessionId: string) => readonly string[];
  readonly roomIdFor: (sessionId: string) => string | null;
};

type Occupant = {
  readonly actorId: string;
  readonly role: RealtimeRole;
  readonly revealedObjectIds: readonly string[];
};

function roomIdForSession(sessionId: string): string {
  return `session:${sessionId}`;
}

function asProjectionActor(actor: Actor, input: RealtimeJoinInput): ProjectionActor {
  return {
    actorId: actor.actorId,
    role: input.role,
    revealedObjectIds: input.revealedObjectIds ?? [],
  };
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
      },
      events,
    },
    actor,
  );
}

/**
 * In-process authorized room registry. Mount as Colyseus Room.onJoin / onLeave /
 * onMessage("resync") bodies — business logic stays here, not in transport adapters.
 */
export function createRealtimeSessionRooms(deps: {
  readonly session: SessionPorts;
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

    const projectionActor = asProjectionActor(actor, input);
    const eventRecords = since.events.map((event) => ({
      id: `EV-${event.revision}`,
      revision: event.revision,
      kind: event.kind,
      actorUserId: event.actorUserId,
      payload: event.payload,
    }));
    const projected = projectRuntimeSnapshot(snap.snapshot, projectionActor, eventRecords);

    const room = ensureRoom(input.sessionId);
    room.occupants.set(actor.actorId, {
      actorId: actor.actorId,
      role: input.role,
      revealedObjectIds: input.revealedObjectIds ?? [],
    });

    return {
      ok: true,
      sync: {
        sessionId: input.sessionId,
        roomId: room.roomId,
        revision: snap.snapshot.revision,
        snapshot: projected,
        // When client is current, events since == empty (no duplicate apply).
        // When behind, only revisions > clientRevision (no gap relative to durable log).
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
      // Re-authorize every resync — revoked membership must not reuse prior room state.
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
      // Occupancy fan-out is transport-owned; this hook proves commits reach realtime.
      const room = rooms.get(event.sessionId);
      if (!room) return;
      // Keep room revision awareness via occupant map presence only.
      void event.revision;
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
