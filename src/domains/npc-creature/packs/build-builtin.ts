/**
 * buildBuiltinNpcCreature — construct a read-only Core/builtin NpcCreatureDefinition.
 * Location: src/domains/npc-creature/packs/build-builtin.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { NpcCreatureDefinition } from '../definition';
import type { NpcCreatureCategory, NpcCreatureKind } from '../taxonomy';
import type {
  SagaTreeCombatProfile,
  SagaTreeCombatRole,
  SagaTreeNpcLevel,
} from '../../rules/sagatree/npc-creature-power';
import { normalizeCombatRoleForProfile } from '../../rules/sagatree/npc-creature-power';

export interface BuiltinNpcCreatureInput {
  id: string;
  name: string;
  description: string;
  kind: NpcCreatureKind;
  category: NpcCreatureCategory;
  level: SagaTreeNpcLevel;
  combatProfile: SagaTreeCombatProfile;
  combatRole?: SagaTreeCombatRole;
  tags?: readonly string[];
  notes?: string;
  /**
   * Static SVG slug under `/assets/npc-creatures/{iconKey}.svg`.
   * Defaults to definition id with dots → hyphens.
   */
  iconKey?: string;
}

/** `builtin.npc.fantasy.knight` / `core:npc.bandit` → kebab slug. */
export function builtinNpcCreatureIdToIconKey(definitionId: string): string {
  return definitionId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Build a scope=core repository-local definition (never a DB row). */
export function buildBuiltinNpcCreature(input: BuiltinNpcCreatureInput): NpcCreatureDefinition {
  const combatRole = normalizeCombatRoleForProfile(
    input.combatProfile,
    input.combatRole ?? 'standard',
  );
  const iconKey = input.iconKey ?? builtinNpcCreatureIdToIconKey(input.id);
  return Object.freeze({
    id: input.id,
    scope: 'core',
    name: input.name,
    description: input.description,
    kind: input.kind,
    category: input.category,
    sheetMode: 'compact',
    level: input.level,
    combatProfile: input.combatProfile,
    combatRole,
    tags: Object.freeze([...(input.tags ?? [])]),
    iconKey,
    notes: input.notes,
  });
}
