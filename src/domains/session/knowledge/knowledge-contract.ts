/**
 * knowledge-contract — Session Knowledge / Secrets / Reveals (#367).
 * Location: src/domains/session/knowledge/knowledge-contract.ts
 *
 * Audience-aware knowledge state. Secret bodies never leave the server-side
 * projection for unauthorized participants. Pure domain — no React/backend clients.
 */

import {
  canReadVisibilityAudience,
  type LiveSessionAccess,
} from '../contracts/live-session-access';

export const KNOWLEDGE_SCHEMA_VERSION = 1 as const;

export const KNOWLEDGE_VISIBILITIES = [
  'public',
  'gm_only',
  'discovered',
  'character_specific',
  'program',
] as const;

export type KnowledgeVisibility = (typeof KNOWLEDGE_VISIBILITIES)[number];

export type RevealTarget =
  | { readonly kind: 'everyone' }
  | { readonly kind: 'program' }
  | { readonly kind: 'players' }
  | { readonly kind: 'character'; readonly characterId: string };

export type KnowledgeFactRef = {
  readonly id: string;
  readonly title: string;
  /** Authoring visibility — default audience before reveals. */
  readonly visibility: KnowledgeVisibility;
  /** Body may be omitted in unauthorized projections. */
  readonly body: string | null;
  readonly handoutRef: { readonly id: string } | null;
  readonly characterId: string | null;
};

export type DiscoveryState = {
  readonly factId: string;
  readonly discoveredAt: string;
  readonly byUserId: string | null;
};

export type RevealEvent = {
  readonly id: string;
  readonly factId: string;
  readonly target: RevealTarget;
  readonly revealedAt: string;
  readonly byUserId: string | null;
};

export type SessionKnowledgeState = {
  readonly schemaVersion: typeof KNOWLEDGE_SCHEMA_VERSION;
  readonly authoritative: true;
  readonly facts: readonly KnowledgeFactRef[];
  readonly discoveries: readonly DiscoveryState[];
  readonly reveals: readonly RevealEvent[];
  readonly updatedAt: string | null;
};

export type KnowledgeFactProjection = {
  readonly id: string;
  readonly title: string;
  readonly visibility: KnowledgeVisibility;
  readonly body: string | null;
  readonly handoutRef: { readonly id: string } | null;
  readonly characterId: string | null;
  readonly discovered: boolean;
  readonly revealedToAudience: boolean;
};

export type KnowledgeProjection = {
  readonly facts: readonly KnowledgeFactProjection[];
  readonly audience: 'public' | 'player' | 'gm' | 'program';
};

export type RevealCommandInput = {
  readonly factId: string;
  readonly target: RevealTarget;
};

const MAX_ID = 128;
const MAX_TITLE = 160;
const MAX_BODY = 4000;

export function isKnowledgeVisibility(value: string): value is KnowledgeVisibility {
  return (KNOWLEDGE_VISIBILITIES as readonly string[]).includes(value);
}

export function emptyKnowledgeState(updatedAt: string | null = null): SessionKnowledgeState {
  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    authoritative: true,
    facts: [],
    discoveries: [],
    reveals: [],
    updatedAt,
  };
}

function parseTarget(raw: unknown): RevealTarget | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const kind = obj.kind;
  if (kind === 'everyone' || kind === 'program' || kind === 'players') {
    return { kind };
  }
  if (kind === 'character') {
    const characterId =
      typeof obj.characterId === 'string' ? obj.characterId.trim().slice(0, MAX_ID) : '';
    if (!characterId) return null;
    return { kind: 'character', characterId };
  }
  return null;
}

export function parseRevealCommandInput(input: Record<string, unknown>): RevealCommandInput {
  const factId = typeof input.factId === 'string' ? input.factId.trim().slice(0, MAX_ID) : '';
  if (!factId) throw new Error('factId ist erforderlich');
  const target = parseTarget(input.target);
  if (!target) throw new Error('Ungültiges Reveal-Target');
  return { factId, target };
}

