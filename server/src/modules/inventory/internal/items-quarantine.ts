/**
 * Quarantined items Edge worker characterization (MIG-411 / #827).
 * Location: server/src/modules/inventory/internal/items-quarantine.ts
 *
 * NOT a public host route. Distinct from durable inventory_item_definitions.
 * Field types mirror legacy lack of schema validation (unknowns preserved).
 */

export const ITEMS_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/** Legacy Map catalog is not the durable inventory definitions adapter. */
export const ITEMS_MAP_IS_DURABLE_INVENTORY = false as const;

/**
 * Legacy item shape — fields are unvalidated (typed-as-any in Edge).
 * Using `unknown` preserves that characterization without pretending validation.
 */
export type QuarantineItem = {
  readonly id: string;
  readonly name: unknown;
  readonly type: unknown;
  readonly rarity: unknown;
  readonly weight: unknown;
  readonly value: unknown;
  readonly description: unknown;
  readonly properties: unknown;
  readonly source: unknown;
};

export const SEED_ITEMS: ReadonlyArray<QuarantineItem> = Object.freeze([
  {
    id: 'longsword',
    name: 'Longsword',
    type: 'weapon',
    rarity: 'common',
    weight: 3,
    value: 15,
    description: 'A versatile melee weapon.',
    properties: { damage: '1d8 slashing', versatile: '1d10' },
    source: 'SRD',
  },
  {
    id: 'chain-mail',
    name: 'Chain Mail',
    type: 'armor',
    rarity: 'common',
    weight: 55,
    value: 75,
    description:
      'Made of interlocking metal rings, chain mail includes a layer of quilted fabric underneath to prevent painful chafing.',
    properties: { ac: 16, strength: 13, stealth: 'disadvantage' },
    source: 'SRD',
  },
  {
    id: 'shield',
    name: 'Shield',
    type: 'shield',
    rarity: 'common',
    weight: 6,
    value: 10,
    description: 'A shield made of wood or metal.',
    properties: { ac: 2 },
    source: 'SRD',
  },
  {
    id: 'potion-healing',
    name: 'Potion of Healing',
    type: 'potion',
    rarity: 'common',
    weight: 0.1,
    value: 50,
    description: 'You regain 2d4+2 hit points when you drink this potion.',
    properties: { healing: '2d4+2' },
    source: 'SRD',
  },
  {
    id: 'scroll-fireball',
    name: 'Scroll of Fireball',
    type: 'scroll',
    rarity: 'uncommon',
    weight: 0,
    value: 200,
    description: 'A scroll containing the Fireball spell.',
    properties: { spell: 'fireball', level: 3 },
    source: 'SRD',
  },
  {
    id: 'bag-holding',
    name: 'Bag of Holding',
    type: 'wondrous',
    rarity: 'uncommon',
    weight: 15,
    value: 4000,
    description: 'This bag has an interior space considerably larger than its outside dimensions.',
    properties: { capacity: 500, weightLimit: 500 },
    source: 'SRD',
  },
]);

/** Legacy falsy || defaults — no schema coercion. */
export function applyItemDefaults(data: Record<string, unknown>, id: string): QuarantineItem {
  return {
    id,
    name: data.name || 'Unknown',
    type: data.type || 'other',
    rarity: data.rarity || 'common',
    weight: data.weight || 0,
    value: data.value || 0,
    description: data.description || '',
    properties: data.properties || {},
    source: data.source || 'custom',
  };
}

export function filterItems(
  catalog: ReadonlyArray<QuarantineItem>,
  query: { readonly type?: string; readonly rarity?: string },
): ReadonlyArray<QuarantineItem> {
  let all = [...catalog];
  if (query.type) all = all.filter((i) => i.type === query.type);
  if (query.rarity) all = all.filter((i) => i.rarity === query.rarity);
  return all;
}

const GEN_TYPES = ['weapon', 'armor', 'potion', 'scroll', 'wondrous'] as const;
const GEN_RARITIES = ['common', 'uncommon', 'rare', 'very rare', 'legendary'] as const;

/**
 * Seeded generate — matches legacy Math.random draw order:
 * name-type, type, rarity, weight, value (body type/rarity ignored).
 */
export function generateItem(rng: () => number, id: string): QuarantineItem {
  const nameType = GEN_TYPES[Math.floor(rng() * GEN_TYPES.length)]!;
  const type = GEN_TYPES[Math.floor(rng() * GEN_TYPES.length)]!;
  const rarity = GEN_RARITIES[Math.floor(rng() * GEN_RARITIES.length)]!;
  const weight = Math.floor(rng() * 50);
  const value = Math.floor(rng() * 50000);
  return applyItemDefaults(
    {
      name: `Magic ${nameType}`,
      type,
      rarity,
      weight,
      value,
    },
    id,
  );
}

export function createSeededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
