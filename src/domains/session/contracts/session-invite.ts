/**
 * session-invite — Pure invite URL + resolve decision helpers (#490).
 * Location: src/domains/session/contracts/session-invite.ts
 *
 * No React/backend clients. Role is never taken from the invite token/URL.
 */
const INVITE_RETURN_KEY = 'sagatree:invite-return';

export type SessionInviteErrorCode =
  | 'missing_token'
  | 'not_found'
  | 'revoked'
  | 'expired'
  | 'session_missing'
  | 'session_completed'
  | 'saga_missing'
  | 'unknown';

export type SessionInviteResolveOk = {
  readonly ok: true;
  readonly sagaPublicId: string;
  readonly sessionPublicId: string;
  readonly projectId: string;
  readonly sessionId: string;
  readonly sessionStatus: string;
  readonly alreadyMember: boolean;
  readonly isProjectGm: boolean;
  readonly characterPublicId: string | null;
};

export type SessionInviteResolveFail = {
  readonly ok: false;
  readonly errorCode: SessionInviteErrorCode;
};

export type SessionInviteResolveResult = SessionInviteResolveOk | SessionInviteResolveFail;

export type SessionInviteCreateResult = {
  readonly id: string;
  readonly token: string;
  readonly sessionId: string;
  readonly expiresAt: string;
};

/** Absolute or relative invite path — token only in query `t`. */
export function buildSessionInvitePath(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return '/session-invite';
  return `/session-invite?t=${encodeURIComponent(trimmed)}`;
}

export function buildSessionInviteAbsoluteUrl(token: string, origin: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}${buildSessionInvitePath(token)}`;
}

export function readInviteTokenFromSearch(search: string): string | null {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const token = params.get('t')?.trim() ?? params.get('token')?.trim() ?? '';
  return token.length > 0 ? token : null;
}

export function normalizeInviteToken(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function mapInviteResolvePayload(raw: unknown): SessionInviteResolveResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errorCode: 'unknown' };
  }
  const row = raw as Record<string, unknown>;
  if (row.ok !== true) {
    const code = typeof row.error_code === 'string' ? row.error_code : 'unknown';
    return {
      ok: false,
      errorCode: (code as SessionInviteErrorCode) || 'unknown',
    };
  }
  const sagaPublicId =
    typeof row.saga_public_id === 'string' ? row.saga_public_id.trim().toUpperCase() : '';
  const sessionPublicId =
    typeof row.session_public_id === 'string'
      ? row.session_public_id.trim().toUpperCase()
      : '';
  const projectId = typeof row.project_id === 'string' ? row.project_id.trim() : '';
  const sessionId = typeof row.session_id === 'string' ? row.session_id.trim() : '';
  if (!sagaPublicId || !sessionPublicId || !projectId || !sessionId) {
    return { ok: false, errorCode: 'unknown' };
  }
  const characterRaw =
    typeof row.character_public_id === 'string'
      ? row.character_public_id.trim().toUpperCase()
      : '';
  return {
    ok: true,
    sagaPublicId,
    sessionPublicId,
    projectId,
    sessionId,
    sessionStatus: typeof row.session_status === 'string' ? row.session_status : '',
    alreadyMember: row.already_member === true,
    isProjectGm: row.is_project_gm === true,
    characterPublicId: characterRaw.length > 0 ? characterRaw : null,
  };
}

export function mapInviteCreatePayload(raw: unknown): SessionInviteCreateResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const token = typeof row.token === 'string' ? row.token.trim() : '';
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const sessionId = typeof row.session_id === 'string' ? row.session_id.trim() : '';
  const expiresAt = typeof row.expires_at === 'string' ? row.expires_at : '';
  if (!token || !id || !sessionId) return null;
  return { id, token, sessionId, expiresAt };
}

export function inviteErrorMessage(code: SessionInviteErrorCode): string {
  switch (code) {
    case 'missing_token':
      return 'Einladungslink ist ungültig (kein Token).';
    case 'not_found':
      return 'Einladung wurde nicht gefunden.';
    case 'revoked':
      return 'Diese Einladung wurde widerrufen.';
    case 'expired':
      return 'Diese Einladung ist abgelaufen.';
    case 'session_missing':
      return 'Die Session zu dieser Einladung fehlt.';
    case 'session_completed':
      return 'Diese Session ist bereits beendet.';
    case 'saga_missing':
      return 'Die Saga zu dieser Einladung fehlt.';
    default:
      return 'Einladung konnte nicht aufgelöst werden.';
  }
}

/**
 * After resolve: strip invite token from the address bar via session-join (or live).
 */
export function decideInvitePostResolveNavigation(
  result: SessionInviteResolveOk,
): { kind: 'session-join' } | { kind: 'live'; liveView: 'gamemaster' | 'player'; characterPublicId?: string } {
  if (result.alreadyMember && result.isProjectGm) {
    return { kind: 'live', liveView: 'gamemaster' };
  }
  if (result.alreadyMember && result.characterPublicId) {
    return {
      kind: 'live',
      liveView: 'player',
      characterPublicId: result.characterPublicId,
    };
  }
  return { kind: 'session-join' };
}

export function setInviteReturnPath(path: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/session-invite')) return;
  sessionStorage.setItem(INVITE_RETURN_KEY, trimmed);
}

export function takeInviteReturnPath(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  const value = sessionStorage.getItem(INVITE_RETURN_KEY);
  sessionStorage.removeItem(INVITE_RETURN_KEY);
  if (!value || !value.startsWith('/session-invite')) return null;
  return value;
}

export function isInvitePath(pathname: string, search = ''): boolean {
  const path = pathname.trim() || '/';
  if (path === '/session-invite' || path.startsWith('/session-invite?')) return true;
  if (path === '/session-invite' && search.includes('t=')) return true;
  return path === '/session-invite';
}
