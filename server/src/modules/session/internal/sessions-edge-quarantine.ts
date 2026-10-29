/**
 * Quarantined Edge `sessions` worker characterization (MIG-422 / #838).
 * Location: server/src/modules/session/internal/sessions-edge-quarantine.ts
 *
 * NOT a public host route. Legacy worker is dispatcher-unmounted (404).
 * In-memory Maps only — no membership/GM/owner auth; body spreads can alter
 * authority. Do not wire into HTTP/WS without a separate human activation ticket.
 * Current create_play_session / apply_session_runtime_command must not call this.
 */

/** Explicit product decision: no automatic host/public activation. */
export const SESSIONS_EDGE_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/** Legacy Maps are not durable session / chat / savepoint policy. */
export const SESSIONS_EDGE_MAP_IS_DURABLE = false as const;

export type QuarantineSessionStatus = 'scheduled' | 'active' | 'paused' | 'completed';

export type QuarantineWorldState = {
  location: string;
  time: string;
  weather?: string;
  date?: string;
  activeQuests: string[];
  exploredLocations: string[];
  npcs: Record<string, unknown>;
  flags: Record<string, boolean | string | number>;
  inventory: string[];
};

export type QuarantinePlayerState = {
  userId: string;
  characterId: string;
  characterName: string;
  hp: number;
  maxHp: number;
  spellSlots: Record<string, number>;
  conditions: string[];
  inventory: string[];
  experience: number;
  notes?: string;
};

export type QuarantineSavePoint = {
  id: string;
  name: string;
  description?: string;
  worldState: QuarantineWorldState;
  playerStates: QuarantinePlayerState[];
  createdAt: string;
};

