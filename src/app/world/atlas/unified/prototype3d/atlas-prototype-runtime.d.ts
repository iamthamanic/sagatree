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

export type AtlasPrototypeMount = {
  readonly dispose: () => void;
  readonly updateExternalNav: (tree: AtlasPrototypeExternalNav | null) => void;
  readonly setActiveNavPlaceId: (placeId: string | null) => void;
  readonly setToolChrome: (rows: readonly AtlasPrototypeToolChromeRow[] | null) => void;
  readonly setCanEdit: (canEdit: boolean) => void;
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
};

export function mountAtlasPrototype3d(
  host: HTMLElement,
  options?: AtlasPrototypeMountOptions,
): AtlasPrototypeMount;
