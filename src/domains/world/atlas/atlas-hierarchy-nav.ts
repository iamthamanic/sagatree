/**
 * atlas-hierarchy-nav — ATL2-E03 six-level map zoom / breadcrumb / back-nav.
 * Location: src/domains/world/atlas/atlas-hierarchy-nav.ts
 *
 * Pure domain — no React / Host. Per-map camera snapshots are session-local;
 * hierarchy identity stays parent_map_id (E01). Unlocated children stay honest (E02).
 */
import type { AtlasProductCameraMode } from './atlas-product-camera';
import type { ParentSpatialAnchor } from './map-frame';
import { canLodEnterChildMap, type MapFrameMeta } from './map-frame';

/** Minimal map row for breadcrumb / parent walks. */
export type AtlasHierarchyMapRef = {
  readonly id: string;
  readonly title: string;
  readonly parentMapId: string | null;
};

/** Abstract 2D/product camera view stored per map while navigating. */
export type AtlasNavCameraView = {
  readonly centerX: number;
  readonly centerY: number;
  /** Half-height style span (product) or derived from 2D pixelsPerUnit. */
  readonly span: number;
  readonly mode: AtlasProductCameraMode;
};

export type AtlasHierarchyNavState = {
  readonly activeMapId: string;
  /** Last known camera per map id (session). */
  readonly snapshots: Readonly<Record<string, AtlasNavCameraView>>;
  /** Optional fly-to rect when entering a child (parent-space focus). */
  readonly pendingFocus:
    | {
        readonly mapId: string;
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
      }
    | null;
};

export const HIERARCHY_NAV_BACK_DE = 'Zurück zur Elternkarte';
export const HIERARCHY_NAV_UNLOCATED_DE =
  'Kindkarte ist unverortet — kein maßstabsgetreuer Zoom-Drill.';

export function defaultAtlasNavCameraView(
  seed?: Partial<AtlasNavCameraView>,
): AtlasNavCameraView {
  return {
    centerX:
      typeof seed?.centerX === 'number' && Number.isFinite(seed.centerX) ? seed.centerX : 500,
    centerY:
      typeof seed?.centerY === 'number' && Number.isFinite(seed.centerY) ? seed.centerY : 500,
    span: typeof seed?.span === 'number' && Number.isFinite(seed.span) && seed.span > 0 ? seed.span : 530,
    mode: seed?.mode === 'diorama-oblique' || seed?.mode === 'perspective' ? seed.mode : 'ortho-topdown',
  };
}

export function createAtlasHierarchyNavState(
  activeMapId: string,
  camera?: AtlasNavCameraView,
): AtlasHierarchyNavState {
  const id = activeMapId.trim();
  const view = defaultAtlasNavCameraView(camera);
  return {
    activeMapId: id,
    snapshots: id ? { [id]: view } : {},
    pendingFocus: null,
  };
}

/**
 * Cycle-safe breadcrumb from world root → active tip via parent_map_id.
 * Missing parents stop the walk; loops abort without duplicating.
 */
export function buildMapBreadcrumb(
  maps: readonly AtlasHierarchyMapRef[],
  activeMapId: string,
): AtlasHierarchyMapRef[] {
  const byId = new Map(maps.map((m) => [m.id, m]));
  const chain: AtlasHierarchyMapRef[] = [];
  const guard = new Set<string>();
  let cur = byId.get(activeMapId.trim());
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    chain.unshift(cur);
    const parentId = cur.parentMapId?.trim() || null;
    cur = parentId ? byId.get(parentId) : undefined;
  }
  return chain;
}

export function focusRectFromParentAnchor(anchor: ParentSpatialAnchor): {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
} {
  const w = Math.max(1e-6, anchor.extentX * 2);
  const h = Math.max(1e-6, anchor.extentY * 2);
  return {
    x: anchor.centerX - w / 2,
    y: anchor.centerY - h / 2,
    width: w,
    height: h,
  };
}

function withSnapshot(
  state: AtlasHierarchyNavState,
  mapId: string,
  camera: AtlasNavCameraView,
): Readonly<Record<string, AtlasNavCameraView>> {
  return { ...state.snapshots, [mapId]: defaultAtlasNavCameraView(camera) };
}

