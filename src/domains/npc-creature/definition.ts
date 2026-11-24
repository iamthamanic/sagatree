/**
 * NpcCreatureDefinition — reusable library definition (not a session instance).
 * Location: src/domains/npc-creature/definition.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 * Machtgrad is derived from level via the power framework — never authored.
 */

import type {
  SagaTreeCombatProfile,
  SagaTreeCombatRole,
  SagaTreeNpcLevel,
} from '../rules/sagatree/npc-creature-power';
import type {
  NpcCreatureCategory,
  NpcCreatureKind,
  NpcCreatureScope,
  NpcCreatureSheetMode,
} from './taxonomy';

/**
 * Catalog definition of an NPC or creature.
 * Adventure/session runtime lives on `NpcCreatureInstance` (#201), not here.
 */
export interface NpcCreatureDefinition {
  /** Stable catalog id, e.g. `personal:<uuid>` or `world:<uuid>`. */
  id: string;
  scope: NpcCreatureScope;
  name: string;
  description: string;
  kind: NpcCreatureKind;
  category: NpcCreatureCategory;
  sheetMode: NpcCreatureSheetMode;
  level: SagaTreeNpcLevel;
  combatProfile: SagaTreeCombatProfile;
  combatRole: SagaTreeCombatRole;
  /** Free-form tags; empty/omitted is fine. */
  tags: readonly string[];
  /**
   * Static SVG slug under `/assets/npc-creatures/{iconKey}.svg`.
   * Parallel to item `iconKey` — not Meshy/storage.
   */
  iconKey?: string;
  /** Optional Meshy/upload portrait key (asset pipeline later). */
  portraitAssetKey?: string;
  /** Optional notes / lore hooks (definition-level only). */
  notes?: string;
  /**
   * Explicit numeric overrides for Advanced editor (#198).
   * Recommended values remain derived via the power framework; overrides are never
   * silently clamped on save (invalid values fail validation).
   */
  statOverrides?: NpcCreatureStatOverrides;
  /** Free-text combat authoring for Kampf tab (#198). */
  combatDetails?: NpcCreatureCombatDetails;
  /** Free-text detail authoring for Details tab (#198). */
  detailExtras?: NpcCreatureDetailExtras;
  /**
   * Opaque full-sheet snapshot when sheetMode is `full`.
   * Compact definitions must not carry this; parse fails closed if present.
   */
  fullSheet?: Readonly<Record<string, unknown>>;
}

/** Optional numeric overrides — keys omitted mean "use derived recommended". */
export interface NpcCreatureStatOverrides {
  health?: number;
  defense?: number;
  movementMeters?: number;
  attributes?: readonly [number, number, number, number, number, number];
  resistanceHigh?: number;
  resistanceNormal?: number;
  resistanceLow?: number;
}

/** Kampf-tab free text (attacks, impulses, etc.). */
export interface NpcCreatureCombatDetails {
  attacks?: string;
  reactions?: string;
  signatures?: string;
  impulseOptions?: string;
  wendepunkt?: string;
  resistancesNotes?: string;
  weaknessesNotes?: string;
  immunitiesNotes?: string;
}

/** Details-tab free text. */
export interface NpcCreatureDetailExtras {
  senses?: string;
  behavior?: string;
  loot?: string;
}

/** Write draft: identity (id/scope) assigned by infrastructure. */
export type NpcCreatureDefinitionWriteDraft = Omit<NpcCreatureDefinition, 'id' | 'scope'>;
