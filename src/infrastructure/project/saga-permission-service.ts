/**
 * saga-permission-service — RPCs for saga grants, bindings, lore (#617).
 * Location: src/infrastructure/project/saga-permission-service.ts
 *
 * Clients never write grant/binding tables directly.
 */
import { supabase } from '../../lib/supabase';
import {
  isSagaBundleId,
  isSagaPermissionKey,
  parseSagaRevealStatus,
  type SagaAssetKind,
  type SagaBundleId,
  type SagaPermissionKey,
  type SagaRevealStatus,
} from '../../domains/saga/permissions';
import {
  parseSagaLoreTimeline,
  type SagaLoreTimelineVm,
} from '../../domains/saga/permissions/lore-timeline';

export type SagaMyPermissionsVm = {
  readonly projectId: string;
  readonly bundleId: SagaBundleId | null;
  readonly isGm: boolean;
  readonly keys: readonly SagaPermissionKey[];
};

export type SagaMemberPermissionStateVm = {
  readonly memberId: string;
  readonly userId: string;
  readonly role: string;
  readonly status: string;
  readonly bundleId: SagaBundleId | null;
  readonly canSetBundle: boolean;
};

export type SagaAssetBindingVm = {
  readonly id: string;
  readonly assetKind: SagaAssetKind;
  readonly assetId: string;
  readonly reveal: SagaRevealStatus;
  readonly label: string;
  /** Linked world_places.id when location is mapped to Donalu place model. */
  readonly worldPlaceId?: string | null;
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function parseKeys(raw: unknown): SagaPermissionKey[] {
  if (!Array.isArray(raw)) return [];
  const out: SagaPermissionKey[] = [];
  for (const item of raw) {
    if (isSagaPermissionKey(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

function parseMyPermissions(raw: unknown): SagaMyPermissionsVm {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Berechtigungen konnten nicht geladen werden');
  }
  const row = raw as Record<string, unknown>;
  const projectId = asString(row.projectId);
  if (!projectId) throw new Error('Berechtigungen ohne projectId');
  const bundleRaw = row.bundleId;
  return {
    projectId,
    bundleId: isSagaBundleId(bundleRaw) ? bundleRaw : null,
    isGm: row.isGm === true,
    keys: parseKeys(row.keys),
  };
}

function parseMemberState(raw: unknown): SagaMemberPermissionStateVm[] {
  if (!Array.isArray(raw)) return [];
  const out: SagaMemberPermissionStateVm[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const memberId = asString(row.memberId);
    const userId = asString(row.userId);
    if (!memberId || !userId) continue;
    const bundleRaw = row.bundleId;
    out.push({
      memberId,
      userId,
      role: asString(row.role),
      status: asString(row.status, 'active'),
      bundleId: isSagaBundleId(bundleRaw) ? bundleRaw : null,
      canSetBundle: row.canSetBundle === true,
    });
  }
  return out;
}

function parseBindings(raw: unknown): SagaAssetBindingVm[] {
  if (!Array.isArray(raw)) return [];
  const out: SagaAssetBindingVm[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = asString(row.id);
    const assetKind = asString(row.assetKind) as SagaAssetKind;
    const assetId = asString(row.assetId);
    const reveal = parseSagaRevealStatus(row.reveal);
    if (!id || !assetId || !reveal) continue;
    const worldPlaceRaw = row.worldPlaceId;
    out.push({
      id,
      assetKind,
      assetId,
      reveal,
      label: asString(row.label),
      worldPlaceId: typeof worldPlaceRaw === 'string' && worldPlaceRaw ? worldPlaceRaw : null,
    });
  }
  return out;
}

export const sagaPermissionService = {
  async getMyPermissions(sagaPublicId: string): Promise<SagaMyPermissionsVm> {
    const { data, error } = await supabase.rpc('get_my_saga_permissions', {
      p_public_id: sagaPublicId.trim().toUpperCase(),
    });
    if (error) {
      throw new Error(`Berechtigungen: ${error.message}`);
    }
    return parseMyPermissions(data);
  },

  async listMemberPermissionState(
    sagaPublicId: string,
  ): Promise<SagaMemberPermissionStateVm[]> {
    const { data, error } = await supabase.rpc('list_saga_member_permission_state', {
      p_public_id: sagaPublicId.trim().toUpperCase(),
    });
    if (error) {
      throw new Error(`Mitglieder-Rechte: ${error.message}`);
    }
    return parseMemberState(data);
  },

  async setMemberBundle(input: {
    projectId: string;
    memberId: string;
    bundleId: SagaBundleId;
  }): Promise<void> {
    const { error } = await supabase.rpc('set_saga_member_bundle', {
      p_project_id: input.projectId,
      p_member_id: input.memberId,
      p_bundle_id: input.bundleId,
    });
    if (error) {
      throw new Error(`Bundle konnte nicht gesetzt werden: ${error.message}`);
    }
  },

  async listBindings(
    sagaPublicId: string,
    assetKind?: SagaAssetKind | null,
  ): Promise<SagaAssetBindingVm[]> {
    const { data, error } = await supabase.rpc('list_saga_bindings', {
      p_public_id: sagaPublicId.trim().toUpperCase(),
      p_asset_kind: assetKind ?? null,
    });
    if (error) {
      throw new Error(`Bindings: ${error.message}`);
    }
    return parseBindings(data);
  },

  async setBindingReveal(input: {
    projectId: string;
    bindingId: string;
    reveal: SagaRevealStatus;
  }): Promise<SagaAssetBindingVm> {
    const { data, error } = await supabase.rpc('set_saga_binding_reveal', {
      p_project_id: input.projectId,
      p_binding_id: input.bindingId,
      p_reveal: input.reveal,
    });
    if (error) {
      throw new Error(`Sichtbarkeit: ${error.message}`);
    }
    const parsed = parseBindings([data]);
    if (parsed.length === 0) {
      throw new Error('Sichtbarkeit konnte nicht gelesen werden');
    }
    return parsed[0]!;
  },

  async getLoreTimeline(sagaPublicId: string): Promise<SagaLoreTimelineVm> {
    const { data, error } = await supabase.rpc('get_saga_lore_timeline', {
      p_public_id: sagaPublicId.trim().toUpperCase(),
    });
    if (error) {
      throw new Error(`Lore/Verlauf: ${error.message}`);
    }
    return parseSagaLoreTimeline(data);
  },
};
