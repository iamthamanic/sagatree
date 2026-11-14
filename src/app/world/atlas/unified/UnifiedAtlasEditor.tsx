/**
 * UnifiedAtlasEditor — multi-scale Canvas atlas (HTML prototype parity).
 * Location: src/app/world/atlas/unified/UnifiedAtlasEditor.tsx
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  Wall,
  Door,
  CaretDown,
  Eraser,
  Hand,
  Cursor,
  PaintBrush,
  Mountains,
  Path,
  Polygon,
  Square,
  Stamp,
  Wrench,
  type IconProps
} from '@phosphor-icons/react';
import {
  ATLAS_PROTOTYPE_LAYER_LABELS,
  applyMapEdit,
  atlasMapPinFocusSpan,
  atlasMapPinVisible,
  atlasProductBrushWidth,
  atlasProductStampSize,
  atlasPrototypeApplyLod,
  atlasPrototypeContentVisible,
  atlasSpanFromScale,
  atlasToolsForKind,
  buildDungeonGeneratorMeta,
  commitDungeonFeaturesToDoc,
  DEFAULT_ATLAS_BOUNDS,
  dungeonCommitPayloadFromResults,
  dungeonNeedsReforgeConfirm,
  emptyUnifiedCanvasDoc,
  generateDungeon,
  isAtlasToolAllowed,
  mergeDungeonPreviewIntoDoc,
  rasterizeDungeonGenerateResult,
  type DungeonCommitPayload,
  type DungeonGenerateResult,
  type DungeonRasterizeResult,
  type DungeonThemeKey,
  isSettlementLodId,
  atlasZoomCaption,
  emptyWebglRuntime,
  parseWebglRuntimeState,
  atlasInteractionModeLabelDe,
  beginAtlasEditBatch,
  cancelAtlasEditBatch,
  canAtlasRedo,
  canAtlasUndo,
  canEditFeatureKind,
  canHitFeature,
  clampAtlasBrushUi,
  commitAtlasEditBatch,
  emptyAtlasEditHistory,
  featureKindForId,
  featuresInRect,
  isLayerLocked,
  pushAtlasEdit,
  redoAtlasEdit,
  undoAtlasEdit,
  type AtlasEditHistory,
  pickDoorAt,
  pickObjectAt,
  pickRoomAt,
  pickRoomVertexAt,
  pickStrokeAt,
  pickWallAt,
  pickWallEndpoint,
  readLegacyWebglLocalStorage,
  roomFromValidatedPolygon,
  setLayerLock,
  snapPointToCandidates,
  snapPointToGrid,
  snapStructurePoint,
  toggleSelection,
  translateSelected,
  wallParamAt,
  wallPointAt,
  syncCanvasDocIntoWebglRuntime,
  syncWebglPropsIntoCanvasDoc,
  type DungeonGeneratorMeta,
  type UnifiedCanvasDoc,
  type UnifiedCanvasLayerId,
  type UnifiedCanvasMaterial,
  type UnifiedCanvasStampType,
  type UnifiedCanvasTool,
  type WebglRuntimeState,
  type AtlasMapPin,
  type AtlasMapScale,
  type AtlasNavCameraView,
  type AtlasHierarchyLodBand,
  atlasHierarchyLodLayerFlags,
  parseHierarchyNavKey,
  wheelRequestsHierarchyBack,
} from '../../../../domains/world/atlas';
import type { WorldNodeKind } from '../../../../domains/world/hierarchy';
import {
  atlasFitCamera,
  atlasOpacity,
  atlasPanBy,
  atlasScreenToWorld,
  atlasZoomAt,
  type AtlasCamera,
  type AtlasRect,
} from '../../../../domains/world/map';
import { Button } from '../../../../shared/ui/button';
import { Input } from '../../../../shared/ui/input';
import { Label } from '../../../../shared/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../../../../shared/ui/sheet';
import {
  placeKindForAuthor,
  resolveAtlasLodFromPlaces,
  seedKeyForAuthor,
  stampSizeForAuthor,
  type AtlasPlaceAuthorKind,
  type AtlasPlaceNavItem,
  type AtlasWebglNavTree,
  type SettlementPresetId,
} from '../../../../domains/world/places';
import {
  CITY_RECT,
  ELDORIA_NODES,
  INN_RECT,
  LAYER_LABELS,
  MATERIAL_COLORS,
  NORTH_RECT,
  REGION_RECT,
  STAMP_CATALOG,
  WORLD_RECT,
  demoSeedObjects,
  pointInRect,
} from './eldoria-scene';
import { getEldoriaArt } from './procedural-eldoria';
import {
  AtlasDefinePlacePanel,
  type AtlasDefinePlaceRequest,
} from './AtlasDefinePlacePanel';
import { AtlasNative3dEditor } from './AtlasNative3dEditor';

export type UnifiedAtlasCreatePlaceInput = {
  readonly authorKind: AtlasPlaceAuthorKind;
  readonly name: string;
  readonly settlementPresetId: SettlementPresetId | null;
  readonly x: number;
  readonly y: number;
  readonly stampSize: number;
  readonly seedKey: string;
  readonly placeKind: ReturnType<typeof placeKindForAuthor>;
};

export type UnifiedAtlasEditorProps = {
  readonly doc: UnifiedCanvasDoc;
  readonly canEdit: boolean;
  readonly onDocChange: (next: UnifiedCanvasDoc) => void;
  /** Persisted generator_meta.dungeon for reforge guard. */
  readonly dungeonMeta?: DungeonGeneratorMeta | null;
  readonly onDungeonMetaChange?: (next: DungeonGeneratorMeta | null) => void;
  /**
   * Persist a world_place then return; editor adds the canvas stamp after success.
   * Omit for read-only / library preview without place API.
   */
  readonly onCreatePlace?: (input: UnifiedAtlasCreatePlaceInput) => Promise<void>;
  /** DB places with map-link anchors — drives zoom nav + LOD when present. */
  readonly placeNav?: readonly AtlasPlaceNavItem[];
  /** Product WebGL #nav tree from persisted WorldNodes (#747). */
  readonly webglNavTree?: AtlasWebglNavTree | null;
  readonly activePlaceId?: string | null;
  readonly onWebglNavSelect?: (payload: {
    readonly placeId: string | null;
    readonly mapId: string | null;
    readonly worldRoot: boolean;
    readonly located?: boolean;
    readonly drillAllowed?: boolean;
  }) => void;
  readonly onWebglNavRename?: (payload: {
    readonly placeId: string;
    readonly label: string;
  }) => void;
  readonly onWebglNavAdd?: (payload: {
    readonly uiKind: string;
    readonly parentId: string;
  }) => void;
  readonly onWebglNavDuplicate?: (payload: { readonly placeId: string }) => void;
  readonly onWebglNavArchive?: (payload: { readonly placeId: string }) => void;
  readonly onWebglNavReparent?: (payload: { readonly placeId: string }) => void;
  /** Active WorldNode tip for contextual tool palette (#720). */
  readonly activeNodeKind?: WorldNodeKind | null;
  /** Active map sketch status for WebGL empty/drill gates (#752). */
  readonly mapSketchStatus?: 'unlocated' | 'unsketched' | 'ready' | null;
  /** Content scale of the active map (3D terrain vs floor-plan rendering). */
  readonly mapScale?: AtlasMapScale;
  /** Persisted place labels anchored on the active map (3D pins). */
  readonly mapPins?: readonly AtlasMapPin[] | null;
  /** Product surface (3D vs Draufsicht); pass it to keep the choice across map remounts. */
  readonly surfaceMode?: '3d' | '2d';
  readonly onSurfaceModeChange?: (mode: '3d' | '2d') => void;
  /** Host actions shown in the Draufsicht surface bar (Golden, Voll/Spieleransicht, Speichern). */
  readonly surfaceActions?: ReactNode;
  /** Optional floating chrome on the canvas (e.g. Karten hierarchy rail). */
  readonly canvasLeftRail?: ReactNode;
  /** Active map identity for controlled WebGL remount (#721). */
  readonly mapKey?: string;
  /** Persisted WebGL runtime (generator_meta.webglRuntimeV3). */
  readonly webglRuntime?: WebglRuntimeState | null;
  readonly onWebglRuntimeChange?: (next: WebglRuntimeState) => void;
  /**
   * Parent-map locate session (Steps 3+4): drag a rect in Draufsicht to place the child frame.
   * When set, paint tools yield to locate marquee until commit/cancel.
   */
  readonly locateSession?: { readonly childTitle: string } | null;
  readonly onLocateCommit?: (rect: {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  }) => void;
  readonly onLocateCancel?: () => void;
  /** ATL2-E03: restore session camera when remounting after breadcrumb/back. */
  readonly navRestoreView?: AtlasNavCameraView | null;
  /** ATL2-E03: fly-to focus after enter-child (parent-space rect). */
  readonly navPendingFocus?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } | null;
  readonly onNavPendingFocusConsumed?: () => void;
  /** ATL2-E03: report live Draufsicht camera for per-map snapshots. */
  readonly onNavViewChange?: (view: AtlasNavCameraView) => void;
  /** ATL2-E03: hierarchy back (Escape / Alt+ArrowUp / wheel-at-min). */
  readonly onHierarchyBack?: () => void;
  /**
   * ATL2-E04: semantic LOD band for the active hierarchy tip.
   * Editor layer toggles can only hide further — never force-show LOD-hidden content.
   */
  readonly hierarchyLodBand?: AtlasHierarchyLodBand | null;
};

type DragState =
  | { readonly mode: 'pan'; readonly px: number; readonly py: number; readonly cam: AtlasCamera }
  | {
      readonly mode: 'locate';
      readonly start: { readonly x: number; readonly y: number };
    }
  | {
      readonly mode: 'paint';
      readonly strokeId: string;
    }
  | {
      readonly mode: 'height';
      readonly heightMode: 'raise' | 'lower' | 'smooth' | 'flatten';
    }
  | {
      readonly mode: 'shape';
      readonly start: { x: number; y: number };
      readonly kind: 'room' | 'wall' | 'road';
    }
  | {
      readonly mode: 'move_object';
      readonly id: string;
      readonly ox: number;
      readonly oy: number;
      readonly sx: number;
      readonly sy: number;
    }
  | {
      readonly mode: 'move_room';
      readonly id: string;
      readonly ox: number;
      readonly oy: number;
      readonly sx: number;
      readonly sy: number;
    }
  | {
      readonly mode: 'move_room_vertex';
      readonly id: string;
      readonly index: number;
    }
  | {
      readonly mode: 'move_stroke_point';
      readonly id: string;
      readonly index: number;
    }
  | {
      readonly mode: 'move_wall_endpoint';
      readonly id: string;
      readonly endpoint: 1 | 2;
    }
  | {
      readonly mode: 'resize_room';
      readonly id: string;
      readonly ox: number;
      readonly oy: number;
      readonly ow: number;
      readonly oh: number;
      readonly sx: number;
      readonly sy: number;
    }
  | {
      readonly mode: 'marquee';
      readonly start: { x: number; y: number };
    }
  | null;

/** Product (non-demo) maps use DEFAULT_ATLAS_BOUNDS — not Eldoria's 1440×900 demo rect. */
const PRODUCT_WORLD_RECT: AtlasRect = {
  x: DEFAULT_ATLAS_BOUNDS.minX,
  y: DEFAULT_ATLAS_BOUNDS.minY,
  width: DEFAULT_ATLAS_BOUNDS.maxX - DEFAULT_ATLAS_BOUNDS.minX,
  height: DEFAULT_ATLAS_BOUNDS.maxY - DEFAULT_ATLAS_BOUNDS.minY,
};

/** Level badge + fallback crumb per map scale (same wording as the 3D runtime). */
const PRODUCT_SCALE_LABEL: Readonly<
  Record<AtlasMapScale, { readonly tag: string; readonly crumb: string }>
> = {
  world: { tag: 'WELTKARTE', crumb: 'Weltkarte' },
  settlement: { tag: 'ORTSKARTE', crumb: 'Ortskarte' },
  interior: { tag: 'INNENRAUM', crumb: 'Innenraum' },
};

function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

function easing(t: number): number {
  return t * t * (3 - 2 * t);
}

function stageAt(cam: AtlasCamera, scale: number): EldoriaStage {
  const p = cam.center;
  if (pointInRect(p, INN_RECT) && scale * INN_RECT.width > 270) return 'inn';
  if (pointInRect(p, CITY_RECT) && scale * CITY_RECT.width > 360) return 'city';
  if (pointInRect(p, REGION_RECT) && scale * REGION_RECT.width > 350) return 'region';
  if (pointInRect(p, NORTH_RECT) && scale * NORTH_RECT.width > 400) return 'north';
  return 'world';
}

type EldoriaStage = 'world' | 'north' | 'region' | 'city' | 'inn';

const STAGE_LABEL: Record<EldoriaStage, [string, string]> = {
  world: ['WELT', 'Weltkarte'],
  north: ['LAND', 'Demo-Nordreich'],
  region: ['REGION', 'Demo-Mark'],
  city: ['STADT', 'Dornhain'],
  inn: ['INNENRAUM', 'Demo-Kupferlaterne'],
};

const PAINT_HEIGHT: Record<EldoriaStage, number> = {
  world: 18,
  north: 6,
  region: 2.9,
  city: 1,
  inn: 0.18,
};

