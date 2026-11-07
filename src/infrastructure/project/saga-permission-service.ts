/**
 * saga-permission-service — Saga grants, bindings, lore via host HTTP (#617, CUT-20).
 * Location: src/infrastructure/project/saga-permission-service.ts
 */
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
import {
  fetchHostMySagaPermissions,
  fetchHostSagaLoreTimeline,
  isHostLibraryEnabled,
  listHostSagaBindings,
  listHostSagaMemberPermissionState,
  setHostSagaBindingReveal,
  setHostSagaMemberBundle,
} from '../host/host-project-http';

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

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

export const sagaPermissionService = {
  async getMyPermissions(sagaPublicId: string): Promise<SagaMyPermissionsVm> {
    assertHost();
    const publicId = sagaPublicId.trim().toUpperCase();
    const data = await fetchHostMySagaPermissions(publicId);
    return parseMyPermissions(data);
  },

  async listMemberPermissionState(
    sagaPublicId: string,
  ): Promise<SagaMemberPermissionStateVm[]> {
    assertHost();
    const publicId = sagaPublicId.trim().toUpperCase();
    const data = await listHostSagaMemberPermissionState(publicId);
    const members =
      data && typeof data === 'object' && Array.isArray((data as { members?: unknown }).members)
        ? (data as { members: unknown[] }).members
        : Array.isArray(data)
          ? data
          : [];
    return parseMemberState(members);
  },

  async setMemberBundle(input: {
    projectId: string;
    memberId: string;
    bundleId: SagaBundleId;
  }): Promise<void> {
    assertHost();
    await setHostSagaMemberBundle(input.projectId, input.memberId, input.bundleId);
  },

  async listBindings(
    sagaPublicId: string,
    assetKind?: SagaAssetKind | null,
  ): Promise<SagaAssetBindingVm[]> {
    assertHost();
    const publicId = sagaPublicId.trim().toUpperCase();
    const data = await listHostSagaBindings(publicId, assetKind ?? null);
    const bindings =
      data && typeof data === 'object' && Array.isArray((data as { bindings?: unknown }).bindings)
        ? (data as { bindings: unknown[] }).bindings
        : Array.isArray(data)
          ? data
          : [];
    return parseBindings(bindings);
  },

  async setBindingReveal(input: {
    projectId: string;
    bindingId: string;
    reveal: SagaRevealStatus;
  }): Promise<SagaAssetBindingVm> {
    assertHost();
    const data = await setHostSagaBindingReveal(
      input.projectId,
      input.bindingId,
      input.reveal,
    );
    const parsed = parseBindings([data]);
    if (parsed.length === 0) {
      throw new Error('Sichtbarkeit konnte nicht gelesen werden');
    }
    return parsed[0]!;
  },

  async getLoreTimeline(sagaPublicId: string): Promise<SagaLoreTimelineVm> {
    assertHost();
    const publicId = sagaPublicId.trim().toUpperCase();
    const data = await fetchHostSagaLoreTimeline(publicId);
    return parseSagaLoreTimeline(data);
  },
};
