/**
 * Tiere — builtin animal pack (#199).
 * Location: src/domains/npc-creature/packs/animals.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { NpcCreatureDefinition } from '../definition';
import type { NpcCreaturePack } from '../pack';
import { buildBuiltinNpcCreature } from './build-builtin';

export const ANIMALS_PACK_ID = 'builtin:npc-animals' as const;

export const ANIMALS_DEFINITIONS: readonly NpcCreatureDefinition[] = Object.freeze([
  buildBuiltinNpcCreature({
    id: 'builtin.creature.animal.wolf',
    name: 'Wolf',
    description: 'Rudeljäger mit mobilem Nahkampfprofil.',
    kind: 'creature',
    category: 'tier',
    level: 2,
    combatProfile: 'mobile',
    combatRole: 'standard',
    tags: ['tier', 'rudel'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.creature.animal.bear',
    name: 'Bär',
    description: 'Zäh und kraftvoll; Einzelbedrohung im Wald.',
    kind: 'creature',
    category: 'tier',
    level: 5,
    combatProfile: 'tough',
    combatRole: 'elite',
    tags: ['tier', 'wald'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.creature.animal.hawk',
    name: 'Habicht',
    description: 'Schneller Flugjäger; Fernkampf-ähnliche Hit-and-run.',
    kind: 'creature',
    category: 'tier',
    level: 1,
    combatProfile: 'ranged',
    combatRole: 'standard',
    tags: ['tier', 'flug'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.creature.animal.horse',
    name: 'Pferd',
    description: 'Reit- und Lasttier; nichtkämpferisch als Standard.',
    kind: 'creature',
    category: 'tier',
    level: 2,
    combatProfile: 'noncombat',
    tags: ['tier', 'reitier'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.creature.animal.snake',
    name: 'Schlange',
    description: 'Giftige oder würgende Schlange für Dungeons und Wildnis.',
    kind: 'creature',
    category: 'tier',
    level: 3,
    combatProfile: 'offensive',
    combatRole: 'standard',
    tags: ['tier', 'gift'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.creature.animal.boar',
    name: 'Wildschwein',
    description: 'Aggressives Waldtier mit Stoßangriff.',
    kind: 'creature',
    category: 'tier',
    level: 3,
    combatProfile: 'offensive',
    combatRole: 'standard',
    tags: ['tier', 'wald'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.creature.animal.dire-wolf',
    name: 'Schreckenswolf',
    description: 'Größere, gefährlichere Wolfsvariante.',
    kind: 'creature',
    category: 'tier',
    level: 6,
    combatProfile: 'offensive',
    combatRole: 'elite',
    tags: ['tier', 'elite'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.creature.animal.rat-swarm',
    name: 'Rattenschwarm',
    description: 'Schwarm-Bedrohung für Keller und Kanalisation.',
    kind: 'creature',
    category: 'tier',
    level: 1,
    combatProfile: 'mobile',
    combatRole: 'standard',
    tags: ['tier', 'schwarm'],
  }),
]);

export const ANIMALS_PACK: NpcCreaturePack = Object.freeze({
  id: ANIMALS_PACK_ID,
  version: 1,
  name: 'Tiere',
  description: 'Tiere und Wildniswesen für Begegnungen und Atmosphäre.',
  settingTags: Object.freeze(['animals', 'wilderness']),
  definitionIds: Object.freeze(ANIMALS_DEFINITIONS.map((definition) => definition.id)),
});
