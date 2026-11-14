/**
 * search — pure token/phrase rulebook search shared by FE and Host (AIB-01).
 * Location: src/domains/rulebook/search.ts
 */
import type {
  RulebookIndex,
  RulebookSearchHit,
  RulebookSearchOptions,
  RulebookSection,
} from './contracts';

const DEFAULT_LIMIT = 20;

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function tokenizeQuery(query: string): string[] {
  const normalized = normalizeText(query.trim());
  if (!normalized) return [];
  return normalized
    .split(/[^a-z0-9äöüß]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function snippetAround(haystack: string, needle: string, radius = 80): string {
  const lower = haystack.toLowerCase();
  const idx = lower.indexOf(needle.toLowerCase());
  if (idx < 0) {
    const compact = haystack.replace(/\s+/g, ' ').trim();
    return compact.length <= radius * 2 ? compact : `${compact.slice(0, radius * 2)}…`;
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(haystack.length, idx + needle.length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < haystack.length ? '…' : '';
  return `${prefix}${haystack.slice(start, end).replace(/\s+/g, ' ').trim()}${suffix}`;
}

function scoreSection(section: RulebookSection, query: string, tokens: string[]): number {
  const titleNorm = normalizeText(section.title);
  const bodyNorm = normalizeText(section.bodyMarkdown);
  const numberNorm = section.number ? normalizeText(section.number) : '';
  const queryNorm = normalizeText(query);
  let score = 0;

  if (queryNorm.length >= 2) {
    if (titleNorm === queryNorm) score += 120;
    else if (titleNorm.includes(queryNorm)) score += 80;
    if (bodyNorm.includes(queryNorm)) score += 40;
    if (numberNorm && (numberNorm === queryNorm || `§${numberNorm}` === queryNorm || numberNorm === queryNorm.replace(/^§/, ''))) {
      score += 100;
    }
  }

  for (const token of tokens) {
    if (titleNorm.includes(token)) score += 18;
    if (numberNorm.includes(token)) score += 22;
    const bodyHits = bodyNorm.split(token).length - 1;
    if (bodyHits > 0) score += Math.min(24, bodyHits * 4);
  }

  // Prefer binding playtest only after a real phrase/token match (never invent hits).
  if (score > 0 && section.normativity === 'binding-playtest') score += 2;
  return score;
}

/**
 * Rank sections for a free-text query. Empty query → empty hits (callers use TOC).
 */
export function searchRulebook(
  index: RulebookIndex,
  query: string,
  options: RulebookSearchOptions = {},
): RulebookSearchHit[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const trimmed = query.trim();
  if (!trimmed) return [];

  const tokens = tokenizeQuery(trimmed);
  const hits: RulebookSearchHit[] = [];

  for (const section of index.sections) {
    const score = scoreSection(section, trimmed, tokens);
    if (score <= 0) continue;
    const needle = tokens[0] ?? trimmed;
    hits.push({
      sectionId: section.id,
      title: section.title,
      number: section.number,
      normativity: section.normativity,
      score,
      snippet: snippetAround(section.bodyMarkdown || section.title, needle),
      source: section.source,
    });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.sectionId.localeCompare(b.sectionId);
  });

  return hits.slice(0, Math.max(1, limit));
}

export function getRulebookSection(index: RulebookIndex, sectionId: string): RulebookSection | null {
  return index.sections.find((section) => section.id === sectionId) ?? null;
}

export function getRulebookSectionByNumber(
  index: RulebookIndex,
  number: string,
): RulebookSection | null {
  const normalized = number.replace(/^§/, '').trim();
  return index.sections.find((section) => section.number === normalized) ?? null;
}
