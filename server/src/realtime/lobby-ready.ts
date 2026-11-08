/**
 * Ephemeral session-lobby ready fan-out (CUT-04b / #1162).
 * Location: server/src/realtime/lobby-ready.ts
 *
 * In-process host realtime hub — membership is enforced at the HTTP adapter.
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
  readonly subscriberCount: (sessionId: string) => number;
};

type RoomState = {
  readonly listeners: Set<LobbyReadyListener>;
};

export function createLobbyReadyHub(): LobbyReadyHub {
  const rooms = new Map<string, RoomState>();

  function ensureRoom(sessionId: string): RoomState {
    let room = rooms.get(sessionId);
    if (!room) {
      room = { listeners: new Set() };
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
        if (room.listeners.size === 0) rooms.delete(sessionId);
      };
    },

    publish(sessionId, userId, ready) {
      const event: LobbyReadyEvent = {
        userId,
        ready: ready === true,
        at: new Date().toISOString(),
      };
      if (!sessionId || !userId) return event;
      const room = rooms.get(sessionId);
      if (!room) return event;
      for (const listener of [...room.listeners]) {
        try {
          listener(event);
        } catch {
          /* one bad subscriber must not break fan-out */
        }
      }
      return event;
    },

    subscriberCount(sessionId) {
      return rooms.get(sessionId)?.listeners.size ?? 0;
    },
  };
}
