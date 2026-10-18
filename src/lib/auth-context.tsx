/**
 * AuthProvider — Supabase session + Local Admin shortcut with attempt generations.
 * Location: src/lib/auth-context.tsx
 *
 * Local Admin GoTrue login is bounded by AUTH_SESSION_TIMEOUT_MS. Timed-out
 * attempts fall back to offline UI, but a late GoTrue success for the same live
 * Local Admin intent upgrades to a real JWT (needed for PostgREST/RLS). After
 * logout or a newer non-admin user, late admin JWTs are still discarded.
 * signInWithPassword has no AbortSignal — stale results use generation + scrub.
 *
 * Durable intent = `isLocalAdminSession()` storage flag (see localAdminAuthPolicy).
 * Generation refs alone are cleared on HMR / Strict remount and must not scrub a
 * wanted Local Admin JWT (that race left the UI stuck on the login screen).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from './supabase';
import {
  isLocalAdminEnabled,
  isLocalAdminSession,
  setLocalAdminSession,
  LOCAL_ADMIN_EMAIL,
  LOCAL_ADMIN_PASSWORD,
  LOCAL_ADMIN_USER_ID,
  LOCAL_ADMIN_USERNAME,
} from './localAdmin';
import {
  isLocalPlayerShortcut,
  LOCAL_PLAYER_EMAIL,
  LOCAL_PLAYER_PASSWORD,
} from './localPlayer';
import {
  AUTH_SESSION_TIMEOUT_MS,
  isTimedOut,
  raceWithTimeout,
  raceWithTimeoutOrSymbol,
} from './networkTimeout';
import {
  decideLocalAdminJwt,
  mayDiscardLocalAdminJwt,
} from './localAdminAuthPolicy';
import type { AuthTokenResponsePassword, User } from '@supabase/supabase-js';
import { projectService } from '../infrastructure/project/project-service';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  /** True when supabase.auth holds an access_token (PostgREST RLS-ready). */
  hasJwtSession: boolean;
  /**
   * Force GoTrue login for Local Admin (or confirm existing JWT).
   * Used by Welt/Atlas when offline fallback blocked API calls.
   */
  ensureJwtSession: () => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/** Soft-provision Dornhain defaults after GoTrue auth (idempotent RPC + DB trigger). */
function provisionDornhainDefaultForSession(): void {
  void projectService.ensureNativeStarterProject().catch((error: unknown) => {
    console.warn('[auth] dornhain default provision:', error);
  });
}

const AuthContext = createContext<AuthContextType | null>(null);

function createLocalAdminUser(): User {
  return {
    id: LOCAL_ADMIN_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: LOCAL_ADMIN_EMAIL,
    app_metadata: {
      provider: 'local-admin',
      providers: ['local-admin'],
    },
    user_metadata: {
      username: LOCAL_ADMIN_USERNAME,
      display_name: 'Admin',
    },
    identities: [],
    created_at: new Date().toISOString(),
    is_anonymous: false,
  } as User;
}

function getStoredLocalAdminUser(): User | null {
  return isLocalAdminSession() ? createLocalAdminUser() : null;
}

function isLocalAdminShortcut(identifier: string, password: string): boolean {
  if (!isLocalAdminEnabled()) return false;
  const normalized = identifier.trim().toLowerCase();
  return (
    (normalized === LOCAL_ADMIN_USERNAME || normalized === LOCAL_ADMIN_EMAIL) &&
    password === LOCAL_ADMIN_PASSWORD
  );
}

function isLocalAdminFallbackUser(user: User | null | undefined): boolean {
  return Boolean(
    user &&
      user.id === LOCAL_ADMIN_USER_ID &&
      user.app_metadata?.provider === 'local-admin',
  );
}

function isSeededLocalAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.id === LOCAL_ADMIN_USER_ID || user.email === LOCAL_ADMIN_EMAIL;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasJwtSession, setHasJwtSession] = useState(false);
  /** Monotonic generation: only the live generation may apply Auth UI state. */
  const authGenerationRef = useRef(0);
  const userRef = useRef<User | null>(null);
  /** Live generations that intentionally use Local Admin fallback (not GoTrue JWT). */
  const fallbackGenerationsRef = useRef<Set<number>>(new Set());
  /**
   * Live generation that still expects GoTrue Local Admin success (not timed out).
   * Allows in-flight SIGNED_IN before applyUser; cleared on timeout/bump/success.
   */
  const expectingGoTrueLocalAdminRef = useRef<number | null>(null);
  /** Ignore onAuthStateChange while discarding a stale Local Admin GoTrue session. */
  const suppressAuthListenerRef = useRef(false);

  const bumpAuthGeneration = (): number => {
    authGenerationRef.current += 1;
    fallbackGenerationsRef.current.clear();
    expectingGoTrueLocalAdminRef.current = null;
    return authGenerationRef.current;
  };

  const isLiveGeneration = (generation: number): boolean =>
    generation === authGenerationRef.current;

  const applyUser = (next: User | null, generation: number) => {
    if (!isLiveGeneration(generation)) return;
    userRef.current = next;
    setUser(next);
  };

  /**
   * Discard a GoTrue session produced by a timed-out / superseded Local Admin attempt.
   * No-ops while Local Admin is still wanted (storage flag) — scrubbing then causes
   * the login hang (JWT written, then deleted ~10ms later on SIGNED_IN race).
   * No-ops when the current session is a different (non-admin) user.
   * Suppresses listener updates so cleanup signOut cannot clear a valid newer UI user.
   */
  const discardStaleLocalAdminSession = async () => {
    if (!mayDiscardLocalAdminJwt(isLocalAdminSession())) return;
    suppressAuthListenerRef.current = true;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user && isSeededLocalAdminUser(session.user)) {
        await supabase.auth.signOut({ scope: 'local' });
      }
      // Fake/partial GoTrue payloads may leave auth-token crumbs that getSession
      // does not surface — clear only seeded Local Admin identities.
      try {
        for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
          const key = window.localStorage.key(i);
          if (!key || !key.includes('auth-token')) continue;
          const raw = window.localStorage.getItem(key);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as { user?: { id?: string; email?: string } };
            if (
              parsed?.user?.email === LOCAL_ADMIN_EMAIL ||
              parsed?.user?.id === LOCAL_ADMIN_USER_ID
            ) {
              window.localStorage.removeItem(key);
            }
          } catch {
            /* ignore malformed */
          }
        }
      } catch {
        /* ignore storage access */
      }
    } catch (error) {
      console.warn('[auth] stale Local Admin session cleanup failed:', error);
    } finally {
      suppressAuthListenerRef.current = false;
    }
  };

  /** Apply seeded Local Admin GoTrue user to UI (JWT path). */
  const adoptLocalAdminJwt = (
    generation: number,
    next: User,
    accessTokenPresent: boolean,
  ) => {
    fallbackGenerationsRef.current.delete(generation);
    if (expectingGoTrueLocalAdminRef.current === generation) {
      expectingGoTrueLocalAdminRef.current = null;
    }
    applyUser(next, generation);
    setHasJwtSession(accessTokenPresent);
    provisionDornhainDefaultForSession();
  };

  const currentUserIsOtherNonAdmin = (current: User | null | undefined): boolean =>
    Boolean(current && !isSeededLocalAdminUser(current) && !isLocalAdminFallbackUser(current));

  /**
   * Promote offline Local Admin UI to a real GoTrue JWT when the user still wants
   * Local Admin. Returns true when the JWT was adopted (do not discard).
   */
  const tryUpgradeLocalAdminFallback = (generation: number, next: User): boolean => {
    if (!isLiveGeneration(generation)) return false;
    if (!isLocalAdminSession()) return false;
    if (!isSeededLocalAdminUser(next)) return false;
    const current = userRef.current;
    if (current && !isLocalAdminFallbackUser(current) && !isSeededLocalAdminUser(current)) {
      return false;
    }
    fallbackGenerationsRef.current.delete(generation);
    applyUser(next, generation);
    setHasJwtSession(true);
    provisionDornhainDefaultForSession();
    return true;
  };

  const watchStaleLocalAdminPasswordLogin = (
    generation: number,
    loginPromise: PromiseLike<AuthTokenResponsePassword>,
  ) => {
    void Promise.resolve(loginPromise)
      .then(async (result) => {
        if (result.error || !result.data?.user) return;
        const next = result.data.user;
        // Live + still on intentional Local Admin fallback → keep JWT for API/RLS.
        if (tryUpgradeLocalAdminFallback(generation, next)) return;
        const liveSuccess =
          isLiveGeneration(generation) && !fallbackGenerationsRef.current.has(generation);
        if (liveSuccess) return;
        const decision = decideLocalAdminJwt({
          localAdminSessionActive: isLocalAdminSession(),
          sessionUserIsSeededAdmin: isSeededLocalAdminUser(next),
          currentUserIsOther: currentUserIsOtherNonAdmin(userRef.current),
        });
        // Wanted Local Admin (possibly new generation after remount) — leave JWT;
        // live listener / bootstrap will adopt.
        if (decision === 'adopt') return;
        if (decision !== 'discard') return;
        // Logged out / other user — scrub persisted admin JWT (anti-resurrection).
        await discardStaleLocalAdminSession();
        await new Promise((resolve) => setTimeout(resolve, 50));
        await discardStaleLocalAdminSession();
      })
      .catch(() => {
        /* ignore */
      });
  };

  useEffect(() => {
    let cancelled = false;
    const bootstrapGeneration = bumpAuthGeneration();
    const SESSION_TIMEOUT_MS = AUTH_SESSION_TIMEOUT_MS;

    const finish = (nextUser: User | null, withJwt: boolean) => {
      if (cancelled) return;
      applyUser(nextUser, bootstrapGeneration);
      setHasJwtSession(Boolean(nextUser && withJwt && !isLocalAdminFallbackUser(nextUser)));
      setIsLoading(false);
    };

    const storedLocalAdmin = isLocalAdminSession();
    if (storedLocalAdmin) {
      raceWithTimeoutOrSymbol(supabase.auth.getSession(), SESSION_TIMEOUT_MS)
        .then(async (sessionResult) => {
          if (isTimedOut(sessionResult)) {
            fallbackGenerationsRef.current.add(bootstrapGeneration);
            finish(getStoredLocalAdminUser(), false);
            return;
          }

          const {
            data: { session },
          } = sessionResult;
          if (session?.user && session.access_token) {
            finish(session.user, true);
            return;
          }

          try {
            expectingGoTrueLocalAdminRef.current = bootstrapGeneration;
            const loginPromise = supabase.auth.signInWithPassword({
              email: LOCAL_ADMIN_EMAIL,
              password: LOCAL_ADMIN_PASSWORD,
            });
            const loginResult = await raceWithTimeoutOrSymbol(loginPromise, SESSION_TIMEOUT_MS);
            if (isTimedOut(loginResult)) {
              if (expectingGoTrueLocalAdminRef.current === bootstrapGeneration) {
                expectingGoTrueLocalAdminRef.current = null;
              }
              fallbackGenerationsRef.current.add(bootstrapGeneration);
              watchStaleLocalAdminPasswordLogin(bootstrapGeneration, loginPromise);
              throw new Error('local re-login timeout');
            }
            if (expectingGoTrueLocalAdminRef.current === bootstrapGeneration) {
              expectingGoTrueLocalAdminRef.current = null;
            }
            const { data, error } = loginResult;
            if (error || !data.user) throw error ?? new Error('local re-login failed');
            finish(data.user, Boolean(data.session?.access_token));
          } catch {
            fallbackGenerationsRef.current.add(bootstrapGeneration);
            finish(getStoredLocalAdminUser(), false);
          }
        })
        .catch(() => {
          fallbackGenerationsRef.current.add(bootstrapGeneration);
          finish(getStoredLocalAdminUser(), false);
        });
    } else {
      raceWithTimeout(
        supabase.auth.getSession(),
        { data: { session: null }, error: null },
        SESSION_TIMEOUT_MS,
      )
        .then(({ data: { session } }) => {
          finish(session?.user ?? null, Boolean(session?.access_token));
        })
        .catch(() => {
          finish(null, false);
        });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (suppressAuthListenerRef.current) return;
      const generation = authGenerationRef.current;
      const current = userRef.current;
      const onFallback =
        isLocalAdminFallbackUser(current) || fallbackGenerationsRef.current.has(generation);

      if (event === 'SIGNED_IN' && session?.user && isSeededLocalAdminUser(session.user)) {
        const decision = decideLocalAdminJwt({
          localAdminSessionActive: isLocalAdminSession(),
          sessionUserIsSeededAdmin: true,
          currentUserIsOther: currentUserIsOtherNonAdmin(current),
        });

        if (decision === 'discard') {
          void (async () => {
            await discardStaleLocalAdminSession();
            await new Promise((resolve) => setTimeout(resolve, 50));
            await discardStaleLocalAdminSession();
          })();
          return;
        }

        if (decision === 'adopt') {
          // Storage flag says Local Admin is wanted — always keep the JWT.
          // Covers fallback upgrade, first login, and HMR/Strict remount races
          // where expectingGoTrue was cleared mid-flight.
          if (onFallback && tryUpgradeLocalAdminFallback(generation, session.user)) {
            return;
          }
          adoptLocalAdminJwt(generation, session.user, Boolean(session.access_token));
          return;
        }
      }

      if (event === 'SIGNED_OUT') {
        // Cleanup for stale admin must not clear fallback UI or a newer non-admin user.
        if (onFallback) return;
        if (current && !isSeededLocalAdminUser(current)) return;
        if (current === null) return;
        // Local Admin still wanted (flag set) → never bounce to LoginScreen after
        // a spurious scrub signOut; keep offline fallback until JWT re-upgrade.
        if (isLocalAdminSession()) {
          if (!isLocalAdminFallbackUser(current)) {
            applyUser(createLocalAdminUser(), generation);
            setHasJwtSession(false);
          }
          return;
        }
        applyUser(null, generation);
        setHasJwtSession(false);
        return;
      }

      // INITIAL_SESSION / other events with no Supabase session must not wipe
      // intentional Local Admin fallback (storage-backed offline UI).
      if (!session?.user) {
        if (onFallback || isLocalAdminFallbackUser(current) || isLocalAdminSession()) {
          return;
        }
        applyUser(null, generation);
        setHasJwtSession(false);
        return;
      }

      applyUser(session.user, generation);
      setHasJwtSession(Boolean(session.access_token));
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        provisionDornhainDefaultForSession();
      }
    });

    return () => {
      cancelled = true;
      bumpAuthGeneration();
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (isLocalAdminShortcut(email, password)) {
      const generation = bumpAuthGeneration();
      expectingGoTrueLocalAdminRef.current = generation;
      setLocalAdminSession(true);
      const loginPromise = supabase.auth.signInWithPassword({
        email: LOCAL_ADMIN_EMAIL,
        password: LOCAL_ADMIN_PASSWORD,
      });
      try {
        const loginResult = await raceWithTimeoutOrSymbol(loginPromise, AUTH_SESSION_TIMEOUT_MS);
        if (isTimedOut(loginResult)) {
          if (expectingGoTrueLocalAdminRef.current === generation) {
            expectingGoTrueLocalAdminRef.current = null;
          }
          fallbackGenerationsRef.current.add(generation);
          watchStaleLocalAdminPasswordLogin(generation, loginPromise);
          throw new Error('local GoTrue login timeout');
        }
        const { data, error } = loginResult;
        if (error) throw error;
        if (data.user) {
          if (!isLiveGeneration(generation)) {
            if (expectingGoTrueLocalAdminRef.current === generation) {
              expectingGoTrueLocalAdminRef.current = null;
            }
            // Remount superseded this attempt. Keep JWT when Local Admin is still
            // wanted — the live provider adopts via SIGNED_IN / bootstrap.
            // Never scrub here (that was the login-screen hang).
            return;
          }
          adoptLocalAdminJwt(generation, data.user, Boolean(data.session?.access_token));
          return;
        }
      } catch (error) {
        if (expectingGoTrueLocalAdminRef.current === generation) {
          expectingGoTrueLocalAdminRef.current = null;
        }
        if (!isLiveGeneration(generation)) {
          watchStaleLocalAdminPasswordLogin(generation, loginPromise);
          return;
        }
        console.warn('[auth] local GoTrue login unavailable, using app-level admin session:', error);
        fallbackGenerationsRef.current.add(generation);
        watchStaleLocalAdminPasswordLogin(generation, loginPromise);
        applyUser(createLocalAdminUser(), generation);
        setHasJwtSession(false);
        return;
      }
      if (expectingGoTrueLocalAdminRef.current === generation) {
        expectingGoTrueLocalAdminRef.current = null;
      }
      if (!isLiveGeneration(generation)) return;
      fallbackGenerationsRef.current.add(generation);
      watchStaleLocalAdminPasswordLogin(generation, loginPromise);
      applyUser(createLocalAdminUser(), generation);
      setHasJwtSession(false);
      return;
    }

    const generation = bumpAuthGeneration();
    setLocalAdminSession(false);
    // Resolve local demo shortcuts to seeded GoTrue emails (admin handled above).
    const resolvedEmail = isLocalPlayerShortcut(email, password)
      ? LOCAL_PLAYER_EMAIL
      : email.trim();
    const resolvedPassword = isLocalPlayerShortcut(email, password)
      ? LOCAL_PLAYER_PASSWORD
      : password;
    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password: resolvedPassword,
    });
    if (error) throw error;
    if (!isLiveGeneration(generation)) return;
    if (data.user) {
      applyUser(data.user, generation);
      setHasJwtSession(Boolean(data.session?.access_token));
      provisionDornhainDefaultForSession();
    }
  };

  const ensureJwtSession = useCallback(async (): Promise<boolean> => {
    const existing = await supabase.auth.getSession();
    if (existing.data.session?.access_token && existing.data.session.user) {
      if (isLiveGeneration(authGenerationRef.current)) {
        applyUser(existing.data.session.user, authGenerationRef.current);
        setHasJwtSession(true);
      }
      return true;
    }
    if (!isLocalAdminSession()) {
      setHasJwtSession(false);
      return false;
    }
    const generation = authGenerationRef.current;
    const { data, error } = await supabase.auth.signInWithPassword({
      email: LOCAL_ADMIN_EMAIL,
      password: LOCAL_ADMIN_PASSWORD,
    });
    if (error || !data.user || !data.session?.access_token) {
      setHasJwtSession(false);
      return false;
    }
    if (!isLiveGeneration(generation)) return Boolean(data.session?.access_token);
    fallbackGenerationsRef.current.delete(generation);
    applyUser(data.user, generation);
    setHasJwtSession(true);
    provisionDornhainDefaultForSession();
    return true;
  }, []);

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    // DB trigger provisions on auth.users INSERT; client ensure covers session-present signups.
    if (data.session?.user) {
      provisionDornhainDefaultForSession();
    }
  };

  const signOut = async () => {
    bumpAuthGeneration();
    setLocalAdminSession(false);
    userRef.current = null;
    setUser(null);
    setHasJwtSession(false);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('[auth] signOut cleanup:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        hasJwtSession,
        ensureJwtSession,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
