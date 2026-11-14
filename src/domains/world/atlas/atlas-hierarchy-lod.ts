/**
 * atlas-hierarchy-lod — ATL2-E04 semantic LOD, lazy child loads, transitions.
 * Location: src/domains/world/atlas/atlas-hierarchy-lod.ts
 *
 * Pure domain — no React / Host. Per-level semantic feature visibility is
 * independent of editor layer toggles (editor may only hide further). Load
 * generations cancel stale fetches; cache keys support invalidation without
 * inventing child geography (E02 gates stay closed).
 */

import { canLodEnterChildMap, type MapFrameMeta } from './map-frame';

/** Six primary-map hierarchy bands (E01), coarsest → finest. */
export type AtlasHierarchyLodBand =
  | 'world'
  | 'continent'
  | 'country'
  | 'place'
  | 'building'
  | 'room';

export const ATLAS_HIERARCHY_LOD_BANDS: readonly AtlasHierarchyLodBand[] = [
  'world',
  'continent',
  'country',
  'place',
  'building',
  'room',
] as const;

/** Semantic content kinds — not the same as UnifiedCanvas editor layer keys. */
export type AtlasSemanticFeatureKind =
  | 'terrain'
  | 'region'
  | 'settlement'
  | 'building'
  | 'interior'
  | 'props'
  | 'grid';

export type AtlasEditorLayerFlags = {
  readonly terrain: boolean;
  readonly region: boolean;
  readonly city: boolean;
  readonly interior: boolean;
  readonly objects: boolean;
  readonly grid: boolean;
};

export const LOD_LOAD_FAILED_DE =
  'Kindkarte konnte nicht geladen werden — Elternkarte bleibt navigierbar.';
export const LOD_CHILD_MISSING_DE =
  'Detailkarte fehlt — kein Drill auf erfundene Geografie.';
export const LOD_STALE_IGNORED_DE = 'Veraltete Kartenladung verworfen.';
export const LOD_PREFETCH_SKIP_UNLOCATED_DE =
  'Unverortetes Kind — kein Prefetch / kein maßstabsgetreuer LOD-Drill.';
export const LOD_TRANSITION_BUSY_DE = 'Kartenwechsel läuft…';

export type AtlasMapLoadPhase =
  | 'idle'
  | 'prefetching'
  | 'loading'
  | 'transitioning'
  | 'ready'
  | 'error'
  | 'cancelled';

export type AtlasMapLoadSession = {
  readonly phase: AtlasMapLoadPhase;
  readonly activeMapId: string | null;
  readonly targetMapId: string | null;
  /** Monotonic token — only the latest generation may commit. */
  readonly generation: number;
  readonly errorDe: string | null;
  /** Bumped on invalidate; cache entries compare against this. */
  readonly cacheEpoch: number;
};

export type AtlasMapCacheEntry = {
  readonly mapId: string;
  readonly contentFingerprint: string;
  readonly cachedAtEpoch: number;
};

export type AtlasMapCacheStore = Readonly<Record<string, AtlasMapCacheEntry>>;

/** Breadcrumb length 1…6 → LOD band (longer crumb = finer). */
export function lodBandFromBreadcrumbDepth(depth: number): AtlasHierarchyLodBand {
  const d = Math.max(1, Math.min(6, Math.floor(depth)));
  return ATLAS_HIERARCHY_LOD_BANDS[d - 1]!;
}

export function createAtlasMapLoadSession(
  activeMapId: string | null = null,
): AtlasMapLoadSession {
  const id = activeMapId?.trim() || null;
  return {
    phase: id ? 'ready' : 'idle',
    activeMapId: id,
    targetMapId: null,
    generation: 0,
    errorDe: null,
    cacheEpoch: 0,
  };
}

/**
 * Semantic visibility for the active hierarchy band.
 * Editor layer flags can only further hide — never force-show LOD-hidden content.
 */
