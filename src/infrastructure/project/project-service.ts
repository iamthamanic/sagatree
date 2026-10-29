/**
 * project-service — Supabase adapter for projects/campaigns.
 * Location: src/infrastructure/project/project-service.ts
 *
 * #569: Never select projects.adventure_runtime or sessions.world_state/notes —
 * those columns are revoked for authenticated; use projected session RPCs.
 *
 * Dual-path (MIG-308): production remains Supabase RPCs/tables. Host ports are
 * bound via `createHostProjectAdapter` for tests / future cutover (no accidental
 * cutover — VITE host flags alone do not redirect this facade).
 */
import { supabase } from '../../lib/supabase';
import { getAuthenticatedUserId } from '../../lib/authenticatedUser';
import { raceWithTimeoutReject, SUPABASE_QUERY_TIMEOUT_MS } from '../../lib/networkTimeout';
import { projectMemberService } from './project-member-service';
import type {
  ProjectDto,
  ProjectVm,
  CreateProjectDto,
  JoinProjectDto,
  ProjectMemberDto,
  ProjectMemberVm,
  ProjectSummaryVm,
  SessionDto,
  SessionVm,
} from '../../domains/project/contracts/project.types';

/** Safe project columns for authenticated SELECT (#569/#603 — excludes adventure_runtime). */
const PROJECT_SAFE_COLUMNS =
  'id, public_id, code, name, description, world_id, world_profile_id, default_look_profile_id, allow_player_character_look_override, gm_user_id, status, saga_id, saga_version_id, created_at, updated_at';

/** Safe session columns for authenticated SELECT (#569/#603 — excludes world_state, notes). */
const SESSION_SAFE_COLUMNS =
  'id, public_id, project_id, session_number, name, description, status, code, started_at, ended_at, look_profile_id, created_at, updated_at';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProjectStatus(value: unknown): value is ProjectDto['status'] {
  return value === 'active' || value === 'paused' || value === 'completed' || value === 'archived';
}

function isProjectDto(value: unknown): value is ProjectDto {
  if (!isRecord(value)) return false;
  const publicIdOk =
    typeof value.public_id === 'string'
    || value.public_id === undefined
    || value.public_id === null;
  const worldProfileOk =
    value.world_profile_id === undefined
    || value.world_profile_id === null
    || typeof value.world_profile_id === 'string';
  const defaultLookOk =
    value.default_look_profile_id === undefined
    || value.default_look_profile_id === null
    || typeof value.default_look_profile_id === 'string';
  const allowOverrideOk =
    value.allow_player_character_look_override === undefined
    || typeof value.allow_player_character_look_override === 'boolean';
  return (
    typeof value.id === 'string' &&
    publicIdOk &&
    typeof value.code === 'string' &&
    typeof value.name === 'string' &&
    (typeof value.description === 'string' || value.description === null) &&
    (typeof value.world_id === 'string' || value.world_id === null) &&
    worldProfileOk &&
    defaultLookOk &&
    allowOverrideOk &&
    typeof value.gm_user_id === 'string' &&
    isProjectStatus(value.status) &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string'
  );
}

/**
 * Project Service
 * Handles all project-related API calls (campaigns/adventures)
 */
function isProjectSummaryRow(
  value: unknown,
): value is Pick<
  ProjectDto,
  'id' | 'code' | 'name' | 'description' | 'gm_user_id' | 'status'
> & {
  public_id?: string | null;
  world_id?: string | null;
  world_profile_id?: string | null;
} {
  if (!isRecord(value)) return false;
  const publicIdOk =
    typeof value.public_id === 'string'
    || value.public_id === undefined
    || value.public_id === null;
  const worldIdOk =
    typeof value.world_id === 'string'
    || value.world_id === undefined
    || value.world_id === null;
  const worldProfileIdOk =
    typeof value.world_profile_id === 'string'
    || value.world_profile_id === undefined
    || value.world_profile_id === null;
  return (
    typeof value.id === 'string' &&
    publicIdOk &&
    worldIdOk &&
    worldProfileIdOk &&
    typeof value.code === 'string' &&
    typeof value.name === 'string' &&
    (typeof value.description === 'string' || value.description === null) &&
    typeof value.gm_user_id === 'string' &&
    isProjectStatus(value.status)
  );
}

function isSessionStatus(value: unknown): value is SessionDto['status'] {
  return (
    value === 'scheduled'
    || value === 'waiting'
    || value === 'active'
    || value === 'paused'
    || value === 'completed'
    || value === 'cancelled'
  );
}

