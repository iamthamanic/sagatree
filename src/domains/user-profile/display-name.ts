/**
 * Account display-name + initials helpers (#682).
 * Location: src/domains/user-profile/display-name.ts
 *
 * Pure domain — no React, no backend clients. Shared by Layout chrome, Profile, Lobby.
 */

export type AccountDisplayNameInput = {
  readonly profileDisplayName?: string | null;
  readonly authDisplayName?: string | null;
  readonly authUsername?: string | null;
  readonly email?: string | null;
};

/**
 * Resolve account label: profile → auth display_name → username → email local-part.
 * Empty / whitespace → null (callers apply UI fallback).
 */
export function resolveAccountDisplayName(input: AccountDisplayNameInput): string | null {
  for (const candidate of [
    input.profileDisplayName,
    input.authDisplayName,
    input.authUsername,
    input.email?.split('@')[0],
  ]) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
}

/**
 * Up to two initials from a display name. Empty → "?" for stable UI fallback.
 */
export function initialsFromDisplayName(displayName: string | null | undefined): string {
  const parts = (displayName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return '?';
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}
