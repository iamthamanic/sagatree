/**
 * client-trust-body — Reject privileged client body keys on public Edge POSTs (#675).
 * Location: supabase/functions/_shared/client-trust-body.ts
 *
 * Hand parsers still pick allowlisted fields; this fails closed when a client
 * also sends ownership/counters/roles that must never be trusted.
 */

export const PRIVILEGED_CLIENT_BODY_KEYS = [
  'author_id',
  'owner_user_id',
  'rating',
  'downloads',
  'roles',
  'permissions',
  'is_admin',
  'service_role',
] as const;

export type PrivilegedClientBodyKey = (typeof PRIVILEGED_CLIENT_BODY_KEYS)[number];

const PRIVILEGED = new Set<string>(PRIVILEGED_CLIENT_BODY_KEYS);

export function findPrivilegedClientBodyKeys(
  body: unknown,
): PrivilegedClientBodyKey[] {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return [];
  }
  const found: PrivilegedClientBodyKey[] = [];
  for (const key of Object.keys(body as Record<string, unknown>)) {
    if (PRIVILEGED.has(key)) {
      found.push(key as PrivilegedClientBodyKey);
    }
  }
  return found;
}

/** Returns an error message when privileged keys are present; otherwise null. */
export function privilegedClientBodyRejectionMessage(
  body: unknown,
): string | null {
  const found = findPrivilegedClientBodyKeys(body);
  if (found.length === 0) return null;
  return `Client darf privilegierte Felder nicht setzen: ${found.join(', ')}`;
}