function isSessionDto(value: unknown): value is SessionDto {
  if (!isRecord(value)) return false;
  const durationOk =
    value.duration_minutes === undefined
    || typeof value.duration_minutes === 'number'
    || value.duration_minutes === null;
  const publicIdOk =
    typeof value.public_id === 'string'
    || value.public_id === undefined
    || value.public_id === null;
  const lookOk =
    value.look_profile_id === undefined
    || value.look_profile_id === null
    || typeof value.look_profile_id === 'string';
  const notesOk =
    value.notes === undefined
    || typeof value.notes === 'string'
    || value.notes === null;
  return (
    typeof value.id === 'string'
    && publicIdOk
    && typeof value.project_id === 'string'
    && typeof value.session_number === 'number'
    && (typeof value.name === 'string' || value.name === null)
    && notesOk
    && isSessionStatus(value.status)
    && (typeof value.started_at === 'string' || value.started_at === null)
    && (typeof value.ended_at === 'string' || value.ended_at === null)
    && durationOk
    && lookOk
    && typeof value.created_at === 'string'
    && typeof value.updated_at === 'string'
  );
}

function normalizeSessionDto(value: SessionDto): SessionDto {
  return {
    ...value,
    // #569: notes column not selectable by authenticated — treat missing as null.
    notes: value.notes ?? null,
    duration_minutes: value.duration_minutes ?? null,
  };
}

class ProjectService {
  private readonly tableName = 'projects';
  private readonly membersTableName = 'project_members';
  private readonly sessionsTableName = 'sessions';

