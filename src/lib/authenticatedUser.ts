/**
 * Resolves the current user id for service-layer calls.
 * Local-admin sessions short-circuit when the stack is unreachable.
 * Location: src/lib/authenticatedUser.ts
 *
 * FE-HOST-09: under host library, actor comes from Better Auth whoami (cookie).
 * World/Atlas PostgREST still requires a GoTrue JWT when host library is off —
 * use `assertSupabaseJwtSession` before those legacy RLS paths.
 */

import { supabase } from './supabase';
import { isLocalAdminSession, LOCAL_ADMIN_USER_ID } from './localAdmin';
import { probeHostActor } from './hostAuthBridge';
import { isHostLibraryEnabled } from '../infrastructure/host/host-library-http';
import {
  AUTH_SESSION_TIMEOUT_MS,
  isTimedOut,
  raceWithTimeoutOrSymbol,
  raceWithTimeoutReject,
  SUPABASE_QUERY_TIMEOUT_MS,
} from './networkTimeout';

/** Shown when UI is signed in offline but PostgREST would run as anon. */
export const API_AUTH_REQUIRED_DE =
  'API-Anmeldung fehlt. Local Admin braucht ein GoTrue-JWT für Welt und Atlas — bitte „API verbinden“ oder erneut einloggen.';

const JWT_WAIT_MS = 4_000;
const JWT_POLL_MS = 200;

export async function getAuthenticatedUserId(): Promise<string> {
  if (isHostLibraryEnabled()) {
    const actor = await probeHostActor();
    if (actor?.actorId) return actor.actorId;
    throw new Error('User not authenticated');
  }

  if (isLocalAdminSession()) {
    const sessionResult = await raceWithTimeoutOrSymbol(
      supabase.auth.getSession(),
      AUTH_SESSION_TIMEOUT_MS,
    );
    if (!isTimedOut(sessionResult) && sessionResult.data.session?.user) {
      return sessionResult.data.session.user.id;
    }
    return LOCAL_ADMIN_USER_ID;
  }

  const { data, error } = await raceWithTimeoutReject(
    supabase.auth.getUser(),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Authentication request timed out',
  );
  if (error) throw error;
  if (data.user) return data.user.id;
  throw new Error('User not authenticated');
}

/**
 * Ensures the Supabase client holds an access token (PostgREST `authenticated`).
 * Polls briefly so a late Local Admin GoTrue upgrade can land before failing.
 * Under host library, returns the host actor id (no GoTrue JWT required).
 * @returns authenticated user id from the JWT session (or host whoami)
 */
export async function assertSupabaseJwtSession(): Promise<string> {
  if (isHostLibraryEnabled()) {
    return getAuthenticatedUserId();
  }
  const deadline = Date.now() + JWT_WAIT_MS;
  while (Date.now() <= deadline) {
    const sessionResult = await raceWithTimeoutOrSymbol(
      supabase.auth.getSession(),
      AUTH_SESSION_TIMEOUT_MS,
    );
    if (!isTimedOut(sessionResult)) {
      const session = sessionResult.data.session;
      const userId = session?.user?.id?.trim();
      if (session?.access_token && userId) {
        return userId;
      }
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, JWT_POLL_MS);
    });
  }
  throw new Error(API_AUTH_REQUIRED_DE);
}
