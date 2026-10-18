/**
 * Resolves the current user id for service-layer Supabase calls.
 * Local-admin sessions short-circuit when the stack is unreachable.
 * Location: src/lib/authenticatedUser.ts
 *
 * World/Atlas RLS requires a real GoTrue JWT (`authenticated` role). Offline
 * Local Admin UI may resolve an owner id without a token — use
 * `assertSupabaseJwtSession` before PostgREST calls that hit world RPCs/RLS.
 */

import { supabase } from './supabase';
import { isLocalAdminSession, LOCAL_ADMIN_USER_ID } from './localAdmin';
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
 * @returns authenticated user id from the JWT session
 */
export async function assertSupabaseJwtSession(): Promise<string> {
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
