/**
 * AtlasThreeWorkstation — Unified SagaTree React/Radix Three.js 3D Workstation.
 * Location: src/app/world/atlas/unified/AtlasThreeWorkstation.tsx
 *
 * Replaces the legacy vanilla-DOM prototype overlay with a clean SagaTree-native
 * workstation over `AtlasThreeRuntime` (ADR-ST-11 / ATL3 R04 / ATL4 A01-B02):
 *  - Left collapsible rail: Ebenen (persisted WorldNode hierarchy + layer visibility)
 *  - Center stage: Three.js PBR + PCFSoftShadow + GLSL water + instanced scatter
 *    with Diorama / Satellit (ortho) / Perspektive cameras, Day/Evening/Night
 *    lighting, Roof Cutaway, 3D Gizmos (W/E/T), terrain sculpt, biome paint,
 *    direct stamp placement, projected Place Pins, and continuous zoom transitions
 *  - Right collapsible rail: Werkzeuge + Feature-Inspektor + Dungeon-Generator slot
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import {
  ArrowsOutCardinal,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowUUpLeft,
  CaretRight,
  Compass,
  Copy,
  Cube,
  Cursor,
  Eraser,
  Eye,
  EyeSlash,
  GlobeHemisphereWest,
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
  formatAtlasSpanLabelDe,
  resolveContinuousZoomTransition,
  type AtlasBiomeBrushId,
  type AtlasGraphicsPresetId,
  type AtlasMapPin,
  type AtlasMapScale,
  type AtlasTerrainSculptMode,
  type UnifiedCanvasDoc,
  type UnifiedCanvasLayerId,
  type UnifiedCanvasStampType,
} from '../../../../domains/world/atlas';
import type { AtlasWebglNavNode, AtlasWebglNavTree } from '../../../../domains/world/places';
import {
  AtlasThreeRuntime,
  defaultAtlasThreePitch,
  type AtlasThreeCameraMode,
  type AtlasThreeCameraView,
  type AtlasThreeLightingMode,
  type AtlasThreeProjectedPin,
} from '../../../../infrastructure/world/atlas-three';
import { Button } from '../../../../shared/ui/button';
import { Input } from '../../../../shared/ui/input';
import type { AtlasNativeNavSelectPayload } from './AtlasNative3dEditor';

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
  readonly toolsSlot?: ReactNode;
  readonly topBarExtra?: ReactNode;
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
  onNavSelect,
  onNavAdd,
  onNavViewChange,
  onHierarchyBack,
  onWebglMountError,
  toolsSlot = null,
  topBarExtra = null,
}: AtlasThreeWorkstationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<AtlasThreeRuntime | null>(null);
  const dragRef = useRef<DragSession | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const onCommitDocRef = useRef(onCommitDoc);
  onCommitDocRef.current = onCommitDoc;
  const onNavViewChangeRef = useRef(onNavViewChange);
  onNavViewChangeRef.current = onNavViewChange;
  const onWebglMountErrorRef = useRef(onWebglMountError);
  onWebglMountErrorRef.current = onWebglMountError;

  const [layersOpen, setLayersOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [tool, setTool] = useState<AtlasThreeToolId>('hand');
  // Always open in dramatic 3D Diorama oblique perspective (user can switch to Satellit/Perspektive anytime).
  const [cameraMode, setCameraMode] = useState<AtlasThreeCameraMode>('diorama-oblique');
  const [lightingMode, setLightingMode] = useState<AtlasThreeLightingMode>('day');
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
  const [hudCoords, setHudCoords] = useState('X 500 · Z 500');
  const [hudSpan, setHudSpan] = useState(mapScale === 'world' ? 470 : 320);
  const [ready, setReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [zoomPrompt, setZoomPrompt] = useState<
    | { readonly kind: 'enter'; readonly pin: AtlasMapPin }
    | { readonly kind: 'exit' }
    | null
  >(null);

  const look: 'outdoor' | 'indoor' = mapScale === 'interior' ? 'indoor' : 'outdoor';
  const activeTool: AtlasThreeToolId = canEdit ? tool : 'hand';
  const mapIdByPlaceId = useMemo(
    () => new Map((externalNav?.nodes ?? []).map((n) => [n.id, n.primaryMapId] as const)),
    [externalNav],
  );

  // Mount Three.js runtime once per canvas lifetime (preset updates in-place).
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
          onNavViewChangeRef.current?.({
            centerX: v.x,
            centerY: v.z,
            span: v.span,
            mode: v.mode,
          });
        },
        onProjectedPins: (pins) => setProjectedPins(pins),
        onContextLostChange: (lost) => setContextLost(lost),
      });
      runtimeRef.current = rt;
      setReady(true);
      onWebglMountErrorRef.current?.(null);

      // Expose lightweight read/camera bridge compatible with Atlas E2E inspection.
      const win = window as Window & {
        __sagatreeAtlas?: {
          getState: () => {
            mode: 'webgl';
            renderer: 'three-js';
            camera: AtlasThreeCameraView;
            rooms: number;
            calls: number;
            triangles: number;
            ids: string[];
          };
          setCameraMode: (m: AtlasThreeCameraMode) => void;
          setYaw: (rad: number) => void;
        };
      };
      win.__sagatreeAtlas = {
        getState: () => {
          const stats = rt?.getStats() ?? { calls: 0, triangles: 0, rooms: 0 };
          return {
            mode: 'webgl',
            renderer: 'three-js',
            camera: rt?.getView() ?? {
              mode: 'diorama-oblique',
              x: 500,
              z: 500,
              span: 470,
              yawRad: 0.35,
              pitchRad: 1.02,
            },
            rooms: stats.rooms,
            calls: stats.calls,
            triangles: stats.triangles,
            ids: rt?.getRenderedIds() ?? [],
          };
        },
        setCameraMode: (m) => {
          setCameraMode(m);
          rt?.setView({ mode: m, pitchRad: defaultAtlasThreePitch(m) }, false);
        },
        setYaw: (rad) => {
          rt?.setView({ yawRad: rad }, false);
        },
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

  // Apply graphics preset changes cleanly without tearing down WebGL context.
  useEffect(() => {
    runtimeRef.current?.applyQualityProfile(graphicsPresetId);
  }, [graphicsPresetId]);

  // Reset / restore camera whenever the active map changes — always frame nicely in 3D Diorama.
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    setSelectedId(null);
    setZoomPrompt(null);
    const defaultSpan = mapScale === 'world' ? 430 : mapScale === 'settlement' ? 195 : 220;
    const defaultX = mapScale === 'settlement' ? 370 : 500;
    const defaultZ = mapScale === 'settlement' ? 485 : 500;
    if (navRestoreView && navRestoreView.span < 900) {
      const targetMode: AtlasThreeCameraMode =
        navRestoreView.mode === 'perspective' ? 'perspective' : 'diorama-oblique';
      setCameraMode(targetMode);
      rt.setView(
        {
          mode: targetMode,
          x: navRestoreView.centerX,
          z: navRestoreView.centerY,
          span: Math.min(navRestoreView.span, defaultSpan * 1.35),
          yawRad: 0.42,
          pitchRad: defaultAtlasThreePitch(targetMode),
        },
        false,
      );
      return;
    }
    setCameraMode('diorama-oblique');
    rt.setView(
      {
        mode: 'diorama-oblique',
        x: defaultX,
        z: defaultZ,
        span: defaultSpan,
        yawRad: 0.42,
        pitchRad: defaultAtlasThreePitch('diorama-oblique'),
      },
      false,
    );
  }, [mapKey, mapScale]);

  // Push live canonical document + pins + selection into Three.js runtime.
  useEffect(() => {
    runtimeRef.current?.setSceneState({
      doc,
      mapScale,
      look,
      seed: mapKey,
      hideRoofs,
      lightingMode,
      pins: mapPins,
      selectedId,
      gizmoVisible:
        canEdit &&
        Boolean(selectedId) &&
        (activeTool === 'select' || activeTool === 'move' || activeTool === 'rotate' || activeTool === 'scale'),
    });
  }, [doc, mapScale, look, mapKey, hideRoofs, lightingMode, mapPins, selectedId, canEdit, activeTool]);

  // Keyboard shortcuts (V17 / ATL4-A01: W=Move, E=Rotate, T=Scale, Q=Hand/Orbit, Del=Delete, Cmd/Ctrl+Z=Undo).
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
      if (!canEdit) return;
      const k = ev.key.toLowerCase();
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

  const switchCameraMode = useCallback((mode: AtlasThreeCameraMode) => {
    setCameraMode(mode);
    runtimeRef.current?.setView(
      {
        mode,
        yawRad: mode === 'ortho-topdown' ? 0 : 0.35,
        pitchRad: defaultAtlasThreePitch(mode),
      },
      true,
    );
  }, []);

  const zoomByFactor = useCallback((factor: number) => {
    const rt = runtimeRef.current;
    if (!rt) return;
    const cur = rt.getView();
    rt.setView({ span: clamp(cur.span * factor, 35, 1100) }, true);
  }, []);

  const hasParentMap = Boolean(activePlaceId && activePlaceId !== externalNav?.worldId);

  const handleWheel = useCallback(
    (ev: ReactWheelEvent<HTMLCanvasElement>) => {
      ev.preventDefault();
      const rt = runtimeRef.current;
      const canvas = canvasRef.current;
      if (!rt || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const before = rt.screenToGround(px, py);
      const cur = rt.getView();
      const factor = Math.exp(ev.deltaY * 0.0014);
      const nextSpan = clamp(cur.span * factor, 35, 1100);
      rt.setView({ span: nextSpan }, false);
      if (before) {
        const after = rt.screenToGround(px, py);
        if (after) {
          rt.setView({ x: cur.x + (before.x - after.x), z: cur.z + (before.z - after.z) }, false);
        }
      }
      const updated = rt.getView();
      const transition = resolveContinuousZoomTransition({
        centerX: updated.x,
        centerY: updated.z,
        span: updated.span,
        wheelDeltaY: ev.deltaY,
        hasParentMap,
        pins: mapPins,
        mapScale,
      });
      if (transition.kind === 'enter-child') {
        setZoomPrompt({ kind: 'enter', pin: transition.pin });
      } else if (transition.kind === 'exit-parent') {
        setZoomPrompt({ kind: 'exit' });
      } else {
        setZoomPrompt(null);
      }
    },
    [hasParentMap, mapPins, mapScale],
  );

  const handlePointerDown = useCallback(
    (ev: ReactPointerEvent<HTMLCanvasElement>) => {
      const rt = runtimeRef.current;
      const canvas = canvasRef.current;
      if (!rt || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const cur = rt.getView();

      // Right-click or Alt+drag always orbits the 3D camera cleanly.
      if (ev.button === 2 || ev.altKey) {
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
        const op: AtlasTerrainSculptMode = ev.shiftKey ? 'lower' : sculptMode;
        const next = applyAtlasTerrainSculptDab(docRef.current, {
          x: ground.x,
          y: ground.z,
          radius: sculptRadius,
          strength: sculptStrength,
          op,
        });
        onCommitDocRef.current(next, true);
        dragRef.current = { kind: 'height' };
        canvas.setPointerCapture(ev.pointerId);
        return;
      }

      if (activeTool === 'biome' && canEdit) {
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
        onCommitDocRef.current(next, true);
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

      // Select / Move / Rotate / Scale canonical objects directly in 3D!
      if (picked) {
        const obj = docRef.current.objects.find((o) => o.id === picked);
        setSelectedId(picked);
        if (obj && canEdit) {
          if (activeTool === 'rotate') {
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
        setHudCoords(`X ${Math.round(ground.x)} · Z ${Math.round(ground.z)}`);
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
    if (drag.kind === 'move-object' || drag.kind === 'rotate-object' || drag.kind === 'scale-object') {
      onCommitDocRef.current(docRef.current, true);
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
    return childIds.map((cid) => {
      const node = byId.get(cid);
      if (!node) return null;
      const active = activePlaceId === node.id;
      const addSpec = NEXT_CHILD_KIND[node.kind];
      return (
        <div key={node.id} className="space-y-0.5">
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 10}px` }}>
            <button
              type="button"
              data-atlas-nav-node={node.id}
              aria-current={active ? 'true' : undefined}
              className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md border px-2 text-left text-xs transition-colors ${
                active
                  ? 'border-primary bg-primary text-primary-foreground font-semibold'
                  : 'border-transparent text-foreground hover:border-accent hover:bg-muted/70'
              }`}
              onClick={() =>
                onNavSelect?.({
                  placeId: node.id,
                  mapId: node.primaryMapId,
                  worldRoot: false,
                })
              }
            >
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">
                <span className="block truncate">{node.label}</span>
                <span
                  className={`block truncate text-[10px] ${
                    active ? 'text-primary-foreground/80' : 'text-muted-foreground'
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
          {renderNavBranch(node.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[#10252f]"
      data-atlas-three-workstation
      data-atlas-ready={ready ? 'true' : undefined}
      data-atlas-surface-ready={ready ? 'true' : undefined}
      data-atlas-chrome-ready={ready ? 'true' : undefined}
    >
      {/* Top Workstation Control Strip — clean SagaTree bar, zero canvas overlap */}
      <div
        className="z-[5] flex flex-wrap items-center gap-1.5 border-b border-border bg-card/95 px-2.5 py-1.5 backdrop-blur"
        data-atlas-workstation-topbar
      >
        <Button
          type="button"
          variant={layersOpen ? 'default' : 'outline'}
          size="sm"
          className="min-h-10 gap-1.5"
          data-atlas-panel-fold="layers"
          aria-expanded={layersOpen}
          onClick={() => setLayersOpen((v) => !v)}
        >
          <Stack className="size-4" aria-hidden />
          <span>Ebenen</span>
        </Button>

        {hasParentMap && onHierarchyBack ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 gap-1"
            onClick={onHierarchyBack}
          >
            <ArrowUUpLeft className="size-4" aria-hidden />
            <span>Hoch</span>
          </Button>
        ) : null}

        {/* Camera modes: Diorama / Satellit (ATL3-C01) / Perspektive */}
        <div
          className="flex items-center rounded-md border border-border bg-background/70 p-0.5"
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
              className={`min-h-9 rounded px-2.5 text-xs font-semibold transition-colors ${
                cameraMode === m.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-accent'
              }`}
              onClick={() => switchCameraMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Lighting / Time of Day */}
        {look === 'outdoor' ? (
          <div
            className="flex items-center rounded-md border border-border bg-background/70 p-0.5"
            role="group"
            aria-label="Lichtstimmung"
          >
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
                title={label}
                className={`flex min-h-9 items-center gap-1 rounded px-2 text-xs font-medium transition-colors ${
                  lightingMode === id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-accent'
                }`}
                onClick={() => setLightingMode(id)}
              >
                <Icon className="size-3.5" aria-hidden />
                <span className="hidden xl:inline">{label}</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* Roof Cutaway (ATL4-I01) */}
        <Button
          type="button"
          variant={hideRoofs ? 'default' : 'outline'}
          size="sm"
          className="min-h-10 gap-1"
          aria-pressed={hideRoofs}
          title="Dächer ausblenden / Innenräume zeigen"
          onClick={() => setHideRoofs((v) => !v)}
        >
          {hideRoofs ? <EyeSlash className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          <span className="hidden lg:inline">{hideRoofs ? 'Innenraum' : 'Dächer'}</span>
        </Button>

        {topBarExtra}

        <div className="ml-auto flex items-center gap-1.5">
          {canEdit ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 min-w-10 px-2"
                disabled={!canUndo}
                title="Rückgängig (⌘Z)"
                aria-label="Rückgängig"
                onClick={onUndo}
              >
                <ArrowCounterClockwise className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 min-w-10 px-2"
                disabled={!canRedo}
                title="Wiederholen (⇧⌘Z)"
                aria-label="Wiederholen"
                onClick={onRedo}
              >
                <ArrowClockwise className="size-4" aria-hidden />
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant={toolsOpen ? 'default' : 'outline'}
            size="sm"
            className="min-h-10 gap-1.5"
            data-atlas-panel-fold="tools"
            aria-expanded={toolsOpen}
            onClick={() => setToolsOpen((v) => !v)}
          >
            <Wrench className="size-4" aria-hidden />
            <span>Werkzeuge</span>
          </Button>
        </div>
      </div>

      {/* Main 3-Pane Workstation Body — Sidebars dock cleanly without colliding! */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Left Rail: Ebenen (Hierarchy + Layer Visibility) — docked cleanly in flex, never overlapping! */}
        {layersOpen ? (
          <aside
            data-atlas-three-layers
            className="z-[4] flex w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-card/95 backdrop-blur"
            aria-label="Welthierarchie und Ebenen"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Welthierarchie
              </span>
              {canEdit && onNavAdd && externalNav ? (
                <button
                  type="button"
                  className="flex min-h-8 min-w-8 items-center justify-center rounded border border-border text-muted-foreground hover:border-accent hover:text-accent"
                  title="Neuen Kontinent anlegen"
                  aria-label="Neuen Kontinent anlegen"
                  onClick={() => onNavAdd({ uiKind: 'kontinent', parentId: externalNav.worldId })}
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {externalNav ? (
                <div className="space-y-1">
                  <button
                    type="button"
                    data-atlas-nav-root
                    aria-current={!activePlaceId || activePlaceId === externalNav.worldId ? 'true' : undefined}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-md border px-2 text-left text-xs transition-colors ${
                      !activePlaceId || activePlaceId === externalNav.worldId
                        ? 'border-primary bg-primary text-primary-foreground font-semibold'
                        : 'border-transparent text-foreground hover:border-accent hover:bg-muted/70'
                    }`}
                    onClick={() =>
                      onNavSelect?.({
                        placeId: null,
                        mapId: externalNav.worldPrimaryMapId,
                        worldRoot: true,
                      })
                    }
                  >
                    <GlobeHemisphereWest className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="block truncate">{externalNav.worldLabel}</span>
                      <span
                        className={`block truncate text-[10px] ${
                          !activePlaceId || activePlaceId === externalNav.worldId
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

              <div className="border-t border-border pt-2">
                <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
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

        {/* Center 3D Three.js Stage */}
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <canvas
            ref={canvasRef}
            className={`block h-full w-full touch-none ${
              activeTool === 'hand' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
            }`}
            aria-label="Interaktive Three.js 3D-Weltkarte"
            onContextMenu={(e) => e.preventDefault()}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />

          {/* Projected HTML Place Pins (click flies camera; button drills into child map) */}
          {projectedPins.map((pin) => {
            if (!pin.visible) return null;
            const targetMapId = mapIdByPlaceId.get(pin.id) ?? null;
            return (
              <div
                key={pin.id}
                className="pointer-events-auto absolute z-[3] -translate-x-1/2 -translate-y-full"
                style={{ left: pin.left, top: pin.top }}
              >
                <button
                  type="button"
                  data-atlas-3d-pin={pin.id}
                  className="flex min-h-9 items-center gap-1.5 rounded-full border border-primary/70 bg-card/90 px-3 py-1 text-xs font-semibold text-foreground shadow-lg backdrop-blur transition-colors hover:border-accent hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    const sourcePin = mapPins.find((p) => p.id === pin.id);
                    if (sourcePin) {
                      runtimeRef.current?.flyTo(sourcePin.x, sourcePin.y, Math.max(90, hudSpan * 0.52));
                    }
                    onNavSelect?.({ placeId: pin.id, mapId: targetMapId, worldRoot: false });
                  }}
                >
                  <MapPin className="size-3.5 text-primary" aria-hidden />
                  <span>{pin.label}</span>
                  {targetMapId ? <CaretRight className="size-3 opacity-70" aria-hidden /> : null}
                </button>
              </div>
            );
          })}

          {/* Continuous Zoom Transition Prompt (ATL4-S02) */}
          {zoomPrompt ? (
            <div className="absolute left-1/2 top-3 z-[4] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-primary/60 bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
              {zoomPrompt.kind === 'enter' ? (
                <>
                  <span>
                    Detailkarte bereit: <strong>{zoomPrompt.pin.label}</strong>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-8"
                    onClick={() => {
                      onNavSelect?.({
                        placeId: zoomPrompt.pin.id,
                        mapId: mapIdByPlaceId.get(zoomPrompt.pin.id) ?? null,
                        worldRoot: false,
                      });
                      setZoomPrompt(null);
                    }}
                  >
                    Hineinzoomen
                  </Button>
                </>
              ) : (
                <>
                  <span>Zur übergeordneten Karte wechseln?</span>
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-8"
                    onClick={() => {
                      onHierarchyBack?.();
                      setZoomPrompt(null);
                    }}
                  >
                    Ebene höher
                  </Button>
                </>
              )}
            </div>
          ) : null}

          {contextLost ? (
            <div
              className="absolute inset-0 z-[5] flex items-center justify-center bg-background/80 p-4 text-sm font-semibold text-foreground"
              role="alert"
            >
              WebGL-Kontext wird wiederhergestellt…
            </div>
          ) : null}

          {/* Compact Bottom HUD — Coords, Scale, Zoom Controls, Reset */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[3] flex items-center justify-between gap-2">
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card/90 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow backdrop-blur">
              <span className="font-mono text-foreground">{hudCoords}</span>
              <span>·</span>
              <span>{formatAtlasSpanLabelDe(hudSpan, mapScale)}</span>
              <span className="hidden md:inline">· Rechtsklick: Drehen · Rad: Zoom</span>
            </div>
            <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-card/90 p-1 shadow backdrop-blur">
              <button
                type="button"
                className="flex min-h-9 min-w-9 items-center justify-center rounded text-sm font-bold hover:bg-muted"
                aria-label="Verkleinern"
                onClick={() => zoomByFactor(1.35)}
              >
                −
              </button>
              <button
                type="button"
                className="flex min-h-9 min-w-9 items-center justify-center rounded text-sm font-bold hover:bg-muted"
                aria-label="Vergrößern"
                onClick={() => zoomByFactor(0.74)}
              >
                +
              </button>
              <button
                type="button"
                className="flex min-h-9 min-w-9 items-center justify-center rounded hover:bg-muted"
                title="Kamera zurücksetzen"
                aria-label="Kamera zurücksetzen"
                onClick={() => runtimeRef.current?.resetCamera()}
              >
                <Compass className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {/* Right Rail: Werkzeuge + Feature Inspector + Dungeon-Generator — docked cleanly in flex! */}
        {toolsOpen ? (
          <aside
            data-atlas-three-tools
            className="z-[4] flex w-80 shrink-0 flex-col overflow-hidden border-l border-border bg-card/95 backdrop-blur"
            aria-label="Kartenwerkzeuge und Inspektor"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Werkzeuge &amp; Inspektor
              </span>
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                Three.js PBR
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
              {/* Tool Grid */}
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
                    className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-md border px-1 text-[10px] font-semibold transition-colors disabled:opacity-40 ${
                      activeTool === id
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

              {/* Contextual Tool Options: Heightfield Sculpt (ATL4-B02) */}
              {activeTool === 'height' && canEdit ? (
                <div className="space-y-2 rounded-lg border border-border bg-background/60 p-2.5">
                  <p className="text-xs font-semibold">Gelände formen (Höhenfeld)</p>
                  <div className="grid grid-cols-2 gap-1">
                    {ATLAS_TERRAIN_SCULPT_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={sculptMode === m.id}
                        className={`min-h-9 rounded border px-2 text-xs font-medium ${
                          sculptMode === m.id
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

              {/* Contextual Tool Options: Biome Paint (ATL4-B01) */}
              {activeTool === 'biome' && canEdit ? (
                <div className="space-y-2 rounded-lg border border-border bg-background/60 p-2.5">
                  <p className="text-xs font-semibold">Biome &amp; Wege malen</p>
                  <div className="grid grid-cols-2 gap-1">
                    {ATLAS_BIOME_BRUSHES.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        aria-pressed={biomeId === b.id}
                        className={`flex min-h-9 items-center gap-2 rounded border px-2 text-left text-xs ${
                          biomeId === b.id
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
                        className={`flex min-h-9 items-center gap-1.5 rounded border px-2 text-xs ${
                          stampKind === opt.id
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

              {/* Selected Object Inspector (ATL4-A01 / V17) */}
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

              {/* Feature Search & Catalog (V17 Inspector parity) */}
              <div className="space-y-2 border-t border-border pt-3">
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
                <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                  {filteredObjects.map((obj) => (
                    <button
                      key={obj.id}
                      type="button"
                      className={`flex min-h-9 w-full items-center justify-between rounded border px-2 text-left text-xs ${
                        selectedId === obj.id
                          ? 'border-primary bg-primary/15 font-semibold text-foreground'
                          : 'border-border/70 hover:border-accent'
                      }`}
                      onClick={() => {
                        setSelectedId(obj.id);
                        runtimeRef.current?.flyTo(obj.x, obj.y, Math.min(hudSpan, 180));
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

              {/* Dungeon-Generator Slot cleanly nested inside Werkzeuge */}
              {toolsSlot ? (
                <div data-atlas-tools-dungeon-section>{toolsSlot}</div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
