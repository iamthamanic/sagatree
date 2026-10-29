/**
 * Quarantined Edge `rulesets` worker characterization (MIG-419 / #835).
 * Location: server/src/modules/rulesets/internal/edge-rulesets-quarantine.ts
 *
 * NOT a public host route. Legacy worker is dispatcher-unmounted (404).
 * In-memory Maps + injectable Open5e fetch only — no RLS invented for Maps.
 * Do not wire into HTTP/WS without a separate human activation ticket.
 */

/** Explicit product decision: no automatic host/public activation. */
export const RULESETS_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/** Legacy Map is not the durable host rulesets catalog (MIG-309 ports). */
export const RULESETS_MAP_IS_HOST_CATALOG_POLICY = false as const;

export const OPEN5E_API_BASE = 'https://api.open5e.com' as const;

export type QuarantineSpell = {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly school: string;
  readonly castingTime: string;
  readonly range: string;
  readonly components: ReadonlyArray<string>;
  readonly duration: string;
  readonly description: string;
  readonly higherLevels?: string;
  readonly classes: ReadonlyArray<string>;
  readonly source: string;
};

export type QuarantineMonster = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly size: string;
  readonly challengeRating: number;
  readonly hp: number;
  readonly ac: number;
  readonly speed: string;
  readonly str: number;
  readonly dex: number;
  readonly con: number;
  readonly int: number;
  readonly wis: number;
  readonly cha: number;
  readonly actions: ReadonlyArray<string>;
  readonly source: string;
};

export type QuarantineItem = {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly rarity: string;
  readonly weight: number;
  readonly cost: string;
  readonly description: string;
  readonly source: string;
};

export type QuarantineRuleset = {
  /** Legacy create may store a truthy non-string JSON `id` (e.g. number) via `data.id || …`. */
  readonly id: string | number;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly abilities: ReadonlyArray<string>;
  readonly skills: Readonly<Record<string, string>>;
  readonly conditions: ReadonlyArray<string>;
  readonly dice: ReadonlyArray<string>;
  readonly classes: Readonly<Record<string, unknown>>;
  readonly races: Readonly<Record<string, unknown>>;
  readonly features: Readonly<Record<string, unknown>>;
  readonly spells?: ReadonlyArray<QuarantineSpell>;
  readonly monsters?: ReadonlyArray<QuarantineMonster>;
  readonly items?: ReadonlyArray<QuarantineItem>;
  readonly source: string;
  readonly isOfficial: boolean;
  readonly isCustom: boolean;
};

const DEFAULT_ABILITIES = Object.freeze([
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
]);

