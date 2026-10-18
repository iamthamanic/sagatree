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
  BrickWall,
  ChevronDown,
  Eraser,
  Hand,
  MousePointer2,
  Paintbrush,
  Route,
  Square,
  Stamp,
  Wrench,
  type LucideProps,
} from 'lucide-react';
import {
  ATLAS_PROTOTYPE_HOTSPOTS,
  ATLAS_PROTOTYPE_LAYER_LABELS,
  ATLAS_PROTOTYPE_LEVELS,
  applyMapEdit,
  atlasPrototypeApplyLod,
  atlasPrototypeBrushSize,
  atlasPrototypeContentVisible,
  atlasPrototypeHotspotVisible,
  atlasPrototypeLevelFromView,
  atlasPrototypeLevelRect,
  atlasPrototypeNextLevel,
  atlasPrototypeStampSize,
  atlasSpanFromScale,
  buildDungeonGeneratorMeta,
  DEFAULT_ATLAS_BOUNDS,
  dungeonNeedsReforgeConfirm,
  emptyUnifiedCanvasDoc,
  generateDungeon,
  isSettlementLodId,
  pickObjectAt,
  type AtlasPrototypeLevelId,
  type DungeonGeneratorMeta,
  type UnifiedCanvasDoc,
  type UnifiedCanvasLayerId,
  type UnifiedCanvasMaterial,
  type UnifiedCanvasStampType,
  type UnifiedCanvasTool,
} from '../../../../domains/world/atlas';
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
  placeKindForAuthor,
  resolveAtlasLodFromPlaces,
  seedKeyForAuthor,
  stampSizeForAuthor,
  type AtlasPlaceAuthorKind,
  type AtlasPlaceNavItem,
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
  /** Optional floating chrome on the canvas (e.g. Karten hierarchy rail). */
  readonly canvasLeftRail?: ReactNode;
};