  /**
   * Generate random 6-digit join code
   */
  private generateProjectCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Map DTO to View Model
   */
  private mapToViewModel(
    project: ProjectDto,
    members: ProjectMemberDto[],
    sessions: SessionDto[]
  ): ProjectVm {
    const mappedMembers: ProjectMemberVm[] = members.map((member) => ({
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
      ? completedSessions.sort((left, right) =>
          new Date(right.ended_at!).getTime() - new Date(left.ended_at!).getTime()
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

  /**
   * Create new project (as GM)
   */
  async createProject(payload: CreateProjectDto): Promise<ProjectVm> {
    const userId = await getAuthenticatedUserId();

    const code = this.generateProjectCode();

    const projectData: Partial<ProjectDto> = {
      code,
      name: payload.name,
      description: payload.description || null,
      world_id: payload.world_id || null,
      world_profile_id: payload.world_profile_id || null,
      gm_user_id: userId,
      status: 'active',
    };

    const { data, error } = await supabase
      .from(this.tableName)
      .insert(projectData)
      .select(PROJECT_SAFE_COLUMNS)
      .single();

    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }

    // The GM-controlled membership policy permits this bootstrap row.
    await supabase.from(this.membersTableName).insert({
      project_id: data.id,
      user_id: userId,
      role: 'gm',
      status: 'active',
    });

    return this.mapToViewModel(data, [], []);
  }

  /**
   * Get user's projects (as GM or active player).
   */
  async getUserProjectSummaries(): Promise<ProjectSummaryVm[]> {
    return raceWithTimeoutReject(
      this.fetchUserProjectSummaries(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Failed to fetch projects: request timed out',
    );
  }

  async getUserProjects(): Promise<ProjectVm[]> {
    return raceWithTimeoutReject(
      this.fetchUserProjects(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Failed to fetch projects: request timed out',
    );
  }

  private countByProjectId(rows: ReadonlyArray<{ project_id: string }>): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * Ensures the native Dornhain starter playthrough exists for the current GM.
   * Soft-fails so list views still load if the definition/RPC is missing.
   */
  async ensureNativeStarterProject(slug = 'dornhain.whisper'): Promise<void> {
    const { error } = await supabase.rpc('ensure_native_starter_project', {
      p_slug: slug,
    });
    if (error) {
      console.warn('[project-service] ensure_native_starter_project:', error.message);
    }
  }

  private async fetchUserProjectSummaries(): Promise<ProjectSummaryVm[]> {
    const userId = await getAuthenticatedUserId();

    // Bridge native saga_definitions → selectable GM project (SessionJoin / Library).
    await this.ensureNativeStarterProject();

    const projectSummarySelect =
      'id, public_id, code, name, description, world_id, world_profile_id, gm_user_id, status, saga_id, saga_version_id, saga_definitions(title, origin, slug)';

    const { data: gmProjects, error: gmError } = await supabase
      .from(this.tableName)
      .select(projectSummarySelect)
      .eq('gm_user_id', userId)
      .order('created_at', { ascending: false });

    if (gmError) {
      throw new Error(`Failed to fetch GM projects: ${gmError.message}`);
    }

    const { data: memberRecords, error: memberError } = await supabase
      .from(this.membersTableName)
      .select(`projects!inner(${projectSummarySelect})`)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (memberError) {
      console.error('Failed to fetch player projects:', memberError);
    }

    type ProjectSummaryRow = Pick<
      ProjectDto,
      'id' | 'code' | 'name' | 'description' | 'gm_user_id' | 'status'
    > & {
      public_id?: string | null;
      world_id?: string | null;
      world_profile_id?: string | null;
      saga_id?: string | null;
      saga_version_id?: string | null;
      saga_definitions?: { title?: string | null; origin?: string | null; slug?: string | null } | null;
    };
    const combined = new Map<string, ProjectSummaryRow>();

    const normalizeSummaryRow = (raw: unknown): ProjectSummaryRow | null => {
      if (!isProjectSummaryRow(raw)) return null;
      const row = raw as ProjectSummaryRow & { saga_definitions?: unknown };
      let def: ProjectSummaryRow['saga_definitions'] = null;
      if (Array.isArray(row.saga_definitions)) {
        const first = row.saga_definitions[0];
        if (isRecord(first)) {
          def = {
            title: typeof first.title === 'string' ? first.title : null,
            origin: typeof first.origin === 'string' ? first.origin : null,
            slug: typeof first.slug === 'string' ? first.slug : null,
          };
        }
      } else if (isRecord(row.saga_definitions)) {
        def = {
          title: typeof row.saga_definitions.title === 'string' ? row.saga_definitions.title : null,
          origin: typeof row.saga_definitions.origin === 'string' ? row.saga_definitions.origin : null,
          slug: typeof row.saga_definitions.slug === 'string' ? row.saga_definitions.slug : null,
        };
      }
      return { ...row, saga_definitions: def };
    };

    for (const project of gmProjects ?? []) {
      const normalized = normalizeSummaryRow(project);
      if (!normalized) continue;
      combined.set(normalized.id, normalized);
    }

    for (const record of memberRecords ?? []) {
      if (!isRecord(record)) continue;
      const normalized = normalizeSummaryRow(record.projects);
      if (!normalized) continue;
      combined.set(normalized.id, normalized);
    }

    const projectIds = [...combined.keys()];
    if (projectIds.length === 0) return [];

    const [{ data: memberRows, error: membersBatchError }, { data: sessionRows, error: sessionsBatchError }] =
      await Promise.all([
        supabase.from(this.membersTableName).select('project_id').in('project_id', projectIds),
        supabase.from(this.sessionsTableName).select('project_id').in('project_id', projectIds),
      ]);

    if (membersBatchError) {
      throw new Error(`Failed to fetch project members: ${membersBatchError.message}`);
    }
    if (sessionsBatchError) {
      throw new Error(`Failed to fetch project sessions: ${sessionsBatchError.message}`);
    }

    const memberCounts = this.countByProjectId((memberRows ?? []) as Array<{ project_id: string }>);
    const sessionCounts = this.countByProjectId((sessionRows ?? []) as Array<{ project_id: string }>);

    return projectIds.map((id) => {
      const project = combined.get(id)!;
      const def = project.saga_definitions;
      const originRaw = def && typeof def.origin === 'string' ? def.origin : null;
      const sagaOrigin =
        originRaw === 'native' || originRaw === 'user' || originRaw === 'private_backfill'
          ? originRaw
          : null;
      return {
        id: project.id,
        publicId: typeof project.public_id === 'string' ? project.public_id : '',
        code: project.code,
        name: project.name,
        description: project.description,
        worldId: typeof project.world_id === 'string' ? project.world_id : null,
        worldProfileId:
          typeof project.world_profile_id === 'string' ? project.world_profile_id : null,
        sagaId: typeof project.saga_id === 'string' ? project.saga_id : null,
        sagaVersionId: typeof project.saga_version_id === 'string' ? project.saga_version_id : null,
        sagaTitle: def && typeof def.title === 'string' ? def.title : null,
        sagaSlug: def && typeof def.slug === 'string' ? def.slug : null,
        sagaOrigin,
        gmUserId: project.gm_user_id,
        status: project.status,
        memberCount: memberCounts.get(id) ?? 0,
        sessionCount: sessionCounts.get(id) ?? 0,
      };
    });
  }

  private async fetchUserProjects(): Promise<ProjectVm[]> {
    const userId = await getAuthenticatedUserId();

    const { data: gmProjects, error: gmError } = await supabase
      .from(this.tableName)
      .select(PROJECT_SAFE_COLUMNS)
      .eq('gm_user_id', userId)
      .order('created_at', { ascending: false });

    if (gmError) {
      throw new Error(`Failed to fetch GM projects: ${gmError.message}`);
    }

    const { data: memberRecords, error: memberError } = await supabase
      .from(this.membersTableName)
      .select(`*, projects!inner(${PROJECT_SAFE_COLUMNS})`)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (memberError) {
      console.error('Failed to fetch player projects:', memberError);
    }

    const playerProjects: ProjectDto[] = [];
    for (const record of memberRecords || []) {
      if (!isRecord(record)) continue;
      const project = record.projects;
      if (isProjectDto(project)) playerProjects.push(project);
    }

    const allProjectIds = new Set<string>();
    const combinedProjects: ProjectDto[] = [];
    for (const project of [...(gmProjects || []), ...playerProjects]) {
      if (!isProjectDto(project) || allProjectIds.has(project.id)) continue;
      allProjectIds.add(project.id);
      combinedProjects.push(project);
    }

    return Promise.all(
      combinedProjects.map(async (project) => {
        const { data: members } = await supabase
          .from(this.membersTableName)
          .select('*')
          .eq('project_id', project.id);

        const { data: sessions } = await supabase
          .from(this.sessionsTableName)
          .select(SESSION_SAFE_COLUMNS)
          .eq('project_id', project.id)
          .order('session_number', { ascending: true });

        const sessionRows: SessionDto[] = [];
        for (const row of sessions || []) {
          if (!isSessionDto(row)) continue;
          sessionRows.push(
            normalizeSessionDto({
              ...row,
              notes: row.notes ?? null,
            }),
          );
        }
        return this.mapToViewModel(project, members || [], sessionRows);
      })
    );
  }

  /**
   * Join project by secret code. The SECURITY DEFINER RPC owns membership identity,
   * role and status, so the browser cannot mint or reactivate an authorization grant.
   */
  async joinProject(payload: JoinProjectDto): Promise<ProjectVm> {
    const membership = await projectMemberService.joinByCode(payload);
    return this.getProjectById(membership.project_id);
  }

  /**
   * Get project by ID
   */
  async getProjectById(id: string): Promise<ProjectVm> {
    const { data: project, error: projectError } = await supabase
      .from(this.tableName)
      .select(PROJECT_SAFE_COLUMNS)
      .eq('id', id)
      .single();

    if (projectError || !project || !isProjectDto(project)) {
      throw new Error('Project not found');
    }

    const { data: members } = await supabase
      .from(this.membersTableName)
      .select('*')
      .eq('project_id', id);

    const { data: sessions } = await supabase
      .from(this.sessionsTableName)
      .select(SESSION_SAFE_COLUMNS)
      .eq('project_id', id)
      .order('session_number', { ascending: true });

    const sessionRows: SessionDto[] = [];
    for (const row of sessions || []) {
      if (!isSessionDto(row)) continue;
      sessionRows.push(
        normalizeSessionDto({
          ...row,
          notes: row.notes ?? null,
        }),
      );
    }
    return this.mapToViewModel(project, members || [], sessionRows);
  }

  /**
   * Update project
   */
  async updateProject(id: string, updates: Partial<ProjectDto>): Promise<ProjectVm> {
    const { error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }

    return this.getProjectById(id);
  }

  /**
   * Bind or clear the adventure's world profile (GM; ownership enforced by DB trigger).
   */
  async updateProjectWorldProfile(
    projectId: string,
    worldProfileId: string | null,
  ): Promise<ProjectVm> {
    return this.updateProject(projectId, { world_profile_id: worldProfileId });
  }

  /**
   * Saga Look settings (#348). GM-only via projects RLS; look ownership via DB trigger.
   */
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

  /**
   * Session Look override (#349). Null clears override → inherit saga default.
   * GM-only + look ownership via DB trigger on sessions.look_profile_id.
   */
  async updateSessionLookSettings(
    sessionId: string,
    settings: { lookProfileId: string | null },
  ): Promise<SessionVm> {
    const { data, error } = await supabase
      .from(this.sessionsTableName)
      .update({ look_profile_id: settings.lookProfileId })
      .eq('id', sessionId)
      .select(SESSION_SAFE_COLUMNS)
      .single();

    if (error) {
      throw new Error(`Failed to update session look: ${error.message}`);
    }
    if (!isSessionDto(data)) {
      throw new Error('Failed to update session look: invalid response');
    }
    const normalized = normalizeSessionDto(data);
    return {
      id: normalized.id,
      publicId: typeof normalized.public_id === 'string' ? normalized.public_id : '',
      projectId: normalized.project_id,
      sessionNumber: normalized.session_number,
      name: normalized.name,
      notes: normalized.notes,
      status: normalized.status,
      startedAt: normalized.started_at,
      endedAt: normalized.ended_at,
      durationMinutes: normalized.duration_minutes,
      lookProfileId:
        typeof normalized.look_profile_id === 'string' ? normalized.look_profile_id : null,
      createdAt: normalized.created_at,
    };
  }

  /**
   * Delete project
   */
  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }

  /**
   * Leave project (as player). Kicked rows stay server/GM-controlled denial records.
   */
  async leaveProject(projectId: string): Promise<void> {
    const userId = await getAuthenticatedUserId();
    await projectMemberService.leave(projectId, userId);
  }

  /**
   * Resolve saga by public id (SA-XXXXX). Auth/RLS still gate the row.
   */
  async getProjectByPublicId(publicId: string): Promise<ProjectVm> {
    const { data: project, error } = await supabase
      .from(this.tableName)
      .select(PROJECT_SAFE_COLUMNS)
      .eq('public_id', publicId.trim().toUpperCase())
      .single();

    if (error || !project || !isProjectDto(project)) {
      throw new Error('Project not found');
    }

    return this.getProjectById(project.id);
  }

  /**
   * Resolve session by public id, scoped to saga public id (cross-saga → not found).
   */
  async getSessionByPublicIds(
    sagaPublicId: string,
    sessionPublicId: string,
  ): Promise<{ project: ProjectVm; session: SessionVm }> {
    const project = await this.getProjectByPublicId(sagaPublicId);
    const wanted = sessionPublicId.trim().toUpperCase();
    let session = project.sessions.find((row) => row.publicId === wanted);
    if (!session) {
      // Direct lookup — avoids dropping rows when status filters/mapping lag behind create.
      const { data: row, error } = await supabase
        .from(this.sessionsTableName)
        .select(SESSION_SAFE_COLUMNS)
        .eq('project_id', project.id)
        .eq('public_id', wanted)
        .maybeSingle();
      if (error || !row || !isSessionDto(row)) {
        throw new Error('Session not found in saga');
      }
      const normalized = normalizeSessionDto({
        ...row,
        notes: row.notes ?? null,
      });
      session = {
        id: normalized.id,
        publicId: typeof normalized.public_id === 'string' ? normalized.public_id : '',
        projectId: normalized.project_id,
        sessionNumber: normalized.session_number,
        name: normalized.name,
        notes: normalized.notes,
        status: normalized.status,
        startedAt: normalized.started_at,
        endedAt: normalized.ended_at,
        durationMinutes: normalized.duration_minutes ?? null,
        lookProfileId:
          typeof normalized.look_profile_id === 'string' ? normalized.look_profile_id : null,
        createdAt: normalized.created_at,
      };
    }
    return { project, session };
  }

  /**
   * Create a project session with concurrency-safe session_number allocation (DB RPC).
   */
  async createProjectSession(payload: {
    projectId: string;
    name?: string;
    notes?: string;
  }): Promise<SessionVm> {
    const { data, error } = await supabase.rpc('create_project_session', {
      p_project_id: payload.projectId,
      p_name: payload.name ?? null,
      p_notes: payload.notes ?? null,
    });

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    if (!isSessionDto(data)) {
      throw new Error('Failed to create session: invalid response');
    }

    const normalized = normalizeSessionDto(data);
    return {
      id: normalized.id,
      publicId: typeof normalized.public_id === 'string' ? normalized.public_id : '',
      projectId: normalized.project_id,
      sessionNumber: normalized.session_number,
      name: normalized.name,
      notes: normalized.notes,
      status: normalized.status,
      startedAt: normalized.started_at,
      endedAt: normalized.ended_at,
      durationMinutes: normalized.duration_minutes,
      lookProfileId:
        typeof normalized.look_profile_id === 'string' ? normalized.look_profile_id : null,
      createdAt: normalized.created_at,
    };
  }
}

export const projectService = new ProjectService();
