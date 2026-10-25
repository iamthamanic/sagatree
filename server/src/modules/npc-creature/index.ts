/**
 * npc-creature module public API — quarantine surface for MIG-403 (#819).
 * Location: server/src/modules/npc-creature/index.ts
 *
 * Bestiary remains unmounted. Public API only exports the activation flag and
 * characterization helpers for isolated tests — never an HTTP port factory.
 */
export {
  BESTIARY_PUBLIC_ACTIVATION_AUTHORIZED,
  applyMonsterDefaults,
  calculateXp,
  computeEncounterXp,
  filterMonsters,
  parseChallengeRating,
  searchMonsters,
  type QuarantineMonster,
} from './internal/bestiary-quarantine.ts';
