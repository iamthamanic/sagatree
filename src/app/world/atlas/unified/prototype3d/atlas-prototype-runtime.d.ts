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

export type AtlasPrototypeMount = {
  readonly dispose: () => void;
  readonly updateExternalNav: (tree: AtlasPrototypeExternalNav | null) => void;
  readonly setActiveNavPlaceId: (placeId: string | null) => void;
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
};

export function mountAtlasPrototype3d(
  host: HTMLElement,
  options?: AtlasPrototypeMountOptions,
): AtlasPrototypeMount;
