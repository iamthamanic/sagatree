/**
 * Quarantined Edge `spellbook` worker characterization (MIG-423 / #839).
 * Location: server/src/modules/character/internal/spellbook-edge-quarantine.ts
 *
 * NOT a public host route. Legacy worker is dispatcher-unmounted (404).
 * In-memory Maps only — no identity, owner, or role authorization; characterId
 * in path is trusted. Cast does not verify spell exists / known / prepared.
 * Do not wire into HTTP without a separate human activation ticket.
 */

/** Explicit product decision: no automatic host/public activation. */
export const SPELLBOOK_EDGE_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/** Legacy Maps are not durable spell / spellbook policy. */
export const SPELLBOOK_EDGE_MAP_IS_DURABLE = false as const;

export type QuarantineSpellSchool =
  | 'abjuration'
  | 'conjuration'
  | 'divination'
  | 'enchantment'
  | 'evocation'
  | 'illusion'
  | 'necromancy'
  | 'transmutation';

export type QuarantineSpell = {
  id: string;
  name: string;
  level: number;
  school: QuarantineSpellSchool;
  castingTime: string;
  range: string;
  components: string[];
  duration: string;
  description: string;
  higherLevels?: string;
  classes: string[];
  source: string;
};

export type QuarantineKnownSpell = {
  spellId: string;
  known: boolean;
  prepared: boolean;
};

export type QuarantineCharacterSpellbook = {
  characterId: string;
  spells: QuarantineKnownSpell[];
  slotsUsed: Record<string, number>;
};

export type SpellbookEdgeQuarantineStore = {
  readonly spells: Map<string, QuarantineSpell>;
  readonly spellbooks: Map<string, QuarantineCharacterSpellbook>;
  idSeq: number;
};

const MAX_SLOTS: Record<string, number> = {
  level1: 4,
  level2: 3,
  level3: 3,
  level4: 3,
  level5: 2,
  level6: 1,
  level7: 1,
  level8: 1,
  level9: 1,
};

const SRD_SEED: QuarantineSpell[] = [
  {
    id: 'fireball',
    name: 'Fireball',
    level: 3,
    school: 'evocation',
    castingTime: '1 action',
    range: '150 feet',
    components: ['V', 'S', 'M'],
    duration: 'Instantaneous',
    description:
      'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.',
    classes: ['sorcerer', 'wizard'],
    source: 'SRD',
  },
  {
    id: 'magic-missile',
    name: 'Magic Missile',
    level: 1,
    school: 'evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: ['V', 'S'],
    duration: 'Instantaneous',
    description:
      'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range.',
    classes: ['sorcerer', 'wizard'],
    source: 'SRD',
  },
  {
    id: 'healing-word',
    name: 'Healing Word',
    level: 1,
    school: 'evocation',
    castingTime: '1 bonus action',
    range: '60 feet',
    components: ['V'],
    duration: 'Instantaneous',
    description:
      'A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier.',
    classes: ['bard', 'cleric', 'druid'],
    source: 'SRD',
  },
  {
    id: 'cure-wounds',
    name: 'Cure Wounds',
    level: 1,
    school: 'evocation',
    castingTime: '1 action',
    range: 'Touch',
    components: ['V', 'S'],
    duration: 'Instantaneous',
    description:
      'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.',
    classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger'],
    source: 'SRD',
  },
  {
    id: 'shield',
    name: 'Shield',
    level: 1,
    school: 'abjuration',
    castingTime: '1 reaction',
    range: 'Self',
    components: ['V', 'S'],
    duration: '1 round',
    description:
      'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC.',
    classes: ['sorcerer', 'wizard'],
    source: 'SRD',
  },
  {
    id: 'detect-magic',
    name: 'Detect Magic',
    level: 1,
    school: 'divination',
    castingTime: '1 action',
    range: 'Self',
    components: ['V', 'S'],
    duration: 'Concentration, up to 10 minutes',
    description: 'For the duration, you sense the presence of magic within 30 feet of you.',
    classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'wizard'],
    source: 'SRD',
  },
  {
    id: 'invisibility',
    name: 'Invisibility',
    level: 2,
    school: 'illusion',
    castingTime: '1 action',
    range: 'Touch',
    components: ['V', 'S', 'M'],
    duration: 'Concentration, up to 1 hour',
    description: 'A creature you touch becomes invisible until the spell ends.',
    classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
    source: 'SRD',
  },
  {
    id: 'counterspell',
    name: 'Counterspell',
    level: 3,
    school: 'abjuration',
    castingTime: '1 reaction',
    range: '60 feet',
    components: ['S'],
    duration: 'Instantaneous',
    description: 'You attempt to interrupt a creature in the process of casting a spell.',
    classes: ['sorcerer', 'warlock', 'wizard'],
    source: 'SRD',
  },
  {
    id: 'hold-person',
    name: 'Hold Person',
    level: 2,
    school: 'enchantment',
    castingTime: '1 action',
    range: '60 feet',
    components: ['V', 'S', 'M'],
    duration: 'Concentration, up to 1 minute',
    description:
      'Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed.',
    classes: ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard'],
    source: 'SRD',
  },
  {
    id: 'fly',
    name: 'Fly',
    level: 3,
    school: 'transmutation',
    castingTime: '1 action',
    range: 'Touch',
    components: ['V', 'S', 'M'],
    duration: 'Concentration, up to 10 minutes',
    description:
      'You touch a willing creature. The target gains a flying speed of 60 feet for the duration.',
    classes: ['sorcerer', 'warlock', 'wizard'],
    source: 'SRD',
  },
];

