/**
 * Quarantined items Edge worker characterization (MIG-411 / #827).
 * Location: server/src/modules/inventory/internal/items-quarantine.ts
 *
 * NOT a public host route. Distinct from durable inventory_item_definitions.
 */

export const ITEMS_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/** Legacy Map catalog is not the durable inventory definitions adapter. */
export const ITEMS_MAP_IS_DURABLE_INVENTORY = false as const;

export type QuarantineItem = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly rarity: string;
  readonly weight: number;
  readonly value: number;
  readonly description: string;
  readonly properties: Record<string, unknown>;
  readonly source: string;
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
    description: 'Made of interlocking metal rings.',
    properties: { ac: 16, strength: 13, stealth: 'disadvantage' },
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
]);

export function applyItemDefaults(
  data: Record<string, unknown>,
  id: string,
): QuarantineItem {
  return {
    id,
    name: (data.name as string) || 'Unknown',
    type: (data.type as string) || 'other',
    rarity: (data.rarity as string) || 'common',
    weight: (data.weight as number) || 0,
    value: (data.value as number) || 0,
    description: (data.description as string) || '',
    properties: (data.properties as Record<string, unknown>) || {},
    source: (data.source as string) || 'custom',
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

/** Seeded generate — legacy ignores request body type/rarity and rolls both independently. */
export function generateItem(
  rng: () => number,
  id: string,
): QuarantineItem {
  const type = GEN_TYPES[Math.floor(rng() * GEN_TYPES.length)]!;
  const rarity = GEN_RARITIES[Math.floor(rng() * GEN_RARITIES.length)]!;
  const nameType = GEN_TYPES[Math.floor(rng() * GEN_TYPES.length)]!;
  return applyItemDefaults(
    {
      name: `Magic ${nameType}`,
      type,
      rarity,
      weight: Math.floor(rng() * 50),
      value: Math.floor(rng() * 50000),
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
