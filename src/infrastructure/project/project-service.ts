/**
 * project-service — Host HTTP adapter for projects/campaigns (CUT-20).
 * Location: src/infrastructure/project/project-service.ts
 *
 * Product runtime uses host Library + project routes only — no Supabase client.
 */
import { getAuthenticatedUserId } from '../../lib/authenticatedUser';
import {
  fetchHostLibraryProjects,
  isHostLibraryEnabled,
  type HostLibraryProjectDto,
} from '../host/host-library-http';
import {
  createHostProject,
  createHostProjectSession,
  deleteHostProject,
  updateHostProject,
  updateHostSessionLook,
  type HostProjectWriteDto,
} from '../host/host-project-http';
import { fetchHostSessions, type HostPlaySessionDto } from '../host/host-session-http';
import { projectMemberService } from './project-member-service';
import type {
  ProjectDto,
  ProjectMemberDto,
  ProjectSummaryVm,
  ProjectVm,
  CreateProjectDto,
  JoinProjectDto,
  SessionDto,
  SessionVm,
} from '../../domains/project/contracts/project.types';
import { normalizePlaySessionStatus } from '../../domains/session/contracts/session-lifecycle';

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

function isProjectStatus(value: unknown): value is ProjectDto['status'] {
  return value === 'active' || value === 'paused' || value === 'completed' || value === 'archived';
}

class ProjectService {
  private mapHostPlaySessionToSessionDto(row: HostPlaySessionDto): SessionDto {
    const status = normalizePlaySessionStatus(row.status);
    const createdAt =
      typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString();
    const updatedAt = createdAt;
    return {
      id: row.sessionId,
      public_id: typeof row.publicId === 'string' ? row.publicId : undefined,
      project_id: row.projectId,
      session_number: typeof row.sessionNumber === 'number' ? row.sessionNumber : 0,
      name: row.name ?? null,
      notes: null,
      status,
      started_at: row.startedAt ?? null,
      ended_at: row.endedAt ?? null,
      duration_minutes: null,
      look_profile_id:
        typeof row.lookProfileId === 'string' ? row.lookProfileId : null,
      created_at: createdAt,
      updated_at: updatedAt,
    };
  }

  private hostProjectRowToProjectDto(row: HostProjectWriteDto | HostLibraryProjectDto): ProjectDto {
    const statusRaw = row.status ?? 'active';
    const status = isProjectStatus(statusRaw) ? statusRaw : 'active';
    const createdAt =
      'createdAt' in row && typeof row.createdAt === 'string'
        ? row.createdAt
        : new Date().toISOString();
    const updatedAt =
      'updatedAt' in row && typeof row.updatedAt === 'string' ? row.updatedAt : createdAt;
    return {
      id: row.id,
      public_id: typeof row.publicId === 'string' ? row.publicId : undefined,
      code: typeof row.code === 'string' ? row.code : '',
      name: row.name,
      description: row.description ?? null,
      world_id: row.worldId ?? null,
      world_profile_id: row.worldProfileId ?? row.worldId ?? null,
      default_look_profile_id:
        'defaultLookProfileId' in row && typeof row.defaultLookProfileId === 'string'
          ? row.defaultLookProfileId
          : null,
      allow_player_character_look_override:
        'allowPlayerCharacterLookOverride' in row &&
        typeof row.allowPlayerCharacterLookOverride === 'boolean'
          ? row.allowPlayerCharacterLookOverride
          : true,
      gm_user_id: row.gmUserId,
      status,
      created_at: createdAt,
      updated_at: updatedAt,
    };
  }

  /**
   * Map DTO to View Model
   */
  private mapToViewModel(
    project: ProjectDto,
    members: ProjectMemberDto[],
    sessions: SessionDto[],
  ): ProjectVm {
    const mappedMembers = members.map((member) => ({
      id: member.id,
      userId: member.user_id,
      characterId: member.character_id,
      role: member.role,
      joinedAt: member.joined_at,
      status: member.status,
    }));

    const mappedSessions: SessionVm[] = sessions.map((session) => ({
      id: session.id,
      publicId: typeof session.public_id === 'string' ? session.public_id : '',
      projectId: session.project_id,
      sessionNumber: session.session_number,
      name: session.name,
      notes: session.notes,
      status: session.status,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      durationMinutes: session.duration_minutes ?? null,
      lookProfileId:
        typeof session.look_profile_id === 'string' ? session.look_profile_id : null,
      createdAt: session.created_at,
    }));

    const completedSessions = sessions.filter((session) => session.ended_at);
    const lastSessionDate = completedSessions.length
      ? completedSessions.sort(
          (left, right) =>
            new Date(right.ended_at!).getTime() - new Date(left.ended_at!).getTime(),
        )[0].ended_at
      : null;

    return {
      id: project.id,
      publicId: typeof project.public_id === 'string' ? project.public_id : '',
      code: project.code,
      name: project.name,
      description: project.description,
      worldId: project.world_id,
      worldProfileId:
        typeof project.world_profile_id === 'string' ? project.world_profile_id : null,
      defaultLookProfileId:
        typeof project.default_look_profile_id === 'string'
          ? project.default_look_profile_id
          : null,
      allowPlayerCharacterLookOverride:
        project.allow_player_character_look_override === false ? false : true,
      gmUserId: project.gm_user_id,
      status: project.status,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      members: mappedMembers,
      sessions: mappedSessions,
      totalSessions: sessions.length,
      lastSessionDate,
    };
  }