type DragState =
  | { readonly mode: 'pan'; readonly px: number; readonly py: number; readonly cam: AtlasCamera }
  | {
      readonly mode: 'paint';
      readonly strokeId: string;
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
  onDocChange,
  dungeonMeta = null,
  onDungeonMetaChange,
  onCreatePlace,
  placeNav = [],
  canvasLeftRail = null,
}: UnifiedAtlasEditorProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<AtlasCamera>({ center: { x: 720, y: 450 }, pixelsPerUnit: 1 });
  const fitRef = useRef(1);
  const dragRef = useRef<DragState>(null);
  const animRef = useRef<number | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;
  const dungeonMetaRef = useRef(dungeonMeta);
  dungeonMetaRef.current = dungeonMeta;
  const placeNavRef = useRef(placeNav);
  placeNavRef.current = placeNav;
  const pinArmedRef = useRef(false);
  const marqueeArmedRef = useRef(false);

  const [tool, setTool] = useState<UnifiedCanvasTool>('hand');
  const [material, setMaterial] = useState<UnifiedCanvasMaterial>('gras');
  const [stamp, setStamp] = useState<UnifiedCanvasStampType>('baum');
  const [brushSize, setBrushSize] = useState(45);
  const [objectSize, setObjectSize] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dungeonSeed, setDungeonSeed] = useState('4242');
  const [dungeonRooms, setDungeonRooms] = useState(16);
  const [dungeonPreview, setDungeonPreview] = useState<ReturnType<typeof generateDungeon> | null>(null);
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
  const [protoLevel, setProtoLevel] = useState<AtlasPrototypeLevelId>('world');
  const [hotspotScreen, setHotspotScreen] = useState<
    readonly { id: string; label: string; target: AtlasPrototypeLevelId; left: number; top: number }[]
  >([]);
  const [viewport, setViewport] = useState({ width: 800, height: 500 });
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
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

  const pushHistory = useCallback((prev: UnifiedCanvasDoc) => {
    setHistory((h) => {
      const next = [...h, JSON.stringify(prev)];
      return next.length > 45 ? next.slice(next.length - 45) : next;
    });
    setFuture([]);
  }, []);

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
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [...f, JSON.stringify(docRef.current)]);
      onDocChange(JSON.parse(prev) as UnifiedCanvasDoc);
      return h.slice(0, -1);
    });
  }, [onDocChange]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[f.length - 1];
      setHistory((h) => [...h, JSON.stringify(docRef.current)]);
      onDocChange(JSON.parse(next) as UnifiedCanvasDoc);
      return f.slice(0, -1);
    });
  }, [onDocChange]);

  const goToRect = useCallback(
    (rect: AtlasRect, duration = 650) => {
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
      const frame = (now: number) => {
        const t = easing(Math.min(1, (now - start.t) / duration));
        camRef.current = {
          center: {
            x: start.x + (dest.x - start.x) * t,
            y: start.y + (dest.y - start.y) * t,
          },
          pixelsPerUnit: Math.exp(Math.log(start.s) + (Math.log(targetScale) - Math.log(start.s)) * t),
        };
        refresh();
        if (t < 1) animRef.current = requestAnimationFrame(frame);
        else animRef.current = null;
      };
      animRef.current = requestAnimationFrame(frame);
    },
    [viewport.height, viewport.width, refresh],
  );

  const mapWorldRect =
    workingDoc.demoSeed !== false ? WORLD_RECT : PRODUCT_WORLD_RECT;

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
  }, [refresh]);

  const productWorldFitDoneRef = useRef(false);
  useEffect(() => {
    productWorldFitDoneRef.current = false;
  }, [workingDoc.demoSeed]);
  // Product maps: one-shot snap to full world extents once the stage has a real size.
  useEffect(() => {
    if (workingDoc.demoSeed !== false) return;
    if (productWorldFitDoneRef.current) return;
    if (viewport.width < 220 || viewport.height < 220) return;
    const fit = atlasFitCamera(PRODUCT_WORLD_RECT, viewport, 48);
    fitRef.current = fit.pixelsPerUnit;
    camRef.current = fit;
    productWorldFitDoneRef.current = true;
    refresh();
  }, [workingDoc.demoSeed, viewport.width, viewport.height, refresh]);

  useEffect(() => {
    // Product maps mount the exact HTML 3D prototype — skip Canvas2D paint.
    if (workingDoc.demoSeed === false) return;
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
    const layers = workingDoc.layers;
    // Narrowed: early-return above skipped product maps (demoSeed === false).
    const isDemo = true;

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
      // Planetary ocean — product maps always start as blue world, lands drawn on top.
      ctx.fillStyle = '#1a5f8a';
      ctx.fillRect(
        PRODUCT_WORLD_RECT.x,
        PRODUCT_WORLD_RECT.y,
        PRODUCT_WORLD_RECT.width,
        PRODUCT_WORLD_RECT.height,
      );
    }

    const protoLod = !isDemo
      ? atlasPrototypeApplyLod(scale, height, {
          terrain: layers.terrain,
          region: layers.region,
          city: layers.city,
          interior: layers.interior,
          objects: layers.objects,
          grid: layers.grid,
        })
      : null;

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
      for (const r of workingDoc.rooms) {
        if (protoLod && !atlasPrototypeContentVisible(r.id, protoLod)) continue;
        // Ocean base room is already painted as full-canvas fill.
        if (!isDemo && r.id === 'w.ocean') continue;
        ctx.fillStyle = isDemo
          ? (MATERIAL_COLORS[r.material] ?? MATERIAL_COLORS.holz)
          : productLandColor(r.material);
        ctx.fillRect(r.x, r.y, r.w, r.h);
        if (isDemo) {
          ctx.strokeStyle = '#514a41';
          ctx.lineWidth = Math.min(r.w, r.h) * 0.08;
          ctx.strokeRect(r.x, r.y, r.w, r.h);
        } else if (!isSettlementLodId(r.id) && r.material !== 'wasser') {
          // Soft coast outline for land masses
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.lineWidth = 3 / Math.max(0.2, scale);
          ctx.strokeRect(r.x, r.y, r.w, r.h);
        }
      }
      for (const s of workingDoc.strokes) {
        if (s.points.length === 0) continue;
        if (protoLod && !atlasPrototypeContentVisible(s.id, protoLod)) continue;
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
      for (const w of workingDoc.walls) {
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
    }
    if (layers.objects) {
      for (const o of workingDoc.objects) {
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
    if (!isDemo && protoLod?.grid) {
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
      const stageId = atlasPrototypeLevelFromView(cam.center, scale, height);
      const stage = ATLAS_PROTOTYPE_LEVELS.find((l) => l.id === stageId) ?? ATLAS_PROTOTYPE_LEVELS[0]!;
      setProtoLevel((prev) => (prev === stageId ? prev : stageId));
      setLevel(stage.tag);
      const placeLod = resolveAtlasLodFromPlaces(cam.center, scale, placeNavRef.current);
      setCrumb(placeLod?.crumb && placeLod.level !== 'WELT' ? placeLod.crumb : stage.label);
      const span = atlasSpanFromScale(scale, height);
      const nextHotspots = ATLAS_PROTOTYPE_HOTSPOTS.filter((h) =>
        atlasPrototypeHotspotVisible(h, scale, height),
      ).map((h) => {
        const sx = (h.x - cam.center.x) * scale + width / 2;
        const sy = (h.y - cam.center.y) * scale + height / 2;
        return {
          id: h.id,
          label: h.label,
          target: h.targetLevel,
          left: Math.round(sx),
          top: Math.round(sy),
        };
      });
      setHotspotScreen((prev) => {
        if (
          prev.length === nextHotspots.length &&
          prev.every(
            (p, i) =>
              p.id === nextHotspots[i]?.id &&
              p.left === nextHotspots[i]?.left &&
              p.top === nextHotspots[i]?.top,
          )
        ) {
          return prev;
        }
        return nextHotspots;
      });
      setZoomPct(`${Math.round((450 / Math.max(1, span)) * 100)}%`);
    } else {
      setHotspotScreen((prev) => (prev.length === 0 ? prev : []));
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
      setZoomPct(`${Math.round((scale / fitRef.current) * 100)}%`);
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

  const brushWidth = () => {
    if (workingDoc.demoSeed === false) {
      return atlasPrototypeBrushSize(protoLevel, brushSize);
    }
    const st = stageAt(camRef.current, camRef.current.pixelsPerUnit);
    return PAINT_HEIGHT[st] * (brushSize / 45);
  };

  const stampSizeNow = () => {
    if (workingDoc.demoSeed === false) {
      return atlasPrototypeStampSize(protoLevel, objectSize);
    }
    const st = stageAt(camRef.current, camRef.current.pixelsPerUnit);
    const base = { world: 25, north: 11, region: 7, city: 3, inn: 0.95 }[st] ?? 5;
    return base * objectSize;
  };

  const goToPrototypeLevel = useCallback(
    (id: AtlasPrototypeLevelId) => {
      const stage = ATLAS_PROTOTYPE_LEVELS.find((l) => l.id === id);
      if (!stage) return;
      goToRect(atlasPrototypeLevelRect(stage));
    },
    [goToRect],
  );

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
      const next = {
        ...workingDoc,
        demoSeed: false,
        objects: [
          ...workingDoc.objects,
          { id: uid(), type: stamp, x: p.x, y: p.y, size: stampSizeNow(), angle: 0 },
        ],
      };
      commit(next, true);
      refresh();
      return;
    }

    if (tool === 'erase') {
      const hit = workingDoc.objects.find(
        (o) => (o.x - p.x) ** 2 + (o.y - p.y) ** 2 < (30 / camRef.current.pixelsPerUnit) ** 2,
      );
      if (hit) {
        commit(
          { ...workingDoc, demoSeed: false, objects: workingDoc.objects.filter((o) => o.id !== hit.id) },
          true,
        );
        return;
      }
      const si = workingDoc.strokes.findIndex((s) =>
        s.points.some(
          (q) =>
            (q[0] - p.x) ** 2 + (q[1] - p.y) ** 2
            < (Math.max(s.width * 0.5, 15 / camRef.current.pixelsPerUnit)) ** 2,
        ),
      );
      if (si >= 0) {
        commit(
          {
            ...workingDoc,
            demoSeed: false,
            strokes: workingDoc.strokes.filter((_, i) => i !== si),
          },
          true,
        );
      }
      return;
    }

    if (tool === 'select') {
      const hit = pickObjectAt(workingDoc, p.x, p.y);
      setSelectedId(hit?.id ?? null);
      if (hit && canEdit) {
        dragRef.current = {
          mode: 'move_object',
          id: hit.id,
          ox: hit.x,
          oy: hit.y,
          sx: p.x,
          sy: p.y,
        };
      } else {
        dragRef.current = { mode: 'pan', px: p.px, py: p.py, cam: camRef.current };
      }
      return;
    }

    if (tool === 'brush' || tool === 'road') {
      const id = uid();
      const stroke = {
        id,
        material: (tool === 'road' ? 'pflaster' : material) as UnifiedCanvasMaterial,
        width: tool === 'road' ? brushWidth() * 0.62 : brushWidth(),
        points: [[p.x, p.y] as const],
      };
      commit({ ...workingDoc, demoSeed: false, strokes: [...workingDoc.strokes, stroke] }, true);
      dragRef.current = { mode: 'paint', strokeId: id };
      return;
    }

    if (tool === 'room' || tool === 'wall') {
      dragRef.current = {
        mode: 'shape',
        start: { x: p.x, y: p.y },
        kind: tool === 'room' ? 'room' : 'wall',
      };
      pushHistory(docRef.current);
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
    if (drag.mode === 'paint') {
      const strokes = workingDoc.strokes.map((s) => {
        if (s.id !== drag.strokeId) return s;
        const last = s.points[s.points.length - 1];
        if ((p.x - last[0]) ** 2 + (p.y - last[1]) ** 2 < (2 / camRef.current.pixelsPerUnit) ** 2) {
          return s;
        }
        return { ...s, points: [...s.points, [p.x, p.y] as const] };
      });
      onDocChange({ ...workingDoc, strokes, demoSeed: false });
      refresh();
      return;
    }
    if (drag.mode === 'shape') {
      refresh();
      return;
    }
    if (drag.mode === 'marquee') {
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
    if (drag?.mode === 'marquee') {
      const x = Math.min(drag.start.x, p.x);
      const y = Math.min(drag.start.y, p.y);
      const w = Math.abs(p.x - drag.start.x);
      const h = Math.abs(p.y - drag.start.y);
      const min = 4 / camRef.current.pixelsPerUnit;
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
      if (drag.kind === 'room') {
        const x = Math.min(drag.start.x, p.x);
        const y = Math.min(drag.start.y, p.y);
        const w = Math.abs(p.x - drag.start.x);
        const h = Math.abs(p.y - drag.start.y);
        if (w > min && h > min) {
          onDocChange({
            ...workingDoc,
            demoSeed: false,
            rooms: [...workingDoc.rooms, { id: uid(), x, y, w, h, material }],
          });
        }
      } else {
        if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > min) {
          onDocChange({
            ...workingDoc,
            demoSeed: false,
            walls: [
              ...workingDoc.walls,
              {
                id: uid(),
                x1: drag.start.x,
                y1: drag.start.y,
                x2: p.x,
                y2: p.y,
                width: brushWidth() * 0.18,
              },
            ],
          });
        }
      }
    }
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
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const next = atlasZoomAt(
      camRef.current,
      { width: viewport.width, height: viewport.height },
      cursor,
      camRef.current.pixelsPerUnit * Math.exp(-e.deltaY * 0.0019),
      fitRef.current * 0.7,
      320,
    );
    camRef.current = next;
    refresh();
  };

  const setLayer = (id: UnifiedCanvasLayerId, on: boolean) => {
    commit({ ...workingDoc, layers: { ...workingDoc.layers, [id]: on } }, false);
  };

  const tools: {
    readonly id: UnifiedCanvasTool;
    readonly label: string;
    readonly Icon: ComponentType<LucideProps>;
  }[] = [
    { id: 'hand', label: 'Hand', Icon: Hand },
    { id: 'select', label: 'Auswahl', Icon: MousePointer2 },
    { id: 'brush', label: 'Pinsel', Icon: Paintbrush },
    { id: 'road', label: 'Weg', Icon: Route },
    { id: 'room', label: 'Raum', Icon: Square },
    { id: 'wall', label: 'Wand', Icon: BrickWall },
    { id: 'stamp', label: 'Stempel', Icon: Stamp },
    { id: 'erase', label: 'Radierer', Icon: Eraser },
  ];

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

  const hasDbPlaces = placeNav.length > 0;
  const isDemo = workingDoc.demoSeed !== false;
  const isWorldStarter = workingDoc.rooms.some((r) => r.id === 'w.ocean');

  // Product maps: native Unified Atlas 3D (WebGL) — same runtime as the HTML prototype,
  // mounted in-repo (editable), skinned to SagaTree. Flat Canvas2D remains for demoSeed.
  if (!isDemo) {
    return (
      <div
        className="flex h-full min-h-0 w-full min-w-0 flex-col"
        data-unified-atlas-editor
        data-atlas-demo="false"
        data-atlas-world-starter={isWorldStarter ? 'true' : undefined}
        data-atlas-proto-exact="true"
      >
        <AtlasNative3dEditor />
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col gap-2"
      data-unified-atlas-editor
      data-atlas-demo={isDemo ? 'true' : 'false'}
      data-atlas-world-starter={isWorldStarter ? 'true' : undefined}
    >
      {workingDoc.strokes.length === 0 ? (
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
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isDemo ? 'Zoom-Stufen · Demo' : 'Weltatlas · Stufen'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {isDemo
              ? 'Eldoria → Dornhain → Kupferlaterne.'
              : 'Welt → Region → Stadt → Dungeon → Raum (eine Kamera).'}
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
            ) : (
              ATLAS_PROTOTYPE_LEVELS.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  data-atlas-proto-level={n.id}
                  aria-current={protoLevel === n.id ? 'true' : undefined}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${
                    protoLevel === n.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                  style={{ paddingLeft: `${8 + i * 4}px` }}
                  onClick={() => goToPrototypeLevel(n.id)}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-xs">
                    {n.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{n.label}</span>
                    <span
                      className={`block truncate text-[10px] ${
                        protoLevel === n.id ? 'text-primary-foreground/80' : 'text-muted-foreground'
                      }`}
                    >
                      {n.sub}
                    </span>
                  </span>
                </button>
              ))
            )}
            {!isDemo && hasDbPlaces
              ? placeNav.map((n) => (
                  <button
                    key={n.placeId}
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted"
                    data-atlas-place-nav={n.placeId}
                    onClick={() => goToRect(n.focusRect)}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-xs">
                      {n.kind === 'settlement' || n.kind === 'building' ? '⌂' : '◇'}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{n.name}</span>
                  </button>
                ))
              : null}
          </nav>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sichtbare Ebenen
          </p>
          <div className="space-y-1" data-atlas-layer-switches>
            {(isDemo ? LAYER_LABELS : ATLAS_PROTOTYPE_LAYER_LABELS).map((l) => {
              const canvasId = (
                isDemo ? l.id : (l as (typeof ATLAS_PROTOTYPE_LAYER_LABELS)[number]).canvasLayer
              ) as UnifiedCanvasLayerId;
              return (
                <label key={l.id} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    data-atlas-layer={l.id}
                    checked={workingDoc.layers[canvasId]}
                    disabled={!canEdit}
                    onChange={(e) => setLayer(canvasId, e.target.checked)}
                  />
                  <span className="flex-1">{l.label}</span>
                  <small className="text-[10px] text-muted-foreground">
                    {workingDoc.layers[canvasId] ? 'AN' : 'AUS'}
                  </small>
                </label>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            onClick={() => (isDemo ? goToRect(mapWorldRect) : goToPrototypeLevel('world'))}
          >
            Zur Weltkarte
          </Button>
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
                data-atlas-proto-level={isDemo ? undefined : protoLevel}
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
              pinArmed || marqueeArmed ? 'cursor-crosshair' : ''
            }`}
            data-unified-atlas-viewport
            data-tool={pinArmed ? 'pin' : marqueeArmed ? 'marquee' : tool}
            data-view-mode="2d"
            data-pin-armed={pinArmed ? 'true' : undefined}
            data-marquee-armed={marqueeArmed ? 'true' : undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onDoubleClick={(e) => {
              const p = worldFromEvent(e);
              if (!isDemo) {
                const next = atlasPrototypeNextLevel(protoLevel);
                if (next !== protoLevel) {
                  goToPrototypeLevel(next);
                  return;
                }
                if (placeNav.length > 0) {
                  const hits = placeNav
                    .filter(
                      (n) =>
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
                }
                goToPrototypeLevel('world');
                return;
              }
              if (placeNav.length > 0) {
                const hits = placeNav
                  .filter(
                    (n) =>
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
              ? hotspotScreen.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className="absolute z-[5] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400/60 bg-[#193038de] px-2.5 py-1.5 text-[10px] font-bold text-[#fff4d3] shadow min-h-11"
                    style={{ left: h.left, top: h.top }}
                    data-atlas-hotspot={h.id}
                    data-unified-chrome
                    onClick={() => goToPrototypeLevel(h.target)}
                  >
                    {h.label}
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
                <ChevronDown
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
              : tool === 'brush' || tool === 'road'
                ? 'Welt gestalten'
                : tool === 'room' || tool === 'wall'
                  ? 'Geometrie'
                  : selectedId
                    ? 'Auswahl'
                    : 'Weltkarte'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Mausrad = zoomen. Land/Wasser mit Pinsel; Orte per Pin oder Rahmen anlegen.
          </p>
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
            <Button type="button" variant="outline" className="min-h-11" disabled={!canEdit} onClick={undo}>
              ↶ Undo
            </Button>
            <Button type="button" variant="outline" className="min-h-11" disabled={!canEdit} onClick={redo}>
              ↷ Redo
            </Button>
            {selectedId && canEdit ? (
              <Button
                type="button"
                variant="destructive"
                className="min-h-11"
                onClick={() => {
                  commit(applyMapEdit(workingDoc, { op: 'remove_object', id: selectedId }), true);
                  setSelectedId(null);
                }}
              >
                Löschen
              </Button>
            ) : null}
          </div>
          {canEdit ? (
            <div className="space-y-2 rounded-md border border-border p-2" data-atlas-dungeon-forge>
              <p className="text-xs font-semibold">Dungeon-Generator</p>
              <p className="text-[11px] text-muted-foreground">
                Seed-basiert (Dungeon Forge MIT). Vorschau erst nach Bestätigung kanonisch.
              </p>
              <Label htmlFor="atlas-dungeon-seed">Seed</Label>
              <Input
                id="atlas-dungeon-seed"
                className="min-h-11"
                value={dungeonSeed}
                onChange={(e) => setDungeonSeed(e.target.value)}
              />
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
                  Bestätigter/manuell bearbeiteter Dungeon — erneutes Generieren überschreibt nur nach
                  Bestätigung.
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                onClick={() => {
                  setDungeonError(null);
                  if (dungeonNeedsReforgeConfirm(dungeonMeta)) {
                    if (
                      !window.confirm(
                        'Dungeon neu generieren? Bestätigte oder manuell geänderte Geometrie kann überschrieben werden, wenn du danach „Bestätigen“ wählst.',
                      )
                    ) {
                      return;
                    }
                  }
                  const seedNum = Number.parseInt(dungeonSeed, 10);
                  const result = generateDungeon({
                    seed: Number.isFinite(seedNum) ? seedNum : 4242,
                    roomCount: dungeonRooms,
                    loopChance: 0.18,
                    themeKey: 'ancient',
                    originX: CITY_RECT.x + 8,
                    originY: CITY_RECT.y + CITY_RECT.height + 4,
                    unitScale: 1.1,
                  });
                  if (!result.valid) {
                    setDungeonPreview(null);
                    setDungeonError(result.error ?? 'Generierung fehlgeschlagen');
                    return;
                  }
                  setDungeonPreview(result);
                }}
              >
                Generieren
              </Button>
              {dungeonError ? (
                <p className="text-xs text-destructive" role="alert">
                  {dungeonError}
                </p>
              ) : null}
              {dungeonPreview?.valid ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {dungeonPreview.stats.roomCount} Räume · {dungeonPreview.stats.edgeCount} Verbindungen ·{' '}
                    {dungeonPreview.stats.genMs.toFixed(1)} ms
                  </p>
                  <Button
                    type="button"
                    className="min-h-11 w-full"
                    onClick={() => {
                      if (!dungeonPreview?.valid) return;
                      if (
                        !window.confirm(
                          'Dungeon als editierbare Räume/Wände übernehmen? Bestehende manuelle Geometry bleibt; Generator-Inhalt wird angehängt.',
                        )
                      ) {
                        return;
                      }
                      const meta = buildDungeonGeneratorMeta(dungeonPreview, true);
                      onDungeonMetaChange?.(meta);
                      pushHistory(docRef.current);
                      onDocChange({
                        ...workingDoc,
                        demoSeed: false,
                        rooms: [...workingDoc.rooms, ...dungeonPreview.canvasRooms],
                        walls: [...workingDoc.walls, ...dungeonPreview.canvasWalls],
                        objects: [...workingDoc.objects, ...dungeonPreview.canvasObjects],
                      });
                      setDungeonPreview(null);
                      goToRect({
                        x: CITY_RECT.x + 4,
                        y: CITY_RECT.y + CITY_RECT.height,
                        width: 48,
                        height: 36,
                      });
                    }}
                  >
                    Bestätigen & übernehmen
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
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
                  setTool('brush');
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
              onChange={(e) => setBrushSize(Number(e.target.value))}
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
