/**
 * marketplace module public API — quarantine + catalog + download counter
 * (#831/#878/#804).
 * Location: server/src/modules/marketplace/index.ts
 *
 * Quarantine Map catalog remains unmounted and is distinct from durable
 * marketplace_items. Catalog ports (MIG-305) + download counter (#878) share
 * the same SQLite table. Atomic host path only — no client counter fallback.
 * No public HTTP activation in this slice.
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
export {
  MARKETPLACE_INFRA_PUBLIC_ACTIVATION_AUTHORIZED,
  escapeMarketplaceLikePattern,
};

/** Explicit: durable counter path is authorized for isolated host use-cases only. */
export const MARKETPLACE_COUNT_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/**
 * Deployment decision (#878 Required Test 1): host SQLite marketplace_items +
 * MarketplaceCountStore replaces optional src/supabase marketplace RPC scripts.
 * FE keeps server-authority counters (no client write fallback, #675).
 * Atomic host path only.
 */
export const MARKETPLACE_COUNT_HOST_SUCCEEDS_OPTIONAL_SQL = true as const;

/** Host path supersedes legacy non-atomic client counter fallback (#675 / MIG-305). */
export const MARKETPLACE_LEGACY_CLIENT_COUNTER_FALLBACK_SUPERSEDED = true as const;

/** Search uses parameterized LIKE + escaped wildcards (not PostgREST interpolation). */
export const MARKETPLACE_SEARCH_USES_PARAMETERIZED_LIKE = true as const;

export type MarketplaceCountPorts = {
  readonly incrementDownloads: (
    actor: Actor,
    itemId: string | null | undefined,
  ) => CountOk | CountError;
  /** Test-only seed / read — not a publish API. */
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
    actor: Actor,
    filters?: MarketplaceListFilters,
  ) => MarketplaceResult<readonly MarketplaceItemRecord[]>;
  readonly getItem: (
    actor: Actor,
    itemId: string,
  ) => MarketplaceResult<MarketplaceItemRecord | null>;
  readonly listFeatured: (
    actor: Actor,
  ) => MarketplaceResult<readonly MarketplaceItemRecord[]>;
  readonly listByAuthor: (
    actor: Actor,
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
  readonly deleteItem: (
    actor: Actor,
    itemId: string,
  ) => MarketplaceResult<boolean>;
  readonly incrementDownloads: (
    actor: Actor,
    itemId: string | null | undefined,
  ) => CountOk | CountError;
};

/** Alias used by dual-path / create-host naming. */
export type MarketplaceInfraPorts = MarketplacePorts;

function actorIdOrDeny(actor: Actor | null | undefined): string | null {
  if (!actor || typeof actor.actorId !== 'string') return null;
  const id = actor.actorId.trim();
  return id ? id : null;
}

function resolveDb(dbOrDeps: HostDatabase | { readonly db: HostDatabase }): HostDatabase {
  if (dbOrDeps && typeof dbOrDeps === 'object' && 'db' in dbOrDeps && dbOrDeps.db) {
    return dbOrDeps.db;
  }
  return dbOrDeps as HostDatabase;
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

/**
 * Catalog + atomic increment ports for MIG-305 dual-path adapters.
 * Catalog reads are public; mutations require verified actor.
 * Atomic host path only — no non-atomic client counter fallback.
 */
export function createMarketplacePorts(
  dbOrDeps: HostDatabase | { readonly db: HostDatabase },
): MarketplacePorts {
  const db = resolveDb(dbOrDeps);
  const catalog = new MarketplaceCatalogStore(db);
  const counts = createMarketplaceCountPorts(db);

  return {
    moduleId: 'marketplace',
    listItems(_actor, filters) {
      return { ok: true, value: catalog.list(filters) };
    },
    getItem(_actor, itemId) {
      const id = typeof itemId === 'string' ? itemId.trim() : '';
      if (!id) return { ok: false, error: 'invalid-item-id' };
      return { ok: true, value: catalog.getById(id) };
    },
    listFeatured(_actor) {
      return { ok: true, value: catalog.listFeatured() };
    },
    listByAuthor(_actor, authorId) {
      const id = typeof authorId === 'string' ? authorId.trim() : '';
      if (!id) return { ok: false, error: 'invalid-author-id' };
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
      if (!authorId) return { ok: false, error: '42501' };
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
    deleteItem: () => deny(),
    incrementDownloads: () => ({ ok: false, error: 'P0001' }),
  };
}

export const createMarketplaceInfraPorts = createMarketplacePorts;
export const createMarketplaceInfraPortsStub = createMarketplacePortsStub;