export function atlasSemanticFeatureVisible(
  band: AtlasHierarchyLodBand,
  feature: AtlasSemanticFeatureKind,
  editorLayerOn: boolean,
): boolean {
  if (!editorLayerOn) return false;
  switch (band) {
    case 'world':
      return feature === 'terrain' || feature === 'region';
    case 'continent':
      return feature === 'terrain' || feature === 'region';
    case 'country':
      return feature === 'terrain' || feature === 'region' || feature === 'settlement';
    case 'place':
      return (
        feature === 'settlement' ||
        feature === 'building' ||
        feature === 'props' ||
        feature === 'terrain'
      );
    case 'building':
      return (
        feature === 'building' ||
        feature === 'interior' ||
        feature === 'props' ||
        feature === 'grid'
      );
    case 'room':
      return feature === 'interior' || feature === 'props' || feature === 'grid';
    default: {
      const _exhaustive: never = band;
      return _exhaustive;
    }
  }
}

/** Map editor canvas layers → semantic AND for the active band. */
export function atlasHierarchyLodLayerFlags(
  band: AtlasHierarchyLodBand,
  layers: AtlasEditorLayerFlags,
): AtlasEditorLayerFlags {
  return {
    terrain: atlasSemanticFeatureVisible(band, 'terrain', layers.terrain),
    region: atlasSemanticFeatureVisible(band, 'region', layers.region),
    city: atlasSemanticFeatureVisible(band, 'settlement', layers.city),
    interior: atlasSemanticFeatureVisible(band, 'interior', layers.interior),
    objects: atlasSemanticFeatureVisible(band, 'props', layers.objects),
    grid: atlasSemanticFeatureVisible(band, 'grid', layers.grid),
  };
}

/**
 * Parent geo must not stay painted as a second LOD sheet when the child tip
 * owns the view — finer bands drop coarse settlement/region overlays.
 */
export function atlasParentGeoSuppressed(band: AtlasHierarchyLodBand): boolean {
  return band === 'building' || band === 'room';
}

export function atlasMapCacheKey(mapId: string, contentFingerprint: string): string {
  return `${mapId.trim()}::${contentFingerprint.trim()}`;
}

export function putAtlasMapCacheEntry(
  store: AtlasMapCacheStore,
  entry: AtlasMapCacheEntry,
): AtlasMapCacheStore {
  const id = entry.mapId.trim();
  if (!id) return store;
  return { ...store, [id]: entry };
}

export function invalidateAtlasMapCache(
  store: AtlasMapCacheStore,
  mapId: string,
): AtlasMapCacheStore {
  const id = mapId.trim();
  if (!id || !(id in store)) return store;
  const next = { ...store };
  delete next[id];
  return next;
}

export function isAtlasMapCacheFresh(
  store: AtlasMapCacheStore,
  mapId: string,
  contentFingerprint: string,
  cacheEpoch: number,
): boolean {
  const entry = store[mapId.trim()];
  if (!entry) return false;
  if (entry.cachedAtEpoch < cacheEpoch) return false;
  return entry.contentFingerprint === contentFingerprint.trim();
}

export type PrefetchChildDecision =
  | { readonly ok: true; readonly reason: 'prefetch' | 'cache-hit' }
  | { readonly ok: false; readonly reasonDe: string };

/**
 * Prefetch only located children. Unlocated never pretends scale-true drill.
 */
export function decidePrefetchChildMap(input: {
  readonly childMapId: string;
  readonly childFrame: MapFrameMeta | null;
  readonly cache: AtlasMapCacheStore;
  readonly contentFingerprint: string;
  readonly cacheEpoch: number;
}): PrefetchChildDecision {
  const id = input.childMapId.trim();
  if (!id) return { ok: false, reasonDe: LOD_CHILD_MISSING_DE };
  if (!input.childFrame || !canLodEnterChildMap(input.childFrame)) {
    return { ok: false, reasonDe: LOD_PREFETCH_SKIP_UNLOCATED_DE };
  }
  if (
    isAtlasMapCacheFresh(
      input.cache,
      id,
      input.contentFingerprint,
      input.cacheEpoch,
    )
  ) {
    return { ok: true, reason: 'cache-hit' };
  }
  return { ok: true, reason: 'prefetch' };
}