export type EnterChildMapInput = {
  readonly state: AtlasHierarchyNavState;
  readonly childMapId: string;
  readonly parentCamera: AtlasNavCameraView;
  /** Child map frame on the current (parent) map — required for scale-true drill. */
  readonly childFrame: MapFrameMeta | null;
  /**
   * Declared `parent_map_id` of the child summary. When set, must equal the
   * active map — never invent a scale-true anchor for grandchildren/siblings.
   */
  readonly childParentMapId?: string | null;
  /** When true, still switch map but skip fly-to and set unlocated notice. */
  readonly allowUnlocatedOpen?: boolean;
};

export type AtlasParentFlyRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type EnterChildMapResult =
  | {
      readonly ok: true;
      readonly state: AtlasHierarchyNavState;
      readonly unlocated: boolean;
      readonly noticeDe: string | null;
      /**
       * Parent-space fly-to for the map being left. Animate on the parent
       * before switching; child restore uses session snapshot (child-local).
       */
      readonly parentFlyTo: AtlasParentFlyRect | null;
    }
  | { readonly ok: false; readonly reasonDe: string };

export const HIERARCHY_NAV_NOT_DIRECT_CHILD_DE =
  'Nur direkte Kindkarten — Ziel ist kein Kind der aktiven Karte.';

/**
 * Leave current map: snapshot parent camera, activate child.
 * Parent-space fly-to is returned separately so the workbench animates it
 * before the map switch; the child then restores a child-local camera.
 */
export function enterChildMap(input: EnterChildMapInput): EnterChildMapResult {
  const childId = input.childMapId.trim();
  if (!childId) return { ok: false, reasonDe: 'Kindkarte fehlt.' };
  if (childId === input.state.activeMapId) {
    return {
      ok: true,
      state: {
        ...input.state,
        snapshots: withSnapshot(input.state, childId, input.parentCamera),
        pendingFocus: null,
      },
      unlocated: false,
      noticeDe: null,
      parentFlyTo: null,
    };
  }

  const declaredParent = input.childParentMapId?.trim() || null;
  if (declaredParent != null && declaredParent !== input.state.activeMapId) {
    return { ok: false, reasonDe: HIERARCHY_NAV_NOT_DIRECT_CHILD_DE };
  }

  const frame = input.childFrame;
  if (
    frame?.parentAnchor &&
    frame.parentAnchor.parentMapId.trim() !== input.state.activeMapId
  ) {
    return { ok: false, reasonDe: HIERARCHY_NAV_NOT_DIRECT_CHILD_DE };
  }

  const located = frame != null && canLodEnterChildMap(frame);
  if (!located && !input.allowUnlocatedOpen) {
    return { ok: false, reasonDe: HIERARCHY_NAV_UNLOCATED_DE };
  }

  const snapshots = withSnapshot(input.state, input.state.activeMapId, input.parentCamera);
  const childSnap =
    snapshots[childId] ??
    defaultAtlasNavCameraView({ mode: input.parentCamera.mode });
  const parentFlyTo =
    located && frame?.parentAnchor
      ? focusRectFromParentAnchor(frame.parentAnchor)
      : null;

  return {
    ok: true,
    state: {
      activeMapId: childId,
      snapshots: { ...snapshots, [childId]: childSnap },
      pendingFocus: null,
    },
    unlocated: !located,
    noticeDe: located ? null : HIERARCHY_NAV_UNLOCATED_DE,
    parentFlyTo,
  };
}
export type NavigateAncestorInput = {
  readonly state: AtlasHierarchyNavState;
  readonly maps: readonly AtlasHierarchyMapRef[];
  readonly targetMapId: string;
  readonly currentCamera: AtlasNavCameraView;
};

export type NavigateAncestorResult =
  | { readonly ok: true; readonly state: AtlasHierarchyNavState }
  | { readonly ok: false; readonly reasonDe: string };

/**
 * Jump to an ancestor (breadcrumb). Restores that map's snapshot; saves current.
 * Target must appear on the active breadcrumb chain (no skip to unrelated maps).
 */
