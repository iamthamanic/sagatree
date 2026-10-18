/**
 * world-atlas-service — Supabase adapter for world_atlas_maps (#702).
 * Location: src/infrastructure/world/world-atlas-service.ts
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
  async listMaps(worldProfileId: string): Promise<WorldAtlasMapSummary[]> {
    await assertSupabaseJwtSession();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const { data, error } = await supabase.rpc('list_world_atlas_maps', {
      p_world_profile_id: id,
    });
    if (error) throw new Error(`Atlas-Liste fehlgeschlagen: ${error.message}`);
    return parseWorldAtlasMapList(data);
  }

  async ensureRoot(worldProfileId: string): Promise<WorldAtlasMapSummary[]> {
    await assertSupabaseJwtSession();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const { data, error } = await supabase.rpc('ensure_world_atlas_root', {
      p_world_profile_id: id,
    });
    if (error) throw new Error(`Atlas-Root fehlgeschlagen: ${error.message}`);
    return parseWorldAtlasMapList(data);
  }

  async getMap(mapId: string, playerView = false): Promise<WorldAtlasMapVm> {
    await assertSupabaseJwtSession();
    const id = mapId.trim();
    if (!id) throw new Error('Karten-ID fehlt');
    const { data, error } = await supabase.rpc('get_world_atlas_map', {
      p_map_id: id,
      p_player_view: playerView,
    });
    if (error) throw new Error(`Atlas-Karte konnte nicht geladen werden: ${error.message}`);
    return parseWorldAtlasMapVm(data);
  }

  async upsertMap(input: UpsertWorldAtlasMapInput): Promise<WorldAtlasMapVm> {
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
    const { data, error } = await supabase.storage
      .from(ATLAS_BUCKET)
      .createSignedUrl(storagePath, expiresSec);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message || 'Download-URL fehlgeschlagen.');
    }
    return data.signedUrl;
  }
}

export const worldAtlasService = new WorldAtlasService();
