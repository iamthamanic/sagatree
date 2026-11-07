/**
 * Resolves the current actor id for service-layer calls (CUT-20).
 * Location: src/lib/authenticatedUser.ts
 *
 * Product runtime uses Better Auth cookies via `probeHostActor` — no Supabase JWT.
 */

import { isLocalAdminSession, LOCAL_ADMIN_USER_ID } from './localAdmin';
import { probeHostActor } from './hostAuthBridge';
import { isHostLibraryEnabled } from '../infrastructure/host/host-library-http';
import {
  AUTH_SESSION_TIMEOUT_MS,
  isTimedOut,
  raceWithTimeoutOrSymbol,
} from './networkTimeout';

/** Shown when host session is missing but world/atlas surfaces expect API auth. */
export const API_AUTH_REQUIRED_DE =
  'API-Anmeldung fehlt. Bitte mit dem Host anmelden (VITE_SAGATREE_HOST_AUTH_URL) oder erneut einloggen.';

export async function getAuthenticatedUserId(): Promise<string> {
  if (!isHostLibraryEnabled()) {
    if (isLocalAdminSession()) return LOCAL_ADMIN_USER_ID;
    throw new Error('Host-Anmeldung nicht konfiguriert');
  }
  const sessionResult = await raceWithTimeoutOrSymbol(
    probeHostActor(),
    AUTH_SESSION_TIMEOUT_MS,
  );
  if (!isTimedOut(sessionResult) && sessionResult.actorId) {
    return sessionResult.actorId;
  }
  throw new Error('User not authenticated');
}

/**
 * Ensures a host actor session exists for world/atlas-style surfaces.
 * Replaces legacy GoTrue JWT assertion (CUT-20).
 */
export async function assertSupabaseJwtSession(): Promise<string> {
  if (!isHostLibraryEnabled()) {
    throw new Error(API_AUTH_REQUIRED_DE);
  }
  const sessionResult = await raceWithTimeoutOrSymbol(
    probeHostActor(),
    AUTH_SESSION_TIMEOUT_MS,
  );
  if (!isTimedOut(sessionResult) && sessionResult.actorId) {
    return sessionResult.actorId;
  }
  throw new Error(API_AUTH_REQUIRED_DE);
}