  private async mergeHostSessions(row: HostLibraryProjectDto | HostProjectWriteDto): Promise<ProjectVm> {
    assertHost();
    const projectDto = this.hostProjectRowToProjectDto(row);
    const [allSessions, members] = await Promise.all([
      fetchHostSessions(),
      projectMemberService.getMembers(projectDto.id),
    ]);
    const sessionDtos = allSessions
      .filter((s) => s.projectId === projectDto.id)
      .map((s) => this.mapHostPlaySessionToSessionDto(s))
      .sort((a, b) => a.session_number - b.session_number);
    return this.mapToViewModel(projectDto, members, sessionDtos);
  }

  private mapHostProjectSummary(row: HostLibraryProjectDto): ProjectSummaryVm {
    const status =
      row.status === 'paused' || row.status === 'completed' || row.status === 'archived'
        ? row.status
        : 'active';
    const origin =
      row.sagaOrigin === 'native' ||
      row.sagaOrigin === 'user' ||
      row.sagaOrigin === 'private_backfill'
        ? row.sagaOrigin
        : null;
    return {
      id: row.id,
      publicId: typeof row.publicId === 'string' ? row.publicId : '',
      code: typeof row.code === 'string' ? row.code : '',
      name: row.name,
      description: row.description ?? null,
      worldId: row.worldId ?? null,
      worldProfileId: row.worldProfileId ?? row.worldId ?? null,
      sagaId: row.sagaId ?? null,
      sagaVersionId: row.sagaVersionId ?? null,
      sagaTitle: row.sagaTitle ?? row.name,
      sagaSlug: row.sagaSlug ?? null,
      sagaOrigin: origin,
      gmUserId: row.gmUserId,
      status,
      memberCount: typeof row.memberCount === 'number' ? row.memberCount : 1,
      sessionCount: typeof row.sessionCount === 'number' ? row.sessionCount : 0,
    };
  }

  /**
   * Create new project (as GM)
   */
  async createProject(payload: CreateProjectDto): Promise<ProjectVm> {
    assertHost();
    const created = await createHostProject({
      name: payload.name,
      description: payload.description ?? null,
      worldProfileId: payload.world_profile_id ?? payload.world_id ?? null,
    });
    return this.mergeHostSessions(created);
  }

  /**
   * Get user's projects (as GM or active player).
   */
  async getUserProjectSummaries(): Promise<ProjectSummaryVm[]> {
    assertHost();
    const rows = await fetchHostLibraryProjects();
    return rows.map((row) => this.mapHostProjectSummary(row));
  }

  async getUserProjects(): Promise<ProjectVm[]> {
    assertHost();
    const rows = await fetchHostLibraryProjects();
    return Promise.all(rows.map((row) => this.mergeHostSessions(row)));
  }

  /**
   * Ensures the native Dornhain starter playthrough exists for the current GM.
   */
  async ensureNativeStarterProject(slug = 'dornhain.whisper'): Promise<void> {
    assertHost();
    try {
      const { ensureHostNativeStarterProject } = await import('../host/host-project-http');
      await ensureHostNativeStarterProject(slug);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[project-service] ensure_native_starter_project (host):', message);
    }
  }

  /**
   * Join project by secret code.
   */
  async joinProject(payload: JoinProjectDto): Promise<ProjectVm> {
    assertHost();
    const membership = await projectMemberService.joinByCode(payload);
    return this.getProjectById(membership.project_id);
  }

  /**
   * Get project by ID
   */
  async getProjectById(id: string): Promise<ProjectVm> {
    assertHost();
    const rows = await fetchHostLibraryProjects();
    const row = rows.find((item) => item.id === id);
    if (!row) throw new Error('Project not found');
    return this.mergeHostSessions(row);
  }

  /**
   * Update project
   */
  async updateProject(id: string, updates: Partial<ProjectDto>): Promise<ProjectVm> {
    assertHost();
    const updated = await updateHostProject(id, {
      name: typeof updates.name === 'string' ? updates.name : undefined,
      description:
        updates.description === undefined
          ? undefined
          : updates.description === null
            ? null
            : String(updates.description),
      status: typeof updates.status === 'string' ? updates.status : undefined,
      worldProfileId:
        updates.world_profile_id !== undefined
          ? updates.world_profile_id
          : updates.world_id !== undefined
            ? updates.world_id
            : undefined,
      defaultLookProfileId:
        updates.default_look_profile_id === undefined
          ? undefined
          : updates.default_look_profile_id,
      allowPlayerCharacterLookOverride:
        typeof updates.allow_player_character_look_override === 'boolean'
          ? updates.allow_player_character_look_override
          : undefined,
    });
    return this.mergeHostSessions(updated);
  }

