/**
 * characterAdventureArc.service — Sync memberships to arcs and persist developments.
 * Location: src/infrastructure/character/character-adventure-arc-service.ts
 */
import { supabase } from '../../lib/supabase';
import { assertHostProductSurfaceAvailable } from '../host/host-product-deny';
import type {
  AppendAdventureDevelopmentInput,
  CharacterAdventureArcDto,
  CharacterAdventureArcStatus,
  CharacterAdventureArcVm,
  CharacterAdventureDevelopmentDto,
  CharacterAdventureDevelopmentKind,
} from '../../domains/character/contracts/character-adventure-arc.types';

const TABLE = 'character_adventure_arcs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDevelopmentKind(value: unknown): value is CharacterAdventureDevelopmentKind {
  return value === 'level' || value === 'species-trait' || value === 'skill' || value === 'note';
}

function isArcStatus(value: unknown): value is CharacterAdventureArcStatus {
  return value === 'active' || value === 'completed' || value === 'left';
}

function normalizeDevelopments(value: unknown): CharacterAdventureDevelopmentDto[] {
  if (!Array.isArray(value)) return [];
  const entries: CharacterAdventureDevelopmentDto[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== 'string' || typeof item.at !== 'string' || typeof item.title !== 'string') continue;
    if (!isDevelopmentKind(item.kind)) continue;
    const entry: CharacterAdventureDevelopmentDto = {
      id: item.id,
      at: item.at,
      kind: item.kind,
      title: item.title.trim(),
    };
    if (typeof item.detail === 'string' && item.detail.trim()) entry.detail = item.detail.trim();
    if (isRecord(item.meta)) entry.meta = item.meta;
    if (entry.title) entries.push(entry);
  }
  return entries;
}

