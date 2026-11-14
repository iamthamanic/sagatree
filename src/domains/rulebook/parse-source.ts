/**
 * parse-source — deterministic Markdown → RulebookIndex builder for SagaTree Core.
 * Location: src/domains/rulebook/parse-source.ts
 *
 * Pure: no filesystem, React, or network. Hash function is injected (Node crypto in
 * build/self-test; never call from browser without a Web-safe hasher).
 * Collision on section ids throws.
 */
import {
  RULEBOOK_SCHEMA_VERSION,
  SAGATREE_CORE_RULESET_ID,
  SAGATREE_CORE_SOURCE_PATH,
  type RulebookIndex,
  type RulebookNormativity,
  type RulebookSection,
} from './contracts';

export type RulebookHashFn = (payloadUtf8: string) => string;

type HeadingMatch = {
  level: 2 | 3 | 4;
  title: string;
  number: string | null;
  lineIndex: number;
};

const HEADING_RE = /^(#{2,4})\s+(.+?)\s*$/;
const NUMBERED_TITLE_RE = /^(\d+(?:\.\d+)*)\.\s+(.+)$/;
const NUMBER_ONLY_TITLE_RE = /^(\d+(?:\.\d+)*)\s+(.+)$/;

function parseHeadingTitle(raw: string): { number: string | null; title: string } {
  const dotted = NUMBERED_TITLE_RE.exec(raw);
  if (dotted) {
    return { number: dotted[1], title: `${dotted[1]}. ${dotted[2]}`.trim() };
  }
  const spaced = NUMBER_ONLY_TITLE_RE.exec(raw);
  if (spaced) {
    return { number: spaced[1], title: `${spaced[1]} ${spaced[2]}`.trim() };
  }
  return { number: null, title: raw.trim() };
}

function topLevelSectionNumber(number: string | null, ancestors: Array<string | null>): number | null {
  if (number) {
    const top = number.split('.')[0];
    const parsed = Number(top);
    return Number.isFinite(parsed) ? parsed : null;
  }
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const ancestor = ancestors[i];
    if (!ancestor) continue;
    const top = ancestor.split('.')[0];
    const parsed = Number(top);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function resolveNormativity(
  number: string | null,
  ancestorNumbers: Array<string | null>,
): RulebookNormativity {
  const top = topLevelSectionNumber(number, ancestorNumbers);
  if (top === null) return 'informational';
  if (top >= 1 && top <= 18) return 'binding-playtest';
  if (top === 19) return 'validation';
  if (top === 20) return 'release-criteria';
  return 'informational';
}

export function sectionIdFromHeading(number: string | null, title: string, ordinal: number): string {
  if (number) {
    return `stc-${number.replace(/\./g, '-')}`;
  }
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `stc-meta-${slug || 'section'}-${ordinal}`;
}

function collectHeadings(lines: string[]): HeadingMatch[] {
  const headings: HeadingMatch[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = HEADING_RE.exec(lines[i]);
    if (!match) continue;
    const hashes = match[1];
    if (hashes.length < 2 || hashes.length > 4) continue;
    const level = hashes.length as 2 | 3 | 4;
    const parsed = parseHeadingTitle(match[2]);
    headings.push({
      level,
      title: parsed.title,
      number: parsed.number,
      lineIndex: i,
    });
  }
  return headings;
}

/** Canonical payload hashed for revision identity (no timestamps). */
export function canonicalIndexPayload(sections: RulebookSection[]): string {
  const normalized = sections.map((section) => ({
    id: section.id,
    number: section.number,
    title: section.title,
    headingLevel: section.headingLevel,
    parentId: section.parentId,
    normativity: section.normativity,
    bodyMarkdown: section.bodyMarkdown,
    source: section.source,
  }));
  return `${JSON.stringify({
    rulesetId: SAGATREE_CORE_RULESET_ID,
    schemaVersion: RULEBOOK_SCHEMA_VERSION,
    sourcePath: SAGATREE_CORE_SOURCE_PATH,
    sections: normalized,
  })}\n`;
}

export function computeRevisionHash(sections: RulebookSection[], hashFn: RulebookHashFn): string {
  return hashFn(canonicalIndexPayload(sections));
}

/**
 * Build a deterministic RulebookIndex from Core Markdown source text.
 * @throws on duplicate section ids
 */
export function buildRulebookIndexFromMarkdown(
  markdown: string,
  hashFn: RulebookHashFn,
): RulebookIndex {
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const headings = collectHeadings(lines);
  if (headings.length === 0) {
    throw new Error('No rulebook headings found in source markdown');
  }

  const sections: RulebookSection[] = [];
  const stack: Array<{ id: string; level: number; number: string | null }> = [];
  const seenIds = new Set<string>();

  for (let h = 0; h < headings.length; h += 1) {
    const heading = headings[h];
    const startLine = heading.lineIndex + 1;
    const endExclusive = h + 1 < headings.length ? headings[h + 1].lineIndex : lines.length;
    const endLine = endExclusive;
    const bodyLines = lines.slice(heading.lineIndex + 1, endExclusive);
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === '') {
      bodyLines.pop();
    }
    const bodyMarkdown = bodyLines.join('\n');

    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }
    const parent = stack.length > 0 ? stack[stack.length - 1] : null;
    const ancestorNumbers = stack.map((entry) => entry.number);
    const id = sectionIdFromHeading(heading.number, heading.title, h + 1);
    if (seenIds.has(id)) {
      throw new Error(`Rulebook section id collision: ${id}`);
    }
    seenIds.add(id);

    const section: RulebookSection = {
      id,
      number: heading.number,
      title: heading.title,
      headingLevel: heading.level,
      parentId: parent ? parent.id : null,
      normativity: resolveNormativity(heading.number, ancestorNumbers),
      bodyMarkdown,
      source: {
        path: SAGATREE_CORE_SOURCE_PATH,
        startLine,
        endLine,
      },
    };
    sections.push(section);
    stack.push({ id, level: heading.level, number: heading.number });
  }

  const revisionHash = computeRevisionHash(sections, hashFn);
  return {
    manifest: {
      rulesetId: SAGATREE_CORE_RULESET_ID,
      schemaVersion: RULEBOOK_SCHEMA_VERSION,
      revisionHash,
      sourcePath: SAGATREE_CORE_SOURCE_PATH,
      sectionCount: sections.length,
    },
    sections,
  };
}
