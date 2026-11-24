/**
 * ItemPack — versioned pack of definition ids (#137).
 * Membership is separate from ItemDefinition; the same definition may appear
 * in multiple packs. Packs never carry marketplace source metadata.
 * Location: src/domains/items/pack.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { ItemSettingTag } from './taxonomy';

/**
 * Curated set of ItemDefinition ids. Base packs ship definitions; context packs
 * only reference existing definition ids.
 */
export interface ItemPack {
  /** Stable pack id, e.g. `builtin:fantasy-basic`. */
  id: string;
  /** Integer pack version — bump when membership or metadata changes. */
  version: number;
  name: string;
  description: string;
  /** Setting filters/recommendations; not a usage ban. */
  settingTags: readonly ItemSettingTag[];
  /** Definition ids in this pack (order is declaration order). */
  definitionIds: readonly string[];
}