function drawStamp(
  c: CanvasRenderingContext2D,
  type: UnifiedCanvasStampType,
  x: number,
  y: number,
  size: number,
  angle = 0,
): void {
  c.save();
  c.translate(x, y);
  c.rotate((angle * Math.PI) / 180);
  c.scale(size / 100, size / 100);
  c.fillStyle = '#3d6c47';
  c.strokeStyle = '#284633';
  c.lineWidth = 3;
  if (type === 'baum' || type === 'tanne') {
    c.beginPath();
    c.arc(0, 0, 40, 0, Math.PI * 2);
    c.fill();
  } else if (type === 'haus') {
    c.fillStyle = '#d7c6a5';
    c.fillRect(-40, -30, 80, 60);
    c.fillStyle = '#794c3c';
    c.beginPath();
    c.moveTo(-45, -30);
    c.lineTo(0, -50);
    c.lineTo(45, -30);
    c.closePath();
    c.fill();
  } else if (type === 'tisch') {
    c.fillStyle = '#6e422b';
    c.fillRect(-40, -24, 80, 48);
    c.fillStyle = '#ae774c';
    c.fillRect(-34, -18, 68, 36);
  } else if (type === 'stuhl') {
    c.fillStyle = '#805336';
    c.fillRect(-22, -22, 44, 44);
  } else if (type === 'fass') {
    c.fillStyle = '#a97b49';
    c.beginPath();
    c.ellipse(0, 0, 28, 34, 0, 0, Math.PI * 2);
    c.fill();
  } else if (type === 'bett') {
    c.fillStyle = '#5b3427';
    c.fillRect(-40, -30, 80, 60);
    c.fillStyle = '#ddc7aa';
    c.fillRect(-32, -24, 64, 18);
  } else if (type === 'lampe') {
    const g = c.createRadialGradient(0, 0, 1, 0, 0, 50);
    g.addColorStop(0, '#f7d28a99');
    g.addColorStop(1, '#eb924100');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, 50, 0, Math.PI * 2);
    c.fill();
  } else if (type === 'teppich') {
    c.fillStyle = '#854b42';
    c.fillRect(-40, -24, 80, 48);
  } else {
    c.fillStyle = '#77827f';
    c.beginPath();
    c.moveTo(-30, -10);
    c.lineTo(0, -35);
    c.lineTo(30, -10);
    c.lineTo(20, 30);
    c.lineTo(-25, 25);
    c.closePath();
    c.fill();
  }
  c.restore();
}

