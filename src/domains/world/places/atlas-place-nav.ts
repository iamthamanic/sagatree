/**
 * atlas-place-nav — derive camera targets from world_place map-link anchors.
 * Location: src/domains/world/places/atlas-place-nav.ts
 */
import type { AtlasRect } from '../map/atlas-camera';
import type { WorldPlaceKind, WorldPlaceMapLinkVm, WorldPlaceVm } from './world-place.types';

export type AtlasPlaceNavItem = {
  readonly placeId: string;
  readonly name: string;
  readonly kind: WorldPlaceKind;
  readonly mapId: string | null;
  readonly x: number;
  readonly y: number;
  /** Suggested fit rect around the anchor for goTo. */
  readonly focusRect: AtlasRect;
  /**
   * True when a grounded numeric anchor exists on a map link.
   * Unlocated nodes keep mapId for tree select but must not drive LOD drill (#722).
   */
  readonly located: boolean;
};

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function anchorPointFromLink(link: WorldPlaceMapLinkVm): { x: number; y: number } | null {
  const x = num(link.anchor.x);
  const y = num(link.anchor.y);
  if (x == null || y == null) return null;
  return { x, y };
}

function spanForKind(kind: WorldPlaceKind): number {
  if (kind === 'realm' || kind === 'continent') return 180;
  if (kind === 'region' || kind === 'area') return 90;
  if (kind === 'settlement' || kind === 'district') return 36;
  if (kind === 'building' || kind === 'site') return 14;
  if (kind === 'interior' || kind === 'dungeon') return 8;
  return 40;
}

/**
 * Build zoom-nav / structure entries from world_places + map links (#718/#722).
 * Prefer primary map ownership; include unlocated nodes (no anchor) without a
 * fake focus rect so LOD cannot invent geography.
 */
export function buildAtlasPlaceNav(
  places: readonly WorldPlaceVm[],
  links: readonly WorldPlaceMapLinkVm[],
): AtlasPlaceNavItem[] {
  const byPlace = new Map<string, WorldPlaceMapLinkVm[]>();
  for (const link of links) {
    const list = byPlace.get(link.placeId) ?? [];
    list.push(link);
    byPlace.set(link.placeId, list);
  }

  const items: AtlasPlaceNavItem[] = [];
  for (const place of places) {
    if (place.status === 'archived') continue;
    const placeLinks = byPlace.get(place.id) ?? [];
    const anchored =
      placeLinks.find((l) => l.usage === 'primary' && anchorPointFromLink(l)) ??
      placeLinks.find((l) => l.usage === 'overview' && anchorPointFromLink(l)) ??
      placeLinks.find((l) => l.usage === 'footprint' && anchorPointFromLink(l)) ??
      placeLinks.find((l) => anchorPointFromLink(l));
    const primary =
      placeLinks.find((l) => l.usage === 'primary') ??
      anchored ??
      placeLinks[0] ??
      null;
    if (!primary) continue;
    const pt = anchored ? anchorPointFromLink(anchored) : null;
    const located = pt != null;
    const span = located ? spanForKind(place.kind) : 0;
    items.push({
      placeId: place.id,
      name: place.name,
      kind: place.kind,
      mapId: primary.mapId,
      x: pt?.x ?? 0,
      y: pt?.y ?? 0,
      located,
      focusRect: located
        ? {
            x: pt!.x - span / 2,
            y: pt!.y - span / 2,
            width: span,
            height: span,
          }
        : { x: 0, y: 0, width: 0, height: 0 },
    });
  }

  const order: Record<string, number> = {
    continent: 0,
    country: 1,
    realm: 1,
    place: 2,
    region: 2,
    area: 3,
    settlement: 3,
    district: 4,
    site: 5,
    building: 5,
    room: 6,
    interior: 6,
    dungeon: 5,
  };
  items.sort((a, b) => (order[a.kind] ?? 50) - (order[b.kind] ?? 50) || a.name.localeCompare(b.name, 'de'));
  return items;
}

export type AtlasLodStage = {
  readonly level: string;
  readonly crumb: string;
  readonly placeId: string | null;
};

function pointInFocus(
  p: { readonly x: number; readonly y: number },
  r: AtlasRect,
): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/**
 * Finest place under the camera that is zoomed in enough (Google-Maps-style LOD).
 * Only grounded (`located`) anchors participate — unlocated never causes map switches (#722).
 * Returns null when nav is empty so callers can fall back to demo rects.
 */
export function resolveAtlasLodFromPlaces(
  center: { readonly x: number; readonly y: number },
  pixelsPerUnit: number,
  nav: readonly AtlasPlaceNavItem[],
): AtlasLodStage | null {
  if (nav.length === 0) return null;
  const ranked = [...nav]
    .filter((item) => item.located && item.focusRect.width > 0 && item.focusRect.height > 0)
    .sort((a, b) => a.focusRect.width - b.focusRect.width);
  for (const item of ranked) {
    if (!pointInFocus(center, item.focusRect)) continue;
    if (pixelsPerUnit * item.focusRect.width < 260) continue;
    const level =
      item.kind === 'building' || item.kind === 'interior' || item.kind === 'dungeon'
        ? 'GEBÄUDE'
        : item.kind === 'settlement' || item.kind === 'district'
          ? 'ORT'
          : item.kind === 'region' || item.kind === 'area'
            ? 'LAND'
            : item.kind === 'realm' || item.kind === 'continent'
              ? 'LAND'
              : 'WELT';
    return { level, crumb: item.name, placeId: item.placeId };
  }
  return { level: 'WELT', crumb: 'Weltkarte', placeId: null };
}
