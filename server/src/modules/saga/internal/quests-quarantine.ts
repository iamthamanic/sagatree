/**
 * Quarantined Edge `quests` worker characterization (MIG-418 / #834).
 * Location: server/src/modules/saga/internal/quests-quarantine.ts
 *
 * NOT a public host route. Legacy worker is dispatcher-unmounted (404).
 * In-memory Maps only — completion does not grant XP/gold/items.
 * Do not wire into HTTP/WS without a separate human activation ticket.
 */

/** Explicit product decision: no automatic host/public activation. */
export const QUESTS_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/** Legacy Map is not durable project-quest / reward grant policy. */
export const QUESTS_MAP_GRANTS_REWARDS = false as const;

export type QuarantineQuestType = 'main' | 'side' | 'personal';
export type QuarantineQuestStatus = 'available' | 'active' | 'completed' | 'failed';

export type QuarantineObjective = {
  readonly id: string;
  readonly description: string;
  readonly completed: boolean;
  readonly target?: string;
  readonly count?: number;
  readonly current?: number;
};

export type QuarantineReward = {
  readonly type: 'xp' | 'gold' | 'item' | 'reputation';
  readonly amount: number;
  readonly item?: string;
};

export type QuarantineQuest = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly description: string;
  readonly type: QuarantineQuestType;
  readonly status: QuarantineQuestStatus;
  readonly objectives: ReadonlyArray<QuarantineObjective>;
  readonly rewards: ReadonlyArray<QuarantineReward>;
  readonly giver?: string;
  readonly location?: string;
  readonly prerequisites: ReadonlyArray<string>;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const TEMPLATES: Readonly<
  Record<QuarantineQuestType, ReadonlyArray<{ name: string; description: string; objectives: ReadonlyArray<string> }>>
