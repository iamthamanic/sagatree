/**
 * project-member-service — Supabase adapter for project membership RPCs.
 * Location: src/infrastructure/project/project-member-service.ts
 *
 * Dual-path (MIG-308): production remains Supabase RPCs/tables. Host ports are
 * bound via `createHostProjectAdapter` for tests / future cutover (no accidental
 * cutover — VITE host flags alone do not redirect this facade).
 */

import { supabase } from '../../lib/supabase';
import type { ProjectMemberDto, JoinProjectDto } from '../../domains/project/contracts/project.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown, operation: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error(`${operation} returned an invalid identifier`);
  }
  return value;
}

export const projectMemberService = {
  /**
   * Get all members of a project
   */
  async getMembers(projectId: string): Promise<ProjectMemberDto[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .order('joined_at');

    if (error) throw error;
    return data || [];
  },

  /**
   * Join a project by its secret code.
   * Membership identity/status is created by a SECURITY DEFINER RPC, never by a client row insert.
   */
  async joinByCode(dto: JoinProjectDto): Promise<ProjectMemberDto> {
    const { data: projectId, error: joinError } = await supabase.rpc('join_project_by_code', {
      p_code: dto.code.toUpperCase(),
      p_character_id: dto.character_id || null,
    });

    if (joinError) throw new Error(`Beitritt fehlgeschlagen: ${joinError.message}`);
    const joinedProjectId = requireUuid(projectId, 'join_project_by_code');

    const { data, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', joinedProjectId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update only the current user's selected character for an active membership.
   * Protected membership fields (project/user/role/status) stay server/GM controlled.
   */
  async updateCharacter(projectId: string, characterId: string): Promise<ProjectMemberDto> {
    const { data: memberId, error: updateError } = await supabase.rpc('set_my_project_character', {
      p_project_id: projectId,
      p_character_id: characterId,
    });

    if (updateError) throw new Error(`Charakter konnte nicht aktualisiert werden: ${updateError.message}`);
    const updatedMemberId = requireUuid(memberId, 'set_my_project_character');

    const { data, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('id', updatedMemberId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Leave a project. Kicked memberships remain as denial records and cannot be self-deleted by RLS.
   */
  async leave(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  /**
   * Get active projects where user is a member
   */
  async getMyProjects(userId: string): Promise<ProjectMemberDto[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        *,
        project:projects(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('joined_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};
