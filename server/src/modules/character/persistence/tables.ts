/**
 * character module owned tables. Private — do not import across modules.
 * Location: server/src/modules/character/persistence/tables.ts
 *
 * Owned: characters (+ presets / adventure arcs product tables).
 */
export const CHARACTER_OWNED_TABLES = [
  'characters',
  'character_presets',
  'character_adventure_arcs',
  'character_avatar_artifacts',
] as const;
