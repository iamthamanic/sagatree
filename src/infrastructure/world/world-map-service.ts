/**
 * world-map-service — Host HTTP for world maps (CUT-20).
 * Location: src/infrastructure/world/world-map-service.ts
 */
import {
  parseWorldMapVm,
  type WorldMapData,
  type WorldMapVm,
} from '../../domains/world/map';
import {
  fetchHostWorldMap,
  isHostLibraryEnabled,
  publishHostWorldAsset,
  saveHostWorldMap,
} from '../host/host-world-http';

const MAP_PIN_MAX_BYTES = 5 * 1024 * 1024;
const MAP_PIN_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export type UploadPinImageOptions = {
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

/** Prepare pin image via map-pin optimizer. Never silent-fallback to original on failure. */
export async function prepareWorldMapPinFile(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  if (file.size > MAP_PIN_MAX_BYTES) {
    throw new Error('Bild ist zu groß. Maximum 5 MB');
  }
  if (!MAP_PIN_ALLOWED_MIME.has(file.type)) {
    throw new Error('Nur PNG, JPEG oder WebP sind als Pin-Bild erlaubt.');
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
    return file;
  }

  if (result.status === 'optimized') {
    if (!optimizedBytes || optimizedBytes.byteLength === 0) {
      throw new Error('Pin-Bild-Optimierung lieferte keine Bytes (kein stilles Original).');
    }
    if (!MAP_PIN_ALLOWED_MIME.has(result.outputMimeType)) {
      throw new Error(`Optimiertes MIME ${result.outputMimeType} ist nicht erlaubt.`);
    }
    const copy = new Uint8Array(optimizedBytes.byteLength);
    copy.set(optimizedBytes);
    const base = file.name.replace(/\.[^.]+$/, '') || 'pin';
    const ext =
      result.outputMimeType === 'image/webp'
        ? 'webp'
        : result.outputMimeType === 'image/png'
          ? 'png'
          : 'jpg';
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
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const data = await fetchHostWorldMap(id, playerView);
    const vm = parseWorldMapVm(data);
    if (!vm) throw new Error('Ungültige Kartenantwort');
    return vm;
  }

  async saveMap(
    worldProfileId: string,
    expectedRevision: number,
    mapData: WorldMapData,
  ): Promise<WorldMapVm> {
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const data = await saveHostWorldMap(id, expectedRevision, mapData);
    const vm = parseWorldMapVm(data);
    if (!vm) throw new Error('Ungültige Speicherantwort');
    return vm;
  }

  /**
   * CUT-10b (#1161): owner/GM world.edit → host AssetPorts via world-scoped publish.
   * Returns owner-scoped storagePath (not a display URL).
   */
  async uploadPinImage(
    worldProfileId: string,
    file: File,
    options?: UploadPinImageOptions,
  ): Promise<string> {
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const prepared = options?.alreadyOptimized
      ? file
      : await prepareWorldMapPinFile(file, options?.signal);
    if (prepared.size > MAP_PIN_MAX_BYTES) {
      throw new Error('Bild ist zu groß. Maximum 5 MB');
    }
    if (!MAP_PIN_ALLOWED_MIME.has(prepared.type)) {
      throw new Error('Nur PNG, JPEG oder WebP sind als Pin-Bild erlaubt.');
    }
    const published = await publishHostWorldAsset(id, prepared, 'map-pin');
    return published.storagePath;
  }
}

export const worldMapService = new WorldMapService();
