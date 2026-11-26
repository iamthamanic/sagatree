/**
 * AtlasThreeWorkstation — Full-Bleed Map-First SagaTree Three.js 3D Workstation.
 * Location: src/app/world/atlas/unified/AtlasThreeWorkstation.tsx
 *
 * Preserves SagaTree's original full-bleed Google-Maps / Figma spatial chrome:
 *  - 100 % full-bleed Three.js canvas with infinite ocean/meadow/sky & FogExp2
 *  - Top-left floating collapsible `Ebenen` glass chip → hierarchy + layer panel
 *    (starts collapsed; leaves bottom-left open for `Vollansicht` & `Golden`)
 *  - Top-center minimal floating glass pill (3D/Split/2D · Diorama/Satellit · Quality)
 *  - Top-right floating collapsible `Werkzeuge` glass chip → 3D tools, Darstellung
 *    (Tag/Abend/Nacht, PBR/Illustrativ/Cel, Dächer), Feature Search & Dungeon-Generator
 *  - Bottom-center floating Scale/HUD Taskbar (X · Z | − 100% + | ▦ Grid | ○ 0° Compass)
 *  - Butter-smooth Google-Maps inertia zoom with automatic cross-scale LOD transitions
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  ArrowsOutCardinal,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowUUpLeft,
  CaretDown,
  CaretRight,
  Copy,
  Cube,
  Cursor,
  Eraser,
  Eye,
  EyeSlash,
  GlobeHemisphereWest,
  GridFour,
  Hand,
  HouseLine,
  MagnifyingGlass,
  MapPin,
  Moon,
  Mountains,
  PaintBrush,
  Plus,
  Resize,
  Stack,
  Stamp,
  Sun,
  SunHorizon,
  Trash,
  Wrench,
} from '@phosphor-icons/react';
import {
  ATLAS_BIOME_BRUSHES,
  ATLAS_TERRAIN_SCULPT_MODES,
  applyAtlasTerrainSculptDab,
  applyMapEdit,
  classifyAtlasPortalKind,
  computeAtlasPinZoomPresentation,
  createAtlasWorldCameraState,
  deriveZoomLayerHierarchyState,
  formatAtlasSpanLabelDe,
  resolveContinuousZoomTransition,
  shouldPromptSpatialOperation,
  switchWorldCameraProjection,
  type AtlasZoomLayerState,
  type SpatialEditIntent,
  type SpatialEditPreferences,
  type WorldOperationPlan,
  type AtlasBiomeBrushId,
  type AtlasGraphicsPresetId,
  type AtlasMapPin,
  type AtlasMapScale,
  type AtlasTerrainSculptMode,
  type AtlasWorldCameraState,
  type AtlasWorldSceneMapInput,
  type UnifiedCanvasDoc,
  type UnifiedCanvasLayerId,
  type UnifiedCanvasStampType,
} from '../../../../domains/world/atlas';
import type { AtlasWebglNavNode, AtlasWebglNavTree } from '../../../../domains/world/places';
import {
  AtlasThreeRuntime,
  autoAtlasThreePitchForSpan,
  bindAtlasUnifiedInput,
  defaultAtlasThreePitch,
  type AtlasThreeCameraMode,
  type AtlasThreeCameraView,
  type AtlasThreeLightingMode,
  type AtlasThreeMultiMapStats,
  type AtlasThreeProjectedPin,
  type AtlasThreeStyleMode,
  type AtlasThreeWorldMapSource,
} from '../../../../infrastructure/world/atlas-three';
import { Button } from '../../../../shared/ui/button';
import { Input } from '../../../../shared/ui/input';
import type { AtlasNativeNavSelectPayload } from './AtlasNative3dEditor';
import {
  AtlasPortalTransitionOverlay,
  type AtlasPortalTransitionState,
} from './AtlasPortalTransitionOverlay';
import {
  SpatialEditPreferencesSection,
  SpatialOperationConfirmDialog,
} from './SpatialOperationConfirmDialog';
import {
  useSpatialEditPreferences,
  type AtlasSpatialContainmentAdapter,
} from './useSpatialEditPreferences';

export type AtlasThreeToolId =
  | 'hand'
  | 'select'
  | 'move'
  | 'rotate'
  | 'scale'
  | 'height'
  | 'biome'
  | 'stamp'
  | 'eraser';

type StampOption = {
  readonly id: UnifiedCanvasStampType;
  readonly label: string;
  readonly defaultSize: number;
};

const STAMP_OPTIONS: readonly StampOption[] = [
  { id: 'haus', label: 'Haus', defaultSize: 0.72 },
  { id: 'turm', label: 'Turm', defaultSize: 0.58 },
  { id: 'baum', label: 'Laubbaum', defaultSize: 0.65 },
  { id: 'tanne', label: 'Tanne', defaultSize: 0.65 },
  { id: 'fels', label: 'Fels / Berg', defaultSize: 0.8 },
  { id: 'tisch', label: 'Tisch', defaultSize: 0.45 },
  { id: 'stuhl', label: 'Stuhl', defaultSize: 0.4 },
  { id: 'fass', label: 'Fass', defaultSize: 0.4 },
  { id: 'lampe', label: 'Fackel', defaultSize: 0.45 },
  { id: 'kiste', label: 'Truhe', defaultSize: 0.4 },
];

const LAYER_ROWS: readonly { readonly id: UnifiedCanvasLayerId; readonly label: string }[] = [
  { id: 'terrain', label: 'Gelände & Relief' },
  { id: 'roads', label: 'Flüsse & Wege' },
  { id: 'objects', label: 'Gebäude & Objekte' },
  { id: 'interior', label: 'Innenräume' },
];

const NEXT_CHILD_KIND: Readonly<Record<string, { readonly uiKind: string; readonly label: string }>> = {
  world: { uiKind: 'kontinent', label: 'Kontinent' },
  kontinent: { uiKind: 'land', label: 'Land' },
  land: { uiKind: 'ort', label: 'Ort' },
  ort: { uiKind: 'gebaeude', label: 'Gebäude / Dungeon' },
  gebaeude: { uiKind: 'raum', label: 'Raum' },
};

function uid(): string {
  return `a3-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function defaultSpanForScale(scale: AtlasMapScale): number {
  if (scale === 'world') return 430;
  if (scale === 'settlement') return 195;
  return 220;
}

export type AtlasThreeWorkstationProps = {
  readonly doc: UnifiedCanvasDoc;
  readonly canEdit: boolean;
  readonly mapKey: string;
  readonly mapScale: AtlasMapScale;
  readonly graphicsPresetId: AtlasGraphicsPresetId;
  readonly externalNav: AtlasWebglNavTree | null;
  readonly activePlaceId: string | null;
  readonly mapPins: readonly AtlasMapPin[];
  readonly navRestoreView?: {
    readonly centerX: number;
    readonly centerY: number;
    readonly span: number;
    readonly mode: AtlasThreeCameraMode;
  } | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onCommitDoc: (next: UnifiedCanvasDoc, recordHistory: boolean) => void;
  /** SWS-08: batched 3D edit history hooks (atlas-edit-history parity with 2D). */
  readonly onBeginEditBatch?: () => void;
  readonly onCommitEditBatch?: () => void;
  readonly onCancelEditBatch?: () => void;
  /** SWS-05: shared World Camera state synced across 2D + 3D projections (E1/E2). */
  readonly sharedWorldCamera?: AtlasWorldCameraState | null;
  readonly onSharedWorldCameraChange?: (next: AtlasWorldCameraState) => void;
  /** SWS-04: optional Multi-Map Scene Graph payload (located world hierarchy). */
  readonly worldSceneGraph?: {
    readonly maps: readonly AtlasWorldSceneMapInput[];
    readonly sources: readonly AtlasThreeWorldMapSource[];
  } | null;
  readonly onNavSelect?: (payload: AtlasNativeNavSelectPayload) => void;
  readonly onNavAdd?: (payload: { readonly uiKind: string; readonly parentId: string }) => void;
  readonly onNavViewChange?: (view: {
    readonly centerX: number;
    readonly centerY: number;
    readonly span: number;
    readonly mode: AtlasThreeCameraMode;
  }) => void;
  readonly onHierarchyBack?: () => void;
  readonly onWebglMountError?: (message: string | null) => void;
  readonly forcedTopDown?: boolean;
  readonly toolsSlot?: ReactNode;
  readonly topBarExtra?: ReactNode;
  readonly spatialContainment?: AtlasSpatialContainmentAdapter | null;
};

type DragSession =
  | {
    readonly kind: 'pan';
    readonly startPx: number;
    readonly startPy: number;
    readonly startX: number;
    readonly startZ: number;
    readonly span: number;
    readonly yawRad: number;
  }
  | {
    readonly kind: 'orbit';
    readonly startPx: number;
    readonly startPy: number;
    readonly startYaw: number;
    readonly startPitch: number;
  }
  | {
    readonly kind: 'compass';
    readonly startPx: number;
    readonly startYaw: number;
    readonly moved: boolean;
  }
  | {
    readonly kind: 'move-object';
    readonly id: string;
    readonly startGroundX: number;
    readonly startGroundZ: number;
    readonly origX: number;
    readonly origY: number;
  }
  | {
    readonly kind: 'rotate-object';
    readonly id: string;
    readonly startPx: number;
    readonly origAngle: number;
  }
  | {
    readonly kind: 'scale-object';
    readonly id: string;
    readonly startPx: number;
    readonly origSize: number;
  }
  | {
    readonly kind: 'height';
    readonly targetHeight?: number;
  }
  | {
    readonly kind: 'biome';
    readonly strokeId: string;
  };

