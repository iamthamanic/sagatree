/**
 * atlas-webgl-nav-tree — project persisted WorldPlaces into WebGL #nav model (#747).
 * Location: src/domains/world/places/atlas-webgl-nav-tree.ts
 *
 * Product 3D must not use prototype NAV_CHILDREN demo ids as hierarchy SoT.
 */
import { pickPrimaryMapIdForPlace } from './parse-world-place';
import type { WorldPlaceKind, WorldPlaceMapLinkVm, WorldPlaceVm } from './world-place.types';

/** UI kinds used by atlas-prototype-runtime.mjs navigation. */
export type AtlasWebglNavUiKind =
  | 'world'
  | 'kontinent'
  | 'land'
  | 'ort'
  | 'gebaeude'
  | 'raum';

export type AtlasWebglNavNode = {
  readonly id: string;
  /** Parent place id, or null when the node hangs directly under the world root. */
  readonly parentId: string | null;
  readonly label: string;
  readonly sub: string;
  readonly kind: AtlasWebglNavUiKind;
  readonly primaryMapId: string | null;
  readonly placeKind: WorldPlaceKind;
  readonly status: string;
};

export type AtlasWebglNavTreeStatus = 'ready' | 'loading' | 'error' | 'empty';

export type AtlasWebglNavTree = {
  readonly worldId: string;
  readonly worldLabel: string;
  readonly worldSub: string;
  readonly worldPrimaryMapId: string | null;
  readonly nodes: readonly AtlasWebglNavNode[];
  /** parent key → ordered child ids; worldId maps to root continents. */
  readonly childrenByParentId: Readonly<Record<string, readonly string[]>>;
  readonly status: AtlasWebglNavTreeStatus;
  readonly errorMessage?: string;
};

export type BuildAtlasWebglNavTreeInput = {
  readonly worldProfileId: string;
  readonly worldLabel: string;
  readonly worldPrimaryMapId?: string | null;
  readonly places: readonly WorldPlaceVm[];
  readonly links: readonly WorldPlaceMapLinkVm[];
  readonly status?: AtlasWebglNavTreeStatus;
  readonly errorMessage?: string;
};

const DEMO_NAV_IDS = [
  'westmark',
  'nordreich',
  'asteria',
  'city',
  'dungeon',
  'room',
  'kontinent',
] as const;

export function isDemoNavPlaceId(id: string): boolean {
  return (DEMO_NAV_IDS as readonly string[]).includes(id);
}

/** Map persisted place kind → WebGL nav UI kind. */
export function webglNavKindFromPlaceKind(kind: WorldPlaceKind): AtlasWebglNavUiKind {
  if (kind === 'continent') return 'kontinent';
  if (kind === 'country' || kind === 'realm') return 'land';
  if (
    kind === 'place' ||
    kind === 'settlement' ||
    kind === 'region' ||
    kind === 'area' ||
    kind === 'district'
  ) {
    return 'ort';
  }
  if (kind === 'building' || kind === 'site' || kind === 'dungeon') return 'gebaeude';
  if (kind === 'room' || kind === 'interior') return 'raum';
  return 'ort';
}

/**
 * Map WebGL + button UI kind → canonical WorldNodeKind for create dialogs (#748).
 * Returns null for `world` (created outside Atlas) or unknown labels.
 */
export function worldNodeKindFromWebglNavUiKind(
  uiKind: string,
): 'continent' | 'country' | 'place' | 'building' | 'room' | null {
  if (uiKind === 'kontinent') return 'continent';
  if (uiKind === 'land') return 'country';
  if (uiKind === 'ort') return 'place';
  if (uiKind === 'gebaeude') return 'building';
  if (uiKind === 'raum') return 'room';
  return null;
}

function subLabelForPlace(place: WorldPlaceVm, uiKind: AtlasWebglNavUiKind): string {
  if (place.status === 'placeholder') return 'Platzhalter';
  if (place.status === 'draft') return 'Entwurf';
  const labels: Record<AtlasWebglNavUiKind, string> = {
    world: 'Welt',
    kontinent: 'Kontinent',
    land: 'Land',
    ort: 'Ort',
    gebaeude: 'Gebäude',
    raum: 'Raum',
  };
  return labels[uiKind];
}

function sortPlaces(a: WorldPlaceVm, b: WorldPlaceVm): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name, 'de');
}

/**
 * Build a product WebGL nav tree from authorized place + link rows.
 * Archived places are omitted. Places without a primary map stay visible (mapId null).
 */
export function buildAtlasWebglNavTree(input: BuildAtlasWebglNavTreeInput): AtlasWebglNavTree {
  const worldId = `world:${input.worldProfileId}`;
  const status = input.status ?? 'ready';
  if (status === 'loading' || status === 'error') {
    return {
      worldId,
      worldLabel: input.worldLabel.trim() || 'Welt',
      worldSub: 'Welt',
      worldPrimaryMapId: input.worldPrimaryMapId ?? null,
      nodes: [],
      childrenByParentId: { [worldId]: [] },
      status,
      errorMessage: input.errorMessage,
    };
  }

  const active = input.places.filter((p) => p.status !== 'archived');
  const nodes: AtlasWebglNavNode[] = active.map((place) => {
    const kind = webglNavKindFromPlaceKind(place.kind);
    return {
      id: place.id,
      parentId: place.parentPlaceId,
      label: place.name,
      sub: subLabelForPlace(place, kind),
      kind,
      primaryMapId: pickPrimaryMapIdForPlace(place.id, input.links),
      placeKind: place.kind,
      status: place.status,
    };
  });

  const byParent = new Map<string, string[]>();
  const ensure = (key: string) => {
    const list = byParent.get(key);
    if (list) return list;
    const next: string[] = [];
    byParent.set(key, next);
    return next;
  };
  ensure(worldId);

  const sorted = [...active].sort(sortPlaces);
  for (const place of sorted) {
    const parentKey = place.parentPlaceId ?? worldId;
    ensure(parentKey).push(place.id);
    ensure(place.id);
  }

  const childrenByParentId: Record<string, readonly string[]> = {};
  for (const [key, ids] of byParent) {
    childrenByParentId[key] = ids;
  }

  return {
    worldId,
    worldLabel: input.worldLabel.trim() || 'Welt',
    worldSub: 'Welt',
    worldPrimaryMapId: input.worldPrimaryMapId ?? null,
    nodes,
    childrenByParentId,
    status: nodes.length === 0 ? 'empty' : 'ready',
  };
}
