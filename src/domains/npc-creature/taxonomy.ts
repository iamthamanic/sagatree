/**
 * NPC/creature taxonomy — categories, kinds, sheet modes, scopes (#196).
 * Location: src/domains/npc-creature/taxonomy.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

/** Create-flow kind: person vs creature family. Independent of category. */
export const NPC_CREATURE_KINDS = ['npc', 'creature'] as const;
export type NpcCreatureKind = (typeof NPC_CREATURE_KINDS)[number];

/** V1 library categories from `.qa/design/npc-creatures-v1-ux.md`. */
export const NPC_CREATURE_CATEGORIES = [
  'npc',
  'tier',
  'kreatur',
  'konstrukt',
  'untot',
  'geist',
  'sonstige',
] as const;
export type NpcCreatureCategory = (typeof NPC_CREATURE_CATEGORIES)[number];

/** Internal sheet mode; UI maps compact→Statblock, full→Charakterbogen. */
export const NPC_CREATURE_SHEET_MODES = ['compact', 'full'] as const;
export type NpcCreatureSheetMode = (typeof NPC_CREATURE_SHEET_MODES)[number];

/**
 * Catalog scopes. `personal` / `world` persist to DB; `core` is repository-local
 * only (Core archetypes + builtin pack members — never DB rows).
 */
export const NPC_CREATURE_SCOPES = ['core', 'personal', 'world'] as const;
export type NpcCreatureScope = (typeof NPC_CREATURE_SCOPES)[number];

/** Scopes that may be written to `npc_creature_definitions`. */
export const NPC_CREATURE_PERSISTED_SCOPES = ['personal', 'world'] as const;
export type NpcCreaturePersistedScope = (typeof NPC_CREATURE_PERSISTED_SCOPES)[number];

export function isNpcCreaturePersistedScope(
  value: unknown,
): value is NpcCreaturePersistedScope {
  return (
    typeof value === 'string' &&
    (NPC_CREATURE_PERSISTED_SCOPES as readonly string[]).includes(value)
  );
}

export const NPC_CREATURE_STATUSES = ['active', 'archived'] as const;
export type NpcCreatureStatus = (typeof NPC_CREATURE_STATUSES)[number];

export function isNpcCreatureKind(value: unknown): value is NpcCreatureKind {
  return typeof value === 'string' && (NPC_CREATURE_KINDS as readonly string[]).includes(value);
}

export function isNpcCreatureCategory(value: unknown): value is NpcCreatureCategory {
  return typeof value === 'string' && (NPC_CREATURE_CATEGORIES as readonly string[]).includes(value);
}

export function isNpcCreatureSheetMode(value: unknown): value is NpcCreatureSheetMode {
  return typeof value === 'string' && (NPC_CREATURE_SHEET_MODES as readonly string[]).includes(value);
}

export function isNpcCreatureScope(value: unknown): value is NpcCreatureScope {
  return typeof value === 'string' && (NPC_CREATURE_SCOPES as readonly string[]).includes(value);
}

export function isNpcCreatureStatus(value: unknown): value is NpcCreatureStatus {
  return typeof value === 'string' && (NPC_CREATURE_STATUSES as readonly string[]).includes(value);
}