export type QuarantineSession = {
  id: string;
  projectId: string;
  sessionNumber: number;
  name: string;
  description?: string;
  status: QuarantineSessionStatus;
  startedAt?: string;
  endedAt?: string;
  worldState: QuarantineWorldState;
  savePoints: QuarantineSavePoint[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type QuarantineChatMessage = {
  id: string;
  sessionId: string;
  userId: string;
  characterId?: string;
  characterName?: string;
  message: string;
  type: 'player' | 'dm' | 'system' | 'npc';
  metadata?: Record<string, unknown>;
  timestamp: string;
};

export type QuarantineSessionPlayer = {
  id: string;
  sessionId: string;
  userId: string;
  characterId?: string;
  isOnline: boolean;
  joinedAt: string;
  leftAt?: string;
  lastActivity: string;
};

export type SessionsEdgeQuarantineStore = {
  readonly sessions: Map<string, QuarantineSession>;
  readonly sessionPlayers: Map<string, QuarantineSessionPlayer[]>;
  readonly chatMessages: Map<string, QuarantineChatMessage[]>;
  idSeq: number;
};

export function createSessionsEdgeQuarantineStore(): SessionsEdgeQuarantineStore {
  return {
    sessions: new Map(),
    sessionPlayers: new Map(),
    chatMessages: new Map(),
    idSeq: 0,
  };
}

function nextId(store: SessionsEdgeQuarantineStore, prefix: string): string {
  store.idSeq += 1;
  return `${prefix}-${store.idSeq}`;
}

export function defaultWorldState(
  partial?: Partial<QuarantineWorldState>,
): QuarantineWorldState {
  return {
    location: partial?.location || 'Unknown',
    time: partial?.time || 'Morning',
    weather: partial?.weather,
    date: partial?.date,
    activeQuests: partial?.activeQuests || [],
    exploredLocations: partial?.exploredLocations || [],
    npcs: partial?.npcs || {},
    flags: partial?.flags || {},
    inventory: partial?.inventory || [],
  };
}

/** Per-Map project numbering — lost across workers/processes. */
export function createQuarantineSession(
  store: SessionsEdgeQuarantineStore,
  data: {
    projectId: string;
    name: string;
    description?: string;
    worldState?: Partial<QuarantineWorldState>;
  },
  nowIso: string,
  id?: string,
): QuarantineSession {
  let sessionNumber = 1;
  for (const session of store.sessions.values()) {
    if (session.projectId === data.projectId) {
      sessionNumber = Math.max(sessionNumber, session.sessionNumber + 1);
    }
  }
  const sessionId = id ?? nextId(store, 'sess');
  const session: QuarantineSession = {
    id: sessionId,
    projectId: data.projectId,
    sessionNumber,
    name: data.name,
    description: data.description,
    status: 'scheduled',
    worldState: defaultWorldState(data.worldState),
    savePoints: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  store.sessions.set(sessionId, session);
  store.sessionPlayers.set(sessionId, []);
  store.chatMessages.set(sessionId, []);
  return session;
}

export function startQuarantineSession(
  store: SessionsEdgeQuarantineStore,
  sessionId: string,
  nowIso: string,
): QuarantineSession {
  const session = store.sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  const updated: QuarantineSession = {
    ...session,
    status: 'active',
    startedAt: nowIso,
    updatedAt: nowIso,
  };
  store.sessions.set(sessionId, updated);
  return updated;
}

export function pauseQuarantineSession(
  store: SessionsEdgeQuarantineStore,
  sessionId: string,
  nowIso: string,
): QuarantineSession {
  const session = store.sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  const updated: QuarantineSession = {
    ...session,
    status: 'paused',
    updatedAt: nowIso,
  };
  store.sessions.set(sessionId, updated);
  return updated;
}

export function endQuarantineSession(
  store: SessionsEdgeQuarantineStore,
  sessionId: string,
  nowIso: string,
): QuarantineSession {
  const session = store.sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  const updated: QuarantineSession = {
    ...session,
    status: 'completed',
    endedAt: nowIso,
    updatedAt: nowIso,
  };
  store.sessions.set(sessionId, updated);
  return updated;
}

/** Chat history default limit 100 (Edge getChatHistory). */
export function sendQuarantineChat(
  store: SessionsEdgeQuarantineStore,
  sessionId: string,
  data: {
    userId: string;
    characterId?: string;
    characterName?: string;
    message: string;
    type: 'player' | 'dm' | 'system' | 'npc';
    metadata?: Record<string, unknown>;
  },
  nowIso: string,
): QuarantineChatMessage {
  const messages = store.chatMessages.get(sessionId) || [];
  const msg: QuarantineChatMessage = {
    id: nextId(store, 'msg'),
    sessionId,
    userId: data.userId,
    characterId: data.characterId,
    characterName: data.characterName,
    message: data.message,
    type: data.type,
    metadata: data.metadata,
    timestamp: nowIso,
  };
  messages.push(msg);
  store.chatMessages.set(sessionId, messages);
  return msg;
}

export function getQuarantineChatHistory(
  store: SessionsEdgeQuarantineStore,
  sessionId: string,
  limit = 100,
): QuarantineChatMessage[] {
  const messages = store.chatMessages.get(sessionId) || [];
  return messages.slice(-limit);
}

export function createQuarantineSavePoint(
  store: SessionsEdgeQuarantineStore,
  sessionId: string,
  data: {
    name: string;
    description?: string;
    playerStates: QuarantinePlayerState[];
  },
  nowIso: string,
): QuarantineSavePoint {
  const session = store.sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  const savePoint: QuarantineSavePoint = {
    id: nextId(store, 'save'),
    name: data.name,
    description: data.description,
    worldState: structuredClone(session.worldState),
    playerStates: data.playerStates.map((p) => ({ ...p })),
    createdAt: nowIso,
  };
  const updated: QuarantineSession = {
    ...session,
    savePoints: [...session.savePoints, savePoint],
    updatedAt: nowIso,
  };
  store.sessions.set(sessionId, updated);
  return savePoint;
}

export function loadQuarantineSavePoint(
  store: SessionsEdgeQuarantineStore,
  sessionId: string,
  savePointId: string,
  nowIso: string,
): { worldState: QuarantineWorldState; playerStates: QuarantinePlayerState[] } {
  const session = store.sessions.get(sessionId);
  if (!session) throw new Error('Session not found');
  const savePoint = session.savePoints.find((sp) => sp.id === savePointId);
  if (!savePoint) throw new Error('Save point not found');
  store.sessions.set(sessionId, {
    ...session,
    worldState: structuredClone(savePoint.worldState),
    updatedAt: nowIso,
  });
  return {
    worldState: structuredClone(savePoint.worldState),
    playerStates: savePoint.playerStates.map((p) => ({ ...p })),
  };
}

/**
 * Legacy defect: body.userId / type:dm / arbitrary worldState are not authority.
 * Quarantine fixtures accept them as data only — never as authz.
 */
export function bodyFieldsAreNotAuthority(): readonly string[] {
  return [
    'body.userId is not authentication',
    'body type:dm is not GM authorization',
    'arbitrary worldState spreads are not membership/owner proof',
  ] as const;
}

export function describeSessionsEdgeLegacyDefects(): readonly string[] {
  return [
    'No membership/GM/owner validation; body spreads can alter session authority/state.',
    'In-memory numbering/chat/savepoints do not provide durable or concurrent runtime guarantees.',
    'Another worker/process loses Map records (SESSIONS_EDGE_MAP_IS_DURABLE=false).',
  ] as const;
}