/** Start a load (or prefetch). Cancels any in-flight generation implicitly. */
export function beginAtlasMapLoad(
  session: AtlasMapLoadSession,
  targetMapId: string,
  mode: 'loading' | 'prefetching' = 'loading',
): AtlasMapLoadSession {
  const id = targetMapId.trim();
  if (!id) {
    return {
      ...session,
      phase: 'error',
      targetMapId: null,
      errorDe: LOD_CHILD_MISSING_DE,
    };
  }
  return {
    ...session,
    phase: mode,
    targetMapId: id,
    generation: session.generation + 1,
    errorDe: null,
  };
}

export function shouldApplyAtlasMapLoad(
  session: AtlasMapLoadSession,
  generation: number,
  mapId: string,
): boolean {
  if (generation !== session.generation) return false;
  if (session.phase !== 'loading' && session.phase !== 'prefetching' && session.phase !== 'transitioning') {
    return false;
  }
  return session.targetMapId === mapId.trim();
}

export function completeAtlasMapLoad(
  session: AtlasMapLoadSession,
  generation: number,
  mapId: string,
): AtlasMapLoadSession {
  if (!shouldApplyAtlasMapLoad(session, generation, mapId)) {
    return session.phase === 'cancelled'
      ? session
      : { ...session, errorDe: session.errorDe ?? LOD_STALE_IGNORED_DE };
  }
  return {
    ...session,
    phase: 'transitioning',
    activeMapId: mapId.trim(),
    targetMapId: mapId.trim(),
    errorDe: null,
  };
}

export function finishAtlasMapTransition(
  session: AtlasMapLoadSession,
  generation: number,
): AtlasMapLoadSession {
  if (generation !== session.generation) return session;
  if (session.phase !== 'transitioning') return session;
  return {
    ...session,
    phase: 'ready',
    targetMapId: null,
    errorDe: null,
  };
}

export function failAtlasMapLoad(
  session: AtlasMapLoadSession,
  generation: number,
  reasonDe: string = LOD_LOAD_FAILED_DE,
): AtlasMapLoadSession {
  if (generation !== session.generation) return session;
  return {
    ...session,
    phase: 'error',
    targetMapId: null,
    errorDe: reasonDe || LOD_LOAD_FAILED_DE,
  };
}

export function cancelAtlasMapLoad(session: AtlasMapLoadSession): AtlasMapLoadSession {
  if (
    session.phase !== 'loading' &&
    session.phase !== 'prefetching' &&
    session.phase !== 'transitioning'
  ) {
    return session;
  }
  return {
    ...session,
    phase: 'cancelled',
    targetMapId: null,
    generation: session.generation + 1,
    errorDe: null,
  };
}

export function bumpAtlasMapCacheEpoch(session: AtlasMapLoadSession): AtlasMapLoadSession {
  return { ...session, cacheEpoch: session.cacheEpoch + 1 };
}

/**
 * Transition opacity for child fade-in (0 → 1). Parent fades as 1 - child.
 * Outside transitioning phase: ready → 1, else → 0 for the incoming tip.
 */
export function atlasLodTransitionOpacity(
  phase: AtlasMapLoadPhase,
  t: number,
): { readonly child: number; readonly parent: number } {
  if (phase === 'ready') return { child: 1, parent: 0 };
  if (phase !== 'transitioning') return { child: 0, parent: 1 };
  const u = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  return { child: u, parent: 1 - u };
}

/** Navigable after cancelled / failed child load — stay on last ready map. */
export function atlasLodFallbackActiveMapId(session: AtlasMapLoadSession): string | null {
  if (session.phase === 'error' || session.phase === 'cancelled') {
    return session.activeMapId;
  }
  return session.activeMapId;
}
