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
import {
  computeMapWorldTransform,
  type AtlasWorldSceneMapInput,
} from './atlas-world-scene-plan';
import {
  isAtlasWorldError,
  localToWorld,
  type AtlasWorldSpaceNode,
} from './atlas-world-space';

/** How a map's content is drawn: terrain (world), streets/buildings (settlement), floor plans (interior). */
export type AtlasMapScale = 'world' | 'settlement' | 'interior';

export type AtlasMapPin = {
  readonly id: string;
  readonly label: string;
  /** Hierarchy kind (null when the legacy place kind has no canonical node kind). */
  readonly kind: WorldNodeKind | null;
  readonly x: number;
  readonly y: number;
  /** Optional World-Space footprint span (used for projection-driven label reveal in World mode). */
  readonly worldSpan?: number;
  /** Optional map ID associated with this pin (own primary map or host parent map for landmarks). */
  readonly mapId?: string;
  /** Optional hierarchy depth (1=world, 2=continent, 3=country, 4=place, 5=building, 6=room). */
  readonly depth?: number;
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
  const candidates = places.filter((p) => p.status !== 'archived' && ownerIds.has(p.id));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;
  // Prefer the shallowest owner whose parent does NOT share the same primary map
  // (so e.g. `Dornhain` always wins over child landmarks like `Whisper Road` / `Marktplatz`).
  const byId = new Map(places.map((p) => [p.id, p]));
  const depthOf = (p: WorldPlaceVm): number => {
    let d = 0;
    let cur: WorldPlaceVm | undefined = p;
    const seen = new Set<string>();
    while (cur?.parentPlaceId && !seen.has(cur.id)) {
      seen.add(cur.id);
      d += 1;
      cur = byId.get(cur.parentPlaceId);
    }
    return d;
  };
  const topOwners = candidates.filter((p) => !p.parentPlaceId || !ownerIds.has(p.parentPlaceId));
  const pool = topOwners.length > 0 ? topOwners : candidates;
  return [...pool].sort((a, b) => depthOf(a) - depthOf(b))[0] ?? null;
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

/**
 * Build unified World-Space pins across the ENTIRE located map hierarchy (continents,
 * countries, settlements like Moorbrück/Dornhain, buildings/dungeons, rooms & child landmarks):
 *  - Deduplicates strictly per `place.id`.
 *  - For places owning a located primary map (where this place is the shallowest owner),
 *    uses the exact World-Space map center via `computeMapWorldTransform`.
 *  - For child landmarks without their own primary map (e.g. Whisper Road / Marktplatz)
 *    or places with only an overview link, resolves `localToWorld(link.mapId, anchor)`.
 *  - Honestly skips unlocated maps / broken anchor chains (never invents coordinates).
 */
export function buildAtlasWorldPins(input: {
  readonly maps: readonly AtlasWorldSceneMapInput[];
  readonly places: readonly WorldPlaceVm[];
  readonly links: readonly WorldPlaceMapLinkVm[];
  readonly rootMapId: string | null;
}): AtlasMapPin[] {
  const { maps, places, links, rootMapId } = input;
  if (maps.length === 0) return [];

  const nodes = new Map<string, AtlasWorldSpaceNode>();
  const locatedTransforms = new Map<
    string,
    {
      readonly depth: number;
      readonly centerX: number;
      readonly centerY: number;
      readonly worldSpan: number;
    }
  >();

  for (const m of maps) {
    nodes.set(m.id, m);
  }
  for (const m of maps) {
    if (m.status === 'unlocated' || m.isPortal) continue;
    const wt = computeMapWorldTransform(nodes, m.id);
    if (!wt.ok) continue;
    locatedTransforms.set(m.id, {
      depth: wt.depth,
      centerX: wt.transform.centerX,
      centerY: wt.transform.centerY,
      worldSpan: wt.transform.worldSpan,
    });
  }

  // Precompute shallowest owner place for every located map so child landmarks sharing
  // a settlement's primary map don't steal the settlement's map center.
  const ownerPlaceIdByMapId = new Map<string, string>();
  for (const mapId of locatedTransforms.keys()) {
    const owner = atlasMapOwnerPlace(mapId, places, links);
    if (owner) ownerPlaceIdByMapId.set(mapId, owner.id);
  }

  const linksByPlaceId = new Map<string, WorldPlaceMapLinkVm[]>();
  for (const link of links) {
    const list = linksByPlaceId.get(link.placeId) ?? [];
    list.push(link);
    linksByPlaceId.set(link.placeId, list);
  }

  const pins: AtlasMapPin[] = [];
  const seen = new Set<string>();

  for (const place of places) {
    if (place.status === 'archived' || seen.has(place.id)) continue;
    const placeLinks = linksByPlaceId.get(place.id);
    if (!placeLinks || placeLinks.length === 0) continue;

    const kind = tryNodeKindFromPlaceKind(place.kind);
    const label = place.name.trim() || 'Ort';

    // 1) Primary-map pin: place owns a located non-root map -> exact World-Space map center
    const ownedPrimary = placeLinks.find(
      (l) =>
        l.usage === 'primary' &&
        l.mapId !== rootMapId &&
        ownerPlaceIdByMapId.get(l.mapId) === place.id &&
        locatedTransforms.has(l.mapId),
    );
    if (ownedPrimary) {
      const wt = locatedTransforms.get(ownedPrimary.mapId)!;
      seen.add(place.id);
      pins.push({
        id: place.id,
        label,
        kind,
        x: wt.centerX,
        y: wt.centerY,
        worldSpan: wt.worldSpan,
        mapId: ownedPrimary.mapId,
        depth: wt.depth,
      });
      continue;
    }

    // 2) Child landmark / overview-link pin: resolve anchor via `localToWorld(link.mapId, anchor)`
    // Prefer links anchored on the deepest located host map (e.g. Marktplatz on Dornhain)
    const groundedCandidates = placeLinks
      .map((link) => {
        const pt = anchorPointFromLink(link);
        const hostWt = locatedTransforms.get(link.mapId);
        if (!pt || !hostWt) return null;
        return { link, pt, hostWt };
      })
      .filter(
        (c): c is {
          readonly link: WorldPlaceMapLinkVm;
          readonly pt: { readonly x: number; readonly y: number };
          readonly hostWt: {
            readonly depth: number;
            readonly centerX: number;
            readonly centerY: number;
            readonly worldSpan: number;
          };
        } => c !== null,
      )
      .sort((a, b) => b.hostWt.depth - a.hostWt.depth);

    const best = groundedCandidates[0];
    if (!best) continue;

    const worldPos = localToWorld(nodes, best.link.mapId, best.pt);
    if (isAtlasWorldError(worldPos)) continue;

    seen.add(place.id);
    // Estimate landmark footprint relative to host map so micro-POIs reveal at host zoom
    const landmarkSpan =
      kind === 'continent'
        ? best.hostWt.worldSpan * 0.4
        : kind === 'country'
          ? best.hostWt.worldSpan * 0.25
          : kind === 'place'
            ? best.hostWt.worldSpan * 0.08
            : best.hostWt.worldSpan * 0.14;

    pins.push({
      id: place.id,
      label,
      kind,
      x: worldPos.value.x,
      y: worldPos.value.y,
      worldSpan: landmarkSpan,
      mapId: best.link.mapId,
      depth: best.hostWt.depth + 1,
    });
  }

  pins.sort(
    (a, b) =>
      (a.kind ? PIN_KIND_ORDER[a.kind] : 9) - (b.kind ? PIN_KIND_ORDER[b.kind] : 9) ||
      a.label.localeCompare(b.label, 'de'),
  );
  return pins.slice(0, ATLAS_MAP_PIN_LIMIT);
}
