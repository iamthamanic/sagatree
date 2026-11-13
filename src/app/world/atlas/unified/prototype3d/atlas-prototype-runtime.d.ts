/**
 * Type stub for atlas-prototype-runtime.mjs
 * Location: src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.d.ts
 */

export type AtlasPrototypeNavSelectPayload = {
  readonly placeId: string | null;
  readonly mapId: string | null;
  readonly worldRoot: boolean;
};

/** Structural match for domains AtlasWebglNavTree (avoid .d.ts→domain import). */
export type AtlasPrototypeExternalNav = {
  readonly worldId: string;
  readonly worldLabel: string;
  readonly worldSub: string;
  readonly worldPrimaryMapId: string | null;
  readonly nodes: ReadonlyArray<{
    readonly id: string;
    readonly parentId: string | null;
    readonly label: string;
    readonly sub: string;
    readonly kind: string;
    readonly primaryMapId: string | null;
    readonly located?: boolean;
  }>;
  readonly childrenByParentId: Readonly<Record<string, readonly string[]>>;
  readonly status: 'ready' | 'loading' | 'error' | 'empty';
  readonly errorMessage?: string;
};

export type AtlasPrototypeToolChromeRow = {
  readonly runtimeId: string;
  readonly labelDe: string;
  readonly enabled?: boolean;
  readonly disabledReason?: string | null;
  readonly atlasId?: string;
  readonly role?: string;
};

/** How a product map renders its content (terrain patches vs interior floor plans). */
export type AtlasPrototypeMapScale = 'world' | 'settlement' | 'interior';

/** Place label anchored on the active map (doc coordinates). */
export type AtlasPrototypeMapPin = {
  readonly id: string;
  readonly label: string;
  readonly kind?: string | null;
  readonly x: number;
  readonly y: number;
};

export type AtlasPrototypeMount = {
  readonly dispose: () => void;
  readonly updateExternalNav: (tree: AtlasPrototypeExternalNav | null) => void;
  readonly setActiveNavPlaceId: (placeId: string | null) => void;
  readonly setToolChrome: (rows: readonly AtlasPrototypeToolChromeRow[] | null) => void;
  readonly setCanEdit: (canEdit: boolean) => void;
  readonly setMapSketchStatus: (status: string | null) => void;
  readonly setMapScale: (scale: AtlasPrototypeMapScale | null) => void;
  readonly setMapPins: (pins: readonly AtlasPrototypeMapPin[] | null) => void;
};

export type AtlasPrototypeNavAddPayload = {
  readonly uiKind: string;
  readonly parentId: string;
};

export type AtlasPrototypeNavPlacePayload = {
  readonly placeId: string;
};

export type AtlasPrototypeMountOptions = {
  readonly controlled?: boolean;
  readonly seedState?: Readonly<Record<string, unknown>> | null;
  readonly onPersist?: (state: Readonly<Record<string, unknown>>) => void;
  /** When set, #nav is driven by persisted WorldNodes (product path #747). */
  readonly externalNav?: AtlasPrototypeExternalNav | null;
  readonly activePlaceId?: string | null;
  readonly onNavSelect?: (payload: AtlasPrototypeNavSelectPayload) => void;
  readonly onNavRename?: (payload: {
    readonly placeId: string;
    readonly label: string;
  }) => void;
  /** Product #748 — open server create dialog for category +. */
  readonly onNavAdd?: (payload: AtlasPrototypeNavAddPayload) => void;
  readonly onNavDuplicate?: (payload: AtlasPrototypeNavPlacePayload) => void;
  readonly onNavArchive?: (payload: AtlasPrototypeNavPlacePayload) => void;
  readonly onNavReparent?: (payload: AtlasPrototypeNavPlacePayload) => void;
  /** ATLAS_TOOL_REGISTRY-derived WebGL chrome (#750). */
  readonly toolChrome?: readonly AtlasPrototypeToolChromeRow[] | null;
  /** When false, map mutations are rejected client-side (RPC/RLS remain authority). */
  readonly canEdit?: boolean;
  /** Active map sketch status — unlocated suppresses demo geography (#752). */
  readonly mapSketchStatus?: 'unlocated' | 'unsketched' | 'ready' | null;
  /** Product map scale; controlled mounts never render demo geography. */
  readonly mapScale?: AtlasPrototypeMapScale;
  /** DB place labels anchored on the active map. */
  readonly mapPins?: readonly AtlasPrototypeMapPin[] | null;
  /** ATL2-D01 degradable graphics preset (DPR / antialias / software prefer). */
  readonly graphicsPreset?: {
    readonly id: string;
    readonly maxPixelRatio: number;
    readonly preferSoftwareFallback: boolean;
    readonly antialias: boolean;
  } | null;
  /** ATL2-D06 diorama daylight / fog / facade detail (from domain light profile). */
  readonly dioramaLight?: {
    readonly presetId: string;
    readonly daylightDir: readonly [number, number, number];
    readonly ambient: number;
    readonly fogDensity: number;
    readonly fogColor: string;
    readonly clearColor: readonly [number, number, number, number];
    readonly shadowStrength: number;
    readonly detailLevel: 'full' | 'reduced' | 'minimal';
  } | null;
  /** ATL2-F04 dungeon theme look (Custom WebGL; atmospheric only). */
  readonly dungeonLook?: {
    readonly themeKey: string;
    readonly floor: string;
    readonly wall: string;
    readonly door: string;
    readonly accent: string;
    readonly light: string;
    readonly torchIntensity: number;
    readonly bloomEnabled: boolean;
    readonly particlesEnabled: boolean;
    readonly maxTorchInstances: number;
    readonly maxInstances: number;
    readonly fogDensity: number;
    readonly fogColor: string;
    readonly clearColor: readonly [number, number, number, number];
    readonly ambient: number;
    readonly daylightDir: readonly [number, number, number];
    readonly shadowStrength: number;
    readonly geometryFingerprint: string;
    readonly lookFingerprint: string;
    /** Budget allowlists — empty array denies that kind (exhausted). */
    readonly floorIds: readonly string[];
    readonly wallIds: readonly string[];
    readonly doorIds: readonly string[];
    readonly torchIds: readonly string[];
    readonly propIds: readonly string[];
  } | null;
};

export function mountAtlasPrototype3d(
  host: HTMLElement,
  options?: AtlasPrototypeMountOptions,
): AtlasPrototypeMount;
