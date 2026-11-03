/**
 * session-service — Self-host session persistence via SECURITY DEFINER RPCs.
 * Location: src/infrastructure/session/session-service.ts
 * Hides: Supabase RPC/table transport for play-session create/join/leave/status.
 * No Hosted make-server URLs; no client-generated session codes.
 *
 * #569: Never select sessions.world_state or sessions.notes — revoked for
 * authenticated; use get_session_runtime_snapshot for projected runtime.
 */
import { supabase } from '../../lib/supabase';
import {
  isLocalAdminSession,
  LOCAL_ADMIN_USER_ID,
} from '../../lib/localAdmin';
import type {
  SessionDto,
  SessionVm,
  CreateSessionDto,
  JoinSessionDto,
  SessionPlayerDto,
  SessionPlayerVm,
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
  resolveHostSessionInvite,
  revokeHostSessionInvite,
  setHostSessionStatus,
  type HostPlaySessionDto,
} from '../host/host-session-http';

/** Safe session columns for authenticated SELECT (#569 — excludes world_state, notes). */
const SESSION_SAFE_COLUMNS =
  'id, public_id, project_id, session_number, name, description, status, code, started_at, ended_at, look_profile_id, created_at, updated_at';

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

type SessionRow = {
  id: string;
  /** Join code — optional; not always present on older schemas / safe selects. */
  code?: string | null;
  name: string | null;
  project_id: string | null;
  public_id?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  ended_at: string | null;
};

class SessionService {
  private readonly tableName = 'sessions';
  private readonly playersTableName = 'session_players';

