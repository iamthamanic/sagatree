/**
 * Fantasy Basics — builtin NPC/creature pack (#199).
 * Location: src/domains/npc-creature/packs/fantasy-basics.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { NpcCreatureDefinition } from '../definition';
import type { NpcCreaturePack } from '../pack';
import { buildBuiltinNpcCreature } from './build-builtin';

export const FANTASY_BASICS_PACK_ID = 'builtin:npc-fantasy-basics' as const;

export const FANTASY_BASICS_DEFINITIONS: readonly NpcCreatureDefinition[] = Object.freeze([
  buildBuiltinNpcCreature({
    id: 'builtin.npc.fantasy.village-elder',
    name: 'Dorfälteste',
    description: 'Weise Ansprechpartnerin für lokale Quests und Gerüchte.',
    kind: 'npc',
    category: 'npc',
    level: 4,
    combatProfile: 'noncombat',
    tags: ['fantasy', 'sozial'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.npc.fantasy.militia',
    name: 'Milizsoldat',
    description: 'Leicht gerüsteter Verteidiger eines Dorfes oder Außenpostens (Speer und Schild).',
    kind: 'npc',
    category: 'npc',
    level: 3,
    combatProfile: 'balanced',
    combatRole: 'standard',
    tags: ['fantasy', 'kampf'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.npc.fantasy.hedge-mage',
    name: 'Heckenmagier',
    description: 'Lokaler Zauberwirker mit Kontrolle & Support.',
    kind: 'npc',
    category: 'npc',
    level: 5,
    combatProfile: 'control_support',
    combatRole: 'elite',
    tags: ['fantasy', 'magie'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.npc.fantasy.knight',
    name: 'Ritter',
    description: 'Schwere Kavallerie oder Schildträger mit zähem Profil.',
    kind: 'npc',
    category: 'npc',
    level: 6,
    combatProfile: 'tough',
    combatRole: 'elite',
    tags: ['fantasy', 'ritter'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.creature.fantasy.goblin',
    name: 'Goblin',
    description: 'Kleine, listige Kreatur; oft in Gruppen.',
    kind: 'creature',
    category: 'kreatur',
    level: 1,
    combatProfile: 'mobile',
    combatRole: 'standard',
    tags: ['fantasy', 'humanoid'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.creature.fantasy.orc-raider',
    name: 'Ork-Räuber',
    description: 'Brutaler Nahkämpfer für Banditenüberfälle.',
    kind: 'creature',
    category: 'kreatur',
    level: 4,
    combatProfile: 'offensive',
    combatRole: 'standard',
    tags: ['fantasy', 'humanoid'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.creature.fantasy.young-dragon',
    name: 'Junger Drache',
    description: 'Boss-fähige Flugkreatur für legendäre Begegnungen.',
    kind: 'creature',
    category: 'kreatur',
    level: 12,
    combatProfile: 'offensive',
    combatRole: 'boss',
    tags: ['fantasy', 'drache'],
  }),
  buildBuiltinNpcCreature({
    id: 'builtin.creature.fantasy.skeleton',
    name: 'Skelett',
    description:
      'Bloßer Knochen-Untoter (Schädel + Oberkörper); oft in Gruften. Visuelle Identität (2D/3D): nur Skelett, keine Rüstung.',
    kind: 'creature',
    category: 'untot',
    level: 2,
    combatProfile: 'balanced',
    combatRole: 'standard',
    tags: ['fantasy', 'untot', 'skelett'],
    notes: '3D-Modell-Slot: builtin-creature-fantasy-skeleton — bare bones only.',
  }),
]);

export const FANTASY_BASICS_PACK: NpcCreaturePack = Object.freeze({
  id: FANTASY_BASICS_PACK_ID,
  version: 1,
  name: 'Fantasy Basics',
  description: 'Grundlegende Fantasy-NPCs und -Kreaturen für Abenteuerwelten.',
  settingTags: Object.freeze(['fantasy']),
  definitionIds: Object.freeze(
    FANTASY_BASICS_DEFINITIONS.map((definition) => definition.id),
  ),
});
