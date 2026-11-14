/**
 * aiberto-tools navigate allowlist — ClientAction routes only (AIB-06 / #1129).
 * Location: server/src/application/aiberto-tools/navigate-allowlist.ts
 *
 * Deny-by-default: anything not matched is INVALID_ARGS / DENY.
 */

export type AibertoClientNavigateAction = {
  readonly type: 'app.navigate';
  readonly path: string;
};

const STATIC_PATHS = new Set([
  '/',
  '/library',
  '/library/player-characters',
  '/library/npc-creatures',
  '/library/sagas',
  '/library/worlds',
  '/library/items',
  '/library/looks',
  '/character-editor',
  '/sagas',
  '/settings/profile',
  '/settings/ai',
  '/settings/providers',
  '/download',
]);

/** Legacy aliases normalized to canonical allowlisted paths. */
const ALIASES: Record<string, string> = {
  home: '/',
  dashboard: '/',
  library: '/library/player-characters',
  characters: '/library/player-characters',
  'character-editor': '/character-editor',
  sagas: '/sagas',
  profile: '/settings/profile',
  settings: '/settings/profile',
};

function normalizePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const noHash = trimmed.split('#')[0] ?? trimmed;
  const noQuery = noHash.split('?')[0] ?? noHash;
  let path = noQuery.trim();
  if (!path.startsWith('/')) {
    const alias = ALIASES[path.toLowerCase()];
    if (alias) return alias;
    path = `/${path}`;
  }
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

/**
 * Validate navigate target. Rejects protocol-relative, absolute URLs, and unknown paths.
 */
export function resolveNavigateAllowlist(
  routeRaw: unknown,
):
  | { ok: true; action: AibertoClientNavigateAction }
  | { ok: false; code: 'INVALID_ARGS'; message: string } {
  if (typeof routeRaw !== 'string') {
    return {
      ok: false,
      code: 'INVALID_ARGS',
      message: 'app.navigate erfordert route als Zeichenkette.',
    };
  }
  const raw = routeRaw.trim();
  if (!raw || raw.length > 200) {
    return { ok: false, code: 'INVALID_ARGS', message: 'Ungültige Navigations-Route.' };
  }
  // Block absolute / protocol-relative / escapes.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) || raw.startsWith('//') || raw.includes('..')) {
    return { ok: false, code: 'INVALID_ARGS', message: 'Route nicht in der Allowlist.' };
  }
  const path = normalizePath(raw);
  if (!path) {
    return { ok: false, code: 'INVALID_ARGS', message: 'Ungültige Navigations-Route.' };
  }
  if (STATIC_PATHS.has(path)) {
    return { ok: true, action: { type: 'app.navigate', path } };
  }
  // Public character CH-XXXXX deep link (identity only — auth elsewhere).
  if (/^\/characters\/CH-[A-Z0-9]+$/i.test(path)) {
    return { ok: true, action: { type: 'app.navigate', path } };
  }
  // Saga overview only (not live/gm elevation).
  if (/^\/sagas\/SA-[A-Z0-9]+$/i.test(path) || /^\/sagas\/SA-[A-Z0-9]+\/overview$/i.test(path)) {
    return { ok: true, action: { type: 'app.navigate', path } };
  }
  return { ok: false, code: 'INVALID_ARGS', message: 'Route nicht in der Allowlist.' };
}
