/**
 * atlas-map-pins — Map content scale + place pins for the product 3D atlas.
 * Location: src/domains/world/atlas/atlas-map-pins.ts
 *
 * Pure projection of persisted places / map links onto one map (no React, no I/O).
 * Pins are labels only: they never create, move or authorize places.
 */
import { tryNodeKindFromPlaceKind, type WorldNodeKind } from '../hierarchy';
import { anchorPointFromLink } from '../places/atlas-place-nav';
import type { WorldPlaceMapLinkVm, WorldPlaceVm } from '../places/world-place.types';

/** How a map's content is drawn: terrain (world), streets/buildings (settlement), floor plans (interior). */
export type AtlasMapScale = 'world' | 'settlement' | 'interior';

export type AtlasMapPin = {
  readonly id: string;
  readonly label: string;
  /** Hierarchy kind (null when the legacy place kind has no canonical node kind). */
  readonly kind: WorldNodeKind | null;
  readonly x: number;
  readonly y: number;
};

/** Runtime label budget per map; extra places stay reachable via the structure tree. */
export const ATLAS_MAP_PIN_LIMIT = 400;

const PIN_KIND_ORDER: Readonly<Record<WorldNodeKind, number>> = {
  continent: 0,
  country: 1,
  place: 2,
  building: 3,
  room: 4,
};

/** Content scale of a map owned by a hierarchy node; the world root map (null) is world scale. */
export function atlasMapScaleForKind(kind: WorldNodeKind | null): AtlasMapScale {
  if (kind === 'place') return 'settlement';
  if (kind === 'building' || kind === 'room') return 'interior';
  return 'world';
}

/**
 * Half visible height (span) when focusing a pin on a world-scale map.
 * Mirrored by PRODUCT_PIN_SPAN in the import-free 3D runtime.
 */
export const ATLAS_MAP_PIN_FOCUS_SPAN: Readonly<Record<WorldNodeKind, number>> = {
  continent: 420,
  country: 260,
  place: 110,
  building: 34,
  room: 20,
};

/** World maps reveal building / room pins only when zoomed in; other scales show every pin. */
export function atlasMapPinVisible(
  pin: Pick<AtlasMapPin, 'kind'>,
  scale: AtlasMapScale,
  span: number,
): boolean {
  if (scale !== 'world') return true;
  if (pin.kind === 'building') return span < 140;
  if (pin.kind === 'room') return span < 45;
  return true;
}

/** Target span for focusing a pin; on settlement / interior maps the camera only zooms in. */
export function atlasMapPinFocusSpan(
  pin: Pick<AtlasMapPin, 'kind'>,
  scale: AtlasMapScale,
  currentSpan: number,
): number {
  if (scale === 'world') return ATLAS_MAP_PIN_FOCUS_SPAN[pin.kind ?? 'place'];
  return Math.min(currentSpan, scale === 'interior' ? 60 : 160);
}

/** Brush width in map units for the current span (3D runtime: productBrushWidth). */
export function atlasProductBrushWidth(span: number, brushUi: number): number {
  return Math.min(200, Math.max(0.2, span * 0.06 * (brushUi / 35)));
}

/** Stamp size factor for the current span (3D runtime: productStampSize). */
export function atlasProductStampSize(span: number, objectScale: number): number {
  return Math.min(4, Math.max(0.02, Math.round(span * objectScale) / 1000));
}

/** Place whose primary map is `mapId` (null for the world root map or unowned maps). */
export function atlasMapOwnerPlace(
  mapId: string | null,
  places: readonly WorldPlaceVm[],
  links: readonly WorldPlaceMapLinkVm[],
): WorldPlaceVm | null {
  if (!mapId) return null;
  const ownerIds = new Set(
    links.filter((l) => l.mapId === mapId && l.usage === 'primary').map((l) => l.placeId),
  );
  return places.find((p) => p.status !== 'archived' && ownerIds.has(p.id)) ?? null;
}

/**
 * Labels for every non-archived place with a grounded anchor on `mapId`.
 * The map's own owner is skipped (the map is that place); one pin per place.
 */
export function buildAtlasMapPins(input: {
  readonly mapId: string | null;
  readonly places: readonly WorldPlaceVm[];
  readonly links: readonly WorldPlaceMapLinkVm[];
}): AtlasMapPin[] {
  const { mapId, places, links } = input;
  if (!mapId) return [];
  const owner = atlasMapOwnerPlace(mapId, places, links);
  const byId = new Map(places.filter((p) => p.status !== 'archived').map((p) => [p.id, p]));
  const pins: AtlasMapPin[] = [];
  const seen = new Set<string>();
  for (const link of links) {
    if (link.mapId !== mapId || seen.has(link.placeId)) continue;
    const place = byId.get(link.placeId);
    if (!place || place.id === owner?.id) continue;
    const point = anchorPointFromLink(link);
    if (!point) continue;
    seen.add(place.id);
    pins.push({
      id: place.id,
      label: place.name.trim() || 'Ort',
      kind: tryNodeKindFromPlaceKind(place.kind),
      x: point.x,
      y: point.y,
    });
  }
  pins.sort(
    (a, b) =>
      (a.kind ? PIN_KIND_ORDER[a.kind] : 9) - (b.kind ? PIN_KIND_ORDER[b.kind] : 9) ||
      a.label.localeCompare(b.label, 'de'),
  );
  return pins.slice(0, ATLAS_MAP_PIN_LIMIT);
}
