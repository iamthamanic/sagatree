/**
 * Saga workspace IA — top nav + Welt subtabs (#saga-workspace-ia).
 * Location: src/domains/project/contracts/saga-workspace-nav.ts
 *
 * Pure mapping: URL section ids stay stable; chrome collapses to Hub / Welt / Settings.
 */

export type SagaWorkspaceTopId = 'overview' | 'world' | 'settings';

export type SagaWorldSubId =
  | 'places'
  | 'map'
  | 'npc-creatures'
  | 'items'
  | 'quests'
  | 'lore';

/** Canonical section ids used by shell routing (keep in sync with SagaSectionId). */
export type SagaNavSectionId =
  | 'overview'
  | 'characters'
  | 'world'
  | 'map'
  | 'npc-creatures'
  | 'items'
  | 'quests'
  | 'lore'
  | 'sessions'
  | 'settings';

const WORLD_SUBS = new Set<SagaNavSectionId>([
  'world',
  'map',
  'npc-creatures',
  'items',
  'quests',
  'lore',
]);

export function resolveSagaWorkspaceTop(section: SagaNavSectionId): SagaWorkspaceTopId {
  if (section === 'settings') return 'settings';
  if (WORLD_SUBS.has(section)) return 'world';
  return 'overview';
}

export function resolveSagaWorldSub(section: SagaNavSectionId): SagaWorldSubId | null {
  switch (section) {
    case 'world':
      // Legacy /world deep link → Karte (Orte tab removed).
      return 'map';
    case 'map':
      return 'map';
    case 'npc-creatures':
      return 'npc-creatures';
    case 'items':
      return 'items';
    case 'quests':
      return 'quests';
    case 'lore':
      return 'lore';
    default:
      return null;
  }
}

/** Section path to open when picking a top-nav item. */
export function pathSectionForTop(top: SagaWorkspaceTopId): SagaNavSectionId {
  // Welt → Karte (Unified Atlas).
  if (top === 'world') return 'map';
  if (top === 'settings') return 'settings';
  return 'overview';
}

/** Section path for a Welt subtab. */
export function pathSectionForWorldSub(sub: SagaWorldSubId): SagaNavSectionId {
  if (sub === 'places') return 'world';
  if (sub === 'map') return 'map';
  return sub;
}
