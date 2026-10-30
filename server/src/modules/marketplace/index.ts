/**
 * marketplace module public API — quarantine + durable download counter (#831/#878).
 * Location: server/src/modules/marketplace/index.ts
 *
 * Quarantine Map catalog remains unmounted and is distinct from durable
 * marketplace_items. Download counter is the #878 host successor for optional
 * increment_marketplace_downloads SQL (no public HTTP activation in this slice).
 */
import type { Actor } from '../identity/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import {
  MarketplaceCountStore,
  type CountError,
  type CountOk,
} from './internal/marketplace-count-store.ts';

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

/** Explicit: durable counter path is authorized for isolated host use-cases only. */
export const MARKETPLACE_COUNT_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/**
 * Deployment decision (#878 Required Test 1): host SQLite marketplace_items +
 * MarketplaceCountStore replaces optional src/supabase add/deploy marketplace RPC
 * scripts. FE keeps server-authority counters (no client write fallback, #675).
 */
export const MARKETPLACE_COUNT_HOST_SUCCEEDS_OPTIONAL_SQL = true as const;

export type MarketplaceCountPorts = {
  readonly incrementDownloads: (
    actor: Actor,
    itemId: string,
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

function actorIdOrDeny(actor: Actor | null | undefined): string | null {
  if (!actor || typeof actor.actorId !== 'string' || !actor.actorId) return null;
  return actor.actorId;
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
