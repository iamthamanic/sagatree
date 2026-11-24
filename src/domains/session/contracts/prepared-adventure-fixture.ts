/**
 * prepared-adventure-fixture — Domain contract for Epic #210 player-test prepared adventure (#302).
 * Location: src/domains/session/contracts/prepared-adventure-fixture.ts
 * Hides: stable fixture ids, beat list, pregen descriptors, NPC spawn plan, integrity checks.
 * Never imports React or backend clients.
 */

import { SCENE_PRESENTATION_PRESETS } from './shared-scene-presentation';

export const PLAYER_TEST_PREPARED_ADVENTURE_FIXTURE_ID =
  'player-test.prepared-adventure.fantasy-basic.v1' as const;

export const PREPARED_ADVENTURE_FIXTURE_SCHEMA_VERSION = 1 as const;

/** Item pack expected for this fixture's test inventory. */
export const PREPARED_ADVENTURE_WORLD_MODULE_PACK_ID = 'builtin:fantasy-basic' as const;

export const PREPARED_ADVENTURE_HEALING_POTION_ID = 'builtin.fantasy.healing-potion' as const;

/**
 * Voice/Video stays outside the app for the player test — Discord or Google Meet.
 */
export const VOICE_VIDEO_EXTERNAL_NOTE =
  'Voice und Video laufen extern über Discord oder Google Meet — SagaTree stellt in dieser Player-Test-Stufe kein In-App-A/V bereit.' as const;

export type PreparedAdventureBeatKind =
  | 'exploration'
  | 'social'
  | 'combat'
  | 'damage-healing'
  | 'drive-momentum';

export interface PreparedAdventureBeat {
  id: string;
  kind: PreparedAdventureBeatKind;
  title: string;
  /** Scene presentation preset id when kind is exploration. */
  scenePresetId: string | null;
  notes: string;
}

export interface PreparedAdventurePregenDescriptor {
  id: string;
  displayName: string;
  /** Human-readable class / archetype label (German UI). */
  classLabel: string;
  level: number;
  starterItemDefinitionIds: readonly string[];
}

export type PreparedAdventureNpcInstanceKind = 'generic' | 'persistent';

export interface PreparedAdventureNpcSpawnEntry {
  id: string;
  definitionId: string;
  displayName: string;
  instanceKind: PreparedAdventureNpcInstanceKind;
  role: 'social' | 'combat';
}

export interface PreparedAdventureFixture {
  fixtureId: typeof PLAYER_TEST_PREPARED_ADVENTURE_FIXTURE_ID;
  schemaVersion: typeof PREPARED_ADVENTURE_FIXTURE_SCHEMA_VERSION;
  worldModulePackId: typeof PREPARED_ADVENTURE_WORLD_MODULE_PACK_ID;
  adventureName: string;
  adventureDescription: string;
  level: number;
  beats: readonly PreparedAdventureBeat[];
  pregens: readonly PreparedAdventurePregenDescriptor[];
  npcSpawnPlan: readonly PreparedAdventureNpcSpawnEntry[];
  voiceVideoNote: typeof VOICE_VIDEO_EXTERNAL_NOTE;
}

const SCENE_PRESET_IDS = new Set(SCENE_PRESENTATION_PRESETS.map((preset) => preset.id));

const FIXTURE_PREGENS: readonly PreparedAdventurePregenDescriptor[] = [
  {
    id: 'pregen.warrior',
    displayName: 'Brenna Sturmfaust',
    classLabel: 'Kämpferin',
    level: 2,
    starterItemDefinitionIds: [
      PREPARED_ADVENTURE_HEALING_POTION_ID,
      'builtin.fantasy.longsword',
      'builtin.fantasy.rope',
    ],
  },
  {
    id: 'pregen.scout',
    displayName: 'Kael Schattenpfad',
    classLabel: 'Späher',
    level: 2,
    starterItemDefinitionIds: [
      PREPARED_ADVENTURE_HEALING_POTION_ID,
      'builtin.fantasy.shortbow',
      'builtin.fantasy.lockpicks',
    ],
  },
  {
    id: 'pregen.mystic',
    displayName: 'Liora Mondschein',
    classLabel: 'Mystikerin',
    level: 2,
    starterItemDefinitionIds: [
      PREPARED_ADVENTURE_HEALING_POTION_ID,
      'builtin.fantasy.quarterstaff',
      'builtin.fantasy.healer-kit',
    ],
  },
  {
    id: 'pregen.diplomat',
    displayName: 'Oskar Federkiel',
    classLabel: 'Diplomat',
    level: 2,
    starterItemDefinitionIds: [
      PREPARED_ADVENTURE_HEALING_POTION_ID,
      'builtin.fantasy.dagger',
      'builtin.fantasy.writing-kit',
    ],
  },
];

