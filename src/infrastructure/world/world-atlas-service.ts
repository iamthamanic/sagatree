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
  upsertHostWorldAtlasMap,
} from '../host/host-world-http';

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

  /** PARITY_MISSING (#1161): Azgaar upload via host assets. */
  async uploadAzgaarMapFile(_worldProfileId: string, _file: File): Promise<string> {
    void _worldProfileId;
    void _file;
    assertHost();
    throw new Error('Azgaar-Upload über Host-Speicher ist noch nicht verfügbar.');
  }

  /** PARITY_MISSING (#1161): signed URLs via host assets. */
  async createSignedUrl(_storagePath: string, _expiresSec = 3600): Promise<string> {
    void _storagePath;
    void _expiresSec;
    assertHost();
    throw new Error('Atlas-Download-URLs über Host-Speicher sind noch nicht verfügbar.');
  }
}

export const worldAtlasService = new WorldAtlasService();
