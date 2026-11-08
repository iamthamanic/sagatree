/**
 * session-runtime-service — Snapshot + revisioned mutating commands for SessionRuntimeState (CUT-20).
 * Location: src/infrastructure/session/session-runtime-service.ts
 */
import type {
  SessionEventKind,
  SessionRuntimeState,
} from '../../domains/session/contracts/session-runtime';
import {
  StaleRuntimeRevisionError,
  assertSessionEventKind,
  emptyGameplayState,
  normalizeRuntimeStatus,
} from '../../domains/session/contracts/session-runtime';
import {
  applyHostSessionRuntimeCommand,
  fetchHostSessionRuntime,
  isHostLibraryEnabled,
  setHostSessionPresence,
} from '../host/host-session-http';

type SnapshotJson = {
  sessionId?: string;
  revision?: number;
  status?: string;
  roster?: unknown;
  gameplay?: unknown;
  updatedAt?: string;
  idempotentReplay?: boolean;
  eventId?: string;
};

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

function mapRoster(raw: unknown): import('../../domains/session/contracts/session-runtime').SessionPresenceEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: import('../../domains/session/contracts/session-runtime').SessionPresenceEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const userId = typeof row.userId === 'string' ? row.userId : null;
    if (!userId) continue;
    out.push({
      userId,
      characterId: typeof row.characterId === 'string' ? row.characterId : null,
      isOnline: row.isOnline === true,
      joinedAt: typeof row.joinedAt === 'string' ? row.joinedAt : new Date(0).toISOString(),
    });
  }
  return out;
}

function mapGameplay(raw: unknown): import('../../domains/session/contracts/session-runtime').SessionGameplayState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyGameplayState();
  }
  const row = raw as Record<string, unknown>;
  const sceneId = typeof row.sceneId === 'string' && row.sceneId.trim() !== '' ? row.sceneId : null;
  const combatActive = row.combatActive === true;
  const sharedRaw = row.shared;
  const shared =
    sharedRaw && typeof sharedRaw === 'object' && !Array.isArray(sharedRaw)
      ? (sharedRaw as Record<string, unknown>)
      : {};
  return { sceneId, combatActive, shared };
}

export function mapSnapshotJson(data: SnapshotJson): SessionRuntimeState {
  const sessionId = typeof data.sessionId === 'string' ? data.sessionId : '';
  if (!sessionId) {
    throw new Error('Runtime-Snapshot ohne sessionId');
  }
  const revision = typeof data.revision === 'number' ? data.revision : Number(data.revision ?? 0);
  if (!Number.isFinite(revision)) {
    throw new Error('Runtime-Snapshot ohne gültige Revision');
  }
  return {
    sessionId,
    revision,
    status: normalizeRuntimeStatus(typeof data.status === 'string' ? data.status : 'waiting'),
    roster: mapRoster(data.roster),
    gameplay: mapGameplay(data.gameplay),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
  };
}

function isStaleRpcError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('stale revision') || lower.includes('40001');
}

class SessionRuntimeService {
  async getSnapshot(sessionId: string): Promise<SessionRuntimeState> {
    assertHost();
    const data = await fetchHostSessionRuntime(sessionId);
    return mapSnapshotJson(data as SnapshotJson);
  }

  async applyCommand(input: {
    sessionId: string;
    expectedRevision: number;
    kind: SessionEventKind | string;
    payload?: Record<string, unknown>;
    idempotencyKey?: string | null;
  }): Promise<SessionRuntimeState> {
    assertHost();
    const kind = assertSessionEventKind(input.kind);
    try {
      const data = await applyHostSessionRuntimeCommand({
        sessionId: input.sessionId,
        expectedRevision: input.expectedRevision,
        kind,
        payload: input.payload ?? {},
        idempotencyKey: input.idempotencyKey ?? null,
      });
      return mapSnapshotJson(data as SnapshotJson);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isStaleRpcError(message) || /STALE_REVISION/i.test(message)) {
        const snap = await this.getSnapshot(input.sessionId);
        throw new StaleRuntimeRevisionError(input.expectedRevision, snap.revision);
      }
      throw err instanceof Error ? err : new Error(message);
    }
  }

  async setPresence(
    sessionId: string,
    isOnline: boolean,
    expectedRevision?: number | null,
  ): Promise<SessionRuntimeState> {
    assertHost();
    try {
      const data = await setHostSessionPresence(sessionId, isOnline, expectedRevision);
      return mapSnapshotJson(data as SnapshotJson);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isStaleRpcError(message) || /STALE_REVISION/i.test(message)) {
        const snap = await this.getSnapshot(sessionId);
        throw new StaleRuntimeRevisionError(expectedRevision ?? -1, snap.revision);
      }
      throw err instanceof Error ? err : new Error(message);
    }
  }
}

export const sessionRuntimeService = new SessionRuntimeService();