export function UnifiedAtlasEditor({
  doc,
  canEdit,
  onDocChange: onDocChangeProp,
  dungeonMeta = null,
  onDungeonMetaChange,
  onCreatePlace,
  placeNav = [],
  webglNavTree = null,
  activePlaceId = null,
  onWebglNavSelect,
  onWebglNavRename,
  onWebglNavAdd,
  onWebglNavDuplicate,
  onWebglNavArchive,
  onWebglNavReparent,
  activeNodeKind = null,
  mapSketchStatus = null,
  mapScale = 'world',
  mapPins = null,
  surfaceMode: surfaceModeProp,
  onSurfaceModeChange,
  surfaceActions = null,
  canvasLeftRail = null,
  mapKey = 'map',
  webglRuntime = null,
  onWebglRuntimeChange,
  locateSession = null,
  onLocateCommit,
  onLocateCancel,
  navRestoreView = null,
  navPendingFocus = null,
  onNavPendingFocusConsumed,
  onNavViewChange,
  onHierarchyBack,
  hierarchyLodBand = null,
}: UnifiedAtlasEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<AtlasCamera>({ center: { x: 720, y: 450 }, pixelsPerUnit: 1 });
  const fitRef = useRef(1);
  const dragRef = useRef<DragState>(null);
  const animRef = useRef<number | null>(null);
  // A pin click can switch maps (remount) while a camera flight is still running.
  useEffect(
    () => () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
    },
    [],
  );
  const docRef = useRef(doc);
  docRef.current = doc;
  const dungeonMetaRef = useRef(dungeonMeta);
  dungeonMetaRef.current = dungeonMeta;
  const placeNavRef = useRef(placeNav);
  placeNavRef.current = placeNav;
  const webglRuntimeRef = useRef(webglRuntime);
  webglRuntimeRef.current = webglRuntime;
  const pinArmedRef = useRef(false);
  const marqueeArmedRef = useRef(false);
  const legacySeedRef = useRef<WebglRuntimeState | null | undefined>(undefined);
  if (legacySeedRef.current === undefined) {
    legacySeedRef.current = webglRuntime ? null : readLegacyWebglLocalStorage();
  }

  /** 2D doc mutations refresh in-memory webglRuntime for 3D remount (#749); persist strips sidecar geometry (ATL2-B04). */
  const onDocChange = useCallback(
    (next: UnifiedCanvasDoc) => {
      onDocChangeProp(next);
      if (!onWebglRuntimeChange || next.demoSeed !== false) return;
      const nextRuntime = syncCanvasDocIntoWebglRuntime(
        webglRuntimeRef.current ?? emptyWebglRuntime(),
        next,
      );
      webglRuntimeRef.current = nextRuntime;
      onWebglRuntimeChange(nextRuntime);
    },
    [onDocChangeProp, onWebglRuntimeChange],
  );
  const [localSurfaceMode, setLocalSurfaceMode] = useState<'3d' | '2d'>('3d');
  const surfaceMode = surfaceModeProp ?? localSurfaceMode;
  const setSurfaceMode = useCallback(
    (mode: '3d' | '2d') => {
      setLocalSurfaceMode(mode);
      onSurfaceModeChange?.(mode);
    },
    [onSurfaceModeChange],
  );

  const [tool, setTool] = useState<UnifiedCanvasTool>('hand');
  const [material, setMaterial] = useState<UnifiedCanvasMaterial>('gras');
  const [areaDraft, setAreaDraft] = useState<readonly (readonly [number, number])[]>([]);
  const areaDraftRef = useRef(areaDraft);
  areaDraftRef.current = areaDraft;
  const [areaHint, setAreaHint] = useState<string | null>(null);
  const [stamp, setStamp] = useState<UnifiedCanvasStampType>('baum');
  const [brushSize, setBrushSize] = useState(() => clampAtlasBrushUi(45));
  const [objectSize, setObjectSize] = useState(1);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const setSelectedId = (id: string | null) => {
    setSelectedIds(id ? [id] : []);
  };
  const selectFeature = (id: string, additive: boolean) => {
    setSelectedIds((prev) => toggleSelection(prev, id, additive));
  };
  const [dungeonSeed, setDungeonSeed] = useState('4242');
  const [dungeonRooms, setDungeonRooms] = useState(16);
  const [dungeonTheme, setDungeonTheme] = useState<DungeonThemeKey>('ancient');
  const [dungeonPreview, setDungeonPreview] = useState<{
    generate: DungeonGenerateResult;
    raster: DungeonRasterizeResult;
    payload: DungeonCommitPayload;
  } | null>(null);
  const dungeonPreviewRef = useRef(dungeonPreview);
  dungeonPreviewRef.current = dungeonPreview;
  const [dungeonError, setDungeonError] = useState<string | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [pinArmed, setPinArmed] = useState(false);
  const [marqueeArmed, setMarqueeArmed] = useState(false);
  const [placePin, setPlacePin] = useState<{ x: number; y: number } | null>(null);
  const [marqueeLive, setMarqueeLive] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [coords, setCoords] = useState('X 0 · Y 0');
  const [zoomPct, setZoomPct] = useState('100%');
  const [level, setLevel] = useState('WELT');
  const [crumb, setCrumb] = useState('Welt');
  const [pinScreen, setPinScreen] = useState<
    readonly { id: string; label: string; left: number; top: number; selected: boolean }[]
  >([]);
  const [viewport, setViewport] = useState({ width: 800, height: 500 });
  const [editHistory, setEditHistory] = useState<AtlasEditHistory>(() => emptyAtlasEditHistory());
  const editHistoryRef = useRef(editHistory);
  editHistoryRef.current = editHistory;
  const [historyLive, setHistoryLive] = useState('');
  const [layersSheetOpen, setLayersSheetOpen] = useState(false);
  const [, bump] = useState(0);
  pinArmedRef.current = pinArmed;
  marqueeArmedRef.current = marqueeArmed;
  const refresh = useCallback(() => {
    bump((n) => n + 1);
  }, []);

  const workingDoc = useMemo(() => {
    if (doc.objects.length > 0 || doc.strokes.length > 0 || !doc.demoSeed) return doc;
    return { ...doc, objects: demoSeedObjects() };
  }, [doc]);

  /** Preview overlay — non-canonical until Bestätigen. */
  const forgeDisplayDoc = useMemo(() => {
    if (!dungeonPreview?.payload) return workingDoc;
    return mergeDungeonPreviewIntoDoc(workingDoc, dungeonPreview.payload);
  }, [workingDoc, dungeonPreview]);

  /**
   * ATL2-E04: semantic LOD ∧ editor layers for both 2D paint and 3D controlledSeed
   * (Codex P2 — hierarchyLodBand must affect 3D, not only Draufsicht).
   */
  const lodAwareDisplayDoc = useMemo(() => {
    if (!hierarchyLodBand) return forgeDisplayDoc;
    const lodFlags = atlasHierarchyLodLayerFlags(hierarchyLodBand, {
      terrain: forgeDisplayDoc.layers.terrain,
      region: forgeDisplayDoc.layers.region,
      city: forgeDisplayDoc.layers.city,
      interior: forgeDisplayDoc.layers.interior,
      objects: forgeDisplayDoc.layers.objects,
      grid: forgeDisplayDoc.layers.grid,
    });
    return {
      ...forgeDisplayDoc,
      layers: { ...forgeDisplayDoc.layers, ...lodFlags },
    };
  }, [forgeDisplayDoc, hierarchyLodBand]);

  const pushHistory = useCallback((prev: UnifiedCanvasDoc) => {
    setEditHistory((h) => pushAtlasEdit(h, prev));
  }, []);

  const startEditBatch = useCallback(() => {
    setEditHistory((h) => beginAtlasEditBatch(h, docRef.current));
  }, []);

  const endEditBatch = useCallback(() => {
    setEditHistory((h) => commitAtlasEditBatch(h, docRef.current));
  }, []);

  const abortEditBatch = useCallback(() => {
    setEditHistory((h) => {
      const cancelled = cancelAtlasEditBatch(h);
      if (!cancelled) return h;
      onDocChange(cancelled.doc);
      return cancelled.history;
    });
  }, [onDocChange]);

  const commit = useCallback(
    (next: UnifiedCanvasDoc, recordHistory: boolean) => {
      if (recordHistory) {
        pushHistory(docRef.current);
        const meta = dungeonMetaRef.current;
        if (meta?.confirmed && !meta.manualDirty) {
          onDungeonMetaChange?.({ ...meta, manualDirty: true });
        }
      }
      onDocChange({
        ...next,
        demoSeed:
          next.demoSeed === false ? false : next.strokes.length === 0 && next.objects.length === 0,
      });
    },
    [onDocChange, onDungeonMetaChange, pushHistory],
  );

  const undo = useCallback(() => {
    const stepped = undoAtlasEdit(editHistoryRef.current, docRef.current);
    if (!stepped) return;
    setEditHistory(stepped.history);
    onDocChange(stepped.doc);
    setHistoryLive('Rückgängig ausgeführt');
  }, [onDocChange]);

  const redo = useCallback(() => {
    const stepped = redoAtlasEdit(editHistoryRef.current, docRef.current);
    if (!stepped) return;
    setEditHistory(stepped.history);
    onDocChange(stepped.doc);
    setHistoryLive('Wiederherstellen ausgeführt');
  }, [onDocChange]);

  const goToRect = useCallback(
    (rect: AtlasRect, duration = 650, onComplete?: () => void) => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
      const targetScale = Math.min(
        Math.max(
          Math.min((viewport.width - 120) / rect.width, (viewport.height - 115) / rect.height),
          fitRef.current * 0.8,
        ),
        320,
      );
      const start = {
        x: camRef.current.center.x,
        y: camRef.current.center.y,
        s: camRef.current.pixelsPerUnit,
        t: performance.now(),
      };
      const dest = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      const ms = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : duration;
      const frame = (now: number) => {
        const t = ms > 0 ? easing(Math.min(1, (now - start.t) / ms)) : 1;
        camRef.current = {
          center: {
            x: start.x + (dest.x - start.x) * t,
            y: start.y + (dest.y - start.y) * t,
          },
          pixelsPerUnit: Math.exp(Math.log(start.s) + (Math.log(targetScale) - Math.log(start.s)) * t),
        };
        refresh();
        if (t < 1) animRef.current = requestAnimationFrame(frame);
        else {
          animRef.current = null;
          onComplete?.();
        }
      };
      animRef.current = requestAnimationFrame(frame);
    },
    [viewport.height, viewport.width, refresh],
  );

  const reportNavView = useCallback(() => {
    // 3D surface reports via AtlasNative3dEditor — do not overwrite with idle 2D camRef.
    if (surfaceMode === '3d') return;
    if (!onNavViewChange || viewport.height <= 0) return;
    onNavViewChange({
      centerX: camRef.current.center.x,
      centerY: camRef.current.center.y,
      span: atlasSpanFromScale(camRef.current.pixelsPerUnit, viewport.height),
      mode: 'ortho-topdown',
    });
  }, [onNavViewChange, viewport.height, surfaceMode]);

  useEffect(() => {
    if (!navRestoreView || viewport.height <= 0) return;
    const ppu = Math.max(
      fitRef.current * 0.7,
      Math.min(320, viewport.height / (2 * Math.max(0.5, navRestoreView.span))),
    );
    camRef.current = {
      center: { x: navRestoreView.centerX, y: navRestoreView.centerY },
      pixelsPerUnit: ppu,
    };
    refresh();
  }, [mapKey, navRestoreView, viewport.height, refresh]);

  useEffect(() => {
    if (!navPendingFocus) return;
    // Consume only after the fly finishes so parent-space focus plays before a map switch (ATL2-E03).
    goToRect(
      {
        x: navPendingFocus.x,
        y: navPendingFocus.y,
        width: navPendingFocus.width,
        height: navPendingFocus.height,
      },
      650,
      () => {
        onNavPendingFocusConsumed?.();
      },
    );
  }, [navPendingFocus, goToRect, onNavPendingFocusConsumed]);

  useEffect(() => {
    reportNavView();
    return () => {
      reportNavView();
    };
  }, [mapKey, reportNavView]);

  const mapWorldRect =
    workingDoc.demoSeed !== false ? WORLD_RECT : PRODUCT_WORLD_RECT;

  // The stage only exists in the Draufsicht branch; re-attach when the surface flips.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const width = Math.max(220, r.width);
      const height = Math.max(220, r.height);
      setViewport({ width, height });
      const bounds = docRef.current.demoSeed !== false ? WORLD_RECT : PRODUCT_WORLD_RECT;
      const fit = atlasFitCamera(bounds, { width, height }, 48);
      const prevFit = fitRef.current;
      fitRef.current = fit.pixelsPerUnit;
      // Always open on the full world map; only preserve relative zoom after first fit.
      if (camRef.current.pixelsPerUnit <= 1.01 || prevFit <= 0) {
        camRef.current = fit;
      } else {
        camRef.current = {
          ...camRef.current,
          pixelsPerUnit: camRef.current.pixelsPerUnit * (fit.pixelsPerUnit / prevFit),
        };
      }
      refresh();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [refresh, surfaceMode]);

  const productWorldFitDoneRef = useRef(false);
  useEffect(() => {
    productWorldFitDoneRef.current = false;
  }, [workingDoc.demoSeed, mapKey]);
  // Product maps: one-shot snap to full world extents once the stage has a real size.
  // Hierarchy restore owns the camera when navRestoreView is present (Codex P1).
  useEffect(() => {
    if (workingDoc.demoSeed !== false) return;
    if (productWorldFitDoneRef.current) return;
    if (viewport.width < 220 || viewport.height < 220) return;
    if (navRestoreView) {
      productWorldFitDoneRef.current = true;
      return;
    }
    const fit = atlasFitCamera(PRODUCT_WORLD_RECT, viewport, 48);
    fitRef.current = fit.pixelsPerUnit;
    camRef.current = fit;
    productWorldFitDoneRef.current = true;
    refresh();
  }, [workingDoc.demoSeed, viewport.width, viewport.height, refresh, navRestoreView]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { width, height } = viewport;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const cam = camRef.current;
    const scale = cam.pixelsPerUnit;
    const renderDoc = lodAwareDisplayDoc;
    const layers = renderDoc.layers;
    const isDemo = renderDoc.demoSeed !== false;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#08212c');
    bg.addColorStop(1, '#244d52');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.translate(width / 2 - cam.center.x * scale, height / 2 - cam.center.y * scale);
    ctx.scale(scale, scale);

    // Product maps (Dornhain etc.): only the canvas doc — never Eldoria demo LOD art.
    // Demo maps: procedural Eldoria layers fade in with zoom.
    let cf = 0;
    let iface = 0;
    if (isDemo) {
      const art = getEldoriaArt();
      if (layers.terrain) {
        ctx.drawImage(art.world, 0, 0, WORLD_RECT.width, WORLD_RECT.height);
      } else {
        ctx.fillStyle = '#2f5760';
        ctx.fillRect(0, 0, WORLD_RECT.width, WORLD_RECT.height);
      }
      const nf = atlasOpacity(scale * NORTH_RECT.width, 360, 600);
      const rf = atlasOpacity(scale * REGION_RECT.width, 410, 680);
      cf = atlasOpacity(scale * CITY_RECT.width, 380, 670);
      iface = atlasOpacity(scale * INN_RECT.width, 270, 530);
      if (layers.region) {
        ctx.save();
        ctx.globalAlpha = 0.22 + nf * 0.4;
        ctx.strokeStyle = '#a5a06b';
        ctx.lineWidth = 3;
        ctx.setLineDash([9, 9]);
        ctx.strokeRect(NORTH_RECT.x, NORTH_RECT.y, NORTH_RECT.width, NORTH_RECT.height);
        ctx.restore();
        if (rf > 0.01) {
          ctx.save();
          ctx.globalAlpha = rf;
          ctx.drawImage(art.region, REGION_RECT.x, REGION_RECT.y, REGION_RECT.width, REGION_RECT.height);
          ctx.restore();
        }
      }
      if (layers.city && cf > 0.01) {
        ctx.save();
        ctx.globalAlpha = cf;
        ctx.drawImage(art.city, CITY_RECT.x, CITY_RECT.y, CITY_RECT.width, CITY_RECT.height);
        ctx.restore();
      }
      if (layers.interior && iface > 0.01) {
        ctx.save();
        ctx.globalAlpha = iface;
        ctx.drawImage(art.interior, INN_RECT.x, INN_RECT.y, INN_RECT.width, INN_RECT.height);
        ctx.restore();
      }
      if (layers.roads) {
        ctx.save();
        ctx.strokeStyle = '#d5c5a8bf';
        ctx.lineWidth = 4;
        ctx.setLineDash([3, 6]);
        ctx.beginPath();
        ctx.moveTo(841, 539);
        ctx.quadraticCurveTo(907, 512, 956, 469);
        ctx.stroke();
        ctx.restore();
      }
    } else if (layers.terrain) {
      // World maps start as open ocean; settlement / interior maps sit on a plain sheet (3D parity).
      ctx.fillStyle =
        mapScale === 'world' ? '#1a5f8a' : mapScale === 'interior' ? '#1d2529' : '#2f4034';
      ctx.fillRect(
        PRODUCT_WORLD_RECT.x,
        PRODUCT_WORLD_RECT.y,
        PRODUCT_WORLD_RECT.width,
        PRODUCT_WORLD_RECT.height,
      );
    }

    /* ATL2-D04 — Draufsicht heightfield overlay (same SoT as 3D). */
    const hf = renderDoc.heightfield;
    if (hf && Array.isArray(hf.heights) && hf.cols >= 2 && hf.rows >= 2 && layers.terrain) {
      const water = hf.waterLevel;
      for (let row = 0; row < hf.rows; row++) {
        for (let col = 0; col < hf.cols; col++) {
          const h = hf.heights[row * hf.cols + col] ?? 0;
          if (Math.abs(h) < 1e-3 && h >= water) continue;
          const x = hf.originX + col * hf.cellSize;
          const y = hf.originZ + row * hf.cellSize;
          if (h < water) {
            ctx.fillStyle = 'rgba(26,95,138,0.35)';
          } else if (h < water + 2) {
            ctx.fillStyle = 'rgba(111,154,104,0.45)';
          } else if (h < 8) {
            ctx.fillStyle = 'rgba(82,123,85,0.55)';
          } else {
            ctx.fillStyle = 'rgba(128,144,138,0.65)';
          }
          ctx.fillRect(x, y, hf.cellSize + 0.5, hf.cellSize + 0.5);
        }
      }
    }

    // Zoom LOD only applies to world maps; settlement / interior maps show all of their content.
    const protoLod =
      !isDemo && mapScale === 'world'
        ? atlasPrototypeApplyLod(scale, height, {
            terrain: layers.terrain,
            region: layers.region,
            city: layers.city,
            interior: layers.interior,
            objects: layers.objects,
            grid: layers.grid,
          })
        : null;
    // World terrain (w.* areas and strokes) stays as the base layer when zoomed in, as in 3D.
    const areaVisible = (id: string): boolean =>
      !protoLod || id.startsWith('w.') || atlasPrototypeContentVisible(id, protoLod);

    const productLandColor = (material: string): string => {
      switch (material) {
        case 'wasser':
          return '#1a5f8a';
        case 'gras':
          return '#6f9a68';
        case 'erde':
          return '#c4896a';
        case 'sand':
          return '#d4c28a';
        case 'stein':
          return '#a39bb0';
        case 'holz':
          return '#5d8a55';
        case 'pflaster':
          return '#b0a898';
        default:
          return MATERIAL_COLORS[material] ?? '#6f9a68';
      }
    };

    if (layers.drawings) {
      for (const r of renderDoc.rooms) {
        if (!areaVisible(r.id)) continue;
        // Ocean base room is already painted as full-canvas fill.
        if (!isDemo && r.id === 'w.ocean') continue;
        const isPreview = dungeonPreview != null && r.id.startsWith('droom-');
        ctx.fillStyle = isDemo
          ? (MATERIAL_COLORS[r.material] ?? MATERIAL_COLORS.holz)
          : productLandColor(r.material);
        if (isPreview) ctx.globalAlpha = 0.72;
        if (r.points && r.points.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(r.points[0][0], r.points[0][1]);
          for (let i = 1; i < r.points.length; i += 1) {
            ctx.lineTo(r.points[i][0], r.points[i][1]);
          }
          ctx.closePath();
          ctx.fill();
          if (isDemo) {
            ctx.strokeStyle = '#514a41';
            ctx.lineWidth = Math.min(r.w, r.h) * 0.08;
            ctx.stroke();
          } else if (!isSettlementLodId(r.id) && r.material !== 'wasser') {
            ctx.strokeStyle = isPreview ? 'rgba(6,182,212,0.85)' : 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 3 / Math.max(0.2, scale);
            ctx.stroke();
          }
        } else {
          ctx.fillRect(r.x, r.y, r.w, r.h);
          if (isDemo) {
            ctx.strokeStyle = '#514a41';
            ctx.lineWidth = Math.min(r.w, r.h) * 0.08;
            ctx.strokeRect(r.x, r.y, r.w, r.h);
          } else if (!isSettlementLodId(r.id) && r.material !== 'wasser') {
            // Soft coast outline for land masses
            ctx.strokeStyle = isPreview ? 'rgba(6,182,212,0.85)' : 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 3 / Math.max(0.2, scale);
            ctx.strokeRect(r.x, r.y, r.w, r.h);
          }
        }
        if (isPreview) ctx.globalAlpha = 1;
      }
      if (!isDemo && areaDraft.length > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(6,182,212,0.95)';
        ctx.fillStyle = 'rgba(6,182,212,0.18)';
        ctx.lineWidth = 2 / Math.max(0.2, scale);
        ctx.setLineDash([6 / scale, 4 / scale]);
        ctx.beginPath();
        ctx.moveTo(areaDraft[0][0], areaDraft[0][1]);
        for (let i = 1; i < areaDraft.length; i += 1) {
          ctx.lineTo(areaDraft[i][0], areaDraft[i][1]);
        }
        if (areaDraft.length >= 3) ctx.closePath();
        if (areaDraft.length >= 3) ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        for (const [ax, ay] of areaDraft) {
          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.arc(ax, ay, 4 / Math.max(0.2, scale), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      for (const s of renderDoc.strokes) {
        if (s.points.length === 0) continue;
        if (!areaVisible(s.id)) continue;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = isDemo
          ? (MATERIAL_COLORS[s.material] ?? MATERIAL_COLORS.gras)
          : s.material === 'wasser'
            ? '#3a8ab0'
            : productLandColor(s.material);
        ctx.lineWidth = s.width;
        ctx.beginPath();
        ctx.moveTo(s.points[0][0], s.points[0][1]);
        for (let i = 1; i < s.points.length; i += 1) ctx.lineTo(s.points[i][0], s.points[i][1]);
        ctx.stroke();
        ctx.restore();
      }
      for (const w of renderDoc.walls) {
        if (protoLod && !protoLod.mapDungeon && !protoLod.mapCity) continue;
        ctx.strokeStyle = '#34383a';
        ctx.lineWidth = w.width * 1.7;
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x2, w.y2);
        ctx.stroke();
        ctx.strokeStyle = '#b4b6aa';
        ctx.lineWidth = w.width;
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x2, w.y2);
        ctx.stroke();
      }
      for (const d of renderDoc.doors ?? []) {
        if (protoLod && !protoLod.mapDungeon && !protoLod.mapCity) continue;
        const wall = renderDoc.walls.find((w) => w.id === d.wallId);
        if (!wall) continue;
        const [dx, dy] = wallPointAt(wall, d.t);
        ctx.fillStyle = selectedId === d.id ? '#06B6D4' : '#E8A641';
        ctx.beginPath();
        ctx.arc(dx, dy, Math.max(d.width * 0.45, 0.35), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (layers.objects) {
      for (const o of renderDoc.objects) {
        if (isDemo) {
          const inInn = pointInRect(o, INN_RECT);
          const inCity = pointInRect(o, CITY_RECT);
          if ((inInn && iface < 0.34) || (!inInn && inCity && cf < 0.28)) continue;
        } else if (protoLod && !atlasPrototypeContentVisible(o.id, protoLod)) {
          continue;
        } else if (
          protoLod &&
          !(
            protoLod.stampsWorld ||
            protoLod.stampsRegion ||
            protoLod.stampsCity ||
            protoLod.stampsDungeon ||
            protoLod.stampsRoom
          )
        ) {
          continue;
        }
        drawStamp(ctx, o.type, o.x, o.y, o.size * 100, o.angle ?? 0);
      }
    }
    if (!isDemo && (protoLod ? protoLod.grid : layers.grid)) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#54665c';
      ctx.lineWidth = 1 / Math.max(0.2, scale);
      const step = Math.max(4, 12 / scale);
      const cx = cam.center.x;
      const cy = cam.center.y;
      const halfW = width / (2 * scale);
      const halfH = height / (2 * scale);
      const x0 = Math.floor((cx - halfW) / step) * step;
      const y0 = Math.floor((cy - halfH) / step) * step;
      for (let x = x0; x < cx + halfW; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, cy - halfH);
        ctx.lineTo(x, cy + halfH);
        ctx.stroke();
      }
      for (let y = y0; y < cy + halfH; y += step) {
        ctx.beginPath();
        ctx.moveTo(cx - halfW, y);
        ctx.lineTo(cx + halfW, y);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (isDemo && layers.grid && iface > 0.2) {
      ctx.save();
      ctx.globalAlpha = iface * 0.5;
      ctx.strokeStyle = '#ebf0dd';
      ctx.lineWidth = 0.013;
      const step = 0.72;
      for (let x = INN_RECT.x; x < INN_RECT.x + INN_RECT.width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, INN_RECT.y);
        ctx.lineTo(x, INN_RECT.y + INN_RECT.height);
        ctx.stroke();
      }
      for (let y = INN_RECT.y; y < INN_RECT.y + INN_RECT.height; y += step) {
        ctx.beginPath();
        ctx.moveTo(INN_RECT.x, y);
        ctx.lineTo(INN_RECT.x + INN_RECT.width, y);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (selectedId) {
      const o = workingDoc.objects.find((x) => x.id === selectedId);
      if (o) {
        ctx.strokeStyle = '#25e3ef';
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([8 / scale, 5 / scale]);
        ctx.beginPath();
        ctx.arc(o.x, o.y, Math.max(o.size * 0.78, 6 / scale), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (marqueeLive) {
      ctx.save();
      ctx.strokeStyle = '#06b6d4';
      ctx.fillStyle = 'rgba(6,182,212,0.12)';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([6 / scale, 4 / scale]);
      ctx.fillRect(marqueeLive.x, marqueeLive.y, marqueeLive.w, marqueeLive.h);
      ctx.strokeRect(marqueeLive.x, marqueeLive.y, marqueeLive.w, marqueeLive.h);
      ctx.restore();
    }

    if (placePin) {
      ctx.save();
      const r = 10 / scale;
      ctx.fillStyle = '#06b6d4';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2 / scale;
      ctx.beginPath();
      ctx.arc(placePin.x, placePin.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(placePin.x, placePin.y);
      ctx.lineTo(placePin.x, placePin.y - r * 2.4);
      ctx.stroke();
      ctx.restore();
    }

    if (!isDemo) {
      const scaleLabel = PRODUCT_SCALE_LABEL[mapScale];
      setLevel(scaleLabel.tag);
      const placeLod = resolveAtlasLodFromPlaces(cam.center, scale, placeNavRef.current);
      setCrumb(placeLod?.crumb && placeLod.level !== 'WELT' ? placeLod.crumb : scaleLabel.crumb);
      const span = atlasSpanFromScale(scale, height);
      const stackAt = new Map<string, number>();
      const nextPins: { id: string; label: string; left: number; top: number; selected: boolean }[] =
        [];
      for (const pin of mapPins ?? []) {
        if (!atlasMapPinVisible(pin, mapScale, span)) continue;
        const left = Math.round((pin.x - cam.center.x) * scale + width / 2);
        const top = Math.round((pin.y - cam.center.y) * scale + height / 2);
        if (left < -60 || top < -30 || left > width + 60 || top > height + 30) continue;
        const key = `${Math.round(pin.x)}:${Math.round(pin.y)}`;
        const stack = stackAt.get(key) ?? 0;
        stackAt.set(key, stack + 1);
        nextPins.push({
          id: pin.id,
          label: pin.label,
          left,
          top: top - stack * 28,
          selected: pin.id === activePlaceId,
        });
      }
      setPinScreen((prev) =>
        prev.length === nextPins.length &&
        prev.every((p, i) => {
          const n = nextPins[i];
          return (
            !!n &&
            p.id === n.id &&
            p.label === n.label &&
            p.left === n.left &&
            p.top === n.top &&
            p.selected === n.selected
          );
        })
          ? prev
          : nextPins,
      );
      setZoomPct(atlasZoomCaption(Math.round((scale / fitRef.current) * 100), null));
    } else {
      setPinScreen((prev) => (prev.length === 0 ? prev : []));
      const lod = resolveAtlasLodFromPlaces(cam.center, scale, placeNavRef.current);
      if (lod) {
        setLevel(lod.level);
        setCrumb(lod.crumb);
      } else {
        const st = stageAt(cam, scale);
        const [lv, cr] = STAGE_LABEL[st];
        setLevel(lv);
        setCrumb(cr);
      }
      setZoomPct(atlasZoomCaption(Math.round((scale / fitRef.current) * 100), null));
    }
  });

  const worldFromClient = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0, px: 0, py: 0 };
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const w = atlasScreenToWorld(
      { x: px, y: py },
      camRef.current,
      { width: viewport.width, height: viewport.height },
    );
    return { ...w, px, py };
  };

  const worldFromEvent = (e: { clientX: number; clientY: number }) =>
    worldFromClient(e.clientX, e.clientY);

  const currentSpan = () => atlasSpanFromScale(camRef.current.pixelsPerUnit, viewport.height);

  const brushWidth = () => {
    if (workingDoc.demoSeed === false) {
      return atlasProductBrushWidth(currentSpan(), brushSize);
    }
    const st = stageAt(camRef.current, camRef.current.pixelsPerUnit);
    return PAINT_HEIGHT[st] * (brushSize / 45);
  };

  const stampSizeNow = () => {
    if (workingDoc.demoSeed === false) {
      return atlasProductStampSize(currentSpan(), objectSize);
    }
    const st = stageAt(camRef.current, camRef.current.pixelsPerUnit);
    const base = { world: 25, north: 11, region: 7, city: 3, inn: 0.95 }[st] ?? 5;
    return base * objectSize;
  };

  /** Same as a 3D pin click: fly to the pin and select the place (opens its own map when it has one). */
  const focusMapPin = (id: string) => {
    const pin = mapPins?.find((p) => p.id === id);
    if (!pin) return;
    const span = atlasMapPinFocusSpan(pin, mapScale, currentSpan());
    const halfW = span * (viewport.width / Math.max(1, viewport.height));
    goToRect({ x: pin.x - halfW, y: pin.y - span, width: halfW * 2, height: span * 2 });
    const node = webglNavTree?.nodes.find((n) => n.id === id) ?? null;
    const mapId = node?.primaryMapId ?? null;
    onWebglNavSelect?.({
      placeId: id,
      mapId,
      worldRoot: false,
      located: node?.located === true,
      drillAllowed: !!mapId && node?.located === true,
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-unified-chrome]')) return;
    const p = worldFromEvent(e);
    setCoords(`X ${p.x.toFixed(1)} · Y ${p.y.toFixed(1)}`);
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    stageRef.current?.setPointerCapture(e.pointerId);

    if (locateSession) {
      dragRef.current = { mode: 'locate', start: { x: p.x, y: p.y } };
      setMarqueeLive({ x: p.x, y: p.y, w: 0, h: 0 });
      return;
    }

    if (pinArmedRef.current) {
      setPlacePin({ x: p.x, y: p.y });
      setPinArmed(false);
      setMarqueeArmed(false);
      setMarqueeLive(null);
      setPlaceError(null);
      refresh();
      return;
    }

    if (marqueeArmedRef.current) {
      dragRef.current = { mode: 'marquee', start: { x: p.x, y: p.y } };
      setMarqueeLive({ x: p.x, y: p.y, w: 0, h: 0 });
      return;
    }

    if (!canEdit || tool === 'hand') {
      dragRef.current = { mode: 'pan', px: p.px, py: p.py, cam: camRef.current };
      return;
    }

    if (tool === 'stamp') {
      if (!canEditFeatureKind(workingDoc, 'object')) return;
      commit(
        applyMapEdit(workingDoc, {
          op: 'add_object',
          object: { id: uid(), type: stamp, x: p.x, y: p.y, size: stampSizeNow(), angle: 0 },
        }),
        true,
      );
      refresh();
      return;
    }

    if (tool === 'door') {
      if (!canEditFeatureKind(workingDoc, 'door')) return;
      const wall = pickWallAt(workingDoc, p.x, p.y, 14 / camRef.current.pixelsPerUnit);
      if (wall) {
        const t = wallParamAt(wall, p.x, p.y);
        commit(
          applyMapEdit(workingDoc, {
            op: 'add_door',
            door: {
              id: uid(),
              wallId: wall.id,
              t,
              width: Math.max(brushWidth() * 0.35, 0.6),
            },
          }),
          true,
        );
      }
      return;
    }

    if (tool === 'erase') {
      const hit = pickObjectAt(workingDoc, p.x, p.y);
      if (hit) {
        if (!canEditFeatureKind(workingDoc, 'object')) return;
        commit(applyMapEdit(workingDoc, { op: 'remove_object', id: hit.id }), true);
        return;
      }
      const doorHit = pickDoorAt(workingDoc, p.x, p.y, 12 / camRef.current.pixelsPerUnit);
      if (doorHit) {
        if (!canEditFeatureKind(workingDoc, 'door')) return;
        commit(applyMapEdit(workingDoc, { op: 'remove_door', id: doorHit.id }), true);
        return;
      }
      const strokeHit = pickStrokeAt(
        workingDoc,
        p.x,
        p.y,
        15 / camRef.current.pixelsPerUnit,
      );
      if (strokeHit) {
        if (!canEditFeatureKind(workingDoc, 'stroke')) return;
        commit(applyMapEdit(workingDoc, { op: 'remove_stroke', id: strokeHit.id }), true);
        return;
      }
      const wallHit = pickWallAt(workingDoc, p.x, p.y, 12 / camRef.current.pixelsPerUnit);
      if (wallHit) {
        if (!canEditFeatureKind(workingDoc, 'wall')) return;
        commit(applyMapEdit(workingDoc, { op: 'remove_wall', id: wallHit.id }), true);
        return;
      }
      const roomHit = pickRoomAt(workingDoc, p.x, p.y);
      if (roomHit && roomHit.id !== 'w.ocean') {
        if (!canEditFeatureKind(workingDoc, 'room')) return;
        commit(applyMapEdit(workingDoc, { op: 'remove_room', id: roomHit.id }), true);
        return;
      }
      if (workingDoc.heightfield?.heights.some((h) => Math.abs(h) > 1e-3)) {
        commit(applyMapEdit(workingDoc, { op: 'clear_heightfield' }), true);
      }
      return;
    }

    if (tool === 'height') {
      if (!canEdit) return;
      const mode = e.altKey
        ? 'smooth'
        : e.shiftKey
          ? 'lower'
          : e.metaKey || e.ctrlKey
            ? 'flatten'
            : 'raise';
      startEditBatch();
      commit(
        applyMapEdit(workingDoc, {
          op: 'paint_heightfield',
          stroke: {
            mode,
            x: p.x,
            z: p.y,
            radius: Math.max(8, brushWidth() * 1.2),
            strength: mode === 'smooth' ? 0.55 : 1.4,
            ...(mode === 'flatten' ? { targetHeight: 0 } : {}),
          },
        }),
        true,
      );
      dragRef.current = { mode: 'height', heightMode: mode };
      return;
    }

    if (tool === 'area') {
      if (!canEditFeatureKind(workingDoc, 'room')) return;
      if (e.detail >= 2) {
        const draft = areaDraftRef.current;
        if (draft.length >= 3) {
          const built = roomFromValidatedPolygon(uid(), material, draft);
          if (built.ok === false) {
            setAreaHint(
              built.reason === 'self_intersecting'
                ? 'Fläche ungültig — selbstschneidende Polygone sind nicht erlaubt.'
                : 'Fläche ungültig — mindestens 3 Punkte mit Fläche nötig.',
            );
          } else {
            commit(applyMapEdit(workingDoc, { op: 'add_room', room: built.room }), true);
            setAreaDraft([]);
            setAreaHint(null);
          }
        } else {
          setAreaHint('Noch mindestens 3 Punkte setzen, dann Doppelklick zum Schließen.');
        }
        return;
      }
      const snapThreshold = 12 / camRef.current.pixelsPerUnit;
      const candidates = [
        ...areaDraftRef.current,
        ...workingDoc.rooms.flatMap((r) => (r.points ? [...r.points] : [])),
      ];
      const snapped = snapPointToCandidates(
        snapPointToGrid([p.x, p.y], Math.max(snapThreshold * 0.25, 0.5)),
        candidates,
        snapThreshold,
      );
      setAreaDraft((prev) => [...prev, snapped]);
      setAreaHint('Weiter klicken · Doppelklick / Enter schließt · Escape bricht ab');
      refresh();
      return;
    }

    if (tool === 'select') {
      const additive = e.shiftKey;
      // Empty drag starts multi-select marquee (ATL2-C03).
      // Hit probe must ignore hidden layers so marquee / under-hits stay reachable.
      const thr = 12 / camRef.current.pixelsPerUnit;
      const layers = workingDoc.layers;
      const hitProbe =
        (canHitFeature(layers, null, 'object') && pickObjectAt(workingDoc, p.x, p.y)) ||
        (canHitFeature(layers, null, 'door') && pickDoorAt(workingDoc, p.x, p.y, thr)) ||
        (canHitFeature(layers, null, 'wall') && pickWallAt(workingDoc, p.x, p.y, thr)) ||
        (canHitFeature(layers, null, 'stroke') && pickStrokeAt(workingDoc, p.x, p.y, thr)) ||
        (canHitFeature(layers, null, 'room') && pickRoomAt(workingDoc, p.x, p.y));
      if (!hitProbe && canEdit) {
        dragRef.current = { mode: 'marquee', start: { x: p.x, y: p.y } };
        setMarqueeLive({ x: p.x, y: p.y, w: 0, h: 0 });
        if (!additive) setSelectedIds([]);
        return;
      }
      const hit = pickObjectAt(workingDoc, p.x, p.y);
      if (hit) {
        if (!canHitFeature(workingDoc.layers, workingDoc.layerLocks, 'object', { forEdit: true })) {
          return;
        }
        selectFeature(hit.id, additive);
        if (canEdit && !additive) {
          startEditBatch();
          dragRef.current = {
            mode: 'move_object',
            id: hit.id,
            ox: hit.x,
            oy: hit.y,
            sx: p.x,
            sy: p.y,
          };
        }
        return;
      }
      // Vertex first (explicit handle), then strokes over containing areas (Codex P1).
      const vtxThreshold = 14 / camRef.current.pixelsPerUnit;
      for (let ri = workingDoc.rooms.length - 1; ri >= 0; ri -= 1) {
        const room = workingDoc.rooms[ri];
        if (room.id === 'w.ocean' || !canEdit) continue;
        if (!canHitFeature(workingDoc.layers, workingDoc.layerLocks, 'room', { forEdit: true })) {
          break;
        }
        const vtx = pickRoomVertexAt(room, p.x, p.y, vtxThreshold);
        if (vtx >= 0) {
          selectFeature(room.id, additive);
          if (!additive) {
            startEditBatch();
            dragRef.current = { mode: 'move_room_vertex', id: room.id, index: vtx };
          }
          return;
        }
      }
      const strokeHit = pickStrokeAt(
        workingDoc,
        p.x,
        p.y,
        12 / camRef.current.pixelsPerUnit,
      );
      if (
        strokeHit &&
        canEdit &&
        canHitFeature(workingDoc.layers, workingDoc.layerLocks, 'stroke', { forEdit: true })
      ) {
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < strokeHit.points.length; i += 1) {
          const d = Math.hypot(strokeHit.points[i][0] - p.x, strokeHit.points[i][1] - p.y);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        selectFeature(strokeHit.id, additive);
        if (!additive) {
          startEditBatch();
          dragRef.current = {
            mode: 'move_stroke_point',
            id: strokeHit.id,
            index: bestIdx,
          };
        }
        return;
      }
      const doorHit = pickDoorAt(workingDoc, p.x, p.y, 12 / camRef.current.pixelsPerUnit);
      if (
        doorHit &&
        canHitFeature(workingDoc.layers, workingDoc.layerLocks, 'door', { forEdit: true })
      ) {
        selectFeature(doorHit.id, additive);
        return;
      }
      const wallHit = pickWallAt(workingDoc, p.x, p.y, 12 / camRef.current.pixelsPerUnit);
      if (
        wallHit &&
        canEdit &&
        canHitFeature(workingDoc.layers, workingDoc.layerLocks, 'wall', { forEdit: true })
      ) {
        const ep = pickWallEndpoint(
          wallHit,
          p.x,
          p.y,
          14 / camRef.current.pixelsPerUnit,
        );
        selectFeature(wallHit.id, additive);
        if (!additive && (ep === 1 || ep === 2)) {
          startEditBatch();
          dragRef.current = { mode: 'move_wall_endpoint', id: wallHit.id, endpoint: ep };
        }
        return;
      }
      const roomHit = pickRoomAt(workingDoc, p.x, p.y);
      if (
        roomHit &&
        roomHit.id !== 'w.ocean' &&
        canEdit &&
        canHitFeature(workingDoc.layers, workingDoc.layerLocks, 'room', { forEdit: true })
      ) {
        selectFeature(roomHit.id, additive);
        if (additive) return;
        // SE corner resize when near bottom-right of AABB room without polygon.
        if (!roomHit.points) {
          const cornerDist = Math.hypot(
            roomHit.x + roomHit.w - p.x,
            roomHit.y + roomHit.h - p.y,
          );
          if (cornerDist <= 14 / camRef.current.pixelsPerUnit) {
            startEditBatch();
            dragRef.current = {
              mode: 'resize_room',
              id: roomHit.id,
              ox: roomHit.x,
              oy: roomHit.y,
              ow: roomHit.w,
              oh: roomHit.h,
              sx: p.x,
              sy: p.y,
            };
            return;
          }
        }
        startEditBatch();
        dragRef.current = {
          mode: 'move_room',
          id: roomHit.id,
          ox: roomHit.x,
          oy: roomHit.y,
          sx: p.x,
          sy: p.y,
        };
        return;
      }
      setSelectedIds([]);
      dragRef.current = { mode: 'pan', px: p.px, py: p.py, cam: camRef.current };
      return;
    }

    if (tool === 'brush' || tool === 'road') {
      if (!canEditFeatureKind(workingDoc, 'stroke')) return;
      const id = uid();
      // Road + wasser material = Fluss; otherwise paved path (ATL2-C01).
      const strokeMaterial =
        tool === 'road'
          ? material === 'wasser'
            ? 'wasser'
            : 'pflaster'
          : material;
      const stroke = {
        id,
        material: strokeMaterial as UnifiedCanvasMaterial,
        width: tool === 'road' ? brushWidth() * 0.62 : brushWidth(),
        points: [[p.x, p.y] as const],
      };
      startEditBatch();
      commit(applyMapEdit(workingDoc, { op: 'add_stroke', stroke }), true);
      dragRef.current = { mode: 'paint', strokeId: id };
      return;
    }

    if (tool === 'room' || tool === 'wall') {
      if (!canEditFeatureKind(workingDoc, tool === 'room' ? 'room' : 'wall')) return;
      const snapT = 12 / camRef.current.pixelsPerUnit;
      const start = snapStructurePoint(workingDoc, [p.x, p.y], snapT);
      dragRef.current = {
        mode: 'shape',
        start: { x: start[0], y: start[1] },
        kind: tool === 'room' ? 'room' : 'wall',
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = worldFromEvent(e);
    setCoords(`X ${p.x.toFixed(1)} · Y ${p.y.toFixed(1)}`);
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === 'pan') {
      camRef.current = atlasPanBy(drag.cam, { x: p.px - drag.px, y: p.py - drag.py });
      refresh();
      return;
    }
    if (drag.mode === 'move_object') {
      const next = applyMapEdit(workingDoc, {
        op: 'move_object',
        id: drag.id,
        x: drag.ox + (p.x - drag.sx),
        y: drag.oy + (p.y - drag.sy),
      });
      onDocChange(next);
      refresh();
      return;
    }
    if (drag.mode === 'move_room') {
      const next = applyMapEdit(workingDoc, {
        op: 'move_room',
        id: drag.id,
        x: drag.ox + (p.x - drag.sx),
        y: drag.oy + (p.y - drag.sy),
      });
      onDocChange(next);
      refresh();
      return;
    }
    if (drag.mode === 'move_room_vertex') {
      const next = applyMapEdit(workingDoc, {
        op: 'move_room_vertex',
        id: drag.id,
        index: drag.index,
        x: p.x,
        y: p.y,
      });
      onDocChange(next);
      refresh();
      return;
    }
    if (drag.mode === 'move_stroke_point') {
      const next = applyMapEdit(workingDoc, {
        op: 'move_stroke_point',
        id: drag.id,
        index: drag.index,
        x: p.x,
        y: p.y,
      });
      onDocChange(next);
      refresh();
      return;
    }
    if (drag.mode === 'move_wall_endpoint') {
      const wall = workingDoc.walls.find((w) => w.id === drag.id);
      if (!wall) return;
      const snapped = snapStructurePoint(
        workingDoc,
        [p.x, p.y],
        12 / camRef.current.pixelsPerUnit,
      );
      const next = applyMapEdit(workingDoc, {
        op: 'move_wall',
        id: drag.id,
        x1: drag.endpoint === 1 ? snapped[0] : wall.x1,
        y1: drag.endpoint === 1 ? snapped[1] : wall.y1,
        x2: drag.endpoint === 2 ? snapped[0] : wall.x2,
        y2: drag.endpoint === 2 ? snapped[1] : wall.y2,
      });
      onDocChange(next);
      refresh();
      return;
    }
    if (drag.mode === 'resize_room') {
      const w = Math.max(0.5, drag.ow + (p.x - drag.sx));
      const h = Math.max(0.5, drag.oh + (p.y - drag.sy));
      const next = applyMapEdit(workingDoc, {
        op: 'resize_room',
        id: drag.id,
        w,
        h,
      });
      onDocChange(next);
      refresh();
      return;
    }
    if (drag.mode === 'paint') {
      const stroke = workingDoc.strokes.find((s) => s.id === drag.strokeId);
      const last = stroke?.points[stroke.points.length - 1];
      if (
        last &&
        (p.x - last[0]) ** 2 + (p.y - last[1]) ** 2 < (2 / camRef.current.pixelsPerUnit) ** 2
      ) {
        return;
      }
      const next = applyMapEdit(workingDoc, {
        op: 'append_stroke_point',
        id: drag.strokeId,
        x: p.x,
        y: p.y,
      });
      onDocChange(next);
      refresh();
      return;
    }
    if (drag.mode === 'height') {
      const next = applyMapEdit(workingDoc, {
        op: 'paint_heightfield',
        stroke: {
          mode: drag.heightMode,
          x: p.x,
          z: p.y,
          radius: Math.max(8, brushWidth() * 1.2),
          strength: drag.heightMode === 'smooth' ? 0.55 : 1.4,
          ...(drag.heightMode === 'flatten' ? { targetHeight: 0 } : {}),
        },
      });
      onDocChange(next);
      refresh();
      return;
    }
    if (drag.mode === 'shape') {
      refresh();
      return;
    }
    if (drag.mode === 'locate' || drag.mode === 'marquee') {
      const x = Math.min(drag.start.x, p.x);
      const y = Math.min(drag.start.y, p.y);
      const w = Math.abs(p.x - drag.start.x);
      const h = Math.abs(p.y - drag.start.y);
      setMarqueeLive({ x, y, w, h });
      refresh();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const p = worldFromEvent(e);
    if (drag?.mode === 'locate') {
      const minX = Math.min(drag.start.x, p.x);
      const minY = Math.min(drag.start.y, p.y);
      const maxX = Math.max(drag.start.x, p.x);
      const maxY = Math.max(drag.start.y, p.y);
      const min = 4 / camRef.current.pixelsPerUnit;
      dragRef.current = null;
      setMarqueeLive(null);
      if (maxX - minX > min && maxY - minY > min) {
        onLocateCommit?.({ minX, minY, maxX, maxY });
      }
      refresh();
      return;
    }
    if (drag?.mode === 'marquee') {
      const x = Math.min(drag.start.x, p.x);
      const y = Math.min(drag.start.y, p.y);
      const w = Math.abs(p.x - drag.start.x);
      const h = Math.abs(p.y - drag.start.y);
      const min = 4 / camRef.current.pixelsPerUnit;
      if (tool === 'select' && !marqueeArmedRef.current) {
        // Multi-select marquee (ATL2-C03) — not place-pin marquee.
        if (w > min && h > min) {
          const hits = featuresInRect(workingDoc, { x, y, w, h }, workingDoc.layers);
          setSelectedIds(hits.map((f) => f.id));
        }
        setMarqueeLive(null);
        dragRef.current = null;
        try {
          stageRef.current?.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        refresh();
        return;
      }
      if (w > min && h > min) {
        setPlacePin({ x: x + w / 2, y: y + h / 2 });
        setMarqueeLive({ x, y, w, h });
      } else {
        setPlacePin({ x: p.x, y: p.y });
        setMarqueeLive(null);
      }
      setMarqueeArmed(false);
      setPinArmed(false);
      setPlaceError(null);
      dragRef.current = null;
      try {
        stageRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      refresh();
      return;
    }
    if (drag?.mode === 'shape') {
      const min = 9 / camRef.current.pixelsPerUnit;
      const snapT = 12 / camRef.current.pixelsPerUnit;
      if (drag.kind === 'room') {
        if (!canEditFeatureKind(workingDoc, 'room')) {
          /* locked — drop shape without commit */
        } else {
          const x = Math.min(drag.start.x, p.x);
          const y = Math.min(drag.start.y, p.y);
          const w = Math.abs(p.x - drag.start.x);
          const h = Math.abs(p.y - drag.start.y);
          if (w > min && h > min) {
            commit(
              applyMapEdit(workingDoc, {
                op: 'add_room',
                room: { id: uid(), x, y, w, h, material },
              }),
              true,
            );
          }
        }
      } else if (canEditFeatureKind(workingDoc, 'wall')) {
        if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > min) {
          const a = snapStructurePoint(workingDoc, [drag.start.x, drag.start.y], snapT);
          const b = snapStructurePoint(workingDoc, [p.x, p.y], snapT);
          commit(
            applyMapEdit(workingDoc, {
              op: 'add_wall',
              wall: {
                id: uid(),
                x1: a[0],
                y1: a[1],
                x2: b[0],
                y2: b[1],
                width: brushWidth() * 0.18,
              },
            }),
            true,
          );
        }
      }
    }
    // Close any open gesture batch (paint / move / resize) as one undo step.
    endEditBatch();
    dragRef.current = null;
    try {
      stageRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    refresh();
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const minPpu = fitRef.current * 0.7;
    const atMinSpan = camRef.current.pixelsPerUnit <= minPpu * 1.02;
    if (
      onHierarchyBack &&
      wheelRequestsHierarchyBack({ deltaY: e.deltaY, atMinSpan })
    ) {
      onHierarchyBack();
      return;
    }
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const next = atlasZoomAt(
      camRef.current,
      { width: viewport.width, height: viewport.height },
      cursor,
      camRef.current.pixelsPerUnit * Math.exp(-e.deltaY * 0.0019),
      minPpu,
      320,
    );
    camRef.current = next;
    refresh();
  };

  const setLayer = (id: UnifiedCanvasLayerId, on: boolean) => {
    commit({ ...workingDoc, layers: { ...workingDoc.layers, [id]: on } }, false);
  };

  const setLayerLocked = (id: UnifiedCanvasLayerId, locked: boolean) => {
    commit(
      {
        ...workingDoc,
        layerLocks: setLayerLock(workingDoc.layerLocks ?? {}, id, locked),
      },
      false,
    );
  };

  const layerLocked = (id: UnifiedCanvasLayerId) =>
    isLayerLocked(workingDoc.layerLocks, id);

  const toolIcons: Record<UnifiedCanvasTool, ComponentType<IconProps>> = {
    hand: Hand,
    select: Cursor,
    brush: PaintBrush,
    height: Mountains,
    area: Polygon,
    road: Path,
    room: Square,
    wall: Wall,
    door: Door,
    stamp: Stamp,
    erase: Eraser,
  };
  const tools = atlasToolsForKind(activeNodeKind ?? null).map((t) => ({
    id: t.id,
    label: t.labelDe,
    Icon: toolIcons[t.id],
  }));

  useEffect(() => {
    if (!isAtlasToolAllowed(tool, activeNodeKind ?? null)) {
      setTool('hand');
      setAreaDraft([]);
      setAreaHint(null);
    }
  }, [activeNodeKind, tool]);

  useEffect(() => {
    if (tool !== 'area') {
      setAreaDraft([]);
      setAreaHint(null);
    }
  }, [tool]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (locateSession && ev.key === 'Escape') {
        setMarqueeLive(null);
        dragRef.current = null;
        onLocateCancel?.();
        refresh();
        return;
      }
      if (tool === 'area' && canEdit && ev.key === 'Escape') {
        setAreaDraft([]);
        setAreaHint(null);
        refresh();
        return;
      }
      if (tool === 'area' && canEdit && ev.key === 'Enter') {
        if (!canEditFeatureKind(docRef.current, 'room')) return;
        const draft = areaDraftRef.current;
        if (draft.length < 3) {
          setAreaHint('Noch mindestens 3 Punkte setzen, dann Enter zum Schließen.');
          return;
        }
        const built = roomFromValidatedPolygon(uid(), material, draft);
        if (built.ok === false) {
          setAreaHint(
            built.reason === 'self_intersecting'
              ? 'Fläche ungültig — selbstschneidende Polygone sind nicht erlaubt.'
              : 'Fläche ungültig — Punkte müssen eine Fläche bilden.',
          );
          return;
        }
        commit(applyMapEdit(docRef.current, { op: 'add_room', room: built.room }), true);
        setAreaDraft([]);
        setAreaHint(null);
        return;
      }
      if (
        !locateSession &&
        tool !== 'area' &&
        onHierarchyBack &&
        parseHierarchyNavKey({
          key: ev.key,
          altKey: ev.altKey,
          metaKey: ev.metaKey,
          ctrlKey: ev.ctrlKey,
        }) === 'back'
      ) {
        const target = ev.target as HTMLElement | null;
        const tag = target?.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target?.isContentEditable
        ) {
          return;
        }
        if (ev.defaultPrevented) return;
        ev.preventDefault();
        onHierarchyBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    tool,
    canEdit,
    material,
    commit,
    refresh,
    locateSession,
    onLocateCancel,
    onHierarchyBack,
  ]);

  const handleDefinePlace = async (req: AtlasDefinePlaceRequest) => {
    if (!onCreatePlace || !canEdit) return;
    if (!placePin) {
      setPlaceError('Zuerst auf der Karte markieren (Pin oder Rahmen).');
      return;
    }
    const anchor = placePin;
    const stampSize = stampSizeForAuthor(req.authorKind, req.settlementPresetId);
    const seedKey = seedKeyForAuthor(req.authorKind, req.settlementPresetId);
    const placeKind = placeKindForAuthor(req.authorKind);
    setPlaceBusy(true);
    setPlaceError(null);
    try {
      await onCreatePlace({
        authorKind: req.authorKind,
        name: req.name,
        settlementPresetId: req.settlementPresetId,
        x: anchor.x,
        y: anchor.y,
        stampSize,
        seedKey,
        placeKind,
      });
      if (canEditFeatureKind(workingDoc, 'object')) {
        commit(
          applyMapEdit(workingDoc, {
            op: 'add_object',
            object: {
              id: uid(),
              type: 'haus',
              x: anchor.x,
              y: anchor.y,
              size: stampSize,
              height: req.authorKind === 'building' ? 1.2 : req.authorKind === 'settlement' ? 2.4 : 0.4,
            },
          }),
          true,
        );
      }
      setPlacePin(null);
      setMarqueeLive(null);
      setPinArmed(false);
      setMarqueeArmed(false);
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : 'Ort konnte nicht angelegt werden.');
    } finally {
      setPlaceBusy(false);
    }
  };

  const isDemo = workingDoc.demoSeed !== false;
  const isWorldStarter = workingDoc.rooms.some((r) => r.id === 'w.ocean');

  const DUNGEON_THEME_LABELS: Record<DungeonThemeKey, string> = {
    ancient: 'Antik',
    molten: 'Magma',
    frost: 'Frost',
    grim: 'Düster',
    verdant: 'Grün',
  };

  const runDungeonGenerate = useCallback(() => {
    setDungeonError(null);
    if (dungeonNeedsReforgeConfirm(dungeonMeta)) {
      if (
        !window.confirm(
          'Dungeon neu generieren? Bestätigte oder manuell geänderte Generator-Geometrie wird erst beim Bestätigen ersetzt — handgezeichnete Räume bleiben.',
        )
      ) {
        return;
      }
    }
    const seedRaw = dungeonSeed.trim();
    if (!/^\d+$/.test(seedRaw)) {
      setDungeonPreview(null);
      setDungeonError('Ungültiger Seed — bitte nur Ziffern eingeben. Karte unverändert.');
      return;
    }
    const seedNum = Number.parseInt(seedRaw, 10);
    if (!Number.isFinite(seedNum)) {
      setDungeonPreview(null);
      setDungeonError('Ungültiger Seed — Karte unverändert.');
      return;
    }
    const result = generateDungeon({
      seed: seedNum,
      roomCount: dungeonRooms,
      loopChance: 0.18,
      themeKey: dungeonTheme,
      originX: CITY_RECT.x + 8,
      originY: CITY_RECT.y + CITY_RECT.height + 4,
      unitScale: 1.1,
    });
    if (!result.valid) {
      setDungeonPreview(null);
      setDungeonError(result.error ?? 'Generierung fehlgeschlagen — Karte unverändert');
      return;
    }
    const raster = rasterizeDungeonGenerateResult(result);
    if (!raster.valid || !raster.passable) {
      setDungeonPreview(null);
      setDungeonError(raster.error ?? 'Rasterisierung fehlgeschlagen — Karte unverändert');
      return;
    }
    const payload = dungeonCommitPayloadFromResults(result, raster);
    if (!payload) {
      setDungeonPreview(null);
      setDungeonError('Vorschau konnte nicht gebaut werden — Karte unverändert');
      return;
    }
    setDungeonPreview({ generate: result, raster, payload });
  }, [dungeonMeta, dungeonRooms, dungeonSeed, dungeonTheme]);

  const cancelDungeonPreview = useCallback(() => {
    setDungeonPreview(null);
    setDungeonError(null);
  }, []);

  const commitDungeonPreview = useCallback(() => {
    if (!dungeonPreview?.payload || !dungeonPreview.generate.valid) return;
    if (
      !window.confirm(
        'Dungeon als editierbare Räume/Wände/Türen übernehmen? Vorherige Generator-Geometrie wird ersetzt; handgezeichnete Features bleiben.',
      )
    ) {
      return;
    }
    const meta = buildDungeonGeneratorMeta(dungeonPreview.generate, true);
    onDungeonMetaChange?.(meta);
    pushHistory(docRef.current);
    const next = commitDungeonFeaturesToDoc(workingDoc, dungeonPreview.payload, true);
    onDocChange(next);
    setDungeonPreview(null);
    setDungeonError(null);
    if (surfaceMode === '2d') {
      goToRect({
        x: CITY_RECT.x + 4,
        y: CITY_RECT.y + CITY_RECT.height,
        width: 48,
        height: 36,
      });
    }
  }, [
    dungeonPreview,
    goToRect,
    onDocChange,
    onDungeonMetaChange,
    pushHistory,
    surfaceMode,
    workingDoc,
  ]);

  const dungeonForgePanel =
    canEdit ? (
      <div className="space-y-2 rounded-md border border-border p-2" data-atlas-dungeon-forge>
        <p className="text-xs font-semibold">Dungeon-Generator</p>
        <p className="text-[11px] text-muted-foreground">
          Seed-basiert (Dungeon Forge MIT). Vorschau ist nicht kanonisch, bis du bestätigst.
        </p>
        <Label htmlFor="atlas-dungeon-seed">Seed</Label>
        <Input
          id="atlas-dungeon-seed"
          className="min-h-11"
          value={dungeonSeed}
          onChange={(e) => setDungeonSeed(e.target.value)}
        />
        <Label htmlFor="atlas-dungeon-theme">Theme</Label>
        <select
          id="atlas-dungeon-theme"
          className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
          value={dungeonTheme}
          onChange={(e) => setDungeonTheme(e.target.value as DungeonThemeKey)}
          aria-label="Dungeon-Theme"
        >
          {(Object.keys(DUNGEON_THEME_LABELS) as DungeonThemeKey[]).map((key) => (
            <option key={key} value={key}>
              {DUNGEON_THEME_LABELS[key]}
            </option>
          ))}
        </select>
        <Label htmlFor="atlas-dungeon-rooms">Räume ({dungeonRooms})</Label>
        <input
          id="atlas-dungeon-rooms"
          type="range"
          className="w-full accent-primary"
          min={8}
          max={40}
          value={dungeonRooms}
          onChange={(e) => setDungeonRooms(Number(e.target.value))}
        />
        {dungeonNeedsReforgeConfirm(dungeonMeta) ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-400" data-atlas-dungeon-dirty>
            Bestätigter/manuell bearbeiteter Dungeon — Reforge ersetzt nur Generator-IDs nach
            Bestätigung.
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full"
          data-atlas-dungeon-generate
          onClick={runDungeonGenerate}
        >
          Generieren
        </Button>
        {dungeonError ? (
          <p className="text-xs text-destructive" role="alert" data-atlas-dungeon-error>
            {dungeonError}
          </p>
        ) : null}
        {dungeonPreview?.payload ? (
          <>
            <p className="text-xs text-muted-foreground" data-atlas-dungeon-preview-stats>
              Vorschau · {dungeonPreview.generate.stats.roomCount} Räume ·{' '}
              {dungeonPreview.raster.doorwayCount} Türen ·{' '}
              {dungeonPreview.generate.stats.genMs.toFixed(1)} ms
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="min-h-11 w-full"
                data-atlas-dungeon-commit
                onClick={commitDungeonPreview}
              >
                Bestätigen & übernehmen
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                data-atlas-dungeon-cancel
                onClick={cancelDungeonPreview}
              >
                Abbrechen
              </Button>
            </div>
          </>
        ) : null}
      </div>
    ) : null;

  /** Always re-project from display doc so 2D deletes + forge preview survive 3D remount. */
  const controlledSeed = useMemo(
    () =>
      syncCanvasDocIntoWebglRuntime(
        webglRuntime ?? legacySeedRef.current ?? emptyWebglRuntime(),
        lodAwareDisplayDoc,
      ),
    [webglRuntime, lodAwareDisplayDoc],
  );

  /** Remount 3D when preview appears/clears so seedState (forge overlay) is applied. */
  const forge3dMapKey = useMemo(() => {
    if (!dungeonPreview?.payload) return mapKey;
    const gen = dungeonPreview.generate;
    return `${mapKey}:forge-preview:${gen.seed}:${dungeonPreview.payload.rooms.length}:${dungeonPreview.raster.doorwayCount}`;
  }, [mapKey, dungeonPreview]);

  const handleWebglPersist = useCallback(
    (state: WebglRuntimeState) => {
      // Preview is non-canonical — never persist forge overlay into the map SoT.
      if (dungeonPreviewRef.current?.payload) return;
      const parsed = parseWebglRuntimeState(state);
      if (!parsed) return;
      webglRuntimeRef.current = parsed;
      onWebglRuntimeChange?.(parsed);
      const synced = syncWebglPropsIntoCanvasDoc(docRef.current, parsed);
      docRef.current = synced;
      // Use raw prop — avoid re-deriving runtime from doc (3D state is already authoritative).
      onDocChangeProp(synced);
    },
    [onDocChangeProp, onWebglRuntimeChange],
  );

  // Product maps: controlled WebGL (#721) — generator_meta is SoT; Draufsicht (2D) optional.
  if (!isDemo && surfaceMode === '3d') {
    return (
      <div
        className="relative flex h-full min-h-0 w-full min-w-0 flex-col pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        data-unified-atlas-editor
        data-atlas-demo="false"
        data-atlas-world-starter={isWorldStarter ? 'true' : undefined}
        data-atlas-proto-exact="true"
        data-atlas-surface-mode="3d"
        data-atlas-surface-class="workstation"
      >
        {canEdit ? (
          // Center-top: right-3 overlaps #tools „Werkzeuge“ fold (Atlas E2E / product journeys).
          <div className="pointer-events-none absolute left-1/2 top-3 z-[3] -translate-x-1/2">
            <Button
              type="button"
              variant="outline"
              className="pointer-events-auto min-h-11 bg-card/95"
              data-atlas-surface-toggle
              aria-label="Zur Draufsicht wechseln"
              onClick={() => setSurfaceMode('2d')}
            >
              Draufsicht
            </Button>
          </div>
        ) : null}
        {canEdit ? (
          <div
            className="pointer-events-none absolute bottom-3 left-3 z-[3] max-h-[min(50vh,28rem)] w-[min(100%-1.5rem,20rem)] overflow-y-auto"
            data-atlas-dungeon-forge-3d
          >
            <div className="pointer-events-auto bg-card/95 shadow-md">{dungeonForgePanel}</div>
          </div>
        ) : null}
        {dungeonPreview?.payload ? (
          <p
            className="pointer-events-none absolute left-1/2 top-16 z-[3] -translate-x-1/2 rounded-md bg-card/95 px-3 py-1 text-xs text-primary"
            data-atlas-dungeon-preview-badge
            role="status"
          >
            Dungeon-Vorschau (nicht gespeichert)
          </p>
        ) : null}
        <AtlasNative3dEditor
          mapKey={forge3dMapKey}
          controlled
          seedState={controlledSeed}
          onPersist={canEdit && !dungeonPreview?.payload ? handleWebglPersist : undefined}
          externalNav={webglNavTree}
          activePlaceId={activePlaceId}
          activeNodeKind={activeNodeKind ?? null}
          canEdit={canEdit}
          mapSketchStatus={mapSketchStatus ?? null}
          mapScale={mapScale}
          mapPins={mapPins}
<<<<<<< ours
          dungeonThemeKey={
            dungeonPreview
              ? dungeonPreview.generate.params.themeKey
              : (dungeonMeta?.themeKey ?? dungeonTheme)
          }
          dungeonLookDoc={forgeDisplayDoc}
=======
          navRestoreView={navRestoreView}
          onNavViewChange={onNavViewChange}
>>>>>>> theirs
          onNavSelect={onWebglNavSelect}
          onNavRename={canEdit ? onWebglNavRename : undefined}
          onNavAdd={canEdit ? onWebglNavAdd : undefined}
          onNavDuplicate={canEdit ? onWebglNavDuplicate : undefined}
          onNavArchive={canEdit ? onWebglNavArchive : undefined}
          onNavReparent={canEdit ? onWebglNavReparent : undefined}
        />
      </div>
    );
  }

  const renderLayersChrome = () => (
    <div className="space-y-3" data-atlas-layers-chrome>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isDemo ? 'Zoom-Stufen · Demo' : 'Orte auf dieser Karte'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {isDemo
              ? 'Eldoria → Dornhain → Kupferlaterne.'
              : 'Klick zoomt zum Ort. Doppelklick auf die Karte zoomt hinein.'}
          </p>
          <nav className="space-y-1" aria-label="Kartenstruktur" data-atlas-zoom-stages>
            {isDemo ? (
              <>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted"
                  onClick={() => goToRect(mapWorldRect)}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-xs">
                    ◎
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">Weltkarte</span>
                </button>
                {ELDORIA_NODES.filter((n) => n.id !== 'world').map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted"
                    onClick={() => goToRect(n.area)}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-xs">
                      {n.id === 'city' ? '⌂' : '◇'}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{n.label}</span>
                  </button>
                ))}
              </>
            ) : mapPins && mapPins.length > 0 ? (
              mapPins.map((pin) => (
                <button
                  key={pin.id}
                  type="button"
                  data-atlas-pin-nav={pin.id}
                  aria-current={pin.id === activePlaceId ? 'true' : undefined}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${
                    pin.id === activePlaceId ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                  onClick={() => focusMapPin(pin.id)}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-xs">
                    {pin.kind === 'place' || pin.kind === 'building' ? '⌂' : pin.kind === 'room' ? '▧' : '◇'}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{pin.label}</span>
                </button>
              ))
            ) : (
              <p className="px-2 text-xs text-muted-foreground">
                Noch keine Orte auf dieser Karte verortet.
              </p>
            )}
          </nav>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ebenen · Sicht · Sperre
          </p>
          <div className="space-y-1" data-atlas-layer-switches>
            {(isDemo ? LAYER_LABELS : ATLAS_PROTOTYPE_LAYER_LABELS).map((l) => {
              const canvasId = (
                isDemo ? l.id : (l as (typeof ATLAS_PROTOTYPE_LAYER_LABELS)[number]).canvasLayer
              ) as UnifiedCanvasLayerId;
              return (
                <div
                  key={l.id}
                  className="flex min-h-11 items-center gap-2 text-sm"
                  data-atlas-layer-row={l.id}
                >
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      data-atlas-layer={l.id}
                      checked={workingDoc.layers[canvasId]}
                      disabled={!canEdit}
                      onChange={(e) => setLayer(canvasId, e.target.checked)}
                      aria-label={`${l.label} sichtbar`}
                    />
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      data-atlas-layer-lock={l.id}
                      checked={layerLocked(canvasId)}
                      disabled={!canEdit}
                      onChange={(e) => setLayerLocked(canvasId, e.target.checked)}
                      aria-label={`${l.label} sperren`}
                    />
                    Sperre
                  </label>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            onClick={() => goToRect(mapWorldRect)}
          >
            {isDemo || mapScale === 'world' ? 'Zur Weltkarte' : 'Ganze Karte zeigen'}
          </Button>
    </div>
  );

  return (
    <div
      className="@container/atlas flex h-full min-h-0 w-full min-w-0 flex-col gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      data-unified-atlas-editor
      data-atlas-demo={isDemo ? 'true' : 'false'}
      data-atlas-world-starter={isWorldStarter ? 'true' : undefined}
      data-atlas-surface-mode={!isDemo ? '2d' : undefined}
      data-atlas-surface-class="workstation"
    >
      <p className="sr-only" role="status" aria-live="polite" data-atlas-history-live>
        {historyLive}
      </p>
      <div
        className="flex flex-wrap items-center gap-2 @[48rem]:hidden"
        data-atlas-interaction-hint
      >
        <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
          {atlasInteractionModeLabelDe('touch')} · Werkzeuge oben rechts.
        </p>
        <Sheet open={layersSheetOpen} onOpenChange={setLayersSheetOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              data-atlas-layers-sheet-trigger
            >
              Ebenen
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[min(100%,20rem)] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader>
              <SheetTitle>Ebenen & Orte</SheetTitle>
            </SheetHeader>
            <div className="mt-4" data-atlas-layers-sheet data-unified-chrome>
              {renderLayersChrome()}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      {!isDemo ? (
        <div className="flex flex-wrap items-center gap-2" data-atlas-surface-bar>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            data-atlas-surface-toggle
            aria-label="Zur 3D-Ansicht wechseln"
            onClick={() => setSurfaceMode('3d')}
          >
            3D-Ansicht
          </Button>
          <p className="text-xs text-muted-foreground">
            Draufsicht — dieselben Objekt-IDs wie in 3D (gespeicherter Edit-Store).
          </p>
          {surfaceActions ? (
            <div className="ml-auto flex flex-wrap items-center gap-2" data-atlas-surface-actions>
              {surfaceActions}
            </div>
          ) : null}
        </div>
      ) : null}
      {isDemo && workingDoc.strokes.length === 0 ? (
        <div
          className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground"
          data-unified-atlas-demo-badge
          role="status"
        >
          Beispielwelt / Demo — Eldoria → Dornhain → Kupferlaterne (nicht kanonisch). Zeichnungen
          speichern überschreibt den Demo-Hinweis.
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-2 @[48rem]:grid-cols-[12rem_minmax(0,1fr)_14rem]">
        <aside
          className="hidden min-h-0 space-y-3 overflow-auto rounded-lg border border-border p-2 @[48rem]:block"
          data-unified-chrome
        >
          {renderLayersChrome()}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 text-sm">
            <div className="min-w-0 truncate text-muted-foreground">
              {isDemo ? 'Eldoria' : 'Welt'} ›{' '}
              <strong className="text-foreground">{crumb}</strong>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-primary"
                data-atlas-level={level}
              >
                {level}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground" data-atlas-zoom-pct>
                {zoomPct}
              </span>
            </div>
          </div>
          <div
            ref={stageRef}
            className={`relative min-h-[min(70vh,40rem)] flex-1 touch-none overflow-hidden rounded-lg border border-border bg-[#10212a] ${
              locateSession || pinArmed || marqueeArmed ? 'cursor-crosshair' : ''
            }`}
            data-unified-atlas-viewport
            data-tool={
              locateSession ? 'locate' : pinArmed ? 'pin' : marqueeArmed ? 'marquee' : tool
            }
            data-atlas-locate-mode={locateSession ? 'true' : undefined}
            data-view-mode="2d"
            data-pin-armed={pinArmed ? 'true' : undefined}
            data-marquee-armed={marqueeArmed ? 'true' : undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={(e) => {
              // Interrupted gestures restore batchBase instead of committing a partial edit.
              abortEditBatch();
              dragRef.current = null;
              setMarqueeLive(null);
              try {
                stageRef.current?.releasePointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
              refresh();
            }}
            onWheel={onWheel}
            onDoubleClick={(e) => {
              const p = worldFromEvent(e);
              if (!isDemo) {
                // Like 3D: drawing tools keep double-click for themselves.
                if (tool !== 'hand' && tool !== 'select') return;
                camRef.current = atlasZoomAt(
                  camRef.current,
                  viewport,
                  { x: p.px, y: p.py },
                  camRef.current.pixelsPerUnit * 2,
                  fitRef.current * 0.7,
                  320,
                );
                refresh();
                return;
              }
              if (placeNav.length > 0) {
                const hits = placeNav
                  .filter(
                    (n) =>
                      n.located &&
                      p.x >= n.focusRect.x &&
                      p.x <= n.focusRect.x + n.focusRect.width &&
                      p.y >= n.focusRect.y &&
                      p.y <= n.focusRect.y + n.focusRect.height,
                  )
                  .sort((a, b) => a.focusRect.width - b.focusRect.width);
                if (hits[0]) {
                  goToRect(hits[0].focusRect);
                  return;
                }
                goToRect(mapWorldRect);
                return;
              }
              const dest = pointInRect(p, INN_RECT)
                ? ELDORIA_NODES[5].area
                : pointInRect(p, CITY_RECT)
                  ? INN_RECT
                  : pointInRect(p, REGION_RECT)
                    ? CITY_RECT
                    : pointInRect(p, NORTH_RECT)
                      ? REGION_RECT
                      : NORTH_RECT;
              goToRect(dest);
            }}
          >
            <canvas ref={canvasRef} className="block h-full w-full" aria-label="Interaktive Weltkarte" />
            {canvasLeftRail}
            {!isDemo
              ? pinScreen.map((pin) => (
                  <button
                    key={pin.id}
                    type="button"
                    className={`absolute z-[5] min-h-11 -translate-x-1/2 -translate-y-full rounded-md border px-2.5 text-sm font-semibold shadow ${
                      pin.selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card/90 text-foreground hover:border-accent'
                    }`}
                    style={{ left: pin.left, top: pin.top }}
                    data-atlas-map-pin={pin.id}
                    data-unified-chrome
                    aria-label={`${pin.label} öffnen`}
                    aria-pressed={pin.selected}
                    onClick={() => focusMapPin(pin.id)}
                  >
                    {pin.label}
                  </button>
                ))
              : null}
            {(level === 'INNENRAUM' || level === 'GEBÄUDE') && workingDoc.rooms.length === 0 ? (
              <div
                className="pointer-events-none absolute inset-x-4 top-16 z-[3] rounded-lg border border-border bg-card/95 p-3 text-sm shadow"
                data-atlas-missing-detail
                role="status"
              >
                Für diesen Ort ist noch keine Detailkarte festgelegt. Zoomen endet hier absichtlich ohne
                erfundene Innenraum-Kunst (Imagination-First). Als GM kannst du Räume, Wände oder den
                Dungeon-Generator nutzen.
              </div>
            ) : null}
            <div
              className="absolute right-3 top-3 z-[2] flex max-h-[min(75%,32rem)] flex-col gap-1 overflow-hidden rounded-lg border border-border bg-card/95 p-1 shadow"
              data-unified-chrome
              data-atlas-tool-rail
              data-atlas-tools-expanded={toolsExpanded ? 'true' : 'false'}
              role="toolbar"
              aria-label="Kartenwerkzeuge"
            >
              <button
                type="button"
                className="flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md hover:bg-muted"
                aria-expanded={toolsExpanded}
                aria-controls="atlas-tool-rail-list"
                data-atlas-tools-toggle
                title={toolsExpanded ? 'Werkzeuge einklappen' : 'Werkzeuge ausklappen'}
                onClick={() => setToolsExpanded((v) => !v)}
              >
                <Wrench className="size-4" aria-hidden />
                <CaretDown
                  className={`size-3.5 text-muted-foreground transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                    toolsExpanded ? 'rotate-180' : 'rotate-0'
                  }`}
                  aria-hidden
                />
                <span className="sr-only">
                  {toolsExpanded ? 'Werkzeugleiste einklappen' : 'Werkzeugleiste ausklappen'}
                </span>
              </button>
              <div
                id="atlas-tool-rail-list"
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none ${
                  toolsExpanded
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'pointer-events-none grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div
                    className={`flex flex-col gap-1 border-t border-border pt-1 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                      toolsExpanded ? 'translate-y-0' : '-translate-y-1'
                    }`}
                  >
                    {tools.map((t) => {
                      const Icon = t.Icon;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          tabIndex={toolsExpanded ? 0 : -1}
                          disabled={!canEdit && t.id !== 'hand'}
                          className={`flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[10px] font-semibold ${
                            tool === t.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          }`}
                          aria-label={t.label}
                          aria-pressed={tool === t.id}
                          title={t.label}
                          onClick={() => setTool(t.id)}
                        >
                          <Icon className="size-4" aria-hidden />
                          <span className="leading-none">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 z-[2] rounded border border-border bg-card/90 px-2 py-1 text-[10px] text-muted-foreground">
              Mausrad: zoomen · Ziehen: verschieben
            </div>
            <div
              className="absolute bottom-3 left-1/2 z-[2] flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-card/95 p-1"
              data-unified-chrome
              data-atlas-zoom-rail
            >
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 min-w-11"
                aria-label="Verkleinern"
                onClick={() => {
                  camRef.current = atlasZoomAt(
                    camRef.current,
                    viewport,
                    { x: viewport.width / 2, y: viewport.height / 2 },
                    camRef.current.pixelsPerUnit / 1.5,
                    fitRef.current * 0.7,
                    320,
                  );
                  refresh();
                }}
              >
                −
              </Button>
              <span className="min-w-[3rem] text-center font-mono text-xs">{zoomPct}</span>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 min-w-11"
                aria-label="Vergrößern"
                onClick={() => {
                  camRef.current = atlasZoomAt(
                    camRef.current,
                    viewport,
                    { x: viewport.width / 2, y: viewport.height / 2 },
                    camRef.current.pixelsPerUnit * 1.5,
                    fitRef.current * 0.7,
                    320,
                  );
                  refresh();
                }}
              >
                +
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 min-w-11"
                aria-label="Welt zeigen"
                onClick={() => goToRect(mapWorldRect)}
              >
                ⌗
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
            <span>{coords}</span>
            <span>
              Eine Kamera · <strong className="text-foreground">Welt → Land → Stadt → Innenraum</strong>
            </span>
          </div>
        </section>

        <aside className="min-h-0 space-y-3 overflow-auto rounded-lg border border-border p-3" data-unified-chrome>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Kartenwerkzeuge
          </p>
          <h2 className="font-heading text-xl font-bold">
            {tool === 'stamp'
              ? 'Objekte'
              : tool === 'area'
                ? 'Fläche zeichnen'
                : tool === 'height'
                  ? 'Höhenpinsel'
                : tool === 'brush' || tool === 'road'
                  ? 'Welt gestalten'
                  : tool === 'room' || tool === 'wall' || tool === 'door'
                    ? 'Raum / Wand / Tür'
                    : selectedId
                      ? 'Auswahl'
                      : 'Weltkarte'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {locateSession
              ? `Ziehe den Ausschnitt für „${locateSession.childTitle}“ auf dieser Elternkarte. Escape bricht ab.`
              : tool === 'area'
                ? 'Klick setzt Küstenpunkte. Doppelklick oder Enter schließt die Fläche. Escape bricht ab.'
                : tool === 'height'
                  ? 'Ziehen hebt Gelände. Shift = absenken, Alt = glätten, Ctrl/Cmd = einebnen. Radierer löscht das Höhenfeld.'
                : tool === 'door'
                  ? 'Klick auf eine Wand setzt eine Türöffnung. Kein WorldNode wird erzeugt.'
                  : tool === 'room' || tool === 'wall'
                    ? 'Raum ziehen oder Wand-Endpunkte setzen (snappen). Geometrie ≠ WorldNode.'
                    : 'Mausrad = zoomen. Land/Wasser mit Pinsel oder Fläche; Orte per Pin oder Rahmen anlegen.'}
          </p>
          {locateSession ? (
            <div
              className="flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5 text-xs text-foreground"
              data-atlas-locate-session
              role="status"
            >
              <span className="min-w-0 flex-1">
                Verorten: Rechteck ziehen für „{locateSession.childTitle}“.
              </span>
              {onLocateCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  data-atlas-locate-cancel
                  onClick={() => {
                    setMarqueeLive(null);
                    dragRef.current = null;
                    onLocateCancel();
                  }}
                >
                  Abbrechen
                </Button>
              ) : null}
            </div>
          ) : null}
          {areaHint ? (
            <p className="text-xs text-primary" data-atlas-area-hint role="status">
              {areaHint}
            </p>
          ) : null}
          {canEdit && onCreatePlace ? (
            <AtlasDefinePlacePanel
              busy={placeBusy}
              error={placeError}
              pin={placePin}
              pinArmed={pinArmed}
              marqueeActive={marqueeArmed}
              onArmPin={() => {
                setPinArmed(true);
                setMarqueeArmed(false);
                setPlaceError(null);
              }}
              onArmMarquee={() => {
                setMarqueeArmed(true);
                setPinArmed(false);
                setPlaceError(null);
              }}
              onClearPin={() => {
                setPlacePin(null);
                setMarqueeLive(null);
                setPinArmed(false);
                setMarqueeArmed(false);
              }}
              onCreate={handleDefinePlace}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={!canEdit || !canAtlasUndo(editHistory)}
              onClick={undo}
              data-atlas-undo
            >
              ↶ Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={!canEdit || !canAtlasRedo(editHistory)}
              onClick={redo}
              data-atlas-redo
            >
              ↷ Redo
            </Button>
            {selectedId && canEdit ? (
              <Button
                type="button"
                variant="destructive"
                className="min-h-11"
                onClick={() => {
                  const kind = featureKindForId(workingDoc, selectedId);
                  if (!kind || !canEditFeatureKind(workingDoc, kind)) return;
                  const isRoom = kind === 'room';
                  const isStroke = kind === 'stroke';
                  const isWall = kind === 'wall';
                  const isDoor = kind === 'door';
                  commit(
                    applyMapEdit(workingDoc, {
                      op: isRoom
                        ? 'remove_room'
                        : isStroke
                          ? 'remove_stroke'
                          : isWall
                            ? 'remove_wall'
                            : isDoor
                              ? 'remove_door'
                              : 'remove_object',
                      id: selectedId,
                    }),
                    true,
                  );
                  setSelectedId(null);
                }}
              >
                Löschen
              </Button>
            ) : null}
            {selectedId &&
            canEdit &&
            canEditFeatureKind(workingDoc, 'room') &&
            workingDoc.rooms.some((r) => r.id === selectedId && r.id !== 'w.ocean') ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  if (!canEditFeatureKind(workingDoc, 'room')) return;
                  commit(
                    applyMapEdit(workingDoc, {
                      op: 'rotate_room',
                      id: selectedId,
                      angleRad: Math.PI / 2,
                    }),
                    true,
                  );
                }}
              >
                Raum drehen 90°
              </Button>
            ) : null}
            {selectedId &&
            canEdit &&
            canEditFeatureKind(workingDoc, 'object') &&
            workingDoc.objects.some((o) => o.id === selectedId) ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  if (!canEditFeatureKind(workingDoc, 'object')) return;
                  const obj = workingDoc.objects.find((o) => o.id === selectedId);
                  if (!obj) return;
                  commit(
                    applyMapEdit(workingDoc, {
                      op: 'transform_object',
                      id: selectedId,
                      patch: { angle: (obj.angle ?? 0) + 90 },
                    }),
                    true,
                  );
                }}
              >
                Footprint drehen 90°
              </Button>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Raum-/Wand-/Tür-Geometrie ist Kartenzeichnung — kein automatischer WorldNode.
          </p>
          <div
            className="rounded-md border border-border p-2 text-xs"
            data-atlas-selection-inspector
            role="status"
          >
            <p className="font-semibold">Auswahl</p>
            <p className="text-muted-foreground">
              {selectedIds.length === 0
                ? 'Nichts ausgewählt. Shift+Klick addiert; Rahmen zieht Mehrfachauswahl.'
                : `${selectedIds.length} Objekt(e) · Shift+Klick toggelt.`}
            </p>
            {selectedIds.length > 1 && canEdit ? (
              <Button
                type="button"
                variant="outline"
                className="mt-2 min-h-11 w-full"
                onClick={() => {
                  commit(translateSelected(workingDoc, selectedIds, 1, 0), true);
                }}
              >
                Gruppe +1 X
              </Button>
            ) : null}
          </div>
          {dungeonForgePanel}
          <p className="text-xs font-semibold">Textur</p>
          <div className="grid grid-cols-3 gap-1">
            {(Object.keys(MATERIAL_COLORS) as UnifiedCanvasMaterial[]).map((id) => (
              <button
                key={id}
                type="button"
                disabled={!canEdit}
                className={`flex min-h-11 flex-col items-center rounded-md border px-1 text-[10px] ${
                  material === id ? 'border-primary bg-primary/15' : 'border-border'
                }`}
                onClick={() => {
                  setMaterial(id);
                  if (tool !== 'area' && tool !== 'room' && tool !== 'road') setTool('brush');
                }}
              >
                <span
                  className="mb-1 block h-5 w-8 rounded border border-border"
                  style={{ background: MATERIAL_COLORS[id] }}
                />
                {id}
              </button>
            ))}
          </div>
          <label className="block text-xs font-semibold">
            Pinselgröße {brushSize}
            <input
              type="range"
              className="mt-1 w-full accent-primary"
              min={8}
              max={120}
              value={brushSize}
              disabled={!canEdit}
              onChange={(e) => setBrushSize(clampAtlasBrushUi(Number(e.target.value)))}
            />
          </label>
          <p className="text-xs font-semibold">Stempel</p>
          <div className="grid grid-cols-3 gap-1">
            {STAMP_CATALOG.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={!canEdit}
                className={`flex min-h-[3.5rem] flex-col items-center justify-center rounded-md border text-[10px] ${
                  stamp === s.id ? 'border-primary bg-primary/15' : 'border-border'
                }`}
                onClick={() => {
                  setStamp(s.id);
                  setTool('stamp');
                }}
              >
                <span className="text-lg">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
          <label className="block text-xs font-semibold">
            Objektgröße {Math.round(objectSize * 100)}%
            <input
              type="range"
              className="mt-1 w-full accent-primary"
              min={40}
              max={210}
              step={10}
              value={Math.round(objectSize * 100)}
              disabled={!canEdit}
              onChange={(e) => setObjectSize(Number(e.target.value) / 100)}
            />
          </label>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Striche</span>
            <strong>{workingDoc.strokes.length}</strong>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Objekte</span>
            <strong>{workingDoc.objects.length}</strong>
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              onClick={() => {
                if (!window.confirm('Eigene Zeichnungen, Räume und Wände löschen?')) return;
                commit(
                  {
                    ...emptyUnifiedCanvasDoc(true),
                    objects: demoSeedObjects(),
                    layers: workingDoc.layers,
                  },
                  true,
                );
              }}
            >
              Edits löschen
            </Button>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
