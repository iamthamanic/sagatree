/**
 * world-map-service — Supabase adapter for world_maps (#580/#637).
 * Location: src/infrastructure/world/world-map-service.ts
 *
 * Dual-path (FE-HOST-03): Host HTTP when `VITE_SAGATREE_HOST_LIBRARY=1`.
 */
import { supabase } from '../../lib/supabase';
import {
  parseWorldMapVm,
  type WorldMapData,
  type WorldMapVm,
} from '../../domains/world/map';
import {
  fetchHostWorldMap,
  isHostLibraryEnabled,
  saveHostWorldMap,
} from '../host/host-world-http';

const MAP_PIN_MAX_BYTES = 5 * 1024 * 1024;
const MAP_PIN_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export type UploadPinImageOptions = {
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};

/** Prepare pin image via map-pin optimizer. Never silent-fallback to original on failure. */
export async function prepareWorldMapPinFile(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  if (file.size > MAP_PIN_MAX_BYTES) {
    throw new Error('Bild ist zu groß. Maximum 5 MB');
  }
  const { optimizeMedia } = await import('../media/optimizer');
  let optimizedBytes: Uint8Array | undefined;
  const result = await optimizeMedia({
    kind: 'image',
    profileId: 'map-pin',
    mimeType: file.type || 'application/octet-stream',
    byteSize: file.size,
    bytes: file,
    signal,
    onOptimizedBytes: (bytes) => {
      optimizedBytes = bytes;
    },
  });

  if (result.status === 'unchanged') {
    if (!MAP_PIN_ALLOWED_MIME.has(file.type)) {
      throw new Error('Nur PNG, JPEG oder WebP erlaubt.');
    }
    return file;
  }

  if (result.status === 'optimized') {
    if (!optimizedBytes || optimizedBytes.byteLength === 0) {
      throw new Error('Pin-Bild-Optimierung lieferte keine Bytes (kein stilles Original).');
    }
    const copy = new Uint8Array(optimizedBytes.byteLength);
    copy.set(optimizedBytes);
    const base = file.name.replace(/\.[^.]+$/, '') || 'pin';
    const ext = result.outputMimeType === 'image/webp' ? 'webp' : 'bin';
    return new File([copy], `${base}.${ext}`, { type: result.outputMimeType });
  }

  if (result.status === 'aborted') {
    throw new Error(result.message || 'Pin-Bild-Optimierung abgebrochen.');
  }

  const message =
    'message' in result && typeof result.message === 'string'
      ? result.message
      : 'Pin-Bild-Optimierung fehlgeschlagen.';
  throw new Error(message);
}

class WorldMapService {
  async getMap(worldProfileId: string, playerView = false): Promise<WorldMapVm> {
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    if (isHostLibraryEnabled()) {
      const data = await fetchHostWorldMap(id, playerView);
      const vm = parseWorldMapVm(data);
      if (!vm) throw new Error('Ungültige Kartenantwort');
      return vm;
    }
    const { data, error } = await supabase.rpc('get_world_map', {
      p_world_profile_id: id,
      p_player_view: playerView,
    });
    if (error) throw new Error(`Karte konnte nicht geladen werden: ${error.message}`);
    const vm = parseWorldMapVm(data);
    if (!vm) throw new Error('Ungültige Kartenantwort');
    return vm;
  }

  async saveMap(
    worldProfileId: string,
    expectedRevision: number,
    mapData: WorldMapData,
  ): Promise<WorldMapVm> {
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    if (isHostLibraryEnabled()) {
      const data = await saveHostWorldMap(id, expectedRevision, mapData);
      const vm = parseWorldMapVm(data);
      if (!vm) throw new Error('Ungültige Speicherantwort');
      return vm;
    }
    const { data, error } = await supabase.rpc('save_world_map', {
      p_world_profile_id: id,
      p_expected_revision: expectedRevision,
      p_map_data: mapData,
    });
    if (error) throw new Error(`Karte konnte nicht gespeichert werden: ${error.message}`);
    const vm = parseWorldMapVm(data);
    if (!vm) throw new Error('Ungültige Speicherantwort');
    return vm;
  }

  /**
   * Upload pin image; returns owner-scoped Storage path (not signed URL / not Base64).
   * Optimizes unless `alreadyOptimized` (intake already ran map-pin profile).
   */
  async uploadPinImage(
    worldProfileId: string,
    file: File,
    options?: UploadPinImageOptions,
  ): Promise<string> {
    if (isHostLibraryEnabled()) {
      throw new Error(
        'Pin-Bild-Upload über Host-Speicher folgt in einem späteren Cutover.',
      );
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Anmeldung erforderlich');

    const prepared = options?.alreadyOptimized
      ? file
      : await prepareWorldMapPinFile(file, options?.signal);

    if (prepared.size > MAP_PIN_MAX_BYTES) {
      throw new Error('Bild ist zu groß. Maximum 5 MB');
    }
    if (prepared.type && !MAP_PIN_ALLOWED_MIME.has(prepared.type)) {
      throw new Error('Nur PNG, JPEG oder WebP erlaubt.');
    }

    const ext =
      prepared.type === 'image/png' ? 'png' : prepared.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user.id}/world/${worldProfileId}/pins/${Date.now().toString(36)}.${ext}`;
    const { error } = await supabase.storage.from('world-map-pins').upload(path, prepared, {
      upsert: false,
      contentType: prepared.type || 'image/jpeg',
    });
    if (error) throw new Error(`Pin-Bild Upload fehlgeschlagen: ${error.message}`);
    return path;
  }
}

export const worldMapService = new WorldMapService();
