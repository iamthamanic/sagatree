/**
 * marketplace module public API — quarantine surface for MIG-415 (#831).
 * Location: server/src/modules/marketplace/index.ts
 *
 * Legacy Map catalog remains unmounted and is distinct from durable
 * marketplace_items. No HTTP port factory here.
 */
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
