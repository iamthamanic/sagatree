/**
 * world-place-service — Host HTTP for world_places + map links (CUT-20).
 * Location: src/infrastructure/world/world-place-service.ts
 */
import {
  isWorldPlaceMapUsage,
  parseWorldPlaceList,
  parseWorldPlaceMapLinkList,
  parseWorldPlaceMapLinkVm,
  parseWorldPlaceVm,
  type UpsertWorldPlaceInput,
  type WorldPlaceMapLinkVm,
  type WorldPlaceMapUsage,
  type WorldPlaceVm,
} from '../../domains/world/places';
import type { WorldNodeKind, WorldNodeSubtype } from '../../domains/world/hierarchy';
import {
  archiveHostWorldNodeSubtree,
  createHostWorldNodeWithMaps,
  deleteHostWorldNode,
  duplicateHostWorldNode,
  isHostLibraryEnabled,
  listHostWorldPlaceMapLinks,
  listHostWorldPlaces,
  previewHostWorldNodeConsequences,
  renameHostWorldNode,
  reparentHostWorldNode,
  upsertHostWorldPlace,
  upsertHostWorldPlaceMapLink,
} from '../host/host-world-http';

export type ListWorldPlacesOptions = {
  readonly playerView?: boolean;
  readonly sagaPublicId?: string | null;
};

export type LinkWorldPlaceMapInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
  readonly usage: WorldPlaceMapUsage;
  readonly featureId?: string | null;
  readonly anchor?: Readonly<Record<string, unknown>>;
};

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

class WorldPlaceService {
  async listPlaces(
    worldProfileId: string,
    options: ListWorldPlacesOptions = {},
  ): Promise<WorldPlaceVm[]> {
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const data = await listHostWorldPlaces(id, options);
    return parseWorldPlaceList(data);
  }

  async listMapLinks(
    worldProfileId: string,
    options: ListWorldPlacesOptions = {},
  ): Promise<WorldPlaceMapLinkVm[]> {
    assertHost();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const data = await listHostWorldPlaceMapLinks(id, options);
    return parseWorldPlaceMapLinkList(data);
  }

  async upsertPlace(input: UpsertWorldPlaceInput): Promise<WorldPlaceVm> {
    assertHost();
    const data = await upsertHostWorldPlace({
      worldProfileId: input.worldProfileId.trim(),
      placeId: input.placeId ?? null,
      parentPlaceId: input.parentPlaceId ?? null,
      kind: input.kind,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? 'draft',
      seedKey: input.seedKey ?? null,
      sortOrder: input.sortOrder ?? 0,
    });
    const parsed = parseWorldPlaceVm(data);
    if (!parsed) throw new Error('Ort speichern: ungültige Antwort');
    return parsed;
  }

  async createNodeWithMaps(input: {
    readonly worldProfileId: string;
    readonly kind: WorldNodeKind;
    readonly name: string;
    readonly idempotencyKey: string;
    readonly subtype?: WorldNodeSubtype | null;
    readonly parentPlaceId?: string | null;
    readonly description?: string | null;
  }): Promise<Readonly<Record<string, unknown>>> {
    assertHost();
    const data = await createHostWorldNodeWithMaps({
      worldProfileId: input.worldProfileId.trim(),
      kind: input.kind,
      name: input.name,
      idempotencyKey: input.idempotencyKey.trim(),
      subtype: input.subtype ?? null,
      parentPlaceId: input.parentPlaceId ?? null,
      description: input.description ?? null,
    });
    if (!data || typeof data !== 'object') {
      throw new Error('Weltknoten anlegen: ungültige Antwort');
    }
    return data as Readonly<Record<string, unknown>>;
  }

  async previewNodeConsequences(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
  }): Promise<Readonly<Record<string, unknown>>> {
    assertHost();
    const data = await previewHostWorldNodeConsequences({
      worldProfileId: input.worldProfileId.trim(),
      placeId: input.placeId.trim(),
    });
    if (!data || typeof data !== 'object') throw new Error('Folgenabschätzung: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }

  async renameNode(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly name: string;
  }): Promise<WorldPlaceVm> {
    assertHost();
    const data = await renameHostWorldNode({
      worldProfileId: input.worldProfileId.trim(),
      placeId: input.placeId.trim(),
      name: input.name,
    });
    const parsed = parseWorldPlaceVm(data);
    if (!parsed) throw new Error('Umbenennen: ungültige Antwort');
    return parsed;
  }

  async reparentNode(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly newParentPlaceId: string | null;
    readonly confirmRelocate: boolean;
  }): Promise<Readonly<Record<string, unknown>>> {
    assertHost();
    const data = await reparentHostWorldNode({
      worldProfileId: input.worldProfileId.trim(),
      placeId: input.placeId.trim(),
      newParentPlaceId: input.newParentPlaceId,
      confirmRelocate: input.confirmRelocate,
    });
    if (!data || typeof data !== 'object') throw new Error('Verschieben: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }

  async duplicateNode(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly deep?: boolean;
  }): Promise<Readonly<Record<string, unknown>>> {
    assertHost();
    const data = await duplicateHostWorldNode({
      worldProfileId: input.worldProfileId.trim(),
      placeId: input.placeId.trim(),
      deep: input.deep === true,
    });
    if (!data || typeof data !== 'object') throw new Error('Duplizieren: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }

  async archiveNodeSubtree(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly confirm: boolean;
  }): Promise<Readonly<Record<string, unknown>>> {
    assertHost();
    const data = await archiveHostWorldNodeSubtree({
      worldProfileId: input.worldProfileId.trim(),
      placeId: input.placeId.trim(),
      confirm: input.confirm,
    });
    if (!data || typeof data !== 'object') throw new Error('Archivieren: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }

  async deleteNode(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly confirm: boolean;
  }): Promise<Readonly<Record<string, unknown>>> {
    assertHost();
    const data = await deleteHostWorldNode({
      worldProfileId: input.worldProfileId.trim(),
      placeId: input.placeId.trim(),
      confirm: input.confirm,
    });
    if (!data || typeof data !== 'object') throw new Error('Löschen: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }

  async linkMap(input: LinkWorldPlaceMapInput): Promise<WorldPlaceMapLinkVm> {
    assertHost();
    if (!isWorldPlaceMapUsage(input.usage)) {
      throw new Error(`Ungültige Kartenverwendung: ${input.usage}`);
    }
    const data = await upsertHostWorldPlaceMapLink({
      worldProfileId: input.worldProfileId.trim(),
      placeId: input.placeId.trim(),
      mapId: input.mapId.trim(),
      usage: input.usage,
      featureId: input.featureId ?? null,
      anchor: input.anchor ?? {},
    });
    const parsed = parseWorldPlaceMapLinkVm(data);
    if (!parsed) throw new Error('Kartenverknüpfung: ungültige Antwort');
    return parsed;
  }
}

export const worldPlaceService = new WorldPlaceService();
