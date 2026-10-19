/**
 * atlas-persist-state — dirty/saving/saved/conflict transitions for atlas maps (#751).
 * Location: src/domains/world/atlas/atlas-persist-state.ts
 */

export type AtlasPersistStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'conflict';

const CONFLICT_RE = /revision conflict|inzwischen geändert/i;

/** True when an error message denotes a revision CAS conflict. */
export function isAtlasRevisionConflictMessage(message: string): boolean {
  return CONFLICT_RE.test(message);
}

export type AtlasPersistEvent =
  | { readonly type: 'edit' }
  | { readonly type: 'save_start' }
  | { readonly type: 'save_ok' }
  | { readonly type: 'save_fail'; readonly conflict: boolean }
  | { readonly type: 'reload' }
  | { readonly type: 'ack_saved' };

/**
 * Pure status transitions. Illegal transitions return the previous status
 * (never invent a fake `saved` without `save_ok`).
 */
export function reduceAtlasPersistStatus(
  current: AtlasPersistStatus,
  event: AtlasPersistEvent,
): AtlasPersistStatus {
  switch (event.type) {
    case 'edit':
      return current === 'saving' ? 'saving' : 'dirty';
    case 'save_start':
      // Conflict retry is an explicit user action — allow leaving conflict → saving.
      if (current === 'conflict') return 'saving';
      if (current === 'clean' || current === 'saved') return current;
      return 'saving';
    case 'save_ok':
      return 'saved';
    case 'save_fail':
      return event.conflict ? 'conflict' : 'dirty';
    case 'reload':
      return 'clean';
    case 'ack_saved':
      return current === 'saved' ? 'clean' : current;
    default:
      return current;
  }
}

/** German status label for chrome (never claims saved without server confirm). */
export function atlasPersistStatusLabelDe(status: AtlasPersistStatus): string {
  if (status === 'dirty') return 'Ungespeicherte Änderungen';
  if (status === 'saving') return 'Speichern…';
  if (status === 'saved') return 'Gespeichert';
  if (status === 'conflict') return 'Konflikt — neu laden oder erneut speichern';
  return 'Weltkarte · zoomen für Orte';
}
