/**
 * Quarantined marketplace Map-template characterization (MIG-415 / #831).
 * Location: server/src/modules/marketplace/internal/marketplace-quarantine.ts
 *
 * NOT durable marketplace_items. NOT a public host route. Legacy defects preserved.
 */

export const MARKETPLACE_PUBLIC_ACTIVATION_AUTHORIZED = false as const;
/** Explicit: this Map catalog is not the durable marketplace_items adapter. */
export const MARKETPLACE_MAP_IS_DURABLE_MARKETPLACE_ITEMS = false as const;

export type QuarantineTemplate = {
  id: string;
  name: string;
  type: 'ruleset' | 'character' | 'world' | 'quest' | 'npc';
  author: string;
  description: string;
  data: Record<string, unknown>;
  tags: string[];
  downloads: number;
  rating: number;
  createdAt: string;
};

export const SEED_TEMPLATES: readonly QuarantineTemplate[] = [
  {
    id: 'dnd5e-srd',
    name: 'D&D 5e SRD',
    type: 'ruleset',
    author: 'Wizards of the Coast',
    description: 'D&D 5th Edition System Reference Document',
    data: {
      abilities: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
    },
    tags: ['dnd', '5e', 'srd'],
    downloads: 10000,
    rating: 5.0,
    createdAt: '2024-01-01',
  },
  {
    id: 'pf2e-core',
    name: 'Pathfinder 2e Core',
    type: 'ruleset',
    author: 'Paizo',
    description: 'Pathfinder 2nd Edition Core Rules',
    data: {
      abilities: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
    },
    tags: ['pathfinder', 'pf2e'],
    downloads: 5000,
    rating: 4.8,
    createdAt: '2024-01-01',
  },
  {
    id: 'hero-template',
    name: 'Hero Template',
    type: 'character',
    author: 'System',
    description: 'Standard hero character template',
    data: { level: 1, hp: 10, class: 'fighter' },
    tags: ['character', 'hero'],
    downloads: 2000,
    rating: 4.5,
    createdAt: '2024-01-01',
  },
  {
    id: 'village-template',
    name: 'Village Template',
    type: 'world',
    author: 'System',
    description: 'Standard village world template',
    data: { locations: ['tavern', 'blacksmith', 'general store'] },
    tags: ['world', 'village'],
    downloads: 1500,
    rating: 4.3,
    createdAt: '2024-01-01',
  },
];

export type MarketplaceStore = {
  readonly templates: Map<string, QuarantineTemplate>;
};

export function createMarketplaceStore(
  seed: readonly QuarantineTemplate[] = SEED_TEMPLATES,
): MarketplaceStore {
  const templates = new Map<string, QuarantineTemplate>();
  for (const t of seed) {
    templates.set(t.id, { ...t, data: { ...t.data }, tags: [...t.tags] });
  }
  return { templates };
}

export function listTemplates(
  store: MarketplaceStore,
  type?: string,
  tag?: string,
): QuarantineTemplate[] {
  let all = Array.from(store.templates.values());
  if (type) all = all.filter((t) => t.type === type);
  if (tag) all = all.filter((t) => t.tags.includes(tag));
  return all.sort((a, b) => b.downloads - a.downloads);
}

export function getTemplate(store: MarketplaceStore, id: string): QuarantineTemplate | null {
  return store.templates.get(id) || null;
}

export function createTemplate(
  store: MarketplaceStore,
  data: Partial<QuarantineTemplate>,
  id: string,
  nowIso: string,
): QuarantineTemplate {
  const template: QuarantineTemplate = {
    id,
    name: data.name || 'Untitled',
    type: data.type || 'ruleset',
    author: data.author || 'Anonymous',
    description: data.description || '',
    data: data.data || {},
    tags: data.tags || [],
    downloads: 0,
    rating: 0,
    createdAt: nowIso,
  };
  store.templates.set(id, template);
  return template;
}

export function downloadTemplate(
  store: MarketplaceStore,
  id: string,
): QuarantineTemplate | null {
  const template = store.templates.get(id);
  if (!template) return null;
  template.downloads++;
  store.templates.set(id, template);
  return template;
}

/**
 * Legacy rateTemplate: uses downloads as rating-sample count (defect).
 */
export function rateTemplate(
  store: MarketplaceStore,
  id: string,
  rating: number,
): QuarantineTemplate | null {
  const template = store.templates.get(id);
  if (!template) return null;
  const count = template.downloads || 1;
  template.rating = (template.rating * count + rating) / (count + 1);
  store.templates.set(id, template);
  return template;
}

export function searchTemplates(store: MarketplaceStore, query: string): QuarantineTemplate[] {
  const lowerQuery = query.toLowerCase();
  return Array.from(store.templates.values()).filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)),
  );
}
