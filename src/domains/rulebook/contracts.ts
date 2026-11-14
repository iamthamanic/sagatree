/**
 * rulebook contracts — schema for the SagaTree Core rulebook index (AIB-01).
 * Location: src/domains/rulebook/contracts.ts
 *
 * Pure types + validators. No React, HTTP, or LLM.
 */

export const RULEBOOK_SCHEMA_VERSION = 1 as const;
export const SAGATREE_CORE_RULESET_ID = 'sagatree-core' as const;
export const SAGATREE_CORE_SOURCE_PATH = 'docs/sagatree core rules.md' as const;

/** Normativity tags for indexed sections (FR-003 / issue #1124). */
export const RULEBOOK_NORMATIVITIES = [
  'binding-playtest',
  'validation',
  'release-criteria',
  'informational',
] as const;

export type RulebookNormativity = (typeof RULEBOOK_NORMATIVITIES)[number];

export type RulebookSourceRef = {
  path: string;
  startLine: number;
  endLine: number;
};

export type RulebookSection = {
  id: string;
  number: string | null;
  title: string;
  headingLevel: 2 | 3 | 4;
  parentId: string | null;
  normativity: RulebookNormativity;
  bodyMarkdown: string;
  source: RulebookSourceRef;
};

export type RulebookManifest = {
  rulesetId: typeof SAGATREE_CORE_RULESET_ID;
  schemaVersion: typeof RULEBOOK_SCHEMA_VERSION;
  revisionHash: string;
  sourcePath: typeof SAGATREE_CORE_SOURCE_PATH;
  sectionCount: number;
};

export type RulebookIndex = {
  manifest: RulebookManifest;
  sections: RulebookSection[];
};

export type RulebookSearchHit = {
  sectionId: string;
  title: string;
  number: string | null;
  normativity: RulebookNormativity;
  score: number;
  snippet: string;
  source: RulebookSourceRef;
};

export type RulebookSearchOptions = {
  limit?: number;
};

export function isRulebookNormativity(value: string): value is RulebookNormativity {
  return (RULEBOOK_NORMATIVITIES as readonly string[]).includes(value);
}

export function assertRulebookIndex(value: unknown): asserts value is RulebookIndex {
  if (value === null || typeof value !== 'object') {
    throw new Error('Rulebook index must be an object');
  }
  const record = value as Record<string, unknown>;
  const manifest = record.manifest;
  const sections = record.sections;
  if (manifest === null || typeof manifest !== 'object') {
    throw new Error('Rulebook manifest missing');
  }
  const m = manifest as Record<string, unknown>;
  if (m.rulesetId !== SAGATREE_CORE_RULESET_ID) {
    throw new Error(`Unexpected rulesetId: ${String(m.rulesetId)}`);
  }
  if (m.schemaVersion !== RULEBOOK_SCHEMA_VERSION) {
    throw new Error(`Unexpected schemaVersion: ${String(m.schemaVersion)}`);
  }
  if (typeof m.revisionHash !== 'string' || m.revisionHash.length < 16) {
    throw new Error('revisionHash missing or too short');
  }
  if (m.sourcePath !== SAGATREE_CORE_SOURCE_PATH) {
    throw new Error(`Unexpected sourcePath: ${String(m.sourcePath)}`);
  }
  if (!Array.isArray(sections)) {
    throw new Error('sections must be an array');
  }
  if (typeof m.sectionCount !== 'number' || m.sectionCount !== sections.length) {
    throw new Error('sectionCount does not match sections.length');
  }
  const seen = new Set<string>();
  for (const section of sections) {
    if (section === null || typeof section !== 'object') {
      throw new Error('Invalid section entry');
    }
    const s = section as Record<string, unknown>;
    if (typeof s.id !== 'string' || s.id.length === 0) {
      throw new Error('Section id missing');
    }
    if (seen.has(s.id)) {
      throw new Error(`Duplicate section id: ${s.id}`);
    }
    seen.add(s.id);
    if (typeof s.title !== 'string') {
      throw new Error(`Section ${s.id} title missing`);
    }
    if (typeof s.normativity !== 'string' || !isRulebookNormativity(s.normativity)) {
      throw new Error(`Section ${s.id} has invalid normativity`);
    }
    if (typeof s.bodyMarkdown !== 'string') {
      throw new Error(`Section ${s.id} bodyMarkdown missing`);
    }
    if (s.source === null || typeof s.source !== 'object') {
      throw new Error(`Section ${s.id} source missing`);
    }
  }
}