const DEFAULT_DICE = Object.freeze(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']);

/** Minimal seeded SRD stub — enough for enrich/id fixtures (not full Edge dump). */
export function createSeededRulesetCatalog(): Map<string | number, QuarantineRuleset> {
  const catalog = new Map<string | number, QuarantineRuleset>();
  catalog.set(
    'dnd5e-srd',
    Object.freeze({
      id: 'dnd5e-srd',
      name: 'D&D 5th Edition SRD',
      version: '5.1',
      description: 'Dungeons & Dragons 5th Edition System Reference Document',
      abilities: DEFAULT_ABILITIES,
      skills: Object.freeze({ athletics: 'strength', stealth: 'dexterity' }),
      conditions: Object.freeze(['blinded', 'charmed']),
      dice: DEFAULT_DICE,
      classes: Object.freeze({}),
      races: Object.freeze({}),
      features: Object.freeze({}),
      spells: Object.freeze([]),
      monsters: Object.freeze([]),
      items: Object.freeze([]),
      source: 'SRD',
      isOfficial: true,
      isCustom: false,
    }),
  );
  catalog.set(
    'pf2e-core',
    Object.freeze({
      id: 'pf2e-core',
      name: 'Pathfinder 2e',
      version: '2.0',
      description: 'Pathfinder Second Edition',
      abilities: DEFAULT_ABILITIES,
      skills: Object.freeze({}),
      conditions: Object.freeze([]),
      dice: Object.freeze(['d4', 'd6', 'd8', 'd10', 'd12', 'd20']),
      classes: Object.freeze({}),
      races: Object.freeze({}),
      features: Object.freeze({}),
      source: 'OGL',
      isOfficial: true,
      isCustom: false,
    }),
  );
  return catalog;
}

/**
 * Legacy createRuleset defaults — caller-supplied id overwrites Map entry;
 * no auth/owner/validation.
 */
export function applyRulesetCreateDefaults(
  data: Record<string, unknown>,
  nowMs: number,
): QuarantineRuleset {
  // Legacy: `data.id || \`custom-${Date.now()}\`` — any truthy id (incl. number) is kept.
  const id =
    data.id || (`custom-${nowMs}` as string | number);
  return {
    id: id as string | number,
    name: (typeof data.name === 'string' && data.name) || 'Custom Ruleset',
    version: (typeof data.version === 'string' && data.version) || '1.0',
    description: typeof data.description === 'string' ? data.description : '',
    abilities: Array.isArray(data.abilities)
      ? data.abilities.map(String)
      : [...DEFAULT_ABILITIES],
    skills:
      data.skills && typeof data.skills === 'object' && !Array.isArray(data.skills)
        ? { ...(data.skills as Record<string, string>) }
        : {},
    conditions: Array.isArray(data.conditions) ? data.conditions.map(String) : [],
    dice: Array.isArray(data.dice) ? data.dice.map(String) : [...DEFAULT_DICE],
    classes:
      data.classes && typeof data.classes === 'object' && !Array.isArray(data.classes)
        ? { ...(data.classes as Record<string, unknown>) }
        : {},
    races:
      data.races && typeof data.races === 'object' && !Array.isArray(data.races)
        ? { ...(data.races as Record<string, unknown>) }
        : {},
    features:
      data.features && typeof data.features === 'object' && !Array.isArray(data.features)
        ? { ...(data.features as Record<string, unknown>) }
        : {},
    source: (typeof data.source === 'string' && data.source) || 'custom',
    isOfficial: false,
    isCustom: true,
  };
}

/** Put into catalog — same id overwrites (legacy Map.set; keys may be non-string). */
export function putRuleset(
  catalog: Map<string | number, QuarantineRuleset>,
  ruleset: QuarantineRuleset,
): QuarantineRuleset {
  catalog.set(ruleset.id, ruleset);
  return ruleset;
}

export function getRulesetFromCatalog(
  catalog: ReadonlyMap<string | number, QuarantineRuleset>,
  id: string | number,
): QuarantineRuleset | null {
  return catalog.get(id) ?? null;
}

export type Open5eFetch = (input: string) => Promise<{
  readonly ok?: boolean;
  readonly json: () => Promise<unknown>;
}>;

/**
 * Exact Open5e spell field mapping from Edge worker.
 * Malformed rows (non-string `components` / `dnd_class`) throw — fetch helper returns [].
 */
export function mapOpen5eSpell(raw: Record<string, unknown>): QuarantineSpell {
  const components = (raw.components as string).split(',').map((c: string) => c.trim());
  const classes = (raw.dnd_class as string).split(',').map((c: string) => c.trim().toLowerCase());
  return {
    id: String(raw.slug ?? ''),
    name: String(raw.name ?? ''),
    level: parseInt(String(raw.level ?? '0'), 10) || 0,
    school: String(raw.school ?? ''),
    castingTime: String(raw.casting_time ?? ''),
    range: String(raw.range ?? ''),
    components,
    duration: String(raw.duration ?? ''),
    description: String(raw.desc ?? ''),
    higherLevels: typeof raw.higher_level === 'string' ? raw.higher_level : undefined,
    classes,
    source: 'Open5e',
  };
}

/** Exact Open5e monster field mapping from Edge worker. */
export function mapOpen5eMonster(raw: Record<string, unknown>): QuarantineMonster {
  return {
    id: String(raw.slug ?? ''),
    name: String(raw.name ?? ''),
    type: String(raw.type ?? ''),
    size: String(raw.size ?? ''),
    challengeRating: parseFloat(String(raw.cr ?? '0')) || 0,
    hp: Number(raw.hit_points) || 0,
    ac: Number(raw.armor_class) || 0,
    speed: String(raw.speed ?? ''),
    str: Number(raw.strength) || 0,
    dex: Number(raw.dexterity) || 0,
    con: Number(raw.constitution) || 0,
    int: Number(raw.intelligence) || 0,
    wis: Number(raw.wisdom) || 0,
    cha: Number(raw.charisma) || 0,
    actions: [],
    source: 'Open5e',
  };
}

/** Exact Open5e weapon→item mapping from Edge worker. */
export function mapOpen5eItem(raw: Record<string, unknown>): QuarantineItem {
  return {
    id: String(raw.slug ?? ''),
    name: String(raw.name ?? ''),
    type: 'weapon',
    rarity: 'common',
    weight: 0,
    cost: String(raw.cost ?? ''),
    description: typeof raw.desc === 'string' ? raw.desc : '',
    source: 'Open5e',
  };
}

async function readOpen5eResults(
  fetchImpl: Open5eFetch,
  url: string,
  mapOne: (row: Record<string, unknown>) => unknown,
): Promise<unknown[]> {
  try {
    const response = await fetchImpl(url);
    const data = await response.json();
    if (!data || typeof data !== 'object' || !Array.isArray((data as { results?: unknown }).results)) {
      return [];
    }
    return (data as { results: unknown[] }).results.map((row) =>
      mapOne(row && typeof row === 'object' ? (row as Record<string, unknown>) : {}),
    );
  } catch {
    return [];
  }
}

export async function fetchOpen5eSpells(fetchImpl: Open5eFetch): Promise<ReadonlyArray<QuarantineSpell>> {
  const rows = await readOpen5eResults(
    fetchImpl,
    `${OPEN5E_API_BASE}/spells/?limit=500`,
    mapOpen5eSpell,
  );
  return rows as QuarantineSpell[];
}

export async function fetchOpen5eMonsters(
  fetchImpl: Open5eFetch,
): Promise<ReadonlyArray<QuarantineMonster>> {
  const rows = await readOpen5eResults(
    fetchImpl,
    `${OPEN5E_API_BASE}/monsters/?limit=500`,
    mapOpen5eMonster,
  );
  return rows as QuarantineMonster[];
}

export async function fetchOpen5eItems(fetchImpl: Open5eFetch): Promise<ReadonlyArray<QuarantineItem>> {
  const rows = await readOpen5eResults(
    fetchImpl,
    `${OPEN5E_API_BASE}/weapons/?limit=500`,
    mapOpen5eItem,
  );
  return rows as QuarantineItem[];
}

/**
 * Legacy enrich — only `dnd5e-srd` merges Open5e; other ids return as-is;
 * missing id → null. Fetch failures → empty supplement arrays.
 * Does not assume limit=500 paginates or includes all remote records.
 */
export async function enrichRulesetWithOpen5e(
  catalog: ReadonlyMap<string | number, QuarantineRuleset>,
  rulesetId: string | number,
  fetchImpl: Open5eFetch,
): Promise<QuarantineRuleset | null> {
  const ruleset = catalog.get(rulesetId);
  if (!ruleset) return null;
  if (rulesetId !== 'dnd5e-srd') return ruleset;
  const [spells, monsters, items] = await Promise.all([
    fetchOpen5eSpells(fetchImpl),
    fetchOpen5eMonsters(fetchImpl),
    fetchOpen5eItems(fetchImpl),
  ]);
  return {
    ...ruleset,
    spells: [...(ruleset.spells ?? []), ...spells],
    monsters: [...(ruleset.monsters ?? []), ...monsters],
    items: [...(ruleset.items ?? []), ...items],
  };
}

export async function getRuleset(
  catalog: ReadonlyMap<string | number, QuarantineRuleset>,
  id: string | number,
  enrich: boolean,
  fetchImpl: Open5eFetch,
): Promise<QuarantineRuleset | null> {
  const ruleset = catalog.get(id);
  if (!ruleset) return null;
  if (enrich) return enrichRulesetWithOpen5e(catalog, id, fetchImpl);
  return ruleset;
}

/** Documents known Edge defects for successor tickets. */
export function describeRulesetsLegacyDefects(): ReadonlyArray<string> {
  return Object.freeze([
    'No auth, owner model or creation validation on Map writes',
    'Caller-supplied id can overwrite an existing Map entry',
    'Open5e fetches have no explicit timeout, status check, or pagination beyond limit=500',
    'limit=500 does not guarantee all remote records',
  ]);
}
