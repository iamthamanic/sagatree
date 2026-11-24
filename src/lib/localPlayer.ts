/**
 * Shared local-player identity helpers for the local-only SagaTree stack.
 *
 * The `player1` shortcut maps to the seeded auth user (LOCAL_PLAYER_EMAIL).
 * Legacy `player` still accepted. Admin and player have equal product rights today;
 * saga-scoped permissions come later inside each saga. Keep UUID in sync with migration 074.
 * Location: src/lib/localPlayer.ts.
 */

export const LOCAL_PLAYER_USER_ID = '00000000-0000-4000-8000-000000000002';

export const LOCAL_PLAYER_USERNAME = 'player1';
/** Previous shortcut — still accepted so old bookmarks / muscle memory work. */
export const LOCAL_PLAYER_USERNAME_LEGACY = 'player';
export const LOCAL_PLAYER_PASSWORD = '1234';
/** Seeded email — keep stable; renaming would break existing auth rows. */
export const LOCAL_PLAYER_EMAIL = 'player@sagatree.local';

export function isLocalPlayerShortcut(identifier: string, password: string): boolean {
  const normalized = identifier.trim().toLowerCase();
  return (
    (normalized === LOCAL_PLAYER_USERNAME
      || normalized === LOCAL_PLAYER_USERNAME_LEGACY
      || normalized === LOCAL_PLAYER_EMAIL) &&
    password === LOCAL_PLAYER_PASSWORD
  );
}
