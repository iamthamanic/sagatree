/**
 * session-service — Host HTTP for play sessions (CUT-20).
 * Location: src/infrastructure/session/session-service.ts
 */
import type {
  SessionVm,
  CreateSessionDto,
  JoinSessionDto,
  PlaySessionStatus,
} from '../../domains/session/contracts/session.types';
import {
  assertPlaySessionStatusTransition,
  normalizePlaySessionStatus,
  normalizeSessionJoinCode,
} from '../../domains/session/contracts/session-lifecycle';
import {
  mapInviteCreatePayload,
  mapInviteResolvePayload,
  normalizeInviteToken,
  type SessionInviteCreateResult,
  type SessionInviteResolveResult,
} from '../../domains/session/contracts/session-invite';
import {
  createHostPlaySession,
  createHostSessionInvite,
  fetchHostSession,
  fetchHostSessions,
  isHostLibraryEnabled,
  joinHostSessionByCode,
  leaveHostPlaySession,
  deleteHostPlaySession,
  resolveHostSessionInvite,
  revokeHostSessionInvite,
  setHostSessionStatus,
  type HostPlaySessionDto,
} from '../host/host-session-http';

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

function mapHostPlaySessionToVm(row: HostPlaySessionDto): SessionVm {
  const createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
  const code = row.joinCode ?? row.code ?? '';
  return {
    id: row.sessionId,
    code: typeof code === 'string' ? code : '',
    name: row.name ?? '',
    adventureId: row.projectId,
    projectId: row.projectId,
    publicId: row.publicId ?? null,
    gmUserId: row.gmUserId ?? '',
    status: normalizePlaySessionStatus(row.status),
    createdAt,
    updatedAt: createdAt,
    startedAt: row.startedAt ? new Date(row.startedAt) : null,
    endedAt: row.endedAt ? new Date(row.endedAt) : null,
    players: (row.players ?? []).map((p, index) => ({
      id: p.id ?? `${row.sessionId}-${p.userId ?? index}`,
      sessionId: row.sessionId,
      userId: p.userId ?? '',
      characterId: p.characterId ?? null,
      isOnline: p.isOnline === true,
      joinedAt: p.joinedAt ? new Date(p.joinedAt) : createdAt,
    })),
  };
}

class SessionService {
  async createSession(payload: CreateSessionDto): Promise<SessionVm> {
    assertHost();
    const projectId = payload.project_id || payload.adventure_id;
    if (!projectId) {
      throw new Error('project_id ist erforderlich, um eine Session zu erstellen');
    }
    const row = await createHostPlaySession(projectId, payload.name ?? null);
    return mapHostPlaySessionToVm(row);
  }

  async joinSession(payload: JoinSessionDto): Promise<SessionVm> {
    assertHost();
    const code = normalizeSessionJoinCode(payload.code);
    const row = await joinHostSessionByCode(code, payload.character_id ?? null);
    return mapHostPlaySessionToVm(row);
  }

  async getSessionById(id: string): Promise<SessionVm> {
    assertHost();
    const row = await fetchHostSession(id);
    return mapHostPlaySessionToVm(row);
  }

  async getUserSessions(): Promise<SessionVm[]> {
    assertHost();
    const rows = await fetchHostSessions();
    return rows.map(mapHostPlaySessionToVm);
  }

  async updateSessionStatus(id: string, status: PlaySessionStatus): Promise<SessionVm> {
    assertHost();
    const current = await this.getSessionById(id);
    assertPlaySessionStatusTransition(current.status, status);
    const row = await setHostSessionStatus(id, status);
    return mapHostPlaySessionToVm(row);
  }

  async leaveSession(sessionId: string): Promise<void> {
    assertHost();
    await leaveHostPlaySession(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    assertHost();
    const id = sessionId.trim();
    if (!id) {
      throw new Error('Session-ID fehlt');
    }
    try {
      await deleteHostPlaySession(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/42501|forbidden|not[_-]?authorized/i.test(message)) {
        throw new Error('Nur der Gamemaster kann Sessions löschen.');
      }
      throw new Error(
        message.includes('Host-Session löschen fehlgeschlagen')
          ? message
          : `Session konnte nicht gelöscht werden: ${message}`,
      );
    }
  }

  async createSessionInvite(sessionId: string): Promise<SessionInviteCreateResult> {
    assertHost();
    const invite = await createHostSessionInvite(sessionId);
    const mapped = mapInviteCreatePayload(invite);
    if (!mapped) {
      throw new Error('Einladung konnte nicht erstellt werden: ungültige Server-Antwort');
    }
    return mapped;
  }

  async resolveSessionInvite(token: string): Promise<SessionInviteResolveResult> {
    assertHost();
    const normalized = normalizeInviteToken(token);
    if (!normalized) {
      return { ok: false, errorCode: 'missing_token' };
    }
    try {
      const invite = await resolveHostSessionInvite(normalized);
      return mapInviteResolvePayload(invite);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return mapInviteResolvePayload({
        ok: false,
        error_code: message.includes('expired')
          ? 'expired'
          : message.includes('revoked')
            ? 'revoked'
            : message.includes('completed')
              ? 'session_completed'
              : message.includes('missing') || message.includes('P0002')
                ? 'not_found'
                : 'not_found',
      });
    }
  }

  async revokeSessionInvite(token: string): Promise<void> {
    assertHost();
    const normalized = normalizeInviteToken(token);
    if (!normalized) {
      throw new Error('Token fehlt');
    }
    await revokeHostSessionInvite(normalized);
  }
}

export const sessionService = new SessionService();