export function parseKnowledgeFactRef(raw: unknown): KnowledgeFactRef | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim().slice(0, MAX_ID) : '';
  const title = typeof obj.title === 'string' ? obj.title.trim().slice(0, MAX_TITLE) : '';
  if (!id || !title) return null;
  const visibility =
    typeof obj.visibility === 'string' && isKnowledgeVisibility(obj.visibility)
      ? obj.visibility
      : 'gm_only';
  const body =
    typeof obj.body === 'string' ? obj.body.slice(0, MAX_BODY) : obj.body === null ? null : null;
  const handoutRef =
    obj.handoutRef && typeof obj.handoutRef === 'object' && !Array.isArray(obj.handoutRef)
      ? opaqueId((obj.handoutRef as Record<string, unknown>).id)
      : null;
  const characterId =
    typeof obj.characterId === 'string' && obj.characterId.trim()
      ? obj.characterId.trim().slice(0, MAX_ID)
      : null;
  return { id, title, visibility, body, handoutRef, characterId };
}

function opaqueId(id: unknown): { id: string } | null {
  if (typeof id !== 'string' || !id.trim()) return null;
  return { id: id.trim().slice(0, MAX_ID) };
}

export function readSessionKnowledgeState(
  shared: Record<string, unknown>,
): SessionKnowledgeState {
  const raw = shared.knowledge;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyKnowledgeState();
  }
  const obj = raw as Record<string, unknown>;
  if (obj.authoritative !== true || obj.schemaVersion !== KNOWLEDGE_SCHEMA_VERSION) {
    return emptyKnowledgeState();
  }
  const facts: KnowledgeFactRef[] = [];
  if (Array.isArray(obj.facts)) {
    for (const item of obj.facts.slice(0, 200)) {
      const fact = parseKnowledgeFactRef(item);
      if (fact) facts.push(fact);
    }
  }
  const discoveries: DiscoveryState[] = [];
  if (Array.isArray(obj.discoveries)) {
    for (const item of obj.discoveries.slice(0, 400)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const d = item as Record<string, unknown>;
      const factId = typeof d.factId === 'string' ? d.factId : '';
      const discoveredAt = typeof d.discoveredAt === 'string' ? d.discoveredAt : '';
      if (!factId || !discoveredAt) continue;
      discoveries.push({
        factId,
        discoveredAt,
        byUserId: typeof d.byUserId === 'string' ? d.byUserId : null,
      });
    }
  }
  const reveals: RevealEvent[] = [];
  if (Array.isArray(obj.reveals)) {
    for (const item of obj.reveals.slice(0, 400)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const r = item as Record<string, unknown>;
      const id = typeof r.id === 'string' ? r.id : '';
      const factId = typeof r.factId === 'string' ? r.factId : '';
      const revealedAt = typeof r.revealedAt === 'string' ? r.revealedAt : '';
      const target = parseTarget(r.target);
      if (!id || !factId || !revealedAt || !target) continue;
      reveals.push({
        id,
        factId,
        target,
        revealedAt,
        byUserId: typeof r.byUserId === 'string' ? r.byUserId : null,
      });
    }
  }
  return {
    schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
    authoritative: true,
    facts,
    discoveries,
    reveals,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : null,
  };
}

function isDiscovered(state: SessionKnowledgeState, factId: string): boolean {
  return state.discoveries.some((d) => d.factId === factId);
}

function isRevealedToAccess(
  state: SessionKnowledgeState,
  factId: string,
  access: LiveSessionAccess,
): boolean {
  for (const reveal of state.reveals) {
    if (reveal.factId !== factId) continue;
    switch (reveal.target.kind) {
      case 'everyone':
        return true;
      case 'program':
        return true; // program audience; clients with read_program see title/body if public/program
      case 'players':
        return access.role === 'player' || access.role === 'gamemaster';
      case 'character':
        return (
          access.role === 'gamemaster' ||
          (access.role === 'player' && access.characterId === reveal.target.characterId)
        );
      default:
        break;
    }
  }
  return false;
}

