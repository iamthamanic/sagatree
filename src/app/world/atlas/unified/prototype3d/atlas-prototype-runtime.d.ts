/**
 * Type stub for atlas-prototype-runtime.mjs
 * Location: src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.d.ts
 */
export type AtlasPrototypeMount = {
  readonly dispose: () => void;
};

export type AtlasPrototypeMountOptions = {
  readonly controlled?: boolean;
  readonly seedState?: Readonly<Record<string, unknown>> | null;
  readonly onPersist?: (state: Readonly<Record<string, unknown>>) => void;
};

export function mountAtlasPrototype3d(
  host: HTMLElement,
  options?: AtlasPrototypeMountOptions,
): AtlasPrototypeMount;
