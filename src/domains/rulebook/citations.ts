/**
 * citations — pure evidence-gate + citation validation for Aiberto ask (AIB-04).
 * Location: src/domains/rulebook/citations.ts
 *
 * No React, HTTP, or LLM. Host and tests share these helpers.
 */
import type { RulebookSearchHit } from './contracts';

export type AibertoCitation = {
  readonly sectionId: string;
  readonly title?: string;
  readonly number?: string | null;
};

export type EvidenceGateResult =
  | { readonly ok: true; readonly hits: readonly RulebookSearchHit[] }
  | { readonly ok: false; readonly reason: 'no-evidence' };

export type CitationValidationResult = {
  readonly accepted: readonly AibertoCitation[];
  readonly dropped: readonly string[];
  readonly indexRevisionMatch: boolean;
};

const CITATION_ID_RE = /\b(stc-[a-z0-9-]+)\b/gi;
const CITATION_MARK_RE = /\[(?:cite|section|id):\s*(stc-[a-z0-9-]+)\]/gi;

/** Empty / zero-score retrieval must not call the model (SCN-006). */
export function evidenceGate(hits: readonly RulebookSearchHit[]): EvidenceGateResult {
  const usable = hits.filter((h) => typeof h.sectionId === 'string' && h.sectionId.length > 0 && h.score > 0);
  if (usable.length === 0) return { ok: false, reason: 'no-evidence' };
  return { ok: true, hits: usable };
}

/** Extract claimed section IDs from model text (markers + bare stc-* tokens). */
export function extractClaimedCitationIds(answerText: string): string[] {
  const found = new Set<string>();
  const text = typeof answerText === 'string' ? answerText : '';
  for (const re of [CITATION_MARK_RE, CITATION_ID_RE]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const id = match[1]?.toLowerCase();
      if (id) found.add(id);
    }
  }
  return [...found];
}

/**
 * Keep only citations that appear in the retrieved set and match the pinned index revision.
 * Fake IDs are dropped (SCN-007); revision mismatch drops all.
 */
export function validateCitations(input: {
  readonly retrievedSectionIds: readonly string[];
  readonly claimedSectionIds: readonly string[];
  readonly pinnedIndexRevision: string;
  readonly responseIndexRevision: string | null | undefined;
  readonly hitMeta?: ReadonlyMap<string, { title: string; number: string | null }>;
}): CitationValidationResult {
  const pinned = (input.pinnedIndexRevision || '').trim().toLowerCase();
  const reported = (input.responseIndexRevision ?? pinned).trim().toLowerCase();
  const indexRevisionMatch = pinned.length > 0 && pinned === reported;
  if (!indexRevisionMatch) {
    return { accepted: [], dropped: [...input.claimedSectionIds], indexRevisionMatch: false };
  }

  const allowed = new Set(
    input.retrievedSectionIds.map((id) => id.trim().toLowerCase()).filter(Boolean),
  );
  const accepted: AibertoCitation[] = [];
  const dropped: string[] = [];
  const seen = new Set<string>();

  for (const raw of input.claimedSectionIds) {
    const id = raw.trim().toLowerCase();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!allowed.has(id)) {
      dropped.push(id);
      continue;
    }
    const meta = input.hitMeta?.get(id);
    accepted.push({
      sectionId: id,
      title: meta?.title,
      number: meta?.number ?? null,
    });
  }

  return { accepted, dropped, indexRevisionMatch: true };
}

/** Compact evidence block for the system/user prompt (data, not instructions). */
export function formatEvidenceForPrompt(
  hits: readonly RulebookSearchHit[],
  indexRevision: string,
  limit = 8,
): string {
  const lines = hits.slice(0, limit).map((hit, i) => {
    const num = hit.number ? `§${hit.number} ` : '';
    const snip = hit.snippet.replace(/\s+/g, ' ').trim().slice(0, 400);
    return `[${i + 1}] id=${hit.sectionId} ${num}${hit.title}\n${snip}`;
  });
  return (
    `indexRevision=${indexRevision}\n` +
    `Evidence (cite only these section ids with [cite:stc-…]):\n` +
    lines.join('\n\n')
  );
}
