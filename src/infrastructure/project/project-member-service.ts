/**
 * project-member-service — Host HTTP adapter for project membership (CUT-20).
 * Location: src/infrastructure/project/project-member-service.ts
 */
import type { ProjectMemberDto, JoinProjectDto } from '../../domains/project/contracts/project.types';
import {
  isHostLibraryEnabled,
  joinHostProjectByCode,
  leaveHostProject,
  listHostProjectMembers,
  setHostMyProjectCharacter,
} from '../host/host-project-http';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown, operation: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error(`${operation} returned an invalid identifier`);
  }
  return value;
}

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

export const projectMemberService = {
  async getMembers(projectId: string): Promise<ProjectMemberDto[]> {
    assertHost();
    const rows = await listHostProjectMembers(projectId);
    return rows.map((row) => ({
      id: row.id,
      project_id: row.projectId,
      user_id: row.userId,
      character_id: row.characterId,
      role: row.role,
      status: row.status === 'active' ? 'active' : 'inactive',
      joined_at: row.joinedAt ?? new Date(0).toISOString(),
    }));
  },

  async joinByCode(dto: JoinProjectDto): Promise<ProjectMemberDto> {
    assertHost();
    const joined = await joinHostProjectByCode(dto.code.toUpperCase(), dto.character_id || null);
    const projectId = requireUuid(joined.projectId, 'join_project_by_code');
    const userId = requireUuid(joined.userId, 'join_project_by_code.userId');
    return {
      id: projectId,
      project_id: projectId,
      user_id: userId,
      role: 'player',
      status: 'active',
      character_id: dto.character_id || null,
      joined_at: new Date().toISOString(),
    } as ProjectMemberDto;
  },

  async updateCharacter(projectId: string, characterId: string): Promise<ProjectMemberDto> {
    assertHost();
    const updated = await setHostMyProjectCharacter(projectId, characterId);
    const memberId = requireUuid(updated.memberId, 'set_my_project_character');
    const userId = requireUuid(updated.userId, 'set_my_project_character.userId');
    return {
      id: memberId,
      project_id: projectId,
      user_id: userId,
      role: 'player',
      status: 'active',
      character_id: characterId,
      joined_at: new Date().toISOString(),
    } as ProjectMemberDto;
  },

  /** Leave saga membership — host POST /api/v1/projects/:id/leave (CUT-23). */
  async leave(projectId: string, _userId: string): Promise<void> {
    void _userId;
    assertHost();
    await leaveHostProject(projectId);
  },

  /** Unused in product after CUT-20 — retained for contract stability. */
  async getMyProjects(_userId: string): Promise<ProjectMemberDto[]> {
    void _userId;
    return [];
  },
};
