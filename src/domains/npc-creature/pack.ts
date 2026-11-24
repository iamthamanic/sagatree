/**
 * NpcCreaturePack — versioned pack of definition ids (#199).
 * Membership is separate from NpcCreatureDefinition; the same definition may
 * appear in multiple packs. Packs never embed full definition payloads.
 * Location: src/domains/npc-creature/pack.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

/**
 * Curated set of NpcCreatureDefinition ids. Base packs ship definitions;
 * context packs may only reference existing definition ids.
 */
export interface NpcCreaturePack {
  /** Stable pack id, e.g. `builtin:npc-fantasy-basics`. */
  id: string;
  /** Integer pack version — bump when membership or metadata changes. */
  version: number;
  name: string;
  description: string;
  /** Setting / theme tags for UI grouping; not usage bans. */
  settingTags: readonly string[];
  /** Definition ids in this pack (order is declaration order). */
  definitionIds: readonly string[];
}
