/**
 * Quarantined Edge `npcs` worker characterization (MIG-417 / #833).
 * Location: server/src/modules/npc-creature/internal/npcs-quarantine.ts
 *
 * NOT a public host route. Legacy worker is dispatcher-unmounted (404).
 * In-memory Maps only — not npc_creature_definitions / instances / controller policy.
 * Do not wire into HTTP/WS without a separate human activation ticket.
 */

/** Explicit product decision: no automatic host/public activation. */
export const NPCS_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/**
 * Legacy Map catalog is not the durable npc_creature_* policy surface.
 * Successors must not treat this quarantine as a persistence-ownership replacement.
 */
export const NPCS_MAP_IS_NPC_CREATURE_POLICY = false as const;

export type QuarantineNpcDisposition = 'friendly' | 'neutral' | 'hostile' | 'unknown';

export type QuarantineNpcStats = {
  readonly strength: number;
  readonly dexterity: number;
  readonly constitution: number;
  readonly intelligence: number;
  readonly wisdom: number;
  readonly charisma: number;
};

export type QuarantineNpc = {
  readonly id: string;
  readonly name: string;
  readonly type: 'npc' | 'monster' | 'creature';
  readonly race: string;
  readonly class: string;
  readonly level: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly ac: number;
  readonly speed: number;
  readonly description: string;
  readonly disposition: QuarantineNpcDisposition;
  readonly location: string;
  readonly memories: ReadonlyArray<string>;
  readonly relationships: Readonly<Record<string, string>>;
  readonly stats: QuarantineNpcStats;
  readonly abilities: ReadonlyArray<string>;
  readonly actions: ReadonlyArray<string>;
  readonly inventory: ReadonlyArray<string>;
  readonly portrait?: string;
  readonly notes?: string;
  readonly tags: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type QuarantineDialogueResponse = {
  readonly text: string;
  readonly nextDialogueId?: string;
  readonly effect?: string;
};

export type QuarantineDialogueLine = {
  readonly id: string;
  readonly npcId: string;
  readonly trigger: string;
  readonly text: string;
  readonly conditions?: ReadonlyArray<string>;
  readonly responses?: ReadonlyArray<QuarantineDialogueResponse>;
  readonly tags: ReadonlyArray<string>;
};

export const NPC_RACE_NAMES = Object.freeze({
  human: Object.freeze({
    male: Object.freeze([
      'Aldric',
      'Brom',
      'Cedric',
      'Darvin',
      'Eldon',
      'Finn',
      'Garrick',
      'Harold',
    ]),
    female: Object.freeze([
      'Alara',
      'Brea',
      'Cora',
      'Dara',
      'Elara',
      'Fia',
      'Gwen',
      'Hanna',
    ]),
  }),
  elf: Object.freeze({
    male: Object.freeze([
      'Aelrindel',
      'Braenar',
      'Caelynn',
      'Daelys',
      'Elandorr',
      'Faelyn',
      'Gaelin',
      'Hadar',
    ]),
    female: Object.freeze([
      'Aeliana',
      'Braelynn',
      'Caelynn',
      'Daelynn',
      'Elanna',
      'Faelynn',
      'Gaelynn',
      'Haelynn',
    ]),
  }),
  dwarf: Object.freeze({
    male: Object.freeze([
      'Adrik',
      'Bardin',
      'Dolgan',
      'Gardin',
      'Harbek',
      'Kargan',
      'Mardin',
      'Thordak',
    ]),
    female: Object.freeze([
      'Annora',
      'Brynna',
      'Dagna',
      'Greta',
      'Helga',
      'Kadra',
      'Marda',
      'Thora',
    ]),
  }),
  halfling: Object.freeze({
    male: Object.freeze([
      'Alton',
      'Bram',
      'Cedric',
      'Dunn',
      'Eldon',
      'Finbar',
      'Garrett',
      'Hob',
    ]),
    female: Object.freeze([
      'Bella',
      'Cora',
      'Daisy',
      'Elsa',
      'Fiona',
      'Gemma',
      'Holly',
      'Ivy',
    ]),
  }),
  tiefling: Object.freeze({
    male: Object.freeze([
      'Aktaeos',
      'Barakas',
      'Damakos',
      'Ephren',
      'Gauros',
      'Kairon',
      'Melech',
      'Nerios',
    ]),
    female: Object.freeze([
      'Akta',
      'Bryseis',
      'Criella',
      'Ephyra',
      'Grieta',
      'Kalista',
      'Melia',
      'Nyx',
    ]),
  }),
  dragonborn: Object.freeze({
    male: Object.freeze([
      'Arjhan',
      'Bharash',
      'Donaar',
      'Ghesh',
      'Havar',
      'Kriv',
      'Medrash',
      'Nadarr',
    ]),
    female: Object.freeze([
      'Akra',
      'Bharra',
      'Daaria',
      'Gheshra',
      'Havara',
      'Kriva',
      'Medra',
      'Nadaara',
    ]),
  }),
});

export const NPC_CLASSES = Object.freeze([
  'Fighter',
  'Wizard',
  'Rogue',
  'Cleric',
  'Ranger',
  'Paladin',
  'Barbarian',
  'Bard',
  'Druid',
  'Monk',
  'Sorcerer',
  'Warlock',
]);

export const NPC_DISPOSITIONS = Object.freeze(['friendly', 'neutral', 'hostile'] as const);

export const NPC_LOCATIONS = Object.freeze([
  'Tavern',
  'Market',
  'Temple',
  'Castle',
  'Forest',
  'Mountain',
  'Village',
  'City',
  'Dungeon Entrance',
  'Port',
]);

const PERSONALITY_TRAITS = Object.freeze([
  'is always polite and respectful',
  'has a dry sense of humor',
  'is suspicious of strangers',
  'loves to tell stories',
  'is deeply religious',
  'has a quick temper',
  'is very curious',
  'is always looking for a bargain',
  'is terrified of magic',
  'has a secret agenda',
]);

const PHYSICAL_TRAITS = Object.freeze([
  'has a scar across their face',
  'wears distinctive jewelry',
  'has unusual eye color',
  'walks with a limp',
  'has tattoos covering their arms',
  'dresses in fine clothes',
  'has a missing finger',
  'carries a weapon everywhere',
]);

const HIT_DIE: Readonly<Record<string, number>> = Object.freeze({
  Barbarian: 12,
  Fighter: 10,
  Paladin: 10,
  Ranger: 10,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Monk: 8,
  Rogue: 8,
  Warlock: 8,
  Sorcerer: 6,
  Wizard: 6,
});

export function createSeededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function randomFrom<T>(arr: ReadonlyArray<T>, rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

export function generateStats(rng: () => number): QuarantineNpcStats {
  const roll = () => Math.floor(rng() * 15) + 3;
  return {
    strength: roll(),
    dexterity: roll(),
    constitution: roll(),
    intelligence: roll(),
    wisdom: roll(),
    charisma: roll(),
  };
}

export function generateDescription(
  npc: Pick<QuarantineNpc, 'name' | 'race' | 'class' | 'level'>,
  rng: () => number,
): string {
  const traits: string[] = [];
  if (npc.race) traits.push(`is a ${npc.race}`);
  if (npc.class) traits.push(`${npc.class}`);
  if (npc.level) traits.push(`level ${npc.level}`);
  const personality = randomFrom(PERSONALITY_TRAITS, rng);
  const physical = randomFrom(PHYSICAL_TRAITS, rng);
  return `${npc.name || 'This NPC'} ${traits.join(', ')}. They ${personality} and ${physical}.`;
}

function generateName(race: string, gender: 'male' | 'female', rng: () => number): string {
  const key = race.toLowerCase() as keyof typeof NPC_RACE_NAMES;
  const raceNames = NPC_RACE_NAMES[key] ?? NPC_RACE_NAMES.human;
  const pool = raceNames[gender] ?? raceNames.male;
  return randomFrom(pool, rng);
}

function buildNpcRecord(
  data: Record<string, unknown>,
  id: string,
  nowIso: string,
  rng: () => number,
  fillEmptyDescription: boolean,
): QuarantineNpc {
  const name = (typeof data.name === 'string' && data.name) || 'Unknown';
  const typeRaw = data.type;
  const type: QuarantineNpc['type'] =
    typeRaw === 'monster' || typeRaw === 'creature' || typeRaw === 'npc' ? typeRaw : 'npc';
  const race = (typeof data.race === 'string' && data.race) || 'human';
  const npcClass = (typeof data.class === 'string' && data.class) || 'commoner';
  const level = (typeof data.level === 'number' ? data.level : 0) || 1;
  const hp = (typeof data.hp === 'number' ? data.hp : 0) || 10;
  const maxHp = (typeof data.maxHp === 'number' ? data.maxHp : 0) || 10;
  const ac = (typeof data.ac === 'number' ? data.ac : 0) || 10;
  const speed = (typeof data.speed === 'number' ? data.speed : 0) || 30;
  let description = typeof data.description === 'string' ? data.description : '';
  const dispositionRaw = data.disposition;
  const disposition: QuarantineNpcDisposition =
    dispositionRaw === 'friendly' ||
    dispositionRaw === 'neutral' ||
    dispositionRaw === 'hostile' ||
    dispositionRaw === 'unknown'
      ? dispositionRaw
      : 'neutral';
  const location = (typeof data.location === 'string' && data.location) || 'Unknown';
  const memories = Array.isArray(data.memories) ? data.memories.map(String) : [];
  const relationships =
    data.relationships && typeof data.relationships === 'object' && !Array.isArray(data.relationships)
      ? Object.fromEntries(
          Object.entries(data.relationships as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
        )
      : {};
  const stats =
    data.stats && typeof data.stats === 'object'
      ? (data.stats as QuarantineNpcStats)
      : generateStats(rng);
  const abilities = Array.isArray(data.abilities) ? data.abilities.map(String) : [];
  const actions = Array.isArray(data.actions) ? data.actions.map(String) : [];
  const inventory = Array.isArray(data.inventory) ? data.inventory.map(String) : [];
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];

  if (fillEmptyDescription && !description) {
    description = generateDescription({ name, race, class: npcClass, level }, rng);
  }

  return {
    id,
    name,
    type,
    race,
    class: npcClass,
    level,
    hp,
    maxHp,
    ac,
    speed,
    description,
    disposition,
    location,
    memories,
    relationships,
    stats,
    abilities,
    actions,
    inventory,
    portrait: typeof data.portrait === 'string' ? data.portrait : undefined,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    tags,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/**
 * Legacy createNPC falsy || defaults. Empty description is replaced via generateDescription
 * (create path only — import keeps empty description).
 */
export function applyNpcCreateDefaults(
  data: Record<string, unknown>,
  id: string,
  nowIso: string,
  rng: () => number,
): QuarantineNpc {
  return buildNpcRecord(data, id, nowIso, rng, true);
}

/** Legacy importNPC — same defaults but never auto-fills description. */
export function applyNpcImportDefaults(
  data: Record<string, unknown>,
  id: string,
  nowIso: string,
  rng: () => number,
): QuarantineNpc {
  return buildNpcRecord(data, id, nowIso, rng, false);
}

/**
 * Legacy generateNPC — accepts `prompt` but never uses it (no external provider).
 * Level 1..10; AC 12..17; stats each 3..17.
 */
export function generateNpc(
  options: {
    readonly type?: 'npc' | 'monster' | 'creature';
    readonly race?: string;
    readonly class?: string;
    readonly level?: number;
    readonly location?: string;
    readonly prompt?: string;
  },
  id: string,
  nowIso: string,
  rng: () => number,
): QuarantineNpc {
  void options.prompt;
  const raceKeys = Object.keys(NPC_RACE_NAMES);
  const race = options.race || randomFrom(raceKeys, rng);
  const gender: 'male' | 'female' = rng() > 0.5 ? 'male' : 'female';
  const name = generateName(race, gender, rng);
  const npcClass = options.class || randomFrom(NPC_CLASSES, rng);
  const level = options.level || Math.floor(rng() * 10) + 1;
  const disposition = randomFrom(NPC_DISPOSITIONS, rng);
  const location = options.location || randomFrom(NPC_LOCATIONS, rng);

  const hd = HIT_DIE[npcClass] || 8;
  const conRaw = Math.floor(rng() * 15) + 3;
  const conMod = Math.floor((conRaw - 10) / 2);
  const maxHp = hd + conMod + (level - 1) * (Math.floor(hd / 2) + 1 + conMod);
  const ac = Math.floor(rng() * 6) + 12;
  const stats = generateStats(rng);

  return applyNpcCreateDefaults(
    {
      name,
      type: options.type || 'npc',
      race,
      class: npcClass,
      level,
      hp: maxHp,
      maxHp,
      ac,
      disposition,
      location,
      memories: [],
      relationships: {},
      stats,
      tags: [race.toLowerCase(), npcClass.toLowerCase(), disposition],
    },
    id,
    nowIso,
    rng,
  );
}

/** Legacy getMemories — limit defaults to 10 at the HTTP layer; slice from end. */
export function sliceMemories(
  memories: ReadonlyArray<string>,
  limit: number | undefined,
): ReadonlyArray<string> {
  if (limit === undefined) return [...memories];
  return memories.slice(-limit);
}

/** Legacy setRelationship — replacement write for targetId key. */
export function setRelationship(
  relationships: Readonly<Record<string, string>>,
  targetId: string,
  relationship: string,
): Record<string, string> {
  return { ...relationships, [targetId]: relationship };
}

/**
 * Legacy addDialogue shape. Object spread AFTER id/npcId means caller fields can
 * override nominally generated identity (documented legacy defect).
 */
export function buildDialogueLine(
  npcId: string,
  generatedId: string,
  dialogue: Record<string, unknown>,
): QuarantineDialogueLine {
  const base = {
    id: generatedId,
    npcId,
  };
  const merged = { ...base, ...dialogue } as Record<string, unknown>;
  return {
    id: typeof merged.id === 'string' ? merged.id : generatedId,
    npcId: typeof merged.npcId === 'string' ? merged.npcId : npcId,
    trigger: typeof merged.trigger === 'string' ? merged.trigger : '',
    text: typeof merged.text === 'string' ? merged.text : '',
    conditions: Array.isArray(merged.conditions) ? merged.conditions.map(String) : undefined,
    responses: Array.isArray(merged.responses)
      ? (merged.responses as QuarantineDialogueResponse[])
      : undefined,
    tags: Array.isArray(merged.tags) ? merged.tags.map(String) : [],
  };
}

export function describeNpcsLegacyDefects(): ReadonlyArray<string> {
  return Object.freeze([
    'No auth/ownership/session visibility on historical worker Maps',
    'generateNPC accepts prompt but never uses it (no external provider)',
    'addDialogue object spread may override nominally generated id/npcId',
  ]);
}