function mapArc(
  dto: CharacterAdventureArcDto,
  projectName: string,
  projectStatus: string | null,
  sessionCount: number,
): CharacterAdventureArcVm {
  return {
    id: dto.id,
    characterId: dto.character_id,
    projectId: dto.project_id,
    projectName,
    projectStatus,
    sessionCount,
    status: isArcStatus(dto.status) ? dto.status : 'active',
    startedAt: dto.started_at,
    endedAt: dto.ended_at,
    summary: typeof dto.summary === 'string' ? dto.summary : '',
    developments: normalizeDevelopments(dto.developments),
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function createDevelopmentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

class CharacterAdventureArcService {
  /**
   * Sync project memberships into arcs, then return arcs with project metadata.
   * Response: CharacterAdventureArcVm[] ordered by startedAt desc.
   */
  async listArcsForCharacter(characterId: string): Promise<CharacterAdventureArcVm[]> {
    assertHostProductSurfaceAvailable('Abenteuer-Bögen');
    const trimmedId = characterId.trim();
    if (!trimmedId) throw new Error('Character id is required.');

    const { data: memberships, error: membershipError } = await supabase
      .from('project_members')
      .select('project_id, joined_at, status')
      .eq('character_id', trimmedId);

    if (membershipError) {
      throw new Error(`Abenteuer-Mitgliedschaften konnten nicht geladen werden: ${membershipError.message}`);
    }

    const activeMemberships = (memberships ?? []).filter((row) => row.status === 'active');

    const { data: existingArcs, error: arcsError } = await supabase
      .from(TABLE)
      .select('*')
      .eq('character_id', trimmedId)
      .order('started_at', { ascending: false });

    if (arcsError) {
      throw new Error(`Abenteuer-Statistik konnte nicht geladen werden: ${arcsError.message}`);
    }

    const arcsByProject = new Map(
      ((existingArcs ?? []) as CharacterAdventureArcDto[]).map((arc) => [arc.project_id, arc]),
    );

    for (const membership of activeMemberships) {
      const projectId = membership.project_id as string;
      if (arcsByProject.has(projectId)) continue;

      const { data: inserted, error: insertError } = await supabase
        .from(TABLE)
        .insert({
          character_id: trimmedId,
          project_id: projectId,
          status: 'active',
          started_at: membership.joined_at ?? new Date().toISOString(),
          developments: [],
        })
        .select('*')
        .single();

      if (insertError) {
        // Concurrent upsert / unique race: reload later in this pass.
        if (insertError.code === '23505') continue;
        throw new Error(`Abenteuer-Bogen konnte nicht angelegt werden: ${insertError.message}`);
      }

      arcsByProject.set(projectId, inserted as CharacterAdventureArcDto);
    }

    const { data: refreshed, error: refreshError } = await supabase
      .from(TABLE)
      .select('*')
      .eq('character_id', trimmedId)
      .order('started_at', { ascending: false });

    if (refreshError) {
      throw new Error(`Abenteuer-Statistik konnte nicht aktualisiert werden: ${refreshError.message}`);
    }

    const arcs = (refreshed ?? []) as CharacterAdventureArcDto[];
    if (arcs.length === 0) return [];

    const projectIds = [...new Set(arcs.map((arc) => arc.project_id))];

    const [{ data: projects, error: projectsError }, { data: sessions, error: sessionsError }] = await Promise.all([
      supabase.from('projects').select('id, name, status').in('id', projectIds),
      supabase.from('sessions').select('project_id').in('project_id', projectIds),
    ]);

    if (projectsError) {
      throw new Error(`Projekte zur Statistik konnten nicht geladen werden: ${projectsError.message}`);
    }
    if (sessionsError) {
      throw new Error(`Sessions zur Statistik konnten nicht geladen werden: ${sessionsError.message}`);
    }

    const projectMeta = new Map(
      (projects ?? []).map((project) => [
        project.id as string,
        {
          name: typeof project.name === 'string' ? project.name : 'Unbenanntes Abenteuer',
          status: typeof project.status === 'string' ? project.status : null,
        },
      ]),
    );

    const sessionCounts = new Map<string, number>();
    for (const session of sessions ?? []) {
      const projectId = session.project_id as string;
      sessionCounts.set(projectId, (sessionCounts.get(projectId) ?? 0) + 1);
    }

    return arcs.map((arc) => {
      const meta = projectMeta.get(arc.project_id);
      return mapArc(
        arc,
        meta?.name ?? 'Unbekanntes Abenteuer',
        meta?.status ?? null,
        sessionCounts.get(arc.project_id) ?? 0,
      );
    });
  }

  async appendDevelopment(
    arcId: string,
    input: AppendAdventureDevelopmentInput,
  ): Promise<CharacterAdventureArcVm> {
    assertHostProductSurfaceAvailable('Abenteuer-Bögen');
    const title = input.title.trim();
    if (!title) throw new Error('Titel der Entwicklung ist erforderlich.');
    if (!isDevelopmentKind(input.kind)) throw new Error('Ungültige Entwicklungsart.');

    const { data: current, error: loadError } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', arcId)
      .single();

    if (loadError || !current) {
      throw new Error(`Abenteuer-Bogen nicht gefunden: ${loadError?.message ?? 'missing'}`);
    }

    const dto = current as CharacterAdventureArcDto;
    const developments = normalizeDevelopments(dto.developments);
    const nextEntry: CharacterAdventureDevelopmentDto = {
      id: createDevelopmentId(),
      at: new Date().toISOString(),
      kind: input.kind,
      title,
    };
    const detail = input.detail?.trim();
    if (detail) nextEntry.detail = detail;
    if (input.meta && Object.keys(input.meta).length > 0) nextEntry.meta = input.meta;

    const nextDevelopments = [...developments, nextEntry];

    const { data: updated, error: updateError } = await supabase
      .from(TABLE)
      .update({ developments: nextDevelopments })
      .eq('id', arcId)
      .select('*')
      .single();

    if (updateError || !updated) {
      throw new Error(`Entwicklung konnte nicht gespeichert werden: ${updateError?.message ?? 'missing'}`);
    }

    const { data: project } = await supabase
      .from('projects')
      .select('name, status')
      .eq('id', (updated as CharacterAdventureArcDto).project_id)
      .maybeSingle();

    const { count } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', (updated as CharacterAdventureArcDto).project_id);

    return mapArc(
      updated as CharacterAdventureArcDto,
      typeof project?.name === 'string' ? project.name : 'Unbenanntes Abenteuer',
      typeof project?.status === 'string' ? project.status : null,
      count ?? 0,
    );
  }
}

export const characterAdventureArcService = new CharacterAdventureArcService();
