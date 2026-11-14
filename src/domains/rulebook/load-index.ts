/**
 * load-index — validate and expose the committed SagaTree Core rulebook JSON.
 * Location: src/domains/rulebook/load-index.ts
 */
import { assertRulebookIndex, type RulebookIndex } from './contracts';
import generated from './generated/sagatree-core.json';

let cached: RulebookIndex | null = null;

/** Return the bundled Core rulebook index (schema-validated once). */
export function getSagaTreeCoreRulebookIndex(): RulebookIndex {
  if (cached) return cached;
  assertRulebookIndex(generated);
  cached = generated;
  return cached;
}
