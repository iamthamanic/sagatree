/**
 * Context packs for NPC/creature catalogs (#199).
 * Reference existing builtin definition ids; may add a few exclusive members.
 * Location: src/domains/npc-creature/packs/context-packs.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { NpcCreatureDefinition } from '../definition';
import type { NpcCreaturePack } from '../pack';
import { buildBuiltinNpcCreature } from './build-builtin';

/** Exclusive context definitions (not in base packs). */
export const CONTEXT_EXCLUSIVE_DEFINITIONS: readonly NpcCreatureDefinition[] = Object.freeze([
  buildBuiltinNpcCreature({
    id: 'builtin.creature.undead.wraith',
    name: 'Geistwesen',
    description: 'Unkörperlicher Untoter; Kontrolle & Einschüchterung.',
    kind: 'creature',
    category: 'geist',
    level: 7,
    combatProfile: 'control_support',
    combatRole: 'elite',
    tags: ['untot', 'geist'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.creature.construct.golem',
    name: 'Golem',
    description: 'Konstrukt mit hoher Zähigkeit.',
    kind: 'creature',
    category: 'konstrukt',
    level: 8,
    combatProfile: 'tough',
    combatRole: 'elite',
    tags: ['konstrukt'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.creature.undead.zombie',
    name: 'Zombie',
    description: 'Langsamer untoter Fußsoldat.',
    kind: 'creature',
    category: 'untot',
    level: 2,
    combatProfile: 'tough',
    combatRole: 'standard',
    tags: ['untot'],
  }),
]);

export const CONTEXT_PACKS: readonly NpcCreaturePack[] = Object.freeze([
  Object.freeze({
    id: 'builtin:npc-context-undead',
    version: 1,
    name: 'Untote',
    description: 'Skelette, Zombies und Geistwesen für Gruft- und Horror-Szenen.',
    settingTags: Object.freeze(['undead', 'horror']),
    definitionIds: Object.freeze([
      'builtin.creature.fantasy.skeleton',
      'builtin.creature.undead.zombie',
      'builtin.creature.undead.wraith',
    ]),
  }),
  Object.freeze({
    id: 'builtin:npc-context-constructs',
    version: 1,
    name: 'Konstrukte',
    description: 'Belebte Artefakte und Wächterkonstrukte.',
    settingTags: Object.freeze(['construct']),
    definitionIds: Object.freeze(['builtin.creature.construct.golem']),
  }),
  Object.freeze({
    id: 'builtin:npc-context-wilderness',
    version: 1,
    name: 'Wildnis',
    description: 'Wald- und Wildnis-Schwerpunkt aus dem Tiere-Pack.',
    settingTags: Object.freeze(['wilderness']),
    definitionIds: Object.freeze([
      'builtin.creature.animal.wolf',
      'builtin.creature.animal.bear',
      'builtin.creature.animal.boar',
      'builtin.creature.animal.dire-wolf',
    ]),
  }),
]);