  async updateProjectWorldProfile(
    projectId: string,
    worldProfileId: string | null,
  ): Promise<ProjectVm> {
    return this.updateProject(projectId, { world_profile_id: worldProfileId });
  }

  async updateProjectLookSettings(
    projectId: string,
    settings: {
      defaultLookProfileId: string | null;
      allowPlayerCharacterLookOverride: boolean;
    },
  ): Promise<ProjectVm> {
    return this.updateProject(projectId, {
      default_look_profile_id: settings.defaultLookProfileId,
      allow_player_character_look_override: settings.allowPlayerCharacterLookOverride,
    });
  }

  async updateSessionLookSettings(
    sessionId: string,
    settings: { lookProfileId: string | null },
  ): Promise<SessionVm> {
    assertHost();
    const updated = await updateHostSessionLook(sessionId, settings.lookProfileId);
    return {
      id: updated.id,
      publicId: typeof updated.publicId === 'string' ? updated.publicId : '',
      projectId: updated.projectId,
      sessionNumber:
        typeof updated.sessionNumber === 'number' ? updated.sessionNumber : 0,
      name: updated.name ?? null,
      notes: null,
      status:
        updated.status === 'scheduled' ||
        updated.status === 'waiting' ||
        updated.status === 'active' ||
        updated.status === 'paused' ||
        updated.status === 'completed' ||
        updated.status === 'cancelled'
          ? updated.status
          : 'scheduled',
      startedAt: null,
      endedAt: null,
      durationMinutes: null,
      lookProfileId: updated.lookProfileId,
      createdAt: new Date().toISOString(),
    };
  }

  async deleteProject(id: string): Promise<void> {
    assertHost();
    await deleteHostProject(id);
  }

  async leaveProject(projectId: string): Promise<void> {
    assertHost();
    const userId = await getAuthenticatedUserId();
    await projectMemberService.leave(projectId, userId);
  }

  async getProjectByPublicId(publicId: string): Promise<ProjectVm> {
    assertHost();
    const wanted = publicId.trim().toUpperCase();
    const rows = await fetchHostLibraryProjects();
    const row = rows.find((p) => (p.publicId ?? '').trim().toUpperCase() === wanted);
    if (!row) throw new Error('Project not found');
    return this.mergeHostSessions(row);
  }

  async getSessionByPublicIds(
    sagaPublicId: string,
    sessionPublicId: string,
  ): Promise<{ project: ProjectVm; session: SessionVm }> {
    assertHost();
    const project = await this.getProjectByPublicId(sagaPublicId);
    const wanted = sessionPublicId.trim().toUpperCase();
    let session = project.sessions.find((row) => row.publicId === wanted);
    if (!session) {
      const rows = await fetchHostSessions();
      const match = rows.find(
        (r) =>
          r.projectId === project.id && (r.publicId ?? '').trim().toUpperCase() === wanted,
      );
      if (!match) {
        throw new Error('Session not found in saga');
      }
      const dto = this.mapHostPlaySessionToSessionDto(match);
      session = {
        id: dto.id,
        publicId: typeof dto.public_id === 'string' ? dto.public_id : '',
        projectId: dto.project_id,
        sessionNumber: dto.session_number,
        name: dto.name,
        notes: dto.notes,
        status: dto.status,
        startedAt: dto.started_at,
        endedAt: dto.ended_at,
        durationMinutes: dto.duration_minutes ?? null,
        lookProfileId:
          typeof dto.look_profile_id === 'string' ? dto.look_profile_id : null,
        createdAt: dto.created_at,
      };
    }
    return { project, session };
  }

  async createProjectSession(payload: {
    projectId: string;
    name?: string;
    notes?: string;
  }): Promise<SessionVm> {
    assertHost();
    const row = await createHostProjectSession(
      payload.projectId,
      payload.name ?? null,
      payload.notes ?? null,
    );
    const status =
      row.status === 'scheduled' ||
      row.status === 'waiting' ||
      row.status === 'active' ||
      row.status === 'paused' ||
      row.status === 'completed'
        ? row.status
        : 'scheduled';
    return {
      id: row.id,
      publicId: typeof row.publicId === 'string' ? row.publicId : '',
      projectId: row.projectId,
      sessionNumber: typeof row.sessionNumber === 'number' ? row.sessionNumber : 0,
      name: row.name ?? null,
      notes: null,
      status,
      startedAt: null,
      endedAt: null,
      durationMinutes: null,
      lookProfileId: null,
      createdAt: new Date().toISOString(),
    };
  }
}

export const projectService = new ProjectService();