export function navigateToAncestor(input: NavigateAncestorInput): NavigateAncestorResult {
  const targetId = input.targetMapId.trim();
  if (!targetId) return { ok: false, reasonDe: 'Zielkarte fehlt.' };
  const crumb = buildMapBreadcrumb(input.maps, input.state.activeMapId);
  if (!crumb.some((c) => c.id === targetId)) {
    return { ok: false, reasonDe: 'Ziel liegt nicht in der Breadcrumb-Kette.' };
  }
  if (targetId === input.state.activeMapId) {
    return {
      ok: true,
      state: {
        ...input.state,
        snapshots: withSnapshot(input.state, targetId, input.currentCamera),
        pendingFocus: null,
      },
    };
  }
  const snapshots = withSnapshot(input.state, input.state.activeMapId, input.currentCamera);
  const restored = snapshots[targetId] ?? defaultAtlasNavCameraView();
  return {
    ok: true,
    state: {
      activeMapId: targetId,
      snapshots: { ...snapshots, [targetId]: restored },
      pendingFocus: {
        mapId: targetId,
        x: restored.centerX - restored.span,
        y: restored.centerY - restored.span,
        width: restored.span * 2,
        height: restored.span * 2,
      },
    },
  };
}

/** One step up the parent_map_id chain (Back / Alt+ArrowUp / Escape). */
export function navigateBack(input: {
  readonly state: AtlasHierarchyNavState;
  readonly maps: readonly AtlasHierarchyMapRef[];
  readonly currentCamera: AtlasNavCameraView;
}): NavigateAncestorResult {
  const byId = new Map(input.maps.map((m) => [m.id, m]));
  const active = byId.get(input.state.activeMapId);
  const parentId = active?.parentMapId?.trim() || null;
  if (!parentId || !byId.has(parentId)) {
    return { ok: false, reasonDe: 'Keine Elternkarte.' };
  }
  return navigateToAncestor({
    state: input.state,
    maps: input.maps,
    targetMapId: parentId,
    currentCamera: input.currentCamera,
  });
}

export function peekRestoredCamera(
  state: AtlasHierarchyNavState,
  mapId: string,
): AtlasNavCameraView {
  return state.snapshots[mapId.trim()] ?? defaultAtlasNavCameraView();
}

export function consumePendingFocus(
  state: AtlasHierarchyNavState,
): { readonly state: AtlasHierarchyNavState; readonly focus: AtlasHierarchyNavState['pendingFocus'] } {
  return { state: { ...state, pendingFocus: null }, focus: state.pendingFocus };
}

export type HierarchyNavKeyIntent = 'back' | 'none';

/** Keyboard intents for hierarchy back (tools should claim Escape first). */
export function parseHierarchyNavKey(input: {
  readonly key: string;
  readonly altKey: boolean;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
}): HierarchyNavKeyIntent {
  if (input.key === 'Escape') return 'back';
  if (input.altKey && (input.key === 'ArrowUp' || input.key === 'Up')) return 'back';
  return 'none';
}

/**
 * Wheel zoom-out at minimum span requests hierarchy back (not continuous mesh zoom).
 * `deltaY > 0` = zoom out; caller supplies whether already at min span.
 */
export function wheelRequestsHierarchyBack(input: {
  readonly deltaY: number;
  readonly atMinSpan: boolean;
}): boolean {
  return input.atMinSpan && Number.isFinite(input.deltaY) && input.deltaY > 0;
}

/**
 * Two tip ids under the same place must not share a linear ancestor→descendant link
 * (sibling buildings/rooms are independent journeys).
 */
export function assertIndependentBranches(input: {
  readonly maps: readonly AtlasHierarchyMapRef[];
  readonly tipA: string;
  readonly tipB: string;
}): { readonly ok: true } | { readonly ok: false; readonly reasonDe: string } {
  const a = buildMapBreadcrumb(input.maps, input.tipA).map((m) => m.id);
  const b = buildMapBreadcrumb(input.maps, input.tipB).map((m) => m.id);
  if (a.includes(input.tipB) || b.includes(input.tipA)) {
    return { ok: false, reasonDe: 'Tips liegen auf einer gemeinsamen Vorfahren-Linie.' };
  }
  return { ok: true };
}
