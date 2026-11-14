/**
 * EB Doc↔Domain pilot (T-010) — one claim from Core §5.3 vs rules kernel.
 * Location: src/domains/rulebook/eb-pilot.ts
 *
 * Does NOT reimplement EB math. Delegates to getSagaTreeAppliedExperienceBonus.
 */

import { getSagaTreeAppliedExperienceBonus } from '../rules/sagatree/skill-progression';
import type { RulebookIndex } from './contracts';
import { getRulebookSectionByNumber } from './search';

export type AppliedEbPilotCase = {
  skillRank: number;
  level: number;
  expected: number;
};

/** Gold cases mirroring Core §5.3 normative formula text. */
export const APPLIED_EB_PILOT_CASES: readonly AppliedEbPilotCase[] = [
  { skillRank: 0, level: 17, expected: 0 },
  { skillRank: 1, level: 17, expected: 2 },
  { skillRank: 2, level: 17, expected: 3 },
  { skillRank: 4, level: 17, expected: 5 },
  { skillRank: 5, level: 17, expected: 5 },
  { skillRank: 3, level: 4, expected: 1 },
];

/**
 * Assert §5.3 exists in the index and domain helper matches documented fixtures.
 * Throws on mismatch (for self-tests / CI).
 */
export function assertAppliedExperienceBonusPilot(index: RulebookIndex): void {
  const section = getRulebookSectionByNumber(index, '5.3');
  if (!section) {
    throw new Error('EB pilot: missing rulebook section 5.3');
  }
  if (section.normativity !== 'binding-playtest') {
    throw new Error('EB pilot: §5.3 must be binding-playtest');
  }

  // Formula lives under §5.3 children (#### headings), not always in the §5.3 body itself.
  const subtree = index.sections.filter(
    (candidate) => candidate.id === section.id || candidate.parentId === section.id,
  );
  const combined = subtree
    .map((entry) => `${entry.title}\n${entry.bodyMarkdown}`)
    .join('\n')
    .toLowerCase();
  if (!combined.includes('anwendbarer erfahrungsbonus') || !combined.includes('min(globaler')) {
    throw new Error('EB pilot: §5.3 subtree missing applicable-EB formula markers');
  }

  for (const testCase of APPLIED_EB_PILOT_CASES) {
    const actual = getSagaTreeAppliedExperienceBonus(testCase.skillRank, testCase.level);
    if (actual !== testCase.expected) {
      throw new Error(
        `EB pilot mismatch: rank ${testCase.skillRank} level ${testCase.level} → ${actual}, expected ${testCase.expected}`,
      );
    }
  }
}
