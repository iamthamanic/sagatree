/**
 * characterAdventureArc.service — Sync memberships to arcs and persist developments.
 * Location: src/infrastructure/character/character-adventure-arc-service.ts
 *
 * CUT-20: host Library HTTP only (`/api/v1/library/characters/.../adventure-arcs`).
 */
import type {
  AppendAdventureDevelopmentInput,
  CharacterAdventureArcDto,
  CharacterAdventureArcStatus,
  CharacterAdventureArcVm,
  CharacterAdventureDevelopmentDto,
  CharacterAdventureDevelopmentKind,
} from '../../domains/character/contracts/character-adventure-arc.types';
import {
  appendHostLibraryAdventureDevelopment,
  fetchHostLibraryAdventureArcs,
  isHostLibraryEnabled,
} from '../host/host-library-http';

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

function mapHostArc(value: unknown): CharacterAdventureArcVm | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const dto: CharacterAdventureArcDto = {
    id: value.id,
    character_id: typeof value.character_id === 'string' ? value.character_id : '',
    project_id: typeof value.project_id === 'string' ? value.project_id : '',
    status: isArcStatus(value.status) ? value.status : 'active',
    started_at: typeof value.started_at === 'string' ? value.started_at : new Date().toISOString(),
    ended_at: typeof value.ended_at === 'string' ? value.ended_at : null,
    summary: typeof value.summary === 'string' ? value.summary : null,
    developments: Array.isArray(value.developments) ? value.developments : [],
    created_at: typeof value.created_at === 'string' ? value.created_at : new Date().toISOString(),
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : new Date().toISOString(),
  };
  return mapArc(
    dto,
    typeof value.project_name === 'string' ? value.project_name : 'Unbekanntes Abenteuer',
    typeof value.project_status === 'string' ? value.project_status : null,
    typeof value.session_count === 'number' ? value.session_count : 0,
  );
}

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

class CharacterAdventureArcService {
  async listArcsForCharacter(characterId: string): Promise<CharacterAdventureArcVm[]> {
    assertHost();
    const trimmedId = characterId.trim();
    if (!trimmedId) throw new Error('Character id is required.');

    const rows = await fetchHostLibraryAdventureArcs(trimmedId);
    return rows
      .map(mapHostArc)
      .filter((row): row is CharacterAdventureArcVm => row !== null);
  }

  async appendDevelopment(
    arcId: string,
    input: AppendAdventureDevelopmentInput,
  ): Promise<CharacterAdventureArcVm> {
    assertHost();
    const title = input.title.trim();
    if (!title) throw new Error('Titel der Entwicklung ist erforderlich.');
    if (!isDevelopmentKind(input.kind)) throw new Error('Ungültige Entwicklungsart.');

    const updated = await appendHostLibraryAdventureDevelopment(arcId, {
      kind: input.kind,
      title,
      detail: input.detail,
      meta: input.meta,
    });
    const mapped = mapHostArc(updated);
    if (!mapped) throw new Error('Host-Abenteuer-Entwicklung: ungültige Antwort');
    return mapped;
  }
}

export const characterAdventureArcService = new CharacterAdventureArcService();
