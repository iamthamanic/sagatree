/**
 * rulebook — public barrel for SagaTree Core rulebook index + pure search (AIB-01).
 * Location: src/domains/rulebook/index.ts
 *
 * Text SoT remains docs/sagatree core rules.md; compute SoT remains domains/rules/sagatree.
 * Parse/build helpers are exported for Node build + self-tests (inject a hash fn).
 */
export {
  RULEBOOK_NORMATIVITIES,
  RULEBOOK_SCHEMA_VERSION,
  SAGATREE_CORE_RULESET_ID,
  SAGATREE_CORE_SOURCE_PATH,
  assertRulebookIndex,
  isRulebookNormativity,
  type RulebookIndex,
  type RulebookManifest,
  type RulebookNormativity,
  type RulebookSearchHit,
  type RulebookSearchOptions,
  type RulebookSection,
  type RulebookSourceRef,
} from './contracts';

export {
  buildRulebookIndexFromMarkdown,
  canonicalIndexPayload,
  computeRevisionHash,
  resolveNormativity,
  sectionIdFromHeading,
  type RulebookHashFn,
} from './parse-source';

export {
  getRulebookSection,
  getRulebookSectionByNumber,
  searchRulebook,
  tokenizeQuery,
} from './search';

export { getSagaTreeCoreRulebookIndex } from './load-index';

export {
  APPLIED_EB_PILOT_CASES,
  assertAppliedExperienceBonusPilot,
  type AppliedEbPilotCase,
} from './eb-pilot';
