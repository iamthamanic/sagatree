/**
 * world-atlas-service — Host HTTP for world atlas maps (CUT-20).
 * Location: src/infrastructure/world/world-atlas-service.ts
 */
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
  publishHostWorldAsset,
  resolveHostWorldAssetUrl,
  upsertHostWorldAtlasMap,
} from '../host/host-world-http';

/** Azgaar .map / zip ceiling — aligned with host DEFAULT_ASSET_MAX_BYTES. */
const AZGAAR_MAX_BYTES = 16 * 1024 * 1024;

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

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
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const data = await listHostWorldAtlasMaps(id, options);
    return parseWorldAtlasMapList(data);
  }

  async ensureRoot(worldProfileId: string): Promise<WorldAtlasMapSummary[]> {
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const data = await ensureHostWorldAtlasRoot(id);
    return parseWorldAtlasMapList(data);
  }

  async getMap(
    mapId: string,
    playerView = false,
    sagaPublicId?: string | null,
  ): Promise<WorldAtlasMapVm> {
    assertHost();
    const id = mapId.trim();
    if (!id) throw new Error('Karten-ID fehlt');
    const data = await fetchHostWorldAtlasMap(id, playerView, sagaPublicId);
    return parseWorldAtlasMapVm(data);
  }

  async upsertMap(input: UpsertWorldAtlasMapInput): Promise<WorldAtlasMapVm> {
    assertHost();
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

  /**
   * CUT-10b (#1161): Azgaar .map/.zip via world-scoped host assets (world.edit).
   * Returns owner-scoped storagePath for azgaarMapStoragePath persistence.
   */
  async uploadAzgaarMapFile(worldProfileId: string, file: File): Promise<string> {
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    if (file.size <= 0) throw new Error('Azgaar-Datei ist leer.');
    if (file.size > AZGAAR_MAX_BYTES) {
      throw new Error('Azgaar-Datei ist zu groß. Maximum 16 MB');
    }
    const published = await publishHostWorldAsset(id, file, 'azgaar');
    return published.storagePath;
  }

  /**
   * CUT-10b (#1161): credentialed host asset URL successor of Storage signed URL.
   * Cookie media GET on /api/v1/assets/:id — expiresSec retained for API parity only.
   */
  async createSignedUrl(storagePath: string, expiresSec = 3600): Promise<string> {
    void expiresSec;
    assertHost();
    return resolveHostWorldAssetUrl(storagePath);
  }
}

export const worldAtlasService = new WorldAtlasService();
