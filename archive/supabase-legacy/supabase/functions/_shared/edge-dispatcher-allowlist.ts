/**
 * edge-dispatcher-allowlist — Deny-by-default Edge function mounts (#668).
 * Location: supabase/functions/_shared/edge-dispatcher-allowlist.ts
 *
 * Only hardened workers (JWT + owner/service checks inside) may be dispatched.
 * Legacy in-memory / unauthenticated maps stay unreachable via main.
 */

/** Explicit mounts the custom `main` dispatcher may start as userWorkers. */
export const EDGE_DISPATCHER_ALLOWLIST = [
  'ai-provider-credentials',
  'character-avatar-meshy',
  'character-lore',
  'item-model3d',
  'item-thumbnail',
  'look-reference-analysis',
  'ollama-settings',
  'session-media-token',
  'session-recap',
] as const;

export type EdgeDispatcherAllowedName = (typeof EDGE_DISPATCHER_ALLOWLIST)[number];

const ALLOWED = new Set<string>(EDGE_DISPATCHER_ALLOWLIST);

/** Reserved path segments that must never spawn a worker. */
export const EDGE_DISPATCHER_BLOCKED = new Set(['main', '_shared']);

export function isEdgeDispatcherAllowed(serviceName: string): boolean {
  if (!serviceName || serviceName.includes('..')) return false;
  if (EDGE_DISPATCHER_BLOCKED.has(serviceName)) return false;
  return ALLOWED.has(serviceName);
}