export function AtlasThreeWorkstation({
  doc,
  canEdit,
  mapKey,
  mapScale,
  graphicsPresetId,
  externalNav,
  activePlaceId,
  mapPins,
  navRestoreView = null,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCommitDoc,
  onBeginEditBatch,
  onCommitEditBatch,
  onCancelEditBatch,
  sharedWorldCamera = null,
  onSharedWorldCameraChange,
  worldSceneGraph = null,
  onNavSelect,
  onNavAdd,
  onNavViewChange,
  onHierarchyBack,
  onWebglMountError,
  forcedTopDown = false,
  toolsSlot = null,
  topBarExtra = null,
  spatialContainment = null,
}: AtlasThreeWorkstationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<AtlasThreeRuntime | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const onCommitDocRef = useRef(onCommitDoc);
  onCommitDocRef.current = onCommitDoc;
  const onBeginEditBatchRef = useRef(onBeginEditBatch);
  onBeginEditBatchRef.current = onBeginEditBatch;
  const onCommitEditBatchRef = useRef(onCommitEditBatch);
  onCommitEditBatchRef.current = onCommitEditBatch;
  const onCancelEditBatchRef = useRef(onCancelEditBatch);
  onCancelEditBatchRef.current = onCancelEditBatch;
  const onSharedWorldCameraChangeRef = useRef(onSharedWorldCameraChange);
  onSharedWorldCameraChangeRef.current = onSharedWorldCameraChange;
  const onNavViewChangeRef = useRef(onNavViewChange);
  onNavViewChangeRef.current = onNavViewChange;
  const onWebglMountErrorRef = useRef(onWebglMountError);
  onWebglMountErrorRef.current = onWebglMountError;
  const transitionCooldownRef = useRef(0);
  const transitionTimerRef = useRef<number | null>(null);
  const transitionSeqRef = useRef(0);
  const pendingArrivalDirRef = useRef<'in' | 'out' | null>(null);
  const prevTopDownRef = useRef(forcedTopDown);

  // Map-First: both Ebenen & Werkzeuge start collapsed as floating frosted-glass chips!
  const [layersOpen, setLayersOpen] = useState(false);
  const layersOpenRef = useRef(layersOpen);
  layersOpenRef.current = layersOpen;
  const [zoomActiveMapId, setZoomActiveMapId] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const [tool, setTool] = useState<AtlasThreeToolId>('hand');
  const [cameraMode, setCameraMode] = useState<AtlasThreeCameraMode>('diorama-oblique');
  const [lightingMode, setLightingMode] = useState<AtlasThreeLightingMode>('day');
  const [styleMode, setStyleMode] = useState<AtlasThreeStyleMode>('pbr');
  const [showGrid, setShowGrid] = useState(false);
  const [hideRoofs, setHideRoofs] = useState(false);
  const [sculptMode, setSculptMode] = useState<AtlasTerrainSculptMode>('raise');
  const [sculptRadius, setSculptRadius] = useState(64);
  const [sculptStrength, setSculptStrength] = useState(3.2);
  const [biomeId, setBiomeId] = useState<AtlasBiomeBrushId>('gras');
  const [biomeWidth, setBiomeWidth] = useState(26);
  const [stampKind, setStampKind] = useState<UnifiedCanvasStampType>('haus');
  const [stampSize, setStampSize] = useState(0.72);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [featureQuery, setFeatureQuery] = useState('');
  const [projectedPins, setProjectedPins] = useState<readonly AtlasThreeProjectedPin[]>([]);
  const [hudCoords, setHudCoords] = useState('X 500.0 · Z 500.0');
  const [hudSpan, setHudSpan] = useState(() => defaultSpanForScale(mapScale));
  const [hudYawDeg, setHudYawDeg] = useState(24);
  const [ready, setReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [portalTransition, setPortalTransition] = useState<AtlasPortalTransitionState | null>(null);
  const portalTransitionRef = useRef(portalTransition);
  portalTransitionRef.current = portalTransition;
  const canUndoRef = useRef(canUndo);
  canUndoRef.current = canUndo;
  const canRedoRef = useRef(canRedo);
  canRedoRef.current = canRedo;

  // SCM-04: Persistent spatial edit confirmation preferences (`spatialEdit.confirmGrow/Cascade`)
  const {
    prefs: spatialPrefs,
    setConfirmGrow,
    setConfirmCascade,
    dismissPromptFor,
  } = useSpatialEditPreferences();
  const spatialPrefsRef = useRef<SpatialEditPreferences>(spatialPrefs);
  spatialPrefsRef.current = spatialPrefs;
  const spatialContainmentRef = useRef<AtlasSpatialContainmentAdapter | null>(spatialContainment);
  spatialContainmentRef.current = spatialContainment;
  const [pendingSpatialPlan, setPendingSpatialPlan] = useState<WorldOperationPlan | null>(null);
  const pendingSpatialPlanRef = useRef<WorldOperationPlan | null>(pendingSpatialPlan);
  pendingSpatialPlanRef.current = pendingSpatialPlan;
  const [spatialErrorDe, setSpatialErrorDe] = useState<string | null>(null);
  const spatialErrorDeRef = useRef<string | null>(spatialErrorDe);
  spatialErrorDeRef.current = spatialErrorDe;

  const dispatchSpatialIntent = useCallback((intent: SpatialEditIntent) => {
    const adapter = spatialContainmentRef.current;
    if (!adapter) {
      return {
        ok: false,
        prompted: false,
        reasonDe: 'Kein aktives Spatial-Containment-Weltmodell geladen.',
      };
    }
    const planRes = adapter.planIntent(intent);
    if (!planRes.ok) {
      setSpatialErrorDe(planRes.reasonDe);
      return { ok: false, prompted: false, reasonDe: planRes.reasonDe };
    }
    setSpatialErrorDe(null);
    if (shouldPromptSpatialOperation(planRes.plan, spatialPrefsRef.current)) {
      setPendingSpatialPlan(planRes.plan);
      return { ok: true, prompted: true, plan: planRes.plan };
    }
    void adapter.commitPlan(planRes.plan).then((res) => {
      if (!res.ok) setSpatialErrorDe(res.reasonDe);
    });
    return { ok: true, prompted: false, plan: planRes.plan };
  }, []);
  const dispatchSpatialIntentRef = useRef(dispatchSpatialIntent);
  dispatchSpatialIntentRef.current = dispatchSpatialIntent;

  const look: 'outdoor' | 'indoor' = mapScale === 'interior' ? 'indoor' : 'outdoor';
  const activeTool: AtlasThreeToolId = canEdit ? tool : 'hand';
  const mapIdByPlaceId = useMemo(
    () => new Map((externalNav?.nodes ?? []).map((n) => [n.id, n.primaryMapId] as const)),
    [externalNav],
  );
  const navNodeById = useMemo(
    () => new Map((externalNav?.nodes ?? []).map((n) => [n.id, n] as const)),
    [externalNav],
  );
  // SCM-05 / SCM-07: camera-/LOD-driven layer indicator derived purely from AtlasWorldScenePlan
  const zoomLayerState: AtlasZoomLayerState = useMemo(
    () =>
      deriveZoomLayerHierarchyState({
        activeEditorMapId: zoomActiveMapId,
        worldRootMapId: externalNav?.worldPrimaryMapId ?? null,
        worldLabelDe: externalNav?.worldLabel ?? 'Welt',
        nodes: (externalNav?.nodes ?? []).map((n) => ({
          id: n.id,
          label: n.label,
          sub: n.sub,
          parentId: n.parentId,
          primaryMapId: n.primaryMapId,
        })),
        fallbackPlaceId: activePlaceId,
      }),
    [activePlaceId, externalNav, zoomActiveMapId],
  );
  const zoomLayerStateRef = useRef<AtlasZoomLayerState>(zoomLayerState);
  zoomLayerStateRef.current = zoomLayerState;
  const zoomAncestorPlaceSet = useMemo(
    () => new Set(zoomLayerState.activeBreadcrumbPlaceIds),
    [zoomLayerState.activeBreadcrumbPlaceIds],
  );
  const baseSpan = defaultSpanForScale(mapScale);
  const zoomPct = Math.max(10, Math.min(2500, Math.round((baseSpan / Math.max(12, hudSpan)) * 100)));
  const hasParentMap = Boolean(activePlaceId && activePlaceId !== externalNav?.worldId);

  useEffect(
    () => () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    },
    [],
  );

  const triggerSmoothLevelTransition = useCallback(
    (
      direction: 'in' | 'out',
      action: () => void,
      meta?: {
        readonly label?: string | null;
        readonly kind?: string | null;
        readonly sub?: string | null;
        readonly targetX?: number;
        readonly targetZ?: number;
      },
    ) => {
      const now = performance.now();
      if (now < transitionCooldownRef.current) return;
      transitionCooldownRef.current = now + 820;
      pendingArrivalDirRef.current = direction;

      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        action();
        return;
      }

      const rt = runtimeRef.current;
      const portalKind = classifyAtlasPortalKind({
        direction,
        fromScale: mapScale,
        targetLabel: meta?.label,
        targetKind: meta?.kind,
        targetSub: meta?.sub,
      });

      const isPortal = portalKind === 'tavern-doors' || portalKind === 'crypt-gate';

      if (rt && direction === 'in' && meta?.targetX !== undefined && meta?.targetZ !== undefined) {
        rt.flyTo(meta.targetX, meta.targetZ, Math.max(42, rt.getView().span * 0.48));
      } else if (rt && direction === 'out') {
        const cur = rt.getView();
        rt.flyTo(cur.x, cur.z, Math.min(1800, cur.span * 1.45));
      }

      // SWS-04 (D3): NEVER show AtlasPortalTransitionOverlay fade/screenshot mask for
      // ordinary spatial transitions (Welt ↔ Kontinent ↔ Land ↔ Ort) — only real portals!
      if (!isPortal) {
        action();
        return;
      }

      transitionSeqRef.current += 1;
      const seqId = transitionSeqRef.current;
      setPortalTransition({
        id: seqId,
        kind: portalKind,
        label: meta?.label ?? null,
        snapshotUrl: null,
      });

      const swapDelayMs = 180;
      const clearDelayMs = 900;
      if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = window.setTimeout(() => {
        action();
        transitionTimerRef.current = window.setTimeout(() => {
          setPortalTransition((cur) => (cur?.id === seqId ? null : cur));
        }, clearDelayMs);
      }, swapDelayMs);
    },
    [mapScale],
  );

  // Mount Three.js runtime once per canvas lifetime.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let rt: AtlasThreeRuntime | null = null;
    try {
      rt = new AtlasThreeRuntime({
        canvas,
        presetId: graphicsPresetId,
        onCameraChange: (v) => {
          setHudSpan(v.span);
          const deg = ((Math.round((v.yawRad * 180) / Math.PI) % 360) + 360) % 360;
          setHudYawDeg(deg);
          onNavViewChangeRef.current?.({
            centerX: v.x,
            centerY: v.z,
            span: v.span,
            mode: v.mode,
          });
          onSharedWorldCameraChangeRef.current?.(
            createAtlasWorldCameraState({
              focusWorld: { x: v.x, y: v.z, z: 0 },
              span: v.span,
              yawRad: v.yawRad,
              pitchRad: v.pitchRad,
              projection: v.mode,
            }),
          );
        },
        onProjectedPins: (pins) => setProjectedPins(pins),
        onContextLostChange: (lost) => setContextLost(lost),
        onActiveEditorMapChange: (mapId) => setZoomActiveMapId(mapId),
      });
      runtimeRef.current = rt;
      setReady(true);
      onWebglMountErrorRef.current?.(null);

      const win = window as Window & {
        __sagatreeAtlas?: {
          getState: () => {
            mode: 'webgl';
            renderer: 'three-js';
            camera: AtlasThreeCameraView;
            worldCamera: AtlasWorldCameraState;
            rooms: number;
            calls: number;
            triangles: number;
            clearRootCount: number;
            activeMapCount: number;
            multiMap: AtlasThreeMultiMapStats;
            portalTransitionVisible: boolean;
            canUndo: boolean;
            canRedo: boolean;
            layersOpen: boolean;
            zoomLayer: AtlasZoomLayerState;
            ids: string[];
          };
          setCameraMode: (m: AtlasThreeCameraMode) => void;
          setYaw: (rad: number) => void;
          setView: (next: Partial<AtlasThreeCameraView>, animate?: boolean) => void;
          projectWorldToScreen: (
            x: number,
            z: number,
            y?: number,
          ) => { readonly px: number; readonly py: number; readonly visible: boolean };
          pickAt: (px: number, py: number) => string | null;
          getRendererInfo: () => {
            readonly webglRenderer: string;
            readonly webglVendor: string;
            readonly isSoftwareWebgl: boolean;
          };
          getDocObject: (
            id: string,
          ) => {
            readonly id: string;
            readonly type: string;
            readonly x: number;
            readonly y: number;
            readonly size: number;
            readonly angle?: number;
          } | null;
          getSpatialPrefs: () => SpatialEditPreferences;
          getSpatialState: () => {
            readonly ready: boolean;
            readonly entityCount: number;
            readonly activeCount: number;
            readonly archivedCount: number;
            readonly canUndo: boolean;
            readonly canRedo: boolean;
            readonly pendingConfirmKind: string | null;
            readonly pendingSummaryDe: string | null;
            readonly lastErrorDe: string | null;
            readonly entities: Readonly<
              Record<
                string,
                {
                  readonly id: string;
                  readonly labelDe: string;
                  readonly role: string;
                  readonly status: string;
                  readonly carrierId: string | null;
                  readonly boundsWorld: {
                    readonly minX: number;
                    readonly minY: number;
                    readonly maxX: number;
                    readonly maxY: number;
                  };
                }
              >
            >;
          };
          requestSpatialIntent: (intent: SpatialEditIntent) => {
            readonly ok: boolean;
            readonly prompted: boolean;
            readonly reasonDe?: string;
            readonly plan?: WorldOperationPlan;
          };
          undoSpatial: () => Promise<boolean>;
          redoSpatial: () => Promise<boolean>;
        };
      };
      win.__sagatreeAtlas = {
        getState: () => {
          const stats = rt?.getStats() ?? {
            calls: 0,
            triangles: 0,
            rooms: 0,
            clearRootCount: 0,
            activeMapCount: 0,
          };
          const multiMap: AtlasThreeMultiMapStats = rt?.getMultiMapStats() ?? {
            activeMapIds: [],
            activeEditorMapId: null,
            groupCount: 0,
            liveGeometryCount: 0,
            clearRootCount: 0,
            incrementalSyncCount: 0,
          };
          const view = rt?.getView() ?? {
            mode: 'diorama-oblique' as const,
            x: 500,
            z: 500,
            span: 430,
            yawRad: 0.42,
            pitchRad: 0.94,
          };
          return {
            mode: 'webgl',
            renderer: 'three-js',
            camera: view,
            worldCamera:
              rt?.getWorldCameraState() ??
              createAtlasWorldCameraState({
                focusWorld: { x: view.x, y: view.z, z: 0 },
                span: view.span,
                yawRad: view.yawRad,
                pitchRad: view.pitchRad,
                projection: view.mode,
              }),
            rooms: stats.rooms,
            calls: stats.calls,
            triangles: stats.triangles,
            clearRootCount: stats.clearRootCount,
            activeMapCount: stats.activeMapCount,
            multiMap,
            portalTransitionVisible: Boolean(portalTransitionRef.current),
            canUndo: canUndoRef.current,
            canRedo: canRedoRef.current,
            layersOpen: layersOpenRef.current,
            zoomLayer: zoomLayerStateRef.current,
            ids: rt?.getRenderedIds() ?? [],
          };
        },
        setCameraMode: (m) => {
          setCameraMode(m);
          if (!rt) return;
          const nextCam = switchWorldCameraProjection(rt.getWorldCameraState(), m, {
            pitchRad: defaultAtlasThreePitch(m),
          });
          rt.setWorldCameraState(nextCam, false);
        },
        setYaw: (rad) => {
          rt?.setView({ yawRad: rad }, false);
        },
        setView: (next, animate = false) => {
          if (next.mode) setCameraMode(next.mode);
          rt?.setView(next, animate);
        },
        projectWorldToScreen: (x, z, y) =>
          rt?.projectWorldPointToScreen(x, z, y) ?? { px: 0, py: 0, visible: false },
        pickAt: (px, py) => rt?.pickCanonicalId(px, py) ?? null,
        getRendererInfo: () =>
          rt?.getRendererInfo() ?? {
            webglRenderer: 'unknown',
            webglVendor: 'unknown',
            isSoftwareWebgl: true,
          },
        getDocObject: (id) => {
          const hit = docRef.current.objects.find((o) => o.id === id);
          if (!hit) return null;
          return {
            id: hit.id,
            type: hit.type,
            x: hit.x,
            y: hit.y,
            size: hit.size,
            angle: hit.angle,
          };
        },
        getSpatialPrefs: () => ({ ...spatialPrefsRef.current }),
        getSpatialState: () => {
          const adapter = spatialContainmentRef.current;
          const pending = pendingSpatialPlanRef.current;
          if (!adapter) {
            return {
              ready: false,
              entityCount: 0,
              activeCount: 0,
              archivedCount: 0,
              canUndo: false,
              canRedo: false,
              pendingConfirmKind: pending?.requiresConfirmation ?? null,
              pendingSummaryDe: pending?.summaryDe ?? null,
              lastErrorDe: spatialErrorDeRef.current,
              entities: {},
            };
          }
          const list = Object.values(adapter.world.entities);
          const entities: Record<
            string,
            {
              readonly id: string;
              readonly labelDe: string;
              readonly role: string;
              readonly status: string;
              readonly carrierId: string | null;
              readonly boundsWorld: {
                readonly minX: number;
                readonly minY: number;
                readonly maxX: number;
                readonly maxY: number;
              };
            }
          > = {};
          let activeCount = 0;
          let archivedCount = 0;
          for (const e of list) {
            if (e.status === 'archived') archivedCount += 1;
            else activeCount += 1;
            entities[e.id] = {
              id: e.id,
              labelDe: e.labelDe,
              role: e.role,
              status: e.status,
              carrierId: e.carrierId,
              boundsWorld: e.boundsWorld,
            };
          }
          return {
            ready: true,
            entityCount: list.length,
            activeCount,
            archivedCount,
            canUndo: adapter.canUndo,
            canRedo: adapter.canRedo,
            pendingConfirmKind: pending?.requiresConfirmation ?? null,
            pendingSummaryDe: pending?.summaryDe ?? null,
            lastErrorDe: spatialErrorDeRef.current,
            entities,
          };
        },
        requestSpatialIntent: (intent) => dispatchSpatialIntentRef.current(intent),
        undoSpatial: async () => (await spatialContainmentRef.current?.undo()) ?? false,
        redoSpatial: async () => (await spatialContainmentRef.current?.redo()) ?? false,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Three.js WebGL konnte nicht gestartet werden.';
      onWebglMountErrorRef.current?.(msg);
      setReady(false);
    }
    return () => {
      runtimeRef.current = null;
      rt?.dispose();
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.applyQualityProfile(graphicsPresetId);
  }, [graphicsPresetId]);

  // SWS-04: sync located world hierarchy into Multi-Map Scene Graph (incremental, zero clearRoot).
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    if (worldSceneGraph && worldSceneGraph.maps.length > 0) {
      rt.setWorldSceneGraph(worldSceneGraph);
    } else {
      rt.setWorldSceneGraph({ maps: [], sources: [] });
    }
  }, [worldSceneGraph]);

  // Unified Draufsicht toggle (SWS-05 E2): preserve focus, yawRad, and span across 2D ↔ 3D switch!
  useEffect(() => {
    if (prevTopDownRef.current === forcedTopDown) return;
    prevTopDownRef.current = forcedTopDown;
    const rt = runtimeRef.current;
    if (!rt) return;
    const nextMode: AtlasThreeCameraMode = forcedTopDown ? 'ortho-topdown' : 'diorama-oblique';
    const nextCam = switchWorldCameraProjection(rt.getWorldCameraState(), nextMode, {
      pitchRad: forcedTopDown
        ? Math.PI / 2
        : autoAtlasThreePitchForSpan('diorama-oblique', rt.getTargetView().span),
    });
    setCameraMode(nextMode);
    rt.setWorldCameraState(nextCam, true);
  }, [forcedTopDown]);

  // Push live canonical document + pins + visual modes into Three.js runtime.
  useEffect(() => {
    runtimeRef.current?.setSceneState({
      doc,
      mapScale,
      look,
      seed: mapKey,
      hideRoofs,
      lightingMode,
      styleMode,
      showGrid,
      pins: mapPins,
      selectedId,
      gizmoVisible:
        canEdit &&
        Boolean(selectedId) &&
        (activeTool === 'select' || activeTool === 'move' || activeTool === 'rotate' || activeTool === 'scale'),
    });
  }, [
    doc,
    mapScale,
    look,
    mapKey,
    hideRoofs,
    lightingMode,
    styleMode,
    showGrid,
    mapPins,
    selectedId,
    canEdit,
    activeTool,
  ]);

  // Smooth Google-Maps Flyover framing onto exact content center whenever active map changes!
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    setSelectedId(null);
    const arrivalDir = pendingArrivalDirRef.current;
    pendingArrivalDirRef.current = null;

    if (forcedTopDown) {
      setCameraMode('ortho-topdown');
      rt.setView({ mode: 'ortho-topdown', pitchRad: Math.PI / 2 }, false);
      rt.frameContentBounds({ animateFrom: arrivalDir ?? 'in' });
      return;
    }

    // Always frame interiors & fresh arrivals dead-center onto real contentBounds so nothing clips behind the top pill!
    if (navRestoreView && navRestoreView.span < 900 && !arrivalDir && mapScale !== 'interior') {
      const targetMode: AtlasThreeCameraMode =
        navRestoreView.mode === 'perspective' ? 'perspective' : 'diorama-oblique';
      setCameraMode(targetMode);
      const clampedSpan = Math.min(navRestoreView.span, defaultSpanForScale(mapScale) * 1.35);
      rt.setView(
        {
          mode: targetMode,
          x: navRestoreView.centerX,
          z: navRestoreView.centerY,
          span: clampedSpan,
          yawRad: sharedWorldCamera?.yawRad ?? rt.getTargetView().yawRad,
          pitchRad: autoAtlasThreePitchForSpan(targetMode, clampedSpan),
        },
        false,
      );
      return;
    }

    setCameraMode('diorama-oblique');
    rt.setView({ mode: 'diorama-oblique' }, false);
    rt.frameContentBounds({ animateFrom: arrivalDir ?? 'in' });
  }, [mapKey, mapScale]);

  // Keyboard shortcuts (W/E/T/Q, G=Grid, Cmd/Ctrl+Z, Escape, Delete)
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const meta = ev.metaKey || ev.ctrlKey;
      if (meta && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if (ev.key === 'Escape') {
        setSelectedId(null);
        setTool('hand');
        return;
      }
      const k = ev.key.toLowerCase();
      if (k === 'g') {
        setShowGrid((v) => !v);
        return;
      }
      if (!canEdit) return;
      if (k === 'q') setTool('hand');
      else if (k === 'w') setTool('move');
      else if (k === 'e') setTool('rotate');
      else if (k === 't') setTool('scale');
      else if ((ev.key === 'Delete' || ev.key === 'Backspace') && selectedId) {
        const current = docRef.current;
        if (current.objects.some((o) => o.id === selectedId)) {
          onCommitDocRef.current(applyMapEdit(current, { op: 'remove_object', id: selectedId }), true);
          setSelectedId(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEdit, onRedo, onUndo, selectedId]);

  // SWS-05 (E2): mode switch preserves focusWorld, yawRad, and span — NEVER resets yaw to 0!
  const switchCameraMode = useCallback((mode: AtlasThreeCameraMode) => {
    setCameraMode(mode);
    const rt = runtimeRef.current;
    if (!rt) return;
    const cur = rt.getTargetView();
    const nextCam = switchWorldCameraProjection(rt.getWorldCameraState(), mode, {
      pitchRad: autoAtlasThreePitchForSpan(mode, cur.span),
    });
    rt.setWorldCameraState(nextCam, true);
  }, []);

  const zoomByFactor = useCallback((factor: number) => {
    const rt = runtimeRef.current;
    if (!rt) return;
    const cur = rt.getTargetView();
    const nextSpan = clamp(cur.span * factor, 18, 2200);
    rt.setView({ span: nextSpan }, true);
  }, []);

  const handleUnifiedZoomAtScreen = useCallback(
    (zoomDelta: number, px: number, py: number) => {
      const rt = runtimeRef.current;
      if (!rt) return;
      const target = rt.zoomAtScreen(zoomDelta, px, py);

      const transition = resolveContinuousZoomTransition({
        centerX: target.x,
        centerY: target.z,
        span: target.span,
        wheelDeltaY: zoomDelta,
        hasParentMap,
        pins: mapPins,
        mapScale,
      });

      if (transition.kind === 'enter-child') {
        const childMapId = mapIdByPlaceId.get(transition.pin.id) ?? null;
        if (childMapId) {
          const navNode = navNodeById.get(transition.pin.id);
          triggerSmoothLevelTransition(
            'in',
            () => {
              onNavSelect?.({
                placeId: transition.pin.id,
                mapId: childMapId,
                worldRoot: false,
              });
            },
            {
              label: transition.pin.label,
              kind: transition.pin.kind,
              sub: navNode?.sub,
              targetX: transition.pin.x,
              targetZ: transition.pin.y,
            },
          );
        }
      } else if (transition.kind === 'exit-parent' && onHierarchyBack) {
        triggerSmoothLevelTransition('out', () => {
          onHierarchyBack();
        });
      }
    },
    [hasParentMap, mapIdByPlaceId, mapPins, mapScale, navNodeById, onHierarchyBack, onNavSelect, triggerSmoothLevelTransition],
  );

  // SWS-06 (E3–E5): Non-passive wheel + Safari gesturestart/change/end listener for
  // MacBook Trackpad Pinch (ctrlKey+wheel / Safari gesture), Two-Finger Pan, Shift+Wheel Orbit,
  // and deltaMode normalization without browser-zoom conflicts.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return bindAtlasUnifiedInput(canvas, {
      onZoomAtScreen: handleUnifiedZoomAtScreen,
      onPanByScreen: (dx, dy) => {
        runtimeRef.current?.panByScreenDelta(dx, dy);
      },
      onOrbitByDelta: (deltaYawRad, deltaPitchRad) => {
        const rt = runtimeRef.current;
        if (!rt) return;
        const next = rt.orbitByDelta(deltaYawRad, deltaPitchRad);
        if (next.mode !== cameraMode) setCameraMode(next.mode);
      },
    });
  }, [cameraMode, handleUnifiedZoomAtScreen]);

  const handlePointerDown = useCallback(
    (ev: ReactPointerEvent<HTMLCanvasElement>) => {
      const rt = runtimeRef.current;
      const canvas = canvasRef.current;
      if (!rt || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const cur = rt.getTargetView();

      // Right-click, Shift+drag, or Alt+drag smoothly orbits & tilts the 3D camera.
      if (ev.button === 2 || ev.shiftKey || ev.altKey) {
        dragRef.current = {
          kind: 'orbit',
          startPx: px,
          startPy: py,
          startYaw: cur.yawRad,
          startPitch: cur.pitchRad,
        };
        canvas.setPointerCapture(ev.pointerId);
        return;
      }
      if (ev.button === 1 || activeTool === 'hand') {
        dragRef.current = {
          kind: 'pan',
          startPx: px,
          startPy: py,
          startX: cur.x,
          startZ: cur.z,
          span: cur.span,
          yawRad: cur.yawRad,
        };
        canvas.setPointerCapture(ev.pointerId);
        return;
      }

      const ground = rt.screenToGround(px, py);
      if (!ground) return;

      if (activeTool === 'stamp' && canEdit) {
        const next = applyMapEdit(docRef.current, {
          op: 'add_object',
          object: {
            id: uid(),
            type: stampKind,
            x: Math.round(ground.x * 10) / 10,
            y: Math.round(ground.z * 10) / 10,
            size: stampSize,
            angle: 0,
          },
        });
        onCommitDocRef.current(next, true);
        return;
      }

      if (activeTool === 'height' && canEdit) {
        // SWS-08 (F1/F2): batch entire height sculpt stroke as ONE undoable entry
        onBeginEditBatchRef.current?.();
        const op: AtlasTerrainSculptMode = ev.shiftKey ? 'lower' : sculptMode;
        const next = applyAtlasTerrainSculptDab(docRef.current, {
          x: ground.x,
          y: ground.z,
          radius: sculptRadius,
          strength: sculptStrength,
          op,
        });
        onCommitDocRef.current(next, !onBeginEditBatchRef.current);
        dragRef.current = { kind: 'height' };
        canvas.setPointerCapture(ev.pointerId);
        return;
      }

      if (activeTool === 'biome' && canEdit) {
        // SWS-08 (F1/F2): batch entire biome stroke as ONE undoable entry
        onBeginEditBatchRef.current?.();
        const spec = ATLAS_BIOME_BRUSHES.find((b) => b.id === biomeId) ?? ATLAS_BIOME_BRUSHES[0]!;
        const strokeId = uid();
        const next = applyMapEdit(docRef.current, {
          op: 'add_stroke',
          stroke: {
            id: strokeId,
            material: spec.material,
            width: biomeWidth,
            points: [
              [Math.round(ground.x * 10) / 10, Math.round(ground.z * 10) / 10],
              [Math.round((ground.x + 1) * 10) / 10, Math.round((ground.z + 1) * 10) / 10],
            ],
          },
        });
        onCommitDocRef.current(next, !onBeginEditBatchRef.current);
        dragRef.current = { kind: 'biome', strokeId };
        canvas.setPointerCapture(ev.pointerId);
        return;
      }

      const picked = rt.pickCanonicalId(px, py);
      if (activeTool === 'eraser' && canEdit && picked) {
        const curDoc = docRef.current;
        if (curDoc.objects.some((o) => o.id === picked)) {
          onCommitDocRef.current(applyMapEdit(curDoc, { op: 'remove_object', id: picked }), true);
          if (selectedId === picked) setSelectedId(null);
        } else if (curDoc.strokes.some((s) => s.id === picked)) {
          onCommitDocRef.current(applyMapEdit(curDoc, { op: 'remove_stroke', id: picked }), true);
        }
        return;
      }

      if (picked) {
        const obj = docRef.current.objects.find((o) => o.id === picked);
        setSelectedId(picked);
        if (obj && canEdit) {
          if (activeTool === 'rotate') {
            onBeginEditBatchRef.current?.();
            dragRef.current = {
              kind: 'rotate-object',
              id: obj.id,
              startPx: px,
              origAngle: obj.angle ?? 0,
            };
            canvas.setPointerCapture(ev.pointerId);
            return;
          }
          if (activeTool === 'scale') {
            onBeginEditBatchRef.current?.();
            dragRef.current = {
              kind: 'scale-object',
              id: obj.id,
              startPx: px,
              origSize: obj.size,
            };
            canvas.setPointerCapture(ev.pointerId);
            return;
          }
          if (activeTool === 'move' || activeTool === 'select') {
            onBeginEditBatchRef.current?.();
            dragRef.current = {
              kind: 'move-object',
              id: obj.id,
              startGroundX: ground.x,
              startGroundZ: ground.z,
              origX: obj.x,
              origY: obj.y,
            };
            canvas.setPointerCapture(ev.pointerId);
            return;
          }
        }
      } else {
        setSelectedId(null);
        dragRef.current = {
          kind: 'pan',
          startPx: px,
          startPy: py,
          startX: cur.x,
          startZ: cur.z,
          span: cur.span,
          yawRad: cur.yawRad,
        };
        canvas.setPointerCapture(ev.pointerId);
      }
    },
    [
      activeTool,
      biomeId,
      biomeWidth,
      canEdit,
      sculptMode,
      sculptRadius,
      sculptStrength,
      selectedId,
      stampKind,
      stampSize,
    ],
  );

  const handlePointerMove = useCallback(
    (ev: ReactPointerEvent<HTMLCanvasElement>) => {
      const rt = runtimeRef.current;
      const canvas = canvasRef.current;
      if (!rt || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const ground = rt.screenToGround(px, py);
      if (ground) {
        setHudCoords(`X ${ground.x.toFixed(1)} · Z ${ground.z.toFixed(1)}`);
      }
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.kind === 'orbit') {
        const dx = px - drag.startPx;
        const dy = py - drag.startPy;
        const nextMode = cameraMode === 'ortho-topdown' ? 'diorama-oblique' : cameraMode;
        if (nextMode !== cameraMode) setCameraMode(nextMode);
        rt.setView(
          {
            mode: nextMode,
            yawRad: drag.startYaw - dx * 0.006,
            pitchRad: drag.startPitch + dy * 0.005,
          },
          false,
          { manualPitch: true },
        );
        return;
      }

      if (drag.kind === 'pan') {
        const h = Math.max(1, canvas.clientHeight);
        const worldPerPx = (drag.span * 2) / h;
        const dx = (px - drag.startPx) * worldPerPx;
        const dy = (py - drag.startPy) * worldPerPx;
        const cos = Math.cos(drag.yawRad);
        const sin = Math.sin(drag.yawRad);
        rt.setView(
          {
            x: drag.startX - (dx * cos + dy * sin),
            z: drag.startZ - (-dx * sin + dy * cos),
          },
          false,
        );
        return;
      }

      if (drag.kind === 'move-object' && ground) {
        const nx = Math.round((drag.origX + (ground.x - drag.startGroundX)) * 10) / 10;
        const ny = Math.round((drag.origY + (ground.z - drag.startGroundZ)) * 10) / 10;
        onCommitDocRef.current(
          applyMapEdit(docRef.current, { op: 'move_object', id: drag.id, x: nx, y: ny }),
          false,
        );
        return;
      }

      if (drag.kind === 'rotate-object') {
        const nextAngle = Math.round((drag.origAngle + (px - drag.startPx) * 0.8 + 720) % 360);
        onCommitDocRef.current(
          applyMapEdit(docRef.current, {
            op: 'transform_object',
            id: drag.id,
            patch: { angle: nextAngle },
          }),
          false,
        );
        return;
      }

      if (drag.kind === 'scale-object') {
        const nextSize = Math.round(clamp(drag.origSize * (1 + (px - drag.startPx) / 140), 0.15, 6) * 100) / 100;
        onCommitDocRef.current(
          applyMapEdit(docRef.current, {
            op: 'transform_object',
            id: drag.id,
            patch: { size: nextSize },
          }),
          false,
        );
        return;
      }

      if (drag.kind === 'height' && ground) {
        const op: AtlasTerrainSculptMode = ev.shiftKey ? 'lower' : sculptMode;
        const next = applyAtlasTerrainSculptDab(docRef.current, {
          x: ground.x,
          y: ground.z,
          radius: sculptRadius,
          strength: sculptStrength * 0.45,
          op,
        });
        onCommitDocRef.current(next, false);
        return;
      }

      if (drag.kind === 'biome' && ground) {
        const curDoc = docRef.current;
        const target = curDoc.strokes.find((s) => s.id === drag.strokeId);
        if (!target) return;
        const last = target.points[target.points.length - 1];
        if (last && Math.hypot(ground.x - last[0], ground.z - last[1]) < 6) return;
        const nextStrokes = curDoc.strokes.map((s) =>
          s.id === drag.strokeId
            ? {
              ...s,
              points: [
                ...s.points,
                [Math.round(ground.x * 10) / 10, Math.round(ground.z * 10) / 10] as const,
              ],
            }
            : s,
        );
        onCommitDocRef.current({ ...curDoc, strokes: nextStrokes, demoSeed: false }, false);
      }
    },
    [cameraMode, sculptMode, sculptRadius, sculptStrength],
  );

  const handlePointerUp = useCallback((ev: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const isEditDrag =
      drag.kind === 'move-object' ||
      drag.kind === 'rotate-object' ||
      drag.kind === 'scale-object' ||
      drag.kind === 'height' ||
      drag.kind === 'biome';
    if (isEditDrag) {
      if (onCommitEditBatchRef.current) {
        onCommitEditBatchRef.current();
      } else {
        onCommitDocRef.current(docRef.current, true);
      }
    }
    dragRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const handlePointerCancel = useCallback((ev: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (
      drag.kind === 'move-object' ||
      drag.kind === 'rotate-object' ||
      drag.kind === 'scale-object' ||
      drag.kind === 'height' ||
      drag.kind === 'biome'
    ) {
      onCancelEditBatchRef.current?.();
    }
    dragRef.current = null;
    try {
      canvasRef.current?.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const selectedObject = useMemo(
    () => (selectedId ? doc.objects.find((o) => o.id === selectedId) ?? null : null),
    [doc.objects, selectedId],
  );

  const filteredObjects = useMemo(() => {
    const q = featureQuery.trim().toLowerCase();
    if (!q) return doc.objects.slice(0, 24);
    return doc.objects
      .filter((o) => o.id.toLowerCase().includes(q) || o.type.toLowerCase().includes(q))
      .slice(0, 40);
  }, [doc.objects, featureQuery]);

  const toggleLayer = useCallback(
    (layerId: UnifiedCanvasLayerId, checked: boolean) => {
      onCommitDoc(
        {
          ...doc,
          layers: { ...doc.layers, [layerId]: checked },
        },
        true,
      );
    },
    [doc, onCommitDoc],
  );

  const renderNavBranch = (parentId: string, depth: number): ReactNode => {
    if (!externalNav) return null;
    const childIds = externalNav.childrenByParentId[parentId] ?? [];
    if (childIds.length === 0) return null;
    const byId = new Map<string, AtlasWebglNavNode>(externalNav.nodes.map((n) => [n.id, n]));
    const q = navSearch.trim().toLowerCase();
    return childIds.map((cid) => {
      const node = byId.get(cid);
      if (!node) return null;
      const matches = !q || node.label.toLowerCase().includes(q) || node.sub.toLowerCase().includes(q);
      const branch = renderNavBranch(node.id, depth + 1);
      if (!matches && !branch) return null;
      const isZoomActive = zoomLayerState.activePlaceId === node.id;
      const isZoomAncestor = !isZoomActive && zoomAncestorPlaceSet.has(node.id);
      const active = isZoomActive || (!zoomActiveMapId && activePlaceId === node.id);
      const addSpec = NEXT_CHILD_KIND[node.kind];
      return (
        <div key={node.id} className="space-y-0.5">
          {matches ? (
            <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 10}px` }}>
              <button
                type="button"
                data-atlas-nav-node={node.id}
                data-atlas-zoom-active={isZoomActive ? 'true' : undefined}
                data-atlas-zoom-ancestor={isZoomAncestor ? 'true' : undefined}
                aria-current={active ? 'location' : undefined}
                className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md border px-2 text-left text-xs transition-colors ${active
                  ? 'border-primary bg-primary text-primary-foreground font-semibold'
                  : isZoomAncestor
                    ? 'border-primary/45 bg-primary/10 text-foreground font-medium hover:border-accent'
                    : 'border-transparent text-foreground hover:border-accent hover:bg-muted/70'
                  }`}
                onClick={() =>
                  triggerSmoothLevelTransition(
                    'in',
                    () => {
                      onNavSelect?.({
                        placeId: node.id,
                        mapId: node.primaryMapId,
                        worldRoot: false,
                      });
                    },
                    {
                      label: node.label,
                      kind: node.kind,
                      sub: node.sub,
                    },
                  )
                }
              >
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  <span className="block truncate">{node.label}</span>
                  <span
                    className={`block truncate text-[10px] ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      }`}
                  >
                    {node.sub}
                  </span>
                </span>
              </button>
              {canEdit && onNavAdd && addSpec ? (
                <button
                  type="button"
                  className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-accent hover:text-accent"
                  title={`${addSpec.label} unter ${node.label} anlegen`}
                  aria-label={`${addSpec.label} anlegen`}
                  onClick={() => onNavAdd({ uiKind: addSpec.uiKind, parentId: node.id })}
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}
          {branch}
        </div>
      );
    });
  };

  return (
    <div
      className="relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-[#10252f]"
      data-atlas-three-workstation
      data-atlas-ready={ready ? 'true' : undefined}
      data-atlas-surface-ready={ready ? 'true' : undefined}
      data-atlas-chrome-ready={ready ? 'true' : undefined}
    >
      {/* 100% Full-Bleed Three.js Spatial Stage */}
      <div className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className={`block h-full w-full touch-none ${activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
            }`}
          aria-label="Interaktive Three.js 3D-Weltkarte"
          onContextMenu={(e) => e.preventDefault()}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        />
      </div>

      {/* Thematic 3D Portal & Atmospheric Flight Overlay (Oak Tavern Doors, Crypt Portcullis, Google-Earth Flight) */}
      <AtlasPortalTransitionOverlay transition={portalTransition} />

      {/* SCM-04: German Confirmation Dialog for Auto-Grow & Soft-Cascade operations */}
      <SpatialOperationConfirmDialog
        plan={pendingSpatialPlan}
        onCancel={() => setPendingSpatialPlan(null)}
        onConfirm={({ dontAskAgain }) => {
          const plan = pendingSpatialPlan;
          setPendingSpatialPlan(null);
          if (!plan) return;
          if (dontAskAgain) {
            dismissPromptFor(plan.requiresConfirmation);
          }
          const adapter = spatialContainmentRef.current;
          if (!adapter) return;
          void adapter.commitPlan(plan).then((res) => {
            if (!res.ok) setSpatialErrorDe(res.reasonDe);
            else setSpatialErrorDe(null);
          });
        }}
      />

      {spatialErrorDe ? (
        <div
          role="alert"
          data-atlas-scm-error
          className="pointer-events-auto absolute bottom-16 left-1/2 z-[8] flex max-w-md -translate-x-1/2 items-center gap-2 rounded-lg border border-destructive bg-card/95 px-3 py-2 text-xs text-destructive shadow-xl backdrop-blur"
        >
          <span>{spatialErrorDe}</span>
          <button
            type="button"
            className="ml-auto rounded px-1.5 py-0.5 text-[11px] font-semibold text-foreground hover:text-accent"
            onClick={() => setSpatialErrorDe(null)}
          >
            Schließen
          </button>
        </div>
      ) : null}

      {/* Google-Maps Hierarchical Zoom-Tier Progressive Pin Labels + Smart 2D Collision Declutter */}
      {(() => {
        const visibleEntries = projectedPins
          .filter((p) => p.visible)
          .map((pin) => ({
            pin,
            pres: computeAtlasPinZoomPresentation(pin, hudSpan, mapScale, {
              activePlaceId,
              totalPins: mapPins.length,
            }),
          }))
          .filter((entry) => entry.pres.visible);

        if (visibleEntries.length === 0) return null;

        const placed = visibleEntries.map(({ pin, pres }) => ({
          pin,
          pres,
          x: pin.left,
          y: pin.top - (pres.tier === 1 ? 22 : pres.tier === 2 ? 16 : 12),
          w:
            pres.tier === 1
              ? Math.max(122, pin.label.length * 7.8 + 50)
              : pres.tier === 2
                ? Math.max(106, pin.label.length * 7 + 44)
                : Math.max(92, pin.label.length * 6.4 + 34),
          h: pres.tier === 1 ? 38 : pres.tier === 2 ? 32 : 28,
        }));

        for (let iter = 0; iter < 12; iter += 1) {
          for (let i = 0; i < placed.length; i += 1) {
            for (let j = i + 1; j < placed.length; j += 1) {
              const a = placed[i]!;
              const b = placed[j]!;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const overlapX = (a.w + b.w) * 0.5 + 8 - Math.abs(dx);
              const overlapY = (a.h + b.h) * 0.5 + 6 - Math.abs(dy);
              if (overlapX > 0 && overlapY > 0) {
                if (overlapY <= overlapX) {
                  const push = overlapY * 0.54;
                  const dir = dy >= 0 ? 1 : -1;
                  a.y -= dir * push;
                  b.y += dir * push;
                } else {
                  const push = overlapX * 0.54;
                  const dir = dx >= 0 ? 1 : -1;
                  a.x -= dir * push;
                  b.x += dir * push;
                }
              }
            }
          }
        }

        return (
          <>
            <svg
              className="pointer-events-none absolute inset-0 z-[2] h-full w-full overflow-visible"
              aria-hidden
            >
              {placed.map(({ pin, pres, x, y }) => {
                const dist = Math.hypot(x - pin.left, y - pin.top);
                const accent =
                  pres.tier === 1 ? '#f59e0b' : pres.tier === 2 ? '#06b6d4' : '#94a3b8';
                return (
                  <g key={`stem-${pin.id}`} style={{ opacity: pres.opacity }}>
                    {dist > 10 ? (
                      <line
                        x1={pin.left}
                        y1={pin.top}
                        x2={x}
                        y2={y + (pres.tier === 1 ? 14 : 11)}
                        stroke={accent}
                        strokeOpacity={pres.tier === 3 ? 0.55 : 0.78}
                        strokeWidth={pres.tier === 1 ? 1.8 : 1.35}
                        strokeDasharray="3 2"
                      />
                    ) : null}
                    <circle
                      cx={pin.left}
                      cy={pin.top}
                      r={pres.tier === 1 ? 4.2 : pres.tier === 2 ? 3.4 : 2.6}
                      fill={accent}
                      stroke="#0f172a"
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })}
            </svg>
            {placed.map(({ pin, pres, x, y }) => {
              const targetMapId = mapIdByPlaceId.get(pin.id) ?? null;
              const navNode = navNodeById.get(pin.id);
              const tierClasses =
                pres.tier === 1
                  ? 'min-h-9 rounded-full border border-amber-400/75 bg-slate-950/90 px-3.5 py-1.5 text-[13px] font-bold tracking-wide text-amber-50 shadow-xl backdrop-blur-md hover:border-amber-300 hover:bg-accent hover:text-accent-foreground'
                  : pres.tier === 2
                    ? 'min-h-8 rounded-full border border-primary/70 bg-card/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-lg backdrop-blur hover:border-accent hover:bg-accent hover:text-accent-foreground'
                    : 'min-h-7 rounded-full border border-border/80 bg-card/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground shadow backdrop-blur hover:border-accent hover:bg-accent hover:text-accent-foreground';
              return (
                <div
                  key={pin.id}
                  className="pointer-events-auto absolute z-[3] transition-[opacity,transform] duration-200 ease-out"
                  data-atlas-pin-tier={pres.tier}
                  style={{
                    left: Math.round(x),
                    top: Math.round(y),
                    opacity: pres.opacity,
                    transform: `translate(-50%, -50%) scale(${pres.scale})`,
                  }}
                >
                  <button
                    type="button"
                    data-atlas-3d-pin={pin.id}
                    className={`flex items-center gap-1.5 whitespace-nowrap transition-colors ${tierClasses}`}
                    onClick={() => {
                      const sourcePin = mapPins.find((p) => p.id === pin.id);
                      if (targetMapId) {
                        triggerSmoothLevelTransition(
                          'in',
                          () => {
                            onNavSelect?.({ placeId: pin.id, mapId: targetMapId, worldRoot: false });
                          },
                          {
                            label: pin.label,
                            kind: pin.kind,
                            sub: navNode?.sub,
                            targetX: sourcePin?.x,
                            targetZ: sourcePin?.y,
                          },
                        );
                      } else {
                        if (sourcePin) {
                          runtimeRef.current?.flyTo(sourcePin.x, sourcePin.y, Math.max(85, hudSpan * 0.52));
                        }
                        onNavSelect?.({ placeId: pin.id, mapId: null, worldRoot: false });
                      }
                    }}
                  >
                    <MapPin
                      className={
                        pres.tier === 1
                          ? 'size-4 shrink-0 text-amber-400'
                          : pres.tier === 2
                            ? 'size-3.5 shrink-0 text-primary'
                            : 'size-3 shrink-0 text-muted-foreground'
                      }
                      aria-hidden
                    />
                    {pres.showText ? <span>{pin.label}</span> : null}
                    {targetMapId && pres.showText ? (
                      <CaretRight className="size-3 shrink-0 opacity-70" aria-hidden />
                    ) : null}
                  </button>
                </div>
              );
            })}
          </>
        );
      })()}

      {/* TOP-LEFT Floating Collapsible `Ebenen` Chip & Frosted-Glass Drawer (leaves bottom-left open for Vollansicht/Golden!) */}
      <div
        className="pointer-events-none absolute left-3 top-3 z-[6] flex max-h-[calc(100%-5.25rem)] flex-col items-start gap-2"
        data-atlas-three-layers
      >
        <button
          type="button"
          data-atlas-panel-fold="layers"
          aria-expanded={layersOpen}
          className={`pointer-events-auto flex min-h-11 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold shadow-lg backdrop-blur-md transition-colors ${layersOpen
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border/90 bg-card/90 text-foreground hover:border-accent hover:bg-accent hover:text-accent-foreground'
            }`}
          onClick={() => setLayersOpen((v) => !v)}
        >
          <Stack className="size-4" aria-hidden />
          <span>Ebenen</span>
          <span
            data-atlas-zoom-level-badge
            data-atlas-zoom-active-map={zoomLayerState.activeMapId ?? ''}
            data-atlas-zoom-depth={zoomLayerState.activeDepth}
            className={`max-w-[9rem] truncate rounded px-1.5 py-0.5 text-[11px] font-semibold ${layersOpen
              ? 'bg-primary-foreground/20 text-primary-foreground'
              : 'bg-primary/15 text-primary'
              }`}
          >
            {zoomLayerState.activeLabelDe}
          </span>
          <CaretDown
            className={`size-3.5 transition-transform duration-200 ${layersOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {layersOpen ? (
          <aside
            className="pointer-events-auto flex min-h-0 w-72 flex-col overflow-hidden rounded-xl border border-border/90 bg-card/92 shadow-2xl backdrop-blur-md"
            aria-label="Welthierarchie und Ebenen"
          >
            <div className="flex items-center gap-1.5 border-b border-border/80 p-2">
              <div className="relative min-w-0 flex-1">
                <MagnifyingGlass
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={navSearch}
                  onChange={(e) => setNavSearch(e.target.value)}
                  placeholder="Ebenen suchen…"
                  className="min-h-10 pl-8 text-xs"
                  aria-label="Ebenen durchsuchen"
                />
              </div>
              {canEdit && onNavAdd && externalNav ? (
                <button
                  type="button"
                  className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-accent hover:text-accent"
                  title="Neuen Kontinent anlegen"
                  aria-label="Neuen Kontinent anlegen"
                  onClick={() => onNavAdd({ uiKind: 'kontinent', parentId: externalNav.worldId })}
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {externalNav ? (
                <div className="space-y-1">
                  <button
                    type="button"
                    data-atlas-nav-root
                    data-atlas-zoom-active={zoomLayerState.isWorldRoot ? 'true' : undefined}
                    aria-current={
                      zoomLayerState.isWorldRoot || (!zoomActiveMapId && (!activePlaceId || activePlaceId === externalNav.worldId))
                        ? 'location'
                        : undefined
                    }
                    className={`flex min-h-11 w-full items-center gap-2 rounded-md border px-2 text-left text-xs transition-colors ${zoomLayerState.isWorldRoot || (!zoomActiveMapId && (!activePlaceId || activePlaceId === externalNav.worldId))
                      ? 'border-primary bg-primary text-primary-foreground font-semibold'
                      : 'border-primary/45 bg-primary/10 text-foreground font-medium hover:border-accent'
                      }`}
                    onClick={() =>
                      triggerSmoothLevelTransition('out', () => {
                        onNavSelect?.({
                          placeId: null,
                          mapId: externalNav.worldPrimaryMapId,
                          worldRoot: true,
                        });
                      })
                    }
                  >
                    <GlobeHemisphereWest className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="block truncate">{externalNav.worldLabel}</span>
                      <span
                        className={`block truncate text-[10px] ${!activePlaceId || activePlaceId === externalNav.worldId
                          ? 'text-primary-foreground/80'
                          : 'text-muted-foreground'
                          }`}
                      >
                        Weltkarte
                      </span>
                    </span>
                  </button>
                  {renderNavBranch(externalNav.worldId, 1)}
                </div>
              ) : (
                <p className="px-2 py-4 text-xs text-muted-foreground">Weltstruktur wird geladen…</p>
              )}

              <div className="border-t border-border/80 pt-2">
                <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Sichtbare Ebenen
                </p>
                <div className="space-y-1">
                  {LAYER_ROWS.map((layer) => (
                    <label
                      key={layer.id}
                      className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-1.5 text-xs hover:bg-muted/60"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={doc.layers[layer.id] !== false}
                        onChange={(e) => toggleLayer(layer.id, e.target.checked)}
                      />
                      <span>{layer.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {/* TOP-CENTER Minimal Floating Glass Pill (Original SagaTree placement — zero full-width bar!) */}
      <div
        className="pointer-events-none absolute left-1/2 top-3 z-[6] flex max-w-[calc(100%-17rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5"
        data-atlas-workstation-topbar
      >
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-xl border border-border/90 bg-card/90 p-1 shadow-lg backdrop-blur-md">
          {hasParentMap && onHierarchyBack ? (
            <button
              type="button"
              className="flex min-h-9 items-center gap-1 rounded-lg border border-border/70 px-2.5 text-xs font-semibold text-foreground hover:border-accent hover:text-accent"
              title="Eine Ebene höher (oder einfach rauszoomen)"
              onClick={() => triggerSmoothLevelTransition('out', () => onHierarchyBack())}
            >
              <ArrowUUpLeft className="size-3.5" aria-hidden />
              <span>Hoch</span>
            </button>
          ) : null}

          {topBarExtra}

          {!forcedTopDown ? (
            <>
              <div className="h-5 w-px bg-border/80" aria-hidden />

              <div
                className="flex items-center rounded-lg bg-background/60 p-0.5"
                role="group"
                aria-label="Kameramodus"
              >
                {(
                  [
                    { id: 'diorama-oblique', label: 'Diorama' },
                    { id: 'ortho-topdown', label: 'Satellit' },
                    { id: 'perspective', label: 'Perspektive' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    data-atlas-camera-mode={m.id}
                    aria-pressed={cameraMode === m.id}
                    className={`min-h-8 rounded-md px-2.5 text-xs font-semibold transition-colors ${cameraMode === m.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-accent'
                      }`}
                    onClick={() => switchCameraMode(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* TOP-RIGHT Floating Collapsible `Werkzeuge` Chip & Frosted-Glass Drawer */}
      <div
        className="pointer-events-none absolute right-3 top-3 z-[6] flex max-h-[calc(100%-5.25rem)] flex-col items-end gap-2"
        data-atlas-three-tools
      >
        <button
          type="button"
          data-atlas-panel-fold="tools"
          aria-expanded={toolsOpen}
          className={`pointer-events-auto flex min-h-11 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold shadow-lg backdrop-blur-md transition-colors ${toolsOpen
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border/90 bg-card/90 text-foreground hover:border-accent hover:bg-accent hover:text-accent-foreground'
            }`}
          onClick={() => setToolsOpen((v) => !v)}
        >
          <Wrench className="size-4" aria-hidden />
          <span>Werkzeuge</span>
          <CaretDown
            className={`size-3.5 transition-transform duration-200 ${toolsOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {toolsOpen ? (
          <aside
            className="pointer-events-auto flex min-h-0 w-80 flex-col overflow-hidden rounded-xl border border-border/90 bg-card/94 shadow-2xl backdrop-blur-md"
            aria-label="Kartenwerkzeuge und Inspektor"
          >
            <div className="flex items-center justify-between border-b border-border/80 px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Werkzeuge &amp; Darstellung
              </span>
              {canEdit ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="flex min-h-8 min-w-8 items-center justify-center rounded border border-border/80 text-foreground hover:border-accent hover:text-accent disabled:opacity-35"
                    disabled={!canUndo}
                    title="Rückgängig (⌘Z)"
                    aria-label="Rückgängig"
                    onClick={onUndo}
                  >
                    <ArrowCounterClockwise className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="flex min-h-8 min-w-8 items-center justify-center rounded border border-border/80 text-foreground hover:border-accent hover:text-accent disabled:opacity-35"
                    disabled={!canRedo}
                    title="Wiederholen (⇧⌘Z)"
                    aria-label="Wiederholen"
                    onClick={onRedo}
                  >
                    <ArrowClockwise className="size-3.5" aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
              {/* 3D Tool Grid */}
              <div className="grid grid-cols-3 gap-1.5" role="toolbar" aria-label="3D-Werkzeuge">
                {(
                  [
                    { id: 'hand', label: 'Ansicht (Q)', Icon: Hand, editOnly: false },
                    { id: 'select', label: 'Auswahl', Icon: Cursor, editOnly: false },
                    { id: 'move', label: 'Bewegen (W)', Icon: ArrowsOutCardinal, editOnly: true },
                    { id: 'rotate', label: 'Drehen (E)', Icon: ArrowClockwise, editOnly: true },
                    { id: 'scale', label: 'Skalieren (T)', Icon: Resize, editOnly: true },
                    { id: 'height', label: 'Gelände', Icon: Mountains, editOnly: true },
                    { id: 'biome', label: 'Biome', Icon: PaintBrush, editOnly: true },
                    { id: 'stamp', label: 'Stempel', Icon: Stamp, editOnly: true },
                    { id: 'eraser', label: 'Radierer', Icon: Eraser, editOnly: true },
                  ] as const
                ).map(({ id, label, Icon, editOnly }) => (
                  <button
                    key={id}
                    type="button"
                    disabled={editOnly && !canEdit}
                    aria-pressed={activeTool === id}
                    data-atlas-3d-tool={id}
                    className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-md border px-1 text-[10px] font-semibold transition-colors disabled:opacity-40 ${activeTool === id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background/60 text-foreground hover:border-accent hover:text-accent'
                      }`}
                    onClick={() => setTool(id)}
                  >
                    <Icon className="size-4" aria-hidden />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>

              {/* Contextual Tool Options: Heightfield Sculpt */}
              {activeTool === 'height' && canEdit ? (
                <div className="space-y-2 rounded-lg border border-border bg-background/60 p-2.5">
                  <p className="text-xs font-semibold">Gelände formen (Höhenfeld)</p>
                  <div className="grid grid-cols-2 gap-1">
                    {ATLAS_TERRAIN_SCULPT_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={sculptMode === m.id}
                        className={`min-h-9 rounded border px-2 text-xs font-medium ${sculptMode === m.id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:border-accent'
                          }`}
                        onClick={() => setSculptMode(m.id)}
                      >
                        {m.labelDe}
                      </button>
                    ))}
                  </div>
                  <label className="block text-[11px]">
                    Radius: <strong>{sculptRadius}</strong>
                    <input
                      type="range"
                      className="mt-1 w-full accent-primary"
                      min={18}
                      max={180}
                      value={sculptRadius}
                      onChange={(e) => setSculptRadius(Number(e.target.value))}
                    />
                  </label>
                  <label className="block text-[11px]">
                    Stärke: <strong>{sculptStrength.toFixed(1)}</strong>
                    <input
                      type="range"
                      className="mt-1 w-full accent-primary"
                      min={0.5}
                      max={10}
                      step={0.5}
                      value={sculptStrength}
                      onChange={(e) => setSculptStrength(Number(e.target.value))}
                    />
                  </label>
                </div>
              ) : null}

              {/* Contextual Tool Options: Biome Paint */}
              {activeTool === 'biome' && canEdit ? (
                <div className="space-y-2 rounded-lg border border-border bg-background/60 p-2.5">
                  <p className="text-xs font-semibold">Biome &amp; Wege malen</p>
                  <div className="grid grid-cols-2 gap-1">
                    {ATLAS_BIOME_BRUSHES.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        aria-pressed={biomeId === b.id}
                        className={`flex min-h-9 items-center gap-2 rounded border px-2 text-left text-xs ${biomeId === b.id
                          ? 'border-primary bg-primary/15 font-semibold text-foreground'
                          : 'border-border hover:border-accent'
                          }`}
                        onClick={() => setBiomeId(b.id)}
                      >
                        <span
                          className="size-3.5 shrink-0 rounded-sm border border-border"
                          style={{ backgroundColor: b.swatchHex }}
                        />
                        <span className="truncate">{b.labelDe}</span>
                      </button>
                    ))}
                  </div>
                  <label className="block text-[11px]">
                    Pinselbreite: <strong>{biomeWidth}</strong>
                    <input
                      type="range"
                      className="mt-1 w-full accent-primary"
                      min={8}
                      max={90}
                      value={biomeWidth}
                      onChange={(e) => setBiomeWidth(Number(e.target.value))}
                    />
                  </label>
                </div>
              ) : null}

              {/* Contextual Tool Options: 3D Stamp Palette */}
              {activeTool === 'stamp' && canEdit ? (
                <div className="space-y-2 rounded-lg border border-border bg-background/60 p-2.5">
                  <p className="text-xs font-semibold">3D-Objekt platzieren</p>
                  <div className="grid grid-cols-2 gap-1">
                    {STAMP_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={stampKind === opt.id}
                        className={`flex min-h-9 items-center gap-1.5 rounded border px-2 text-xs ${stampKind === opt.id
                          ? 'border-primary bg-primary text-primary-foreground font-semibold'
                          : 'border-border hover:border-accent'
                          }`}
                        onClick={() => {
                          setStampKind(opt.id);
                          setStampSize(opt.defaultSize);
                        }}
                      >
                        <HouseLine className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  <label className="block text-[11px]">
                    Größe: <strong>{Math.round(stampSize * 100)}%</strong>
                    <input
                      type="range"
                      className="mt-1 w-full accent-primary"
                      min={25}
                      max={200}
                      step={5}
                      value={Math.round(stampSize * 100)}
                      onChange={(e) => setStampSize(Number(e.target.value) / 100)}
                    />
                  </label>
                </div>
              ) : null}

              {/* Selected Object Inspector */}
              {selectedObject ? (
                <div className="space-y-2 rounded-lg border border-primary/50 bg-primary/5 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">
                      Auswahl: {selectedObject.type}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {selectedObject.id}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    X {Math.round(selectedObject.x)} · Z {Math.round(selectedObject.y)}
                  </p>
                  {canEdit ? (
                    <>
                      <label className="block text-[11px]">
                        Drehung: <strong>{Math.round(selectedObject.angle ?? 0)}°</strong>
                        <input
                          type="range"
                          className="mt-1 w-full accent-primary"
                          min={0}
                          max={355}
                          step={5}
                          value={Math.round(selectedObject.angle ?? 0)}
                          onChange={(e) =>
                            onCommitDoc(
                              applyMapEdit(doc, {
                                op: 'transform_object',
                                id: selectedObject.id,
                                patch: { angle: Number(e.target.value) },
                              }),
                              true,
                            )
                          }
                        />
                      </label>
                      <label className="block text-[11px]">
                        Größe: <strong>{Math.round(selectedObject.size * 100)}%</strong>
                        <input
                          type="range"
                          className="mt-1 w-full accent-primary"
                          min={20}
                          max={250}
                          step={5}
                          value={Math.round(selectedObject.size * 100)}
                          onChange={(e) =>
                            onCommitDoc(
                              applyMapEdit(doc, {
                                op: 'transform_object',
                                id: selectedObject.id,
                                patch: { size: Number(e.target.value) / 100 },
                              }),
                              true,
                            )
                          }
                        />
                      </label>
                      <div className="flex gap-1.5 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-10 flex-1 gap-1"
                          onClick={() => {
                            const copyId = uid();
                            onCommitDoc(
                              applyMapEdit(doc, {
                                op: 'add_object',
                                object: {
                                  ...selectedObject,
                                  id: copyId,
                                  x: selectedObject.x + 24,
                                  y: selectedObject.y + 24,
                                },
                              }),
                              true,
                            );
                            setSelectedId(copyId);
                          }}
                        >
                          <Copy className="size-3.5" aria-hidden />
                          Duplizieren
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="min-h-10 flex-1 gap-1"
                          onClick={() => {
                            onCommitDoc(
                              applyMapEdit(doc, { op: 'remove_object', id: selectedObject.id }),
                              true,
                            );
                            setSelectedId(null);
                          }}
                        >
                          <Trash className="size-3.5" aria-hidden />
                          Löschen
                        </Button>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {/* Darstellung & Atmosphäre (V17 Style Switch + Time of Day + Roof Cutaway) */}
              <div className="space-y-2.5 border-t border-border/80 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Darstellung &amp; Atmosphäre
                </p>
                {look === 'outdoor' ? (
                  <div className="grid grid-cols-3 gap-1" role="group" aria-label="Lichtstimmung">
                    {(
                      [
                        { id: 'day', label: 'Tag', Icon: Sun },
                        { id: 'evening', label: 'Abend', Icon: SunHorizon },
                        { id: 'night', label: 'Nacht', Icon: Moon },
                      ] as const
                    ).map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={lightingMode === id}
                        className={`flex min-h-9 items-center justify-center gap-1 rounded border text-xs font-semibold transition-colors ${lightingMode === id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background/60 text-foreground hover:border-accent hover:text-accent'
                          }`}
                        onClick={() => setLightingMode(id)}
                      >
                        <Icon className="size-3.5" aria-hidden />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="grid grid-cols-3 gap-1" role="group" aria-label="Darstellungsstil">
                  {(
                    [
                      { id: 'pbr', label: 'PBR' },
                      { id: 'illustrated', label: 'Illustrativ' },
                      { id: 'cel', label: 'Cel' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      data-atlas-style-mode={st.id}
                      aria-pressed={styleMode === st.id}
                      className={`min-h-9 rounded border text-xs font-semibold transition-colors ${styleMode === st.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background/60 text-foreground hover:border-accent hover:text-accent'
                        }`}
                      onClick={() => setStyleMode(st.id)}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  aria-pressed={hideRoofs}
                  className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors ${hideRoofs
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background/60 text-foreground hover:border-accent hover:text-accent'
                    }`}
                  onClick={() => setHideRoofs((v) => !v)}
                >
                  {hideRoofs ? <EyeSlash className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  <span>{hideRoofs ? 'Innenräume sichtbar (Dächer aus)' : 'Dächer ausblenden / Innenräume'}</span>
                </button>
              </div>

              {/* SCM-04: Persistent Werkzeug-Einstellungen for Auto-Grow & Soft-Cascade prompts */}
              <SpatialEditPreferencesSection
                prefs={spatialPrefs}
                onChangeConfirmGrow={setConfirmGrow}
                onChangeConfirmCascade={setConfirmCascade}
              />

              {/* Feature Search & Catalog */}
              <div className="space-y-2 border-t border-border/80 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Objekte auf dieser Karte</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {doc.objects.length}
                  </span>
                </div>
                <div className="relative">
                  <MagnifyingGlass
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={featureQuery}
                    onChange={(e) => setFeatureQuery(e.target.value)}
                    placeholder="Elemente suchen…"
                    className="min-h-10 pl-8 text-xs"
                    aria-label="Kartenobjekte durchsuchen"
                  />
                </div>
                <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                  {filteredObjects.map((obj) => (
                    <button
                      key={obj.id}
                      type="button"
                      className={`flex min-h-9 w-full items-center justify-between rounded border px-2 text-left text-xs ${selectedId === obj.id
                        ? 'border-primary bg-primary/15 font-semibold text-foreground'
                        : 'border-border/70 hover:border-accent'
                        }`}
                      onClick={() => {
                        setSelectedId(obj.id);
                        runtimeRef.current?.flyTo(obj.x, obj.y, Math.min(hudSpan, 145));
                      }}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Cube className="size-3.5 shrink-0 text-primary" aria-hidden />
                        <span className="truncate">{obj.type}</span>
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">{obj.id}</span>
                    </button>
                  ))}
                  {filteredObjects.length === 0 ? (
                    <p className="py-2 text-center text-[11px] text-muted-foreground">
                      Keine passenden Objekte gefunden.
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Dungeon-Generator cleanly nested inside Werkzeuge */}
              {toolsSlot ? (
                <div data-atlas-tools-dungeon-section>{toolsSlot}</div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      {/* BOTTOM-CENTER Floating Scale & Navigation Taskbar (Original SagaTree .scale-widget!) */}
      <div
        className="pointer-events-auto absolute bottom-3 left-1/2 z-[6] flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-xl border border-border/90 bg-card/92 px-2 py-1 shadow-xl backdrop-blur-md"
        data-atlas-bottom-taskbar
        role="region"
        aria-label="Kartenmaßstab und Navigation"
      >
        <button
          type="button"
          className="min-h-9 whitespace-nowrap border-r border-border/80 pr-2.5 font-mono text-[11px] tabular-nums text-muted-foreground transition-colors hover:text-foreground"
          title={`Kamera zentrieren · ${formatAtlasSpanLabelDe(hudSpan, mapScale)}`}
          onClick={() => runtimeRef.current?.resetCamera()}
        >
          {hudCoords}
        </button>

        <button
          type="button"
          className="flex min-h-9 min-w-8 items-center justify-center rounded-md text-sm font-bold text-foreground transition-colors hover:bg-accent/20 hover:text-accent"
          aria-label="Herauszoomen"
          onClick={() => zoomByFactor(1.35)}
        >
          −
        </button>

        <button
          type="button"
          className="min-h-9 min-w-[3.4rem] rounded-md px-1.5 font-mono text-xs font-bold text-foreground transition-colors hover:bg-muted/60"
          title={formatAtlasSpanLabelDe(hudSpan, mapScale)}
          onClick={() => runtimeRef.current?.resetCamera()}
        >
          {zoomPct}%
        </button>

        <button
          type="button"
          className="flex min-h-9 min-w-8 items-center justify-center rounded-md text-sm font-bold text-foreground transition-colors hover:bg-accent/20 hover:text-accent"
          aria-label="Hineinzoomen"
          onClick={() => zoomByFactor(0.74)}
        >
          +
        </button>

        <div className="mx-0.5 h-5 w-px bg-border/80" aria-hidden />

        <button
          type="button"
          data-atlas-grid-toggle
          aria-pressed={showGrid}
          title="Kampfgrid ein-/ausblenden (G)"
          aria-label="Kampfgrid ein-/ausblenden"
          className={`flex min-h-9 min-w-9 items-center justify-center rounded-md transition-colors ${showGrid
            ? 'bg-primary/20 text-primary'
            : 'text-muted-foreground hover:bg-accent/20 hover:text-accent'
            }`}
          onClick={() => setShowGrid((v) => !v)}
        >
          <GridFour className="size-4" aria-hidden />
        </button>

        {/* Interactive 360° Rotating Compass Dial — drag to rotate, click to snap smoothly to 0° North! */}
        <button
          type="button"
          data-atlas-compass-dial
          title="Ziehen: Karte drehen · Klick: Norden (0°)"
          aria-label={`Kartendrehung ${hudYawDeg} Grad — Klick für Norden`}
          className="relative ml-0.5 flex size-9 shrink-0 cursor-grab items-center justify-center rounded-full border border-muted-foreground/60 text-[10px] font-bold text-foreground transition-colors hover:border-accent hover:text-accent active:cursor-grabbing"
          onPointerDown={(ev) => {
            const cur = runtimeRef.current?.getTargetView();
            if (!cur) return;
            dragRef.current = {
              kind: 'compass',
              startPx: ev.clientX,
              startYaw: cur.yawRad,
              moved: false,
            };
            ev.currentTarget.setPointerCapture(ev.pointerId);
          }}
          onPointerMove={(ev) => {
            const drag = dragRef.current;
            if (!drag || drag.kind !== 'compass') return;
            const dx = ev.clientX - drag.startPx;
            if (Math.abs(dx) > 3) {
              dragRef.current = { ...drag, moved: true };
            }
            runtimeRef.current?.setView({ yawRad: drag.startYaw + dx * 0.014 }, false);
          }}
          onPointerUp={(ev) => {
            const drag = dragRef.current;
            if (!drag || drag.kind !== 'compass') return;
            const moved = drag.moved;
            dragRef.current = null;
            try {
              ev.currentTarget.releasePointerCapture(ev.pointerId);
            } catch {
              /* ignore */
            }
            if (!moved) {
              runtimeRef.current?.setYawAnimated(0);
            }
          }}
        >
          <span
            className="pointer-events-none absolute top-0.5 left-1/2 h-2 w-0.5 -translate-x-1/2 rounded-full bg-primary"
            style={{
              transformOrigin: '50% 1rem',
              transform: `translateX(-50%) rotate(${hudYawDeg}deg)`,
            }}
            aria-hidden
          />
          <span className="font-mono tabular-nums">{hudYawDeg}°</span>
        </button>
      </div>

      {contextLost ? (
        <div
          className="absolute inset-0 z-[10] flex items-center justify-center bg-background/80 p-4 text-sm font-semibold text-foreground"
          role="alert"
        >
          WebGL-Kontext wird wiederhergestellt…
        </div>
      ) : null}
    </div>
  );
}
