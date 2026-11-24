/**
 * session-entry-routing — Canonical Saga→Session live entry (#477).
 * Location: src/domains/session/contracts/session-entry-routing.ts
 *
 * Role comes from authorized membership, never from URL claims.
 * Pure domain — path builders only; no React/backend clients.
 */

import type { SessionRole } from './live-session-access';

export type SessionEntryIntent = 'create' | 'join' | 'open';

export type CanonicalLiveEntryDecision =
  | {
      readonly kind: 'live';
      readonly liveView: 'gamemaster' | 'player' | 'viewer';
      readonly sagaPublicId: string;
      readonly sessionPublicId: string;
    }
  | {
      readonly kind: 'session-join';
      readonly sagaPublicId: string | null;
      readonly projectId: string | null;
      readonly intent: SessionEntryIntent;
    }
  | {
      readonly kind: 'unauthorized';
      readonly reason: string;
    }
  | {
      readonly kind: 'legacy-blocked';
      readonly reason: string;
    };

function normalizePublicId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Decide canonical live entry after create/join when public IDs are known.
 * Player never routes to gamemaster.
 */
export function resolveCanonicalLiveEntry(input: {
  role: SessionRole | null;
  sagaPublicId: string | null;
  sessionPublicId: string | null;
}): CanonicalLiveEntryDecision {
  const sagaPublicId = normalizePublicId(input.sagaPublicId);
  const sessionPublicId = normalizePublicId(input.sessionPublicId);
  if (!sagaPublicId || !sessionPublicId) {
    return {
      kind: 'unauthorized',
      reason: 'Saga- und Session-Public-ID sind für den Live-Entry erforderlich',
    };
  }
  if (input.role === 'gamemaster') {
    return {
      kind: 'live',
      liveView: 'gamemaster',
      sagaPublicId,
      sessionPublicId,
    };
  }
  if (input.role === 'player') {
    return {
      kind: 'live',
      liveView: 'player',
      sagaPublicId,
      sessionPublicId,
    };
  }
  if (input.role === 'viewer') {
    return {
      kind: 'live',
      liveView: 'viewer',
      sagaPublicId,
      sessionPublicId,
    };
  }
  return {
    kind: 'unauthorized',
    reason: 'Keine autorisierte Session-Rolle',
  };
}

/**
 * Legacy `/gamemaster` is not the product journey for members with public IDs.
 */
export function decideLegacyGamemasterOpen(input: {
  hasAuthorizedGmMembership: boolean;
  sagaPublicId: string | null;
  sessionPublicId: string | null;
}): CanonicalLiveEntryDecision {
  const live = resolveCanonicalLiveEntry({
    role: input.hasAuthorizedGmMembership ? 'gamemaster' : null,
    sagaPublicId: input.sagaPublicId,
    sessionPublicId: input.sessionPublicId,
  });
  if (live.kind === 'live') return live;
  if (!input.hasAuthorizedGmMembership) {
    return {
      kind: 'legacy-blocked',
      reason: 'URL /gamemaster gewährt keine GM-Rechte',
    };
  }
  return {
    kind: 'session-join',
    sagaPublicId: normalizePublicId(input.sagaPublicId),
    projectId: null,
    intent: 'create',
  };
}

/**
 * Build /session-join query preserving saga/project context (#477).
 */
export function buildSessionJoinPath(input: {
  sagaPublicId?: string | null;
  projectId?: string | null;
  intent?: SessionEntryIntent;
}): string {
  const params = new URLSearchParams();
  const saga = normalizePublicId(input.sagaPublicId ?? null);
  if (saga) params.set('saga', saga);
  if (input.projectId) params.set('project_id', input.projectId);
  if (input.intent === 'join') params.set('intent', 'join');
  if (input.intent === 'create') params.set('intent', 'create');
  const qs = params.toString();
  return qs ? `/session-join?${qs}` : '/session-join';
}

/**
 * Player must never be sent to gamemaster live view from join handlers.
 */
export function assertPlayerNotRoutedToGamemaster(
  role: SessionRole | null,
  liveView: 'gamemaster' | 'player' | 'viewer' | 'display',
): void {
  if (role === 'player' && liveView === 'gamemaster') {
    throw new Error('Player darf nicht auf /live/gamemaster geroutet werden');
  }
}
