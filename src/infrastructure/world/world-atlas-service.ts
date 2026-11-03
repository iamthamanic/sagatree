/**
 * world-atlas-service — Supabase adapter for world_atlas_maps (#702).
 * Location: src/infrastructure/world/world-atlas-service.ts
 *
 * Dual-path (FE-HOST-03): Host HTTP when `VITE_SAGATREE_HOST_LIBRARY=1`.
 */
import {
  assertSupabaseJwtSession,
  getAuthenticatedUserId,
} from '../../lib/authenticatedUser';
import { supabase } from '../../lib/supabase';
import {
  parseWorldAtlasMapList,
  parseWorldAtlasMapVm,
  type WorldAtlasFeatureCollection,
  type WorldAtlasMapKind,
  type WorldAtlasMapSummary,
  type WorldAtlasMapVm,
  type WorldAtlasBounds,
} from '../../domains/world/atlas';
import {
  ensureHostWorldAtlasRoot,
  fetchHostWorldAtlasMap,
  isHostLibraryEnabled,
  listHostWorldAtlasMaps,
  upsertHostWorldAtlasMap,
} from '../host/host-world-http';

const ATLAS_BUCKET = 'world-atlas';
const AZGAAR_MAX_BYTES = 40 * 1024 * 1024;

export type UpsertWorldAtlasMapInput = {
  readonly worldProfileId: string;
  readonly mapId?: string | null;
  readonly parentMapId?: string | null;
  readonly kind: WorldAtlasMapKind;
  readonly title: string;
  readonly sortOrder?: number;
  readonly bounds: WorldAtlasBounds;
  readonly layers: WorldAtlasFeatureCollection;
  readonly basemapStoragePath?: string | null;
  readonly azgaarMapStoragePath?: string | null;
  readonly generatorMeta?: Readonly<Record<string, unknown>>;
  readonly expectedRevision?: number | null;
};

class WorldAtlasService {
  async listMaps(
    worldProfileId: string,
    options: { readonly playerView?: boolean; readonly sagaPublicId?: string | null } = {},
  ): Promise<WorldAtlasMapSummary[]> {
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    if (isHostLibraryEnabled()) {
      const data = await listHostWorldAtlasMaps(id, options);
      return parseWorldAtlasMapList(data);
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('list_world_atlas_maps', {
      p_world_profile_id: id,
      p_player_view: options.playerView === true,
      p_saga_public_id: options.sagaPublicId?.trim() || null,
    });
    if (error) throw new Error(`Atlas-Liste fehlgeschlagen: ${error.message}`);
    return parseWorldAtlasMapList(data);
  }

  async ensureRoot(worldProfileId: string): Promise<WorldAtlasMapSummary[]> {
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    if (isHostLibraryEnabled()) {
      const data = await ensureHostWorldAtlasRoot(id);
      return parseWorldAtlasMapList(data);
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('ensure_world_atlas_root', {
      p_world_profile_id: id,
    });
    if (error) throw new Error(`Atlas-Root fehlgeschlagen: ${error.message}`);
    return parseWorldAtlasMapList(data);
  }

  async getMap(
    mapId: string,
    playerView = false,
    sagaPublicId?: string | null,
  ): Promise<WorldAtlasMapVm> {
    const id = mapId.trim();
    if (!id) throw new Error('Karten-ID fehlt');
    if (isHostLibraryEnabled()) {
      const data = await fetchHostWorldAtlasMap(id, playerView, sagaPublicId);
      return parseWorldAtlasMapVm(data);
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('get_world_atlas_map', {
      p_map_id: id,
      p_player_view: playerView,
      p_saga_public_id: sagaPublicId?.trim() || null,
    });
    if (error) throw new Error(`Atlas-Karte konnte nicht geladen werden: ${error.message}`);
    return parseWorldAtlasMapVm(data);
  }

  async upsertMap(input: UpsertWorldAtlasMapInput): Promise<WorldAtlasMapVm> {
    if (isHostLibraryEnabled()) {
      const data = await upsertHostWorldAtlasMap({
        worldProfileId: input.worldProfileId.trim(),
        mapId: input.mapId ?? null,
        parentMapId: input.parentMapId ?? null,
        kind: input.kind,
        title: input.title,
        sortOrder: input.sortOrder ?? 0,
        bounds: input.bounds,
        layers: input.layers,
        basemapStoragePath: input.basemapStoragePath ?? null,
        azgaarMapStoragePath: input.azgaarMapStoragePath ?? null,
        generatorMeta: input.generatorMeta ?? {},
        expectedRevision: input.expectedRevision ?? null,
      });
      return parseWorldAtlasMapVm(data);
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('upsert_world_atlas_map', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_map_id: input.mapId ?? null,
      p_parent_map_id: input.parentMapId ?? null,
      p_kind: input.kind,
      p_title: input.title,
      p_sort_order: input.sortOrder ?? 0,
      p_bounds: input.bounds,
      p_layers: input.layers,
      p_basemap_storage_path: input.basemapStoragePath ?? null,
      p_azgaar_map_storage_path: input.azgaarMapStoragePath ?? null,
      p_generator_meta: input.generatorMeta ?? {},
      p_expected_revision: input.expectedRevision ?? null,
    });
    if (error) {
      if (error.code === '40001' || /revision conflict/i.test(error.message)) {
        throw new Error(
          'Die Karte wurde inzwischen geändert. Bitte neu laden und erneut speichern.',
        );
      }
      throw new Error(`Atlas speichern fehlgeschlagen: ${error.message}`);
    }
    return parseWorldAtlasMapVm(data);
  }

  /** Store native Azgaar `.map` (or zip) — not a full embedded editor. */
  async uploadAzgaarMapFile(worldProfileId: string, file: File): Promise<string> {
    if (isHostLibraryEnabled()) {
      throw new Error(
        'Azgaar-Upload über Host-Speicher folgt in einem späteren Cutover.',
      );
    }
    await assertSupabaseJwtSession();
    const userId = await getAuthenticatedUserId();
    if (file.size > AZGAAR_MAX_BYTES) {
      throw new Error('Azgaar-Datei ist zu groß (max. 40 MB).');
    }
    const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'world.map';
    const path = `${userId}/${worldProfileId.trim()}/azgaar/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(ATLAS_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });
    if (error) throw new Error(`Azgaar-Upload fehlgeschlagen: ${error.message}`);
    return path;
  }

  async createSignedUrl(storagePath: string, expiresSec = 3600): Promise<string> {
    if (isHostLibraryEnabled()) {
      throw new Error(
        'Atlas-Download-URLs über Host-Speicher folgen in einem späteren Cutover.',
      );
    }
    await assertSupabaseJwtSession();
    const path = storagePath.trim();
    if (!path) throw new Error('Storage-Pfad fehlt');
    const { data, error } = await supabase.storage
      .from(ATLAS_BUCKET)
      .createSignedUrl(path, expiresSec);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message || 'Download-URL fehlgeschlagen.');
    }
    return data.signedUrl;
  }
}

export const worldAtlasService = new WorldAtlasService();