> = Object.freeze({
  main: Object.freeze([
    Object.freeze({
      name: "The Dragon's Hoard",
      description: 'Defeat the ancient dragon and reclaim the stolen treasure.',
      objectives: Object.freeze([
        "Travel to Dragon's Lair",
        'Defeat the Dragon',
        'Retrieve the Treasure',
      ]),
    }),
    Object.freeze({
      name: "The Dark Lord's Return",
      description: 'Stop the Dark Lord from rising again.',
      objectives: Object.freeze(['Gather Information', 'Find the Ritual Site', 'Disrupt the Ritual']),
    }),
  ]),
  side: Object.freeze([
    Object.freeze({
      name: 'Lost Heirloom',
      description: 'A villager has lost a precious family heirloom.',
      objectives: Object.freeze(['Search the Woods', 'Find the Heirloom', 'Return to Owner']),
    }),
    Object.freeze({
      name: 'Monster Bounty',
      description: 'A dangerous monster is terrorizing the countryside.',
      objectives: Object.freeze(['Track the Monster', 'Defeat the Monster', 'Collect the Bounty']),
    }),
  ]),
  personal: Object.freeze([
    Object.freeze({
      name: 'Training Exercise',
      description: 'Practice your skills to become stronger.',
      objectives: Object.freeze(['Complete 3 Encounters']),
    }),
    Object.freeze({
      name: 'Ancient Knowledge',
      description: 'Seek out ancient texts to expand your knowledge.',
      objectives: Object.freeze(['Visit the Library', 'Find the Tome', 'Study the Tome']),
    }),
  ]),
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

export function applyQuestDefaults(
  data: Record<string, unknown>,
  id: string,
  nowIso: string,
): QuarantineQuest {
  const typeRaw = data.type;
  const type: QuarantineQuestType =
    typeRaw === 'main' || typeRaw === 'side' || typeRaw === 'personal' ? typeRaw : 'side';
  const statusRaw = data.status;
  const status: QuarantineQuestStatus =
    statusRaw === 'available' ||
    statusRaw === 'active' ||
    statusRaw === 'completed' ||
    statusRaw === 'failed'
      ? statusRaw
      : 'available';
  const objectives = Array.isArray(data.objectives)
    ? data.objectives.map((o, i) => normalizeObjective(o, i))
    : [];
  const rewards = Array.isArray(data.rewards) ? data.rewards.map(normalizeReward) : [];
  return {
    id,
    projectId: typeof data.projectId === 'string' ? data.projectId : '',
    name: (typeof data.name === 'string' && data.name) || 'Unknown Quest',
    description: typeof data.description === 'string' ? data.description : '',
    type,
    status,
    objectives,
    rewards,
    giver: typeof data.giver === 'string' ? data.giver : undefined,
    location: typeof data.location === 'string' ? data.location : undefined,
    prerequisites: Array.isArray(data.prerequisites) ? data.prerequisites.map(String) : [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function normalizeObjective(raw: unknown, index: number): QuarantineObjective {
  if (!raw || typeof raw !== 'object') {
    return { id: `obj-${index}`, description: '', completed: false };
  }
  const o = raw as Record<string, unknown>;
  return {
    id: typeof o.id === 'string' && o.id ? o.id : `obj-${index}`,
    description: typeof o.description === 'string' ? o.description : '',
    completed: o.completed === true,
    target: typeof o.target === 'string' ? o.target : undefined,
    count: typeof o.count === 'number' && Number.isFinite(o.count) ? o.count : undefined,
    current: typeof o.current === 'number' && Number.isFinite(o.current) ? o.current : undefined,
  };
}

function normalizeReward(raw: unknown): QuarantineReward {
  if (!raw || typeof raw !== 'object') return { type: 'xp', amount: 0 };
  const r = raw as Record<string, unknown>;
  const type =
    r.type === 'xp' || r.type === 'gold' || r.type === 'item' || r.type === 'reputation'
      ? r.type
      : 'xp';
  return {
    type,
    amount: typeof r.amount === 'number' && Number.isFinite(r.amount) ? r.amount : 0,
    item: typeof r.item === 'string' ? r.item : undefined,
  };
}

/**
 * Legacy completeObjective — missing objective is a no-op; when all completed,
 * status becomes completed. Does not grant rewards (QUESTS_MAP_GRANTS_REWARDS=false).
 */
export function completeObjective(
  quest: QuarantineQuest,
  objectiveId: string,
  nowIso: string,
): QuarantineQuest {
  const objectives = quest.objectives.map((o) =>
    o.id === objectiveId ? { ...o, completed: true } : o,
  );
  const touched = objectives.some((o, i) => o.completed !== quest.objectives[i]!.completed);
  if (!touched) {
    return quest;
  }
  const allDone = objectives.length > 0 && objectives.every((o) => o.completed);
  return {
    ...quest,
    objectives,
    status: allDone ? 'completed' : quest.status,
    updatedAt: nowIso,
  };
}

export function filterQuests(
  catalog: ReadonlyArray<QuarantineQuest>,
  query: { readonly projectId?: string; readonly status?: string },
): ReadonlyArray<QuarantineQuest> {
  let all = [...catalog];
  if (query.projectId) all = all.filter((q) => q.projectId === query.projectId);
  if (query.status) all = all.filter((q) => q.status === query.status);
  return all;
}

/**
 * Legacy generateQuest — type must be a known template key (constructor/__proto__
 * guarded). level is used as-is for reward math (legacy has no validation).
 */
export function generateQuest(
  type: string,
  level: number,
  id: string,
  nowIso: string,
  rng: () => number,
): QuarantineQuest {
  const safeType: QuarantineQuestType =
    type === 'main' || type === 'side' || type === 'personal' ? type : 'side';
  const pool = TEMPLATES[safeType];
  const template = pool[Math.floor(rng() * pool.length)]!;
  const objectives =
    safeType === 'personal' && template.name === 'Training Exercise'
      ? [
          { id: 'obj-0', description: 'Complete 3 Encounters', completed: false },
          {
            id: 'obj-1',
            description: `Reach Level ${level + 1}`,
            completed: false,
          },
        ]
      : template.objectives.map((desc, i) => ({
          id: `obj-${i}`,
          description: desc,
          completed: false,
        }));
  return applyQuestDefaults(
    {
      name: template.name,
      description: template.description,
      type: safeType,
      objectives,
      rewards: [
        { type: 'xp', amount: level * 100 },
        { type: 'gold', amount: level * 10 },
      ],
      projectId: '',
    },
    id,
    nowIso,
  );
}

/** Documents that unknown types / invalid levels need successor validation. */
export function describeQuestsLegacyDefects(): ReadonlyArray<string> {
  return Object.freeze([
    'Unauthenticated quest/project Map writes',
    'Generated quests default to empty projectId',
    'Objective completion does not grant rewards or character XP',
    'Legacy generate accepts any level without validation; unknown type falls back via || side at HTTP layer only',
  ]);
}
