/**
 * world-profile-service — world profile persistence facade.
 * Location: src/infrastructure/world/world-profile-service.ts
 *
 * Dual-path (MIG-313): Host Library CRUD when `VITE_SAGATREE_HOST_LIBRARY=1`.
 */
import { assertSupabaseJwtSession } from '../../lib/authenticatedUser';
import { supabase } from '../../lib/supabase';
import { normalizeWorldModuleConfigMap } from '../../domains/world/worldModuleRegistry';
import type {
  CreateWorldProfileDto,
  UpdateWorldProfileDto,
  WorldProfileDto,
  WorldProfileVm,
} from '../../domains/world/contracts/world.types';
import {
  createHostLibraryWorld,
  deleteHostLibraryWorld,
  fetchHostLibraryWorldByPublicId,
  fetchHostLibraryWorlds,
  isHostLibraryEnabled,
  updateHostLibraryWorld,
  type HostLibraryWorldDto,
} from '../host/host-library-http';

const WORLD_SELECT =
  'id, owner_user_id, public_id, name, description, modules, created_at, updated_at';

function mapHostWorld(row: HostLibraryWorldDto): WorldProfileVm {
  const createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
  // Host world ports are title + publicId today (WorldReadDto). Description/modules
  // land in a later FE-HOST world-profile slice — do not invent empty writes.
  return {
    id: row.id,
    publicId: typeof row.publicId === 'string' ? row.publicId : '',
    name: row.title,
    description: '',
    modules: normalizeWorldModuleConfigMap(undefined),
    createdAt,
    updatedAt: createdAt,
  };
}

function normalizeName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error('Der Name der Welt ist erforderlich.');
  if (name.length > 255) throw new Error('Der Name der Welt darf höchstens 255 Zeichen lang sein.');
  return name;
}

function normalizeDescription(value?: string): string | null {
  const description = value?.trim() ?? '';
  return description || null;
}

function duplicateWorldName(sourceName: string): string {
  const suffix = ' (Kopie)';
  const base = sourceName.trim() || 'Welt';
  const maxBase = Math.max(1, 255 - suffix.length);
  return `${base.slice(0, maxBase)}${suffix}`;
}

class WorldProfileService {
  private readonly tableName = 'world_profiles';

  private mapToViewModel(dto: WorldProfileDto): WorldProfileVm {
    return {
      id: dto.id,
      publicId: typeof dto.public_id === 'string' ? dto.public_id : '',
      name: dto.name,
      description: dto.description ?? '',
      modules: normalizeWorldModuleConfigMap(dto.modules),
      createdAt: new Date(dto.created_at),
      updatedAt: new Date(dto.updated_at),
    };
  }