const FIXTURE_NPC_PLAN: readonly PreparedAdventureNpcSpawnEntry[] = [
  {
    id: 'npc.innkeeper',
    definitionId: 'core:npc.citizen',
    displayName: 'Wirtin Mara',
    instanceKind: 'persistent',
    role: 'social',
  },
  {
    id: 'npc.bandit-a',
    definitionId: 'core:npc.bandit',
    displayName: 'Bandit Rusk',
    instanceKind: 'generic',
    role: 'combat',
  },
  {
    id: 'npc.bandit-b',
    definitionId: 'core:npc.bandit',
    displayName: 'Banditin Vexa',
    instanceKind: 'generic',
    role: 'combat',
  },
  {
    id: 'npc.guard',
    definitionId: 'core:npc.guard',
    displayName: 'Stadtwache Torm',
    instanceKind: 'generic',
    role: 'combat',
  },
];

const FIXTURE_BEATS: readonly PreparedAdventureBeat[] = [
  {
    id: 'beat.explore-tavern',
    kind: 'exploration',
    title: 'Ankunft in der Taverne',
    scenePresetId: 'tavern',
    notes: 'Gemeinsame Szene mit Preset tavern; Ort und Beschreibung für alle sichtbar.',
  },
  {
    id: 'beat.explore-forest',
    kind: 'exploration',
    title: 'Pfad in den Wald',
    scenePresetId: 'forest',
    notes: 'Szene auf forest wechseln; Erkundung ohne Kampf.',
  },
  {
    id: 'beat.social',
    kind: 'social',
    title: 'Gespräch mit der Wirtin',
    scenePresetId: null,
    notes: 'Sozialcheck mit Bürger-NSC; Informationen zum Banditenlager.',
  },
  {
    id: 'beat.combat',
    kind: 'combat',
    title: 'Hinterhalt der Banditen',
    scenePresetId: 'forest',
    notes: 'Zwei Banditen-Instanzen (gleiche definitionId) als Kampfziele.',
  },
  {
    id: 'beat.heal',
    kind: 'damage-healing',
    title: 'Wundversorgung',
    scenePresetId: null,
    notes: 'Schaden und Heiltrank (builtin.fantasy.healing-potion) einmal nutzen.',
  },
  {
    id: 'beat.drive',
    kind: 'drive-momentum',
    title: 'Drive / Momentum',
    scenePresetId: null,
    notes: 'Drive oder Momentum einmal einsetzen oder gewinnen.',
  },
];

export const PREPARED_ADVENTURE_FIXTURE: PreparedAdventureFixture = {
  fixtureId: PLAYER_TEST_PREPARED_ADVENTURE_FIXTURE_ID,
  schemaVersion: PREPARED_ADVENTURE_FIXTURE_SCHEMA_VERSION,
  worldModulePackId: PREPARED_ADVENTURE_WORLD_MODULE_PACK_ID,
  adventureName: 'Das Flüstern unter Dornhain (Foundation)',
  adventureDescription:
    'Foundation-Fixture (#302) für das Golden Adventure Package package:dornhain.whisper.v1 — Taverne/Wald/Banditen mit Heiltrank; volle Sandbox-State in #377.',
  level: 2,
  beats: FIXTURE_BEATS,
  pregens: FIXTURE_PREGENS,
  npcSpawnPlan: FIXTURE_NPC_PLAN,
  voiceVideoNote: VOICE_VIDEO_EXTERNAL_NOTE,
};