/** Edge parity: `crypto.randomUUID()`. Optional store bump keeps seq for tests. */
function nextGeneratedId(store: SpellbookEdgeQuarantineStore): string {
  store.idSeq += 1;
  return crypto.randomUUID();
}

export function createSpellbookEdgeQuarantineStore(): SpellbookEdgeQuarantineStore {
  const spells = new Map<string, QuarantineSpell>();
  for (const s of SRD_SEED) {
    spells.set(s.id, { ...s, components: [...s.components], classes: [...s.classes] });
  }
  return { spells, spellbooks: new Map(), idSeq: 0 };
}

export function listQuarantineSpells(
  store: SpellbookEdgeQuarantineStore,
  filters?: { level?: number; school?: string; classFilter?: string },
): QuarantineSpell[] {
  let all = Array.from(store.spells.values());
  if (filters?.level !== undefined) {
    all = all.filter((s) => s.level === filters.level);
  }
  if (filters?.school) {
    all = all.filter((s) => s.school === filters.school);
  }
  if (filters?.classFilter) {
    const needle = filters.classFilter.toLowerCase();
    all = all.filter((s) => s.classes.includes(needle));
  }
  return all;
}

export function getQuarantineSpell(
  store: SpellbookEdgeQuarantineStore,
  id: string,
): QuarantineSpell | null {
  return store.spells.get(id) ?? null;
}

/**
 * Edge parity: always allocates a new id (`crypto.randomUUID`); body `id` is
 * never authority. Optional third `id` is test-only fixture injection.
 */
export function createQuarantineSpell(
  store: SpellbookEdgeQuarantineStore,
  data: Omit<Partial<QuarantineSpell>, 'id'>,
  id?: string,
): QuarantineSpell {
  const spellId = id ?? nextGeneratedId(store);
  if (store.spells.has(spellId)) {
    throw new Error('Spell already exists');
  }
  const spell: QuarantineSpell = {
    id: spellId,
    name: data.name || 'Unknown',
    level: data.level ?? 0,
    school: data.school || 'evocation',
    castingTime: data.castingTime || '1 action',
    range: data.range || '60 feet',
    components: data.components ? [...data.components] : ['V', 'S'],
    duration: data.duration || 'Instantaneous',
    description: data.description || '',
    higherLevels: data.higherLevels,
    classes: data.classes ? [...data.classes] : [],
    source: data.source || 'custom',
  };
  store.spells.set(spellId, spell);
  return spell;
}

export function getQuarantineSpellbook(
  store: SpellbookEdgeQuarantineStore,
  characterId: string,
): QuarantineCharacterSpellbook {
  let book = store.spellbooks.get(characterId);
  if (!book) {
    book = { characterId, spells: [], slotsUsed: {} };
    store.spellbooks.set(characterId, book);
  }
  return book;
}

export function learnQuarantineSpell(
  store: SpellbookEdgeQuarantineStore,
  characterId: string,
  spellId: string,
): QuarantineCharacterSpellbook {
  const book = getQuarantineSpellbook(store, characterId);
  const existing = book.spells.find((s) => s.spellId === spellId);
  if (!existing) {
    book.spells.push({ spellId, known: true, prepared: false });
  }
  store.spellbooks.set(characterId, book);
  return book;
}

export function prepareQuarantineSpell(
  store: SpellbookEdgeQuarantineStore,
  characterId: string,
  spellId: string,
): QuarantineCharacterSpellbook {
  const book = getQuarantineSpellbook(store, characterId);
  const spell = book.spells.find((s) => s.spellId === spellId);
  if (spell) spell.prepared = true;
  store.spellbooks.set(characterId, book);
  return book;
}

export function unprepareQuarantineSpell(
  store: SpellbookEdgeQuarantineStore,
  characterId: string,
  spellId: string,
): QuarantineCharacterSpellbook {
  const book = getQuarantineSpellbook(store, characterId);
  const spell = book.spells.find((s) => s.spellId === spellId);
  if (spell) spell.prepared = false;
  store.spellbooks.set(characterId, book);
  return book;
}

/**
 * Edge parity: increments level slot without checking spell exists, is known,
 * prepared, or that level matches the spell definition.
 */
export function castQuarantineSpell(
  store: SpellbookEdgeQuarantineStore,
  characterId: string,
  _spellId: string,
  level: number,
): { success: boolean; remaining: number } {
  const book = getQuarantineSpellbook(store, characterId);
  const slotKey = `level${level}`;
  const max = MAX_SLOTS[slotKey] ?? 0;
  const used = book.slotsUsed[slotKey] ?? 0;
  if (used >= max) return { success: false, remaining: 0 };
  book.slotsUsed[slotKey] = used + 1;
  store.spellbooks.set(characterId, book);
  return { success: true, remaining: max - book.slotsUsed[slotKey] };
}

export function restoreQuarantineSpellSlots(
  store: SpellbookEdgeQuarantineStore,
  characterId: string,
): void {
  const book = getQuarantineSpellbook(store, characterId);
  book.slotsUsed = {};
  store.spellbooks.set(characterId, book);
}

/** Body/path fields that must never be treated as host authz. */
export function characterIdPathIsNotAuthority(): string[] {
  return [
    'characterId in path is trusted without identity/owner/role checks',
    'POST body spellId/level are not membership or class authorization',
    'createSpell body fields are not owner authority',
  ];
}

export function describeSpellbookEdgeLegacyDefects(): string[] {
  return [
    'No membership, GM, or owner validation — characterId path is trusted',
    'In-memory Maps are not durable across processes/restarts',
    'castSpell increments slots without checking spell exists, known, or prepared',
    'GET /spellbook/:id creates an empty Map record (side-effecting read)',
  ];
}
