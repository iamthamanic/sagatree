/**
 * marketplace module public API — quarantine + catalog + download counter
 * (#831/#878/#804).
 * Location: server/src/modules/marketplace/index.ts
 *
 * Atomic host path only — no client counter fallback. No public HTTP mount.
 */
import type { Actor } from '../identity/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import {
  MarketplaceCountStore,
  type CountError,
  type CountOk,
} from './internal/marketplace-count-store.ts';
import {
  MARKETPLACE_INFRA_PUBLIC_ACTIVATION_AUTHORIZED,
  MarketplaceCatalogStore,
  escapeMarketplaceLikePattern,
  type MarketplaceCreateDraft,
  type MarketplaceItemRecord,
  type MarketplaceListFilters,
  type MarketplaceResult,
  type MarketplaceUpdatePatch,
} from './internal/marketplace-catalog-store.ts';

export {
  MARKETPLACE_MAP_IS_DURABLE_MARKETPLACE_ITEMS,
  MARKETPLACE_PUBLIC_ACTIVATION_AUTHORIZED,
  SEED_TEMPLATES,
  createMarketplaceStore,
  createTemplate,
  downloadTemplate,
  getTemplate,
  listTemplates,
  rateTemplate,
  searchTemplates,
  type MarketplaceStore,
  type QuarantineTemplate,
} from './internal/marketplace-quarantine.ts';

export type { CountError, CountOk };
export type {
  MarketplaceCreateDraft,
  MarketplaceItemRecord,
  MarketplaceItemType,
  MarketplaceListFilters,
  MarketplaceResult,
  MarketplaceUpdatePatch,
} from './internal/marketplace-catalog-store.ts';
export { MARKETPLACE_INFRA_PUBLIC_ACTIVATION_AUTHORIZED, escapeMarketplaceLikePattern };

export const MARKETPLACE_COUNT_PUBLIC_ACTIVATION_AUTHORIZED = false as const;
export const MARKETPLACE_COUNT_HOST_SUCCEEDS_OPTIONAL_SQL = true as const;
export const MARKETPLACE_LEGACY_CLIENT_COUNTER_FALLBACK_SUPERSEDED = true as const;
export const MARKETPLACE_SEARCH_USES_PARAMETERIZED_LIKE = true as const;

export type MarketplaceCountPorts = {
  readonly incrementDownloads: (
    actor: Actor,
    itemId: string | null | undefined,
  ) => CountOk | CountError;
  readonly insertItemForTests: (input: {
    readonly id: string;
    readonly authorId: string;
    readonly title?: string;
    readonly type?: string;
    readonly downloads?: number;
  }) => void;
  readonly readDownloadsForTests: (itemId: string) => number | null;
};

export type MarketplacePorts = {
  readonly moduleId: 'marketplace';
  readonly listItems: (
    actor: Actor | null | undefined,
    filters?: MarketplaceListFilters,
  ) => MarketplaceResult<readonly MarketplaceItemRecord[]>;
  readonly getItem: (
    actor: Actor | null | undefined,
    itemId: string,
  ) => MarketplaceResult<MarketplaceItemRecord | null>;
  readonly listFeatured: (
    actor: Actor | null | undefined,
  ) => MarketplaceResult<readonly MarketplaceItemRecord[]>;
  readonly listByAuthor: (
    actor: Actor | null | undefined,
    authorId: string,
  ) => MarketplaceResult<readonly MarketplaceItemRecord[]>;
  readonly createItem: (
    actor: Actor,
    draft: MarketplaceCreateDraft,
  ) => MarketplaceResult<MarketplaceItemRecord>;
  readonly updateItem: (
    actor: Actor,
    itemId: string,
    patch: MarketplaceUpdatePatch,
  ) => MarketplaceResult<MarketplaceItemRecord>;
  readonly deleteItem: (actor: Actor, itemId: string) => boolean;
  readonly incrementDownloads: (
    actor: Actor,
    itemId: string | null | undefined,
  ) => CountOk | CountError;
};

function actorIdOrDeny(actor: Actor | null | undefined): string | null {
  if (!actor || typeof actor.actorId !== 'string') return null;
  const id = actor.actorId.trim();
  return id ? id : null;
}

function resolveDb(input: HostDatabase | { readonly db: HostDatabase }): HostDatabase {
  if (input && typeof input === 'object' && 'db' in input && input.db) return input.db;
  return input as HostDatabase;
}

export function createMarketplaceCountPorts(db: HostDatabase): MarketplaceCountPorts {
  const store = new MarketplaceCountStore(db);
  return {
    incrementDownloads(actor, itemId) {
      const id = actorIdOrDeny(actor);
      if (!id) return { ok: false, error: '42501' };
      return store.incrementDownloads(id, itemId);
    },
    insertItemForTests(input) {
      store.insertItemForTests(input);
    },
    readDownloadsForTests(itemId) {
      return store.readDownloadsForTests(itemId);
    },
  };
}

/** Atomic host path only — catalog + increment ports (MIG-305). */
export function createMarketplacePorts(
  input: HostDatabase | { readonly db: HostDatabase },
): MarketplacePorts {
  const db = resolveDb(input);
  const catalog = new MarketplaceCatalogStore(db);
  const counts = createMarketplaceCountPorts(db);
  return {
    moduleId: 'marketplace',
    listItems(_actor, filters) {
      return { ok: true, value: catalog.list(filters) };
    },
    getItem(_actor, itemId) {
      const id = typeof itemId === 'string' ? itemId.trim() : '';
      if (!id) return { ok: false, error: '22023' };
      return { ok: true, value: catalog.getById(id) };
    },
    listFeatured(_actor) {
      return { ok: true, value: catalog.listFeatured() };
    },
    listByAuthor(_actor, authorId) {
      const id = typeof authorId === 'string' ? authorId.trim() : '';
      if (!id) return { ok: false, error: '22023' };
      return { ok: true, value: catalog.listByAuthor(id) };
    },
    createItem(actor, draft) {
      const authorId = actorIdOrDeny(actor);
      if (!authorId) return { ok: false, error: '42501' };
      return catalog.create(authorId, draft);
    },
    updateItem(actor, itemId, patch) {
      const authorId = actorIdOrDeny(actor);
      if (!authorId) return { ok: false, error: '42501' };
      return catalog.update(authorId, itemId, patch);
    },
    deleteItem(actor, itemId) {
      const authorId = actorIdOrDeny(actor);
      if (!authorId) return false;
      return catalog.delete(authorId, itemId);
    },
    incrementDownloads(actor, itemId) {
      return counts.incrementDownloads(actor, itemId);
    },
  };
}

export function createMarketplacePortsStub(): MarketplacePorts {
  function deny<T>(): MarketplaceResult<T> {
    return { ok: false, error: 'P0001' };
  }
  return {
    moduleId: 'marketplace',
    listItems: () => deny(),
    getItem: () => deny(),
    listFeatured: () => deny(),
    listByAuthor: () => deny(),
    createItem: () => deny(),
    updateItem: () => deny(),
    deleteItem: () => false,
    incrementDownloads: () => ({ ok: false, error: 'P0001' }),
  };
}

export const createMarketplaceInfraPorts = createMarketplacePorts;
export const createMarketplaceInfraPortsStub = createMarketplacePortsStub;
