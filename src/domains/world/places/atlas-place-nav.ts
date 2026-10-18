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
 * Build zoom-nav entries from places that have an atlas anchor on any map link.
 * Prefer overview/footprint links; fall back to first anchored link.
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
    const placeLinks = byPlace.get(place.id) ?? [];
    const preferred =
      placeLinks.find((l) => l.usage === 'overview' && anchorPointFromLink(l)) ??
      placeLinks.find((l) => l.usage === 'footprint' && anchorPointFromLink(l)) ??
      placeLinks.find((l) => anchorPointFromLink(l));
    if (!preferred) continue;
    const pt = anchorPointFromLink(preferred);
    if (!pt) continue;
    const span = spanForKind(place.kind);
    items.push({
      placeId: place.id,
      name: place.name,
      kind: place.kind,
      mapId: preferred.mapId,
      x: pt.x,
      y: pt.y,
      focusRect: {
        x: pt.x - span / 2,
        y: pt.y - span / 2,
        width: span,
        height: span,
      },
    });
  }

  const order: Record<string, number> = {
    continent: 0,
    realm: 1,
    region: 2,
    area: 3,
    settlement: 4,
    district: 5,
    site: 6,
    building: 7,
    interior: 8,
    dungeon: 9,
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
 * Returns null when nav is empty so callers can fall back to demo rects.
 */
export function resolveAtlasLodFromPlaces(
  center: { readonly x: number; readonly y: number },
  pixelsPerUnit: number,
  nav: readonly AtlasPlaceNavItem[],
): AtlasLodStage | null {
  if (nav.length === 0) return null;
  const ranked = [...nav].sort((a, b) => a.focusRect.width - b.focusRect.width);
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
