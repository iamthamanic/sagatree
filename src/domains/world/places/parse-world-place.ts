/**
 * parse-world-place — JSON → WorldPlaceVm / map-link VMs.
 * Location: src/domains/world/places/parse-world-place.ts
 */
import {
  isWorldPlaceKind,
  isWorldPlaceMapUsage,
  isWorldPlaceStatus,
  type WorldPlaceMapLinkVm,
  type WorldPlaceVm,
} from './world-place.types';

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

export function parseWorldPlaceVm(raw: unknown): WorldPlaceVm | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const worldProfileId = asString(row.worldProfileId);
  const kind = row.kind;
  const name = asString(row.name).trim();
  const status = row.status;
  if (!id || !worldProfileId || !name || !isWorldPlaceKind(kind)) return null;
  const statusSafe = isWorldPlaceStatus(status) ? status : 'canonical';
  return {
    id,
    worldProfileId,
    parentPlaceId: asNullableString(row.parentPlaceId),
    kind,
    name,
    description: asNullableString(row.description),
    status: statusSafe,
    seedKey: asNullableString(row.seedKey),
    sortOrder: typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder) ? row.sortOrder : 0,
    revision: typeof row.revision === 'number' && Number.isFinite(row.revision) ? row.revision : 0,
    bindingReveal: asNullableString(row.bindingReveal) ?? undefined,
    bindingAssetId: asNullableString(row.bindingAssetId) ?? undefined,
  };
}

export function parseWorldPlaceList(raw: unknown): WorldPlaceVm[] {
  if (!raw || typeof raw !== 'object') return [];
  const places = (raw as Record<string, unknown>).places;
  if (!Array.isArray(places)) return [];
  const out: WorldPlaceVm[] = [];
  for (const item of places) {
    const parsed = parseWorldPlaceVm(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function parseWorldPlaceMapLinkVm(raw: unknown): WorldPlaceMapLinkVm | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const worldProfileId = asString(row.worldProfileId);
  const placeId = asString(row.placeId);
  const mapId = asString(row.mapId);
  const usage = row.usage;
  if (!id || !worldProfileId || !placeId || !mapId || !isWorldPlaceMapUsage(usage)) return null;
  const anchor =
    row.anchor && typeof row.anchor === 'object' && !Array.isArray(row.anchor)
      ? (row.anchor as Record<string, unknown>)
      : {};
  return {
    id,
    worldProfileId,
    placeId,
    mapId,
    usage,
    featureId: asNullableString(row.featureId),
    anchor,
  };
}

export function parseWorldPlaceMapLinkList(raw: unknown): WorldPlaceMapLinkVm[] {
  if (!raw || typeof raw !== 'object') return [];
  const links = (raw as Record<string, unknown>).links;
  if (!Array.isArray(links)) return [];
  const out: WorldPlaceMapLinkVm[] = [];
  for (const item of links) {
    const parsed = parseWorldPlaceMapLinkVm(item);
    if (parsed) out.push(parsed);
  }
  return out;
}

/** Prefer interior/dungeon/footprint map for a place. */
export function pickPrimaryMapIdForPlace(
  placeId: string,
  links: readonly WorldPlaceMapLinkVm[],
): string | null {
  const forPlace = links.filter((l) => l.placeId === placeId);
  const order = ['interior', 'dungeon', 'footprint', 'entrance', 'battlemap', 'overview'] as const;
  for (const usage of order) {
    const hit = forPlace.find((l) => l.usage === usage);
    if (hit) return hit.mapId;
  }
  return forPlace[0]?.mapId ?? null;
}

export function placeHasDetailMap(
  placeId: string,
  links: readonly WorldPlaceMapLinkVm[],
): boolean {
  return links.some(
    (l) =>
      l.placeId === placeId &&
      (l.usage === 'interior' || l.usage === 'dungeon' || l.usage === 'battlemap'),
  );
}
