/**
 * session-runtime-service — Snapshot + revisioned mutating commands for SessionRuntimeState.
 * Location: src/infrastructure/session/session-runtime-service.ts
 * Hides: Supabase RPC transport; maps JSON → domain SessionRuntimeState.
 */
import { supabase } from '../../lib/supabase';
import type {
  SessionEventKind,
  SessionGameplayState,
  SessionPresenceEntry,
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

function mapRoster(raw: unknown): SessionPresenceEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SessionPresenceEntry[] = [];
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

function mapGameplay(raw: unknown): SessionGameplayState {
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
    if (isHostLibraryEnabled()) {
      const data = await fetchHostSessionRuntime(sessionId);
      return mapSnapshotJson(data as SnapshotJson);
    }
    const { data, error } = await supabase.rpc('get_session_runtime_snapshot', {
      p_session_id: sessionId,
    });
    if (error || !data) {
      throw new Error(error?.message ?? 'Runtime-Snapshot fehlgeschlagen');
    }
    return mapSnapshotJson(data as SnapshotJson);
  }

  async applyCommand(input: {
    sessionId: string;
    expectedRevision: number;
    kind: SessionEventKind | string;
    payload?: Record<string, unknown>;
    idempotencyKey?: string | null;
  }): Promise<SessionRuntimeState> {
    const kind = assertSessionEventKind(input.kind);
    if (isHostLibraryEnabled()) {
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
    const { data, error } = await supabase.rpc('apply_session_runtime_command', {
      p_session_id: input.sessionId,
      p_expected_revision: input.expectedRevision,
      p_kind: kind,
      p_payload: input.payload ?? {},
      p_idempotency_key: input.idempotencyKey ?? null,
    });

    if (error) {
      if (isStaleRpcError(error.message)) {
        const snap = await this.getSnapshot(input.sessionId);
        throw new StaleRuntimeRevisionError(input.expectedRevision, snap.revision);
      }
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error('Runtime-Befehl lieferte kein Ergebnis');
    }
    return mapSnapshotJson(data as SnapshotJson);
  }

  async setPresence(
    sessionId: string,
    isOnline: boolean,
    expectedRevision?: number | null,
  ): Promise<SessionRuntimeState> {
    if (isHostLibraryEnabled()) {
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
    const { data, error } = await supabase.rpc('set_session_player_presence', {
      p_session_id: sessionId,
      p_is_online: isOnline,
      p_expected_revision: expectedRevision ?? null,
    });
    if (error) {
      if (isStaleRpcError(error.message)) {
        const snap = await this.getSnapshot(sessionId);
        throw new StaleRuntimeRevisionError(expectedRevision ?? -1, snap.revision);
      }
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error('Presence-Update fehlgeschlagen');
    }
    return mapSnapshotJson(data as SnapshotJson);
  }
}

export const sessionRuntimeService = new SessionRuntimeService();
