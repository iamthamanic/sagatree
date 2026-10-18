/**
 * world-place-service — Supabase adapter for world_places + map links.
 * Location: src/infrastructure/world/world-place-service.ts
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
    await assertSupabaseJwtSession();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
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
    await assertSupabaseJwtSession();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const { data, error } = await supabase.rpc('list_world_place_map_links', {
      p_world_profile_id: id,
      p_player_view: options.playerView === true,
      p_saga_public_id: options.sagaPublicId?.trim() || null,
    });
    if (error) throw new Error(`Kartenverknüpfungen fehlgeschlagen: ${error.message}`);
    return parseWorldPlaceMapLinkList(data);
  }

  async upsertPlace(input: UpsertWorldPlaceInput): Promise<WorldPlaceVm> {
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

  async linkMap(input: LinkWorldPlaceMapInput): Promise<WorldPlaceMapLinkVm> {
    await assertSupabaseJwtSession();
    if (!isWorldPlaceMapUsage(input.usage)) {
      throw new Error(`Ungültige Kartenverwendung: ${input.usage}`);
    }
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