function canSeeFactBody(
  fact: KnowledgeFactRef,
  state: SessionKnowledgeState,
  access: LiveSessionAccess,
): boolean {
  if (access.role === 'gamemaster') return true;

  const revealed = isRevealedToAccess(state, fact.id, access);
  const discovered = isDiscovered(state, fact.id);

  switch (fact.visibility) {
    case 'public':
      return true;
    case 'program':
      return canReadVisibilityAudience(access, 'program');
    case 'discovered':
      return discovered || revealed;
    case 'character_specific':
      if (
        canReadVisibilityAudience(access, 'character_private', {
          characterId: fact.characterId,
        })
      ) {
        return true;
      }
      return revealed && access.characterId === fact.characterId;
    case 'gm_only':
      // Only via explicit reveal to this participant — never raw gm_only dump.
      return revealed;
    default:
      return false;
  }
}

function canSeeFactTitle(
  fact: KnowledgeFactRef,
  state: SessionKnowledgeState,
  access: LiveSessionAccess,
): boolean {
  if (access.role === 'gamemaster') return true;
  if (fact.visibility === 'gm_only' && !isRevealedToAccess(state, fact.id, access)) {
    return false;
  }
  if (fact.visibility === 'character_specific') {
    if (access.role === 'viewer') return isRevealedToAccess(state, fact.id, access);
    if (
      access.role === 'player' &&
      fact.characterId !== null &&
      access.characterId !== fact.characterId &&
      !isRevealedToAccess(state, fact.id, access)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Project knowledge for an authenticated participant.
 * Unauthorized secret bodies are null — never sent as hidden fields with content.
 */
export function projectKnowledgeForAccess(
  shared: Record<string, unknown>,
  access: LiveSessionAccess,
): KnowledgeProjection {
  const state = readSessionKnowledgeState(shared);
  const audience =
    access.role === 'gamemaster'
      ? 'gm'
      : access.role === 'viewer'
        ? 'program'
        : access.role === 'player'
          ? 'player'
          : 'public';

  const facts: KnowledgeFactProjection[] = [];
  for (const fact of state.facts) {
    if (!canSeeFactTitle(fact, state, access)) continue;
    const allowBody = canSeeFactBody(fact, state, access);
    facts.push({
      id: fact.id,
      title: fact.title,
      visibility: fact.visibility,
      body: allowBody ? fact.body : null,
      handoutRef: allowBody ? fact.handoutRef : null,
      characterId: fact.characterId,
      discovered: isDiscovered(state, fact.id),
      revealedToAudience: isRevealedToAccess(state, fact.id, access),
    });
  }

  return { facts, audience };
}

/**
 * Apply a reveal in pure domain (used by gate + client optimistic helpers).
 * Server migration is authoritative.
 */
export function applyRevealToKnowledgeState(
  state: SessionKnowledgeState,
  input: RevealCommandInput,
  meta: { revealId: string; revealedAt: string; byUserId: string | null },
): SessionKnowledgeState {
  const fact = state.facts.find((f) => f.id === input.factId);
  if (!fact) throw new Error('Unbekannter Knowledge-Fact');
  const nextReveals = [
    ...state.reveals,
    {
      id: meta.revealId,
      factId: input.factId,
      target: input.target,
      revealedAt: meta.revealedAt,
      byUserId: meta.byUserId,
    },
  ];
  let discoveries = state.discoveries;
  if (
    input.target.kind === 'everyone' ||
    input.target.kind === 'players' ||
    input.target.kind === 'character'
  ) {
    if (!discoveries.some((d) => d.factId === input.factId)) {
      discoveries = [
        ...discoveries,
        {
          factId: input.factId,
          discoveredAt: meta.revealedAt,
          byUserId: meta.byUserId,
        },
      ];
    }
  }
  return {
    ...state,
    discoveries,
    reveals: nextReveals,
    updatedAt: meta.revealedAt,
  };
}

export function upsertKnowledgeFact(
  state: SessionKnowledgeState,
  fact: KnowledgeFactRef,
  updatedAt: string,
): SessionKnowledgeState {
  const others = state.facts.filter((f) => f.id !== fact.id);
  return {
    ...state,
    facts: [...others, fact],
    updatedAt,
  };
}
