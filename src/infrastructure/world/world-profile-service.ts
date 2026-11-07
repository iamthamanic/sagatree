/**
 * world-profile-service — world profile persistence facade (CUT-20 host Library HTTP).
 * Location: src/infrastructure/world/world-profile-service.ts
 *
 * Product runtime uses host Library world routes only — no Supabase client.
 */
import { normalizeWorldModuleConfigMap } from '../../domains/world/worldModuleRegistry';
import type {
  CreateWorldProfileDto,
  UpdateWorldProfileDto,
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

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

function mapHostWorld(row: HostLibraryWorldDto): WorldProfileVm {
  const createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
  // Host world ports are title + publicId today (WorldReadDto). Description/modules
  // Soft-DENY until parity (#1160 family) — do not invent empty writes.
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

function duplicateWorldName(sourceName: string): string {
  const suffix = ' (Kopie)';
  const base = sourceName.trim() || 'Welt';
  const maxBase = Math.max(1, 255 - suffix.length);
  return `${base.slice(0, maxBase)}${suffix}`;
}

class WorldProfileService {
  async getUserWorldProfiles(ownerUserId: string): Promise<WorldProfileVm[]> {
    if (!ownerUserId) throw new Error('User not authenticated');
    assertHost();
    const rows = await fetchHostLibraryWorlds();
    return rows.map(mapHostWorld);
  }

  async getWorldProfile(ownerUserId: string, id: string): Promise<WorldProfileVm> {
    if (!ownerUserId) throw new Error('User not authenticated');
    assertHost();
    const rows = await fetchHostLibraryWorlds();
    const match = rows.find((row) => row.id === id);
    if (!match) throw new Error('Welt konnte nicht geladen werden');
    return mapHostWorld(match);
  }

  /** Resolve by public id (WO-…); host policy decides readability. */
  async getByPublicId(worldPublicId: string): Promise<WorldProfileVm | null> {
    const publicId = worldPublicId.trim().toUpperCase();
    if (!publicId) return null;
    assertHost();
    const row = await fetchHostLibraryWorldByPublicId(publicId);
    if (!row) return null;
    return mapHostWorld(row);
  }

  async createWorldProfile(ownerUserId: string, payload: CreateWorldProfileDto): Promise<WorldProfileVm> {
    if (!ownerUserId) throw new Error('User not authenticated');
    assertHost();
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
    assertHost();
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

  async deleteWorldProfile(ownerUserId: string, id: string): Promise<void> {
    if (!ownerUserId) throw new Error('User not authenticated');
    assertHost();
    try {
      await deleteHostLibraryWorld(id);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      // Host enforces dependents (projects / inventory_item_definitions FK → world-in-use).
      if (/world-in-use|FOREIGN KEY|constraint/i.test(detail)) {
        throw new Error(
          'Welt kann nicht gelöscht werden, solange Gegenstand-Definitionen darauf verweisen. Archivieren Sie die Definitionen zuerst — Löschen würde bestehende Inventare unauflösbar machen.',
        );
      }
      throw err instanceof Error ? err : new Error(detail);
    }
  }
}

export const worldProfileService = new WorldProfileService();