  /**
   * Prefer getSession (storage) over getUser (network JWT validation). Fall back
   * to the Local Admin offline identity when AuthContext is authenticated without
   * a GoTrue JWT (CI Browser E2E / timeout fallback).
   */
  private async requireAuthUser(): Promise<{ id: string }> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) return user;

    if (isLocalAdminSession()) {
      return { id: LOCAL_ADMIN_USER_ID };
    }

    throw new Error('User not authenticated');
  }

  private async resolveGmUserId(projectId: string | null): Promise<string> {
    if (!projectId) return '';
    const { data, error } = await supabase
      .from('projects')
      .select('gm_user_id')
      .eq('id', projectId)
      .maybeSingle();
    if (error || !data) return '';
    return typeof data.gm_user_id === 'string' ? data.gm_user_id : '';
  }

  private async mapRowToDto(row: SessionRow): Promise<SessionDto> {
    const projectId = row.project_id;
    const gmUserId = await this.resolveGmUserId(projectId);
    return {
      id: row.id,
      code: row.code ?? '',
      name: row.name,
      adventure_id: projectId,
      project_id: projectId,
      public_id: row.public_id ?? null,
      gm_user_id: gmUserId,
      status: normalizePlaySessionStatus(row.status),
      created_at: row.created_at,
      updated_at: row.updated_at,
      started_at: row.started_at,
      ended_at: row.ended_at,
    } satisfies SessionDto;
  }

  private mapToViewModel(dto: SessionDto, players: SessionPlayerDto[] = []): SessionVm {
    return {
      id: dto.id,
      code: dto.code,
      name: dto.name ?? '',
      adventureId: dto.adventure_id,
      projectId: dto.project_id,
      publicId: dto.public_id ?? null,
      gmUserId: dto.gm_user_id,
      status: dto.status,
      createdAt: new Date(dto.created_at),
      updatedAt: new Date(dto.updated_at),
      startedAt: dto.started_at ? new Date(dto.started_at) : null,
      endedAt: dto.ended_at ? new Date(dto.ended_at) : null,
      players: players.map((p) => this.mapPlayerToViewModel(p)),
    };
  }

  private mapPlayerToViewModel(dto: SessionPlayerDto): SessionPlayerVm {
    return {
      id: dto.id,
      sessionId: dto.session_id,
      userId: dto.user_id,
      characterId: dto.character_id,
      isOnline: dto.is_online,
      joinedAt: new Date(dto.joined_at),
    };
  }

  private async loadPlayers(sessionId: string): Promise<SessionPlayerDto[]> {
    const { data, error } = await supabase
      .from(this.playersTableName)
      .select('*')
      .eq('session_id', sessionId);

    if (error) {
      console.error('Failed to load session players:', error);
      return [];
    }
    return (data ?? []) as SessionPlayerDto[];
  }

  async createSession(payload: CreateSessionDto): Promise<SessionVm> {
    await this.requireAuthUser();

    const projectId = payload.project_id || payload.adventure_id;
    if (!projectId) {
      throw new Error('project_id ist erforderlich, um eine Session zu erstellen');
    }

    // Dual-path (MIG-311 / FE-HOST-02): host SQLite when library flag is on.
    if (isHostLibraryEnabled()) {
      const row = await createHostPlaySession(projectId, payload.name ?? null);
      return mapHostPlaySessionToVm(row);
    }

    const { data, error } = await supabase.rpc('create_play_session', {
      p_project_id: projectId,
      p_name: payload.name,
    });

    if (error || !data) {
      throw new Error(`Failed to create session: ${error?.message ?? 'unknown'}`);
    }

    const dto = await this.mapRowToDto(data as SessionRow);
    return this.mapToViewModel(dto, []);
  }

  async joinSession(payload: JoinSessionDto): Promise<SessionVm> {
    await this.requireAuthUser();

    const code = normalizeSessionJoinCode(payload.code);

    if (isHostLibraryEnabled()) {
      const row = await joinHostSessionByCode(code, payload.character_id ?? null);
      return mapHostPlaySessionToVm(row);
    }

    const { data, error } = await supabase.rpc('join_session_by_code', {
      p_code: code,
      p_character_id: payload.character_id ?? null,
    });

    if (error || !data) {
      throw new Error(error?.message || 'Session nicht gefunden');
    }

    const dto = await this.mapRowToDto(data as SessionRow);
    const players = await this.loadPlayers(dto.id);
    return this.mapToViewModel(dto, players);
  }

  async getSessionById(id: string): Promise<SessionVm> {
    if (isHostLibraryEnabled()) {
      const row = await fetchHostSession(id);
      return mapHostPlaySessionToVm(row);
    }

    const { data: session, error: sessionError } = await supabase
      .from(this.tableName)
      .select(SESSION_SAFE_COLUMNS)
      .eq('id', id)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    const dto = await this.mapRowToDto(session as unknown as SessionRow);
    const players = await this.loadPlayers(id);
    return this.mapToViewModel(dto, players);
  }

  async getUserSessions(): Promise<SessionVm[]> {
    if (isHostLibraryEnabled()) {
      const rows = await fetchHostSessions();
      return rows.map(mapHostPlaySessionToVm);
    }

    const user = await this.requireAuthUser();

    const { data: gmProjects, error: gmProjectsError } = await supabase
      .from('projects')
      .select('id')
      .eq('gm_user_id', user.id);

    if (gmProjectsError) {
      throw new Error(`Failed to fetch GM projects: ${gmProjectsError.message}`);
    }

    const gmProjectIds = (gmProjects ?? []).map((p) => p.id as string);

    let gmSessions: SessionRow[] = [];
    if (gmProjectIds.length > 0) {
      const { data, error } = await supabase
        .from(this.tableName)
        .select(SESSION_SAFE_COLUMNS)
        .in('project_id', gmProjectIds)
        .neq('status', 'completed')
        .order('created_at', { ascending: false });
      if (error) {
        throw new Error(`Failed to fetch GM sessions: ${error.message}`);
      }
      gmSessions = (data ?? []) as unknown as SessionRow[];
    }

    const { data: playerRecords, error: playerError } = await supabase
      .from(this.playersTableName)
      .select(`*, sessions!inner(${SESSION_SAFE_COLUMNS})`)
      .eq('user_id', user.id);

    if (playerError) {
      console.error('Failed to fetch player sessions:', playerError);
    }

    type PlayerSessionJoinRow = { sessions: SessionRow | SessionRow[] | null };
    const playerSessions = ((playerRecords || []) as PlayerSessionJoinRow[])
      .map((record) => record.sessions)
      .flatMap((session) => (Array.isArray(session) ? session : session ? [session] : []))
      .filter((session) => session.status !== 'completed');

    const allSessionIds = new Set<string>();
    const combined: SessionRow[] = [];
    [...gmSessions, ...playerSessions].forEach((session) => {
      if (!allSessionIds.has(session.id)) {
        allSessionIds.add(session.id);
        combined.push(session);
      }
    });

    return Promise.all(
      combined.map(async (session) => {
        const dto = await this.mapRowToDto(session);
        const players = await this.loadPlayers(session.id);
        return this.mapToViewModel(dto, players);
      }),
    );
  }

  async updateSessionStatus(
    id: string,
    status: PlaySessionStatus,
  ): Promise<SessionVm> {
    const current = await this.getSessionById(id);
    assertPlaySessionStatusTransition(current.status, status);

    if (isHostLibraryEnabled()) {
      const row = await setHostSessionStatus(id, status);
      return mapHostPlaySessionToVm(row);
    }

    const { data, error } = await supabase.rpc('set_session_status', {
      p_session_id: id,
      p_status: status,
    });

    if (error || !data) {
      throw new Error(`Failed to update session: ${error?.message ?? 'unknown'}`);
    }

    const dto = await this.mapRowToDto(data as SessionRow);
    const players = await this.loadPlayers(id);
    return this.mapToViewModel(dto, players);
  }

  async leaveSession(sessionId: string): Promise<void> {
    await this.requireAuthUser();

    if (isHostLibraryEnabled()) {
      await leaveHostPlaySession(sessionId);
      return;
    }

    const { error } = await supabase.rpc('leave_play_session', {
      p_session_id: sessionId,
    });

    if (error) {
      throw new Error(`Failed to leave session: ${error.message}`);
    }
  }

  /**
   * GM deletes a play session (RLS: "GMs can manage sessions"). Cascades players/runtime.
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.requireAuthUser();
    const id = sessionId.trim();
    if (!id) {
      throw new Error('Session-ID fehlt');
    }
    if (isHostLibraryEnabled()) {
      throw new Error('Session-Löschen ist im Host-Modus noch nicht verfügbar');
    }

    const { error } = await supabase.from(this.tableName).delete().eq('id', id);

    if (error) {
      throw new Error(
        error.message.includes('row-level security')
          ? 'Nur der Gamemaster kann Sessions löschen.'
          : `Session konnte nicht gelöscht werden: ${error.message}`,
      );
    }
  }

  /**
   * GM creates (and rotates) an opaque invite token for share links (#490).
   */
  async createSessionInvite(sessionId: string): Promise<SessionInviteCreateResult> {
    await this.requireAuthUser();
    if (isHostLibraryEnabled()) {
      const invite = await createHostSessionInvite(sessionId);
      const mapped = mapInviteCreatePayload(invite);
      if (!mapped) {
        throw new Error('Einladung konnte nicht erstellt werden: ungültige Server-Antwort');
      }
      return mapped;
    }
    const { data, error } = await supabase.rpc('create_session_invite', {
      p_session_id: sessionId,
    });
    if (error) {
      throw new Error(`Einladung konnte nicht erstellt werden: ${error.message}`);
    }
    const mapped = mapInviteCreatePayload(data);
    if (!mapped) {
      throw new Error('Einladung konnte nicht erstellt werden: ungültige Server-Antwort');
    }
    return mapped;
  }

  /**
   * Authenticated resolve of invite token → saga/session facts (no role grant).
   */
  async resolveSessionInvite(token: string): Promise<SessionInviteResolveResult> {
    await this.requireAuthUser();
    const normalized = normalizeInviteToken(token);
    if (!normalized) {
      return { ok: false, errorCode: 'missing_token' };
    }
    if (isHostLibraryEnabled()) {
      try {
        const invite = await resolveHostSessionInvite(normalized);
        return mapInviteResolvePayload(invite);
      } catch {
        return { ok: false, errorCode: 'not_found' };
      }
    }
    const { data, error } = await supabase.rpc('resolve_session_invite', {
      p_token: normalized,
    });
    if (error) {
      throw new Error(`Einladung konnte nicht gelesen werden: ${error.message}`);
    }
    return mapInviteResolvePayload(data);
  }

  async revokeSessionInvite(token: string): Promise<void> {
    await this.requireAuthUser();
    const normalized = normalizeInviteToken(token);
    if (!normalized) {
      throw new Error('Token fehlt');
    }
    if (isHostLibraryEnabled()) {
      await revokeHostSessionInvite(normalized);
      return;
    }
    const { error } = await supabase.rpc('revoke_session_invite', {
      p_token: normalized,
    });
    if (error) {
      throw new Error(`Einladung konnte nicht widerrufen werden: ${error.message}`);
    }
  }
}

export const sessionService = new SessionService();
