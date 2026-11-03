/**
 * world-place-service — Supabase adapter for world_places + map links.
 * Location: src/infrastructure/world/world-place-service.ts
 *
 * Dual-path (FE-HOST-03): Host HTTP when `VITE_SAGATREE_HOST_LIBRARY=1`.
 */
import { assertSupabaseJwtSession } from '../../lib/authenticatedUser';
import { supabase } from '../../lib/supabase';
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

class WorldPlaceService {
  async listPlaces(
    worldProfileId: string,
    options: ListWorldPlacesOptions = {},
  ): Promise<WorldPlaceVm[]> {
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    if (isHostLibraryEnabled()) {
      const data = await listHostWorldPlaces(id, options);
      return parseWorldPlaceList(data);
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('list_world_places', {
      p_world_profile_id: id,
      p_player_view: options.playerView === true,
      p_saga_public_id: options.sagaPublicId?.trim() || null,
    });
    if (error) throw new Error(`Orte konnten nicht geladen werden: ${error.message}`);
    return parseWorldPlaceList(data);
  }

  async listMapLinks(
    worldProfileId: string,
    options: ListWorldPlacesOptions = {},
  ): Promise<WorldPlaceMapLinkVm[]> {
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    if (isHostLibraryEnabled()) {
      const data = await listHostWorldPlaceMapLinks(id, options);
      return parseWorldPlaceMapLinkList(data);
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('list_world_place_map_links', {
      p_world_profile_id: id,
      p_player_view: options.playerView === true,
      p_saga_public_id: options.sagaPublicId?.trim() || null,
    });
    if (error) throw new Error(`Kartenverknüpfungen fehlgeschlagen: ${error.message}`);
    return parseWorldPlaceMapLinkList(data);
  }

  async upsertPlace(input: UpsertWorldPlaceInput): Promise<WorldPlaceVm> {
    if (isHostLibraryEnabled()) {
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
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('upsert_world_place', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId ?? null,
      p_parent_place_id: input.parentPlaceId ?? null,
      p_kind: input.kind,
      p_name: input.name,
      p_description: input.description ?? null,
      p_status: input.status ?? 'draft',
      p_seed_key: input.seedKey ?? null,
      p_sort_order: input.sortOrder ?? 0,
    });
    if (error) throw new Error(`Ort speichern fehlgeschlagen: ${error.message}`);
    const parsed = parseWorldPlaceVm(data);
    if (!parsed) throw new Error('Ort speichern: ungültige Antwort');
    return parsed;
  }

  /**
   * Atomic create: missing placeholder ancestors + target + primary maps (#715).
   * Client must pass a stable idempotency key for retries.
   */
  async createNodeWithMaps(input: {
    readonly worldProfileId: string;
    readonly kind: WorldNodeKind;
    readonly name: string;
    readonly idempotencyKey: string;
    readonly subtype?: WorldNodeSubtype | null;
    readonly parentPlaceId?: string | null;
    readonly description?: string | null;
  }): Promise<Readonly<Record<string, unknown>>> {
    if (isHostLibraryEnabled()) {
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
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('create_world_node_with_maps', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_kind: input.kind,
      p_name: input.name,
      p_idempotency_key: input.idempotencyKey.trim(),
      p_subtype: input.subtype ?? null,
      p_parent_place_id: input.parentPlaceId ?? null,
      p_description: input.description ?? null,
    });
    if (error) throw new Error(`Weltknoten anlegen fehlgeschlagen: ${error.message}`);
    if (!data || typeof data !== 'object') {
      throw new Error('Weltknoten anlegen: ungültige Antwort');
    }
    return data as Readonly<Record<string, unknown>>;
  }

  /** #716 — mutation RPCs (JWT session only). */
  async previewNodeConsequences(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
  }): Promise<Readonly<Record<string, unknown>>> {
    if (isHostLibraryEnabled()) {
      const data = await previewHostWorldNodeConsequences({
        worldProfileId: input.worldProfileId.trim(),
        placeId: input.placeId.trim(),
      });
      if (!data || typeof data !== 'object') throw new Error('Folgenabschätzung: ungültige Antwort');
      return data as Readonly<Record<string, unknown>>;
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('preview_world_node_consequences', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
    });
    if (error) throw new Error(`Folgenabschätzung fehlgeschlagen: ${error.message}`);
    if (!data || typeof data !== 'object') throw new Error('Folgenabschätzung: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }

  async renameNode(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly name: string;
  }): Promise<WorldPlaceVm> {
    if (isHostLibraryEnabled()) {
      const data = await renameHostWorldNode({
        worldProfileId: input.worldProfileId.trim(),
        placeId: input.placeId.trim(),
        name: input.name,
      });
      const parsed = parseWorldPlaceVm(data);
      if (!parsed) throw new Error('Umbenennen: ungültige Antwort');
      return parsed;
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('rename_world_node', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_name: input.name,
    });
    if (error) throw new Error(`Umbenennen fehlgeschlagen: ${error.message}`);
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
    if (isHostLibraryEnabled()) {
      const data = await reparentHostWorldNode({
        worldProfileId: input.worldProfileId.trim(),
        placeId: input.placeId.trim(),
        newParentPlaceId: input.newParentPlaceId,
        confirmRelocate: input.confirmRelocate,
      });
      if (!data || typeof data !== 'object') throw new Error('Verschieben: ungültige Antwort');
      return data as Readonly<Record<string, unknown>>;
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('reparent_world_node', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_new_parent_place_id: input.newParentPlaceId,
      p_confirm_relocate: input.confirmRelocate,
    });
    if (error) throw new Error(`Verschieben fehlgeschlagen: ${error.message}`);
    if (!data || typeof data !== 'object') throw new Error('Verschieben: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }

  async duplicateNode(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly deep?: boolean;
  }): Promise<Readonly<Record<string, unknown>>> {
    if (isHostLibraryEnabled()) {
      const data = await duplicateHostWorldNode({
        worldProfileId: input.worldProfileId.trim(),
        placeId: input.placeId.trim(),
        deep: input.deep === true,
      });
      if (!data || typeof data !== 'object') throw new Error('Duplizieren: ungültige Antwort');
      return data as Readonly<Record<string, unknown>>;
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('duplicate_world_node', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_deep: input.deep === true,
    });
    if (error) throw new Error(`Duplizieren fehlgeschlagen: ${error.message}`);
    if (!data || typeof data !== 'object') throw new Error('Duplizieren: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }

  async archiveNodeSubtree(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly confirm: boolean;
  }): Promise<Readonly<Record<string, unknown>>> {
    if (isHostLibraryEnabled()) {
      const data = await archiveHostWorldNodeSubtree({
        worldProfileId: input.worldProfileId.trim(),
        placeId: input.placeId.trim(),
        confirm: input.confirm,
      });
      if (!data || typeof data !== 'object') throw new Error('Archivieren: ungültige Antwort');
      return data as Readonly<Record<string, unknown>>;
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('archive_world_node_subtree', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_confirm: input.confirm,
    });
    if (error) throw new Error(`Archivieren fehlgeschlagen: ${error.message}`);
    if (!data || typeof data !== 'object') throw new Error('Archivieren: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }

  async deleteNode(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly confirm: boolean;
  }): Promise<Readonly<Record<string, unknown>>> {
    if (isHostLibraryEnabled()) {
      const data = await deleteHostWorldNode({
        worldProfileId: input.worldProfileId.trim(),
        placeId: input.placeId.trim(),
        confirm: input.confirm,
      });
      if (!data || typeof data !== 'object') throw new Error('Löschen: ungültige Antwort');
      return data as Readonly<Record<string, unknown>>;
    }
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('delete_world_node', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_confirm: input.confirm,
    });
    if (error) throw new Error(`Löschen fehlgeschlagen: ${error.message}`);
    if (!data || typeof data !== 'object') throw new Error('Löschen: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }

  async linkMap(input: LinkWorldPlaceMapInput): Promise<WorldPlaceMapLinkVm> {
    if (!isWorldPlaceMapUsage(input.usage)) {
      throw new Error(`Ungültige Kartenverwendung: ${input.usage}`);
    }
    if (isHostLibraryEnabled()) {
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
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('upsert_world_place_map_link', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_map_id: input.mapId.trim(),
      p_usage: input.usage,
      p_feature_id: input.featureId ?? null,
      p_anchor: input.anchor ?? {},
    });
    if (error) throw new Error(`Kartenverknüpfung fehlgeschlagen: ${error.message}`);
    const parsed = parseWorldPlaceMapLinkVm(data);
    if (!parsed) throw new Error('Kartenverknüpfung: ungültige Antwort');
    return parsed;
  }
}

export const worldPlaceService = new WorldPlaceService();