export function listPreparedAdventurePregens(): readonly PreparedAdventurePregenDescriptor[] {
  return PREPARED_ADVENTURE_FIXTURE.pregens;
}

export function listPreparedAdventureNpcSpawnPlan(): readonly PreparedAdventureNpcSpawnEntry[] {
  return PREPARED_ADVENTURE_FIXTURE.npcSpawnPlan;
}

export function getPreparedAdventureFixture(): PreparedAdventureFixture {
  return PREPARED_ADVENTURE_FIXTURE;
}

/**
 * Fail closed: wrong counts, missing healing potion, missing beat kinds, or no duplicate NPC def.
 */
export function assertPreparedAdventureFixtureIntegrity(
  fixture: PreparedAdventureFixture = PREPARED_ADVENTURE_FIXTURE,
): void {
  if (fixture.fixtureId !== PLAYER_TEST_PREPARED_ADVENTURE_FIXTURE_ID) {
    throw new Error('Prepared adventure fixture id mismatch.');
  }
  if (fixture.schemaVersion !== PREPARED_ADVENTURE_FIXTURE_SCHEMA_VERSION) {
    throw new Error('Prepared adventure fixture schema version mismatch.');
  }
  if (fixture.worldModulePackId !== PREPARED_ADVENTURE_WORLD_MODULE_PACK_ID) {
    throw new Error('Prepared adventure fixture must use fantasy-basic pack.');
  }
  if (fixture.level < 1 || fixture.level > 20) {
    throw new Error('Prepared adventure fixture level out of range.');
  }

  const pregenCount = fixture.pregens.length;
  if (pregenCount < 3 || pregenCount > 4) {
    throw new Error(`Prepared adventure needs 3–4 pregens, got ${pregenCount}.`);
  }
  for (const pregen of fixture.pregens) {
    if (!pregen.starterItemDefinitionIds.includes(PREPARED_ADVENTURE_HEALING_POTION_ID)) {
      throw new Error(`Pregen ${pregen.id} missing healing potion id.`);
    }
    if (pregen.starterItemDefinitionIds.length < 3) {
      throw new Error(`Pregen ${pregen.id} needs potion + weapon + tool.`);
    }
  }

  const npcCount = fixture.npcSpawnPlan.length;
  if (npcCount < 3 || npcCount > 5) {
    throw new Error(`Prepared adventure needs 3–5 NPC plan entries, got ${npcCount}.`);
  }
  const defCounts = new Map<string, number>();
  for (const entry of fixture.npcSpawnPlan) {
    defCounts.set(entry.definitionId, (defCounts.get(entry.definitionId) ?? 0) + 1);
  }
  const hasDuplicateDef = [...defCounts.values()].some((count) => count >= 2);
  if (!hasDuplicateDef) {
    throw new Error('NPC spawn plan must reuse at least one definitionId twice.');
  }
  if (!fixture.npcSpawnPlan.some((entry) => entry.definitionId === 'core:npc.citizen')) {
    throw new Error('NPC spawn plan must include core:npc.citizen.');
  }
  if (!fixture.npcSpawnPlan.some((entry) => entry.role === 'combat')) {
    throw new Error('NPC spawn plan must include combat targets.');
  }

  const kinds = new Set(fixture.beats.map((beat) => beat.kind));
  for (const required of [
    'exploration',
    'social',
    'combat',
    'damage-healing',
    'drive-momentum',
  ] as const) {
    if (!kinds.has(required)) {
      throw new Error(`Beat list missing kind: ${required}`);
    }
  }
  for (const beat of fixture.beats) {
    if (beat.kind === 'exploration') {
      if (!beat.scenePresetId || !SCENE_PRESET_IDS.has(beat.scenePresetId)) {
        throw new Error(`Exploration beat ${beat.id} needs a valid scene preset id.`);
      }
    }
  }

  if (!fixture.voiceVideoNote.includes('Discord') || !fixture.voiceVideoNote.includes('Meet')) {
    throw new Error('Voice/Video note must mention Discord and Meet.');
  }
}