  async getUserWorldProfiles(ownerUserId: string): Promise<WorldProfileVm[]> {
    if (!ownerUserId) throw new Error('User not authenticated');
    if (isHostLibraryEnabled()) {
      const rows = await fetchHostLibraryWorlds();
      return rows.map(mapHostWorld);
    }
    const jwtUserId = await assertSupabaseJwtSession();
    const { data, error } = await supabase
      .from(this.tableName)
      .select(WORLD_SELECT)
      .eq('owner_user_id', jwtUserId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Welten konnten nicht geladen werden: ${error.message}`);
    return (data ?? []).map((entry) => this.mapToViewModel(entry as WorldProfileDto));
  }

  async getWorldProfile(ownerUserId: string, id: string): Promise<WorldProfileVm> {
    if (!ownerUserId) throw new Error('User not authenticated');
    if (isHostLibraryEnabled()) {
      const rows = await fetchHostLibraryWorlds();
      const match = rows.find((row) => row.id === id);
      if (!match) throw new Error('Welt konnte nicht geladen werden');
      return mapHostWorld(match);
    }
    const jwtUserId = await assertSupabaseJwtSession();
    const { data, error } = await supabase
      .from(this.tableName)
      .select(WORLD_SELECT)
      .eq('id', id)
      .eq('owner_user_id', jwtUserId)
      .single();

    if (error) throw new Error(`Welt konnte nicht geladen werden: ${error.message}`);
    return this.mapToViewModel(data as WorldProfileDto);
  }

  /** Resolve by public id (WO-…); RLS / host policy decides readability (no client-elevated filter). */
  async getByPublicId(worldPublicId: string): Promise<WorldProfileVm | null> {
    const publicId = worldPublicId.trim().toUpperCase();
    if (!publicId) return null;
    if (isHostLibraryEnabled()) {
      const row = await fetchHostLibraryWorldByPublicId(publicId);
      if (!row) return null;
      return mapHostWorld(row);
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase
      .from(this.tableName)
      .select(WORLD_SELECT)
      .eq('public_id', publicId)
      .maybeSingle();
    if (error) throw new Error(`Welt konnte nicht geladen werden: ${error.message}`);
    if (!data) return null;
    return this.mapToViewModel(data as WorldProfileDto);
  }

  async createWorldProfile(ownerUserId: string, payload: CreateWorldProfileDto): Promise<WorldProfileVm> {
    if (!ownerUserId) throw new Error('User not authenticated');
    if (isHostLibraryEnabled()) {
      if (
        (typeof payload.description === 'string' && payload.description.trim()) ||
        (payload.modules && Object.keys(payload.modules).length > 0)
      ) {
        throw new Error(
          'Host-Welten speichern derzeit nur den Namen. Beschreibung und Module folgen im nächsten Cutover-Schritt.',
        );
      }
      const created = await createHostLibraryWorld({ name: normalizeName(payload.name) });
      return mapHostWorld(created);
    }
    const jwtUserId = await assertSupabaseJwtSession();
    const insertPayload = {
      owner_user_id: jwtUserId,
      name: normalizeName(payload.name),
      description: normalizeDescription(payload.description),
      modules: normalizeWorldModuleConfigMap(payload.modules),
    };

    const { data, error } = await supabase
      .from(this.tableName)
      .insert(insertPayload)
      .select(WORLD_SELECT)
      .single();

    if (error) throw new Error(`Welt konnte nicht erstellt werden: ${error.message}`);
    return this.mapToViewModel(data as WorldProfileDto);
  }

  async duplicateWorldProfile(ownerUserId: string, id: string): Promise<WorldProfileVm> {
    if (!ownerUserId) throw new Error('User not authenticated');
    const source = await this.getWorldProfile(ownerUserId, id);
    return this.createWorldProfile(ownerUserId, {
      name: duplicateWorldName(source.name),
      description: source.description,
      modules: source.modules,
    });
  }

  async updateWorldProfile(
    ownerUserId: string,
    id: string,
    payload: UpdateWorldProfileDto,
  ): Promise<WorldProfileVm> {
    if (!ownerUserId) throw new Error('User not authenticated');
    if (isHostLibraryEnabled()) {
      if (
        (typeof payload.description === 'string' && payload.description.trim()) ||
        (payload.modules && Object.keys(payload.modules).length > 0)
      ) {
        throw new Error(
          'Host-Welten speichern derzeit nur den Namen. Beschreibung und Module folgen im nächsten Cutover-Schritt.',
        );
      }
      if (typeof payload.name !== 'string') {
        return this.getWorldProfile(ownerUserId, id);
      }
      const updated = await updateHostLibraryWorld(id, { name: normalizeName(payload.name) });
      return mapHostWorld(updated);
    }
    const jwtUserId = await assertSupabaseJwtSession();
    const updatePayload = {
      ...(typeof payload.name === 'string' ? { name: normalizeName(payload.name) } : {}),
      ...(typeof payload.description === 'string' ? { description: normalizeDescription(payload.description) } : {}),
      ...(payload.modules ? { modules: normalizeWorldModuleConfigMap(payload.modules) } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(this.tableName)
      .update(updatePayload)
      .eq('id', id)
      .eq('owner_user_id', jwtUserId)
      .select(WORLD_SELECT)
      .single();

    if (error) throw new Error(`Welt konnte nicht gespeichert werden: ${error.message}`);
    return this.mapToViewModel(data as WorldProfileDto);
  }

  async deleteWorldProfile(ownerUserId: string, id: string): Promise<void> {
    if (!ownerUserId) throw new Error('User not authenticated');
    if (isHostLibraryEnabled()) {
      await deleteHostLibraryWorld(id);
      return;
    }
    const jwtUserId = await assertSupabaseJwtSession();

    // World item definitions reference this profile with ON DELETE RESTRICT so
    // owned instances never become permanently unresolvable. Refuse early with
    // a German message instead of surfacing the Postgres FK error.
    const { count, error: catalogError } = await supabase
      .from('inventory_item_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('world_profile_id', id);
    if (catalogError) {
      throw new Error(`Welt konnte nicht gelöscht werden: ${catalogError.message}`);
    }
    if ((count ?? 0) > 0) {
      throw new Error(
        'Welt kann nicht gelöscht werden, solange Gegenstand-Definitionen darauf verweisen. Archivieren Sie die Definitionen zuerst — Löschen würde bestehende Inventare unauflösbar machen.',
      );
    }

    const { count: npcCount, error: npcError } = await supabase
      .from('npc_creature_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('world_profile_id', id);
    if (npcError) {
      throw new Error(`Welt konnte nicht gelöscht werden: ${npcError.message}`);
    }
    if ((npcCount ?? 0) > 0) {
      throw new Error(
        'Welt kann nicht gelöscht werden, solange NPC-/Kreatur-Definitionen darauf verweisen.',
      );
    }

    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .eq('owner_user_id', jwtUserId);

    if (error) throw new Error(`Welt konnte nicht gelöscht werden: ${error.message}`);
  }
}

export const worldProfileService = new WorldProfileService();
