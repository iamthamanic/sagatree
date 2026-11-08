/**
 * Ephemeral session-lobby ready fan-out (CUT-04b / #1162).
 * Location: server/src/realtime/lobby-ready.ts
 *
 * In-process host realtime hub (CUT-04b) — membership is enforced at the HTTP adapter.
 * Ready is never gameplay authorization; actor identity is stamped server-side.
 */
export type LobbyReadyEvent = {
  readonly userId: string;
  readonly ready: boolean;
  readonly at: string;
};

export type LobbyReadyListener = (event: LobbyReadyEvent) => void;

export type LobbyReadyHub = {
  readonly subscribe: (sessionId: string, listener: LobbyReadyListener) => () => void;
  readonly publish: (sessionId: string, userId: string, ready: boolean) => LobbyReadyEvent;
  readonly snapshot: (sessionId: string) => readonly LobbyReadyEvent[];
  readonly subscriberCount: (sessionId: string) => number;
};

type RoomState = {
  readonly listeners: Set<LobbyReadyListener>;
  /** Latest readiness per user — replayed to late subscribers. */
  readonly readyByUserId: Map<string, LobbyReadyEvent>;
};

export function createLobbyReadyHub(): LobbyReadyHub {
  const rooms = new Map<string, RoomState>();

  function ensureRoom(sessionId: string): RoomState {
    let room = rooms.get(sessionId);
    if (!room) {
      room = { listeners: new Set(), readyByUserId: new Map() };
      rooms.set(sessionId, room);
    }
    return room;
  }

  return {
    subscribe(sessionId, listener) {
      if (!sessionId || typeof sessionId !== 'string') {
        return () => undefined;
      }
      const room = ensureRoom(sessionId);
      room.listeners.add(listener);
      return () => {
        room.listeners.delete(listener);
        // Keep readyByUserId after the last listener leaves so reconnect /
        // late subscribers still receive the last known lobby snapshot.
        if (room.listeners.size === 0 && room.readyByUserId.size === 0) {
          rooms.delete(sessionId);
        }
      };
    },

    publish(sessionId, userId, ready) {
      const event: LobbyReadyEvent = {
        userId,
        ready: ready === true,
        at: new Date().toISOString(),
      };
      if (!sessionId || !userId) return event;
      const room = ensureRoom(sessionId);
      room.readyByUserId.set(userId, event);
      for (const listener of [...room.listeners]) {
        try {
          listener(event);
        } catch {
          /* one bad subscriber must not break fan-out */
        }
      }
      return event;
    },

    snapshot(sessionId) {
      const room = rooms.get(sessionId);
      if (!room) return [];
      return [...room.readyByUserId.values()];
    },

    subscriberCount(sessionId) {
      return rooms.get(sessionId)?.listeners.size ?? 0;
    },
  };
}
