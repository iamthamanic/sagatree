/**
 * AuthProvider — Better Auth (host) session for the product runtime (CUT-20 / FE-HOST-07).
 * Location: src/lib/auth-context.tsx
 *
 * Legacy GoTrue/Supabase auth paths were removed with dual-path CUT-20. When
 * `VITE_SAGATREE_HOST_AUTH_URL` is unset, host auth is disabled — see
 * `isHostAuthBridgeEnabled` / `getHostAuthBaseUrl`.
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
import {
  isLocalAdminEnabled,
  isLocalAdminShortcut,
  LOCAL_ADMIN_EMAIL,
  LOCAL_ADMIN_PASSWORD,
  setLocalAdminSession,
} from './localAdmin';
import {
  isLocalPlayerShortcut,
  LOCAL_PLAYER_EMAIL,
  LOCAL_PLAYER_PASSWORD,
} from './localPlayer';
import { projectService } from '../infrastructure/project/project-service';
import {
  isHostAuthBridgeEnabled,
  probeHostActor,
  scrubHostAuthJson,
  getHostAuthBaseUrl,
  HOST_AUTH_SESSION_BEARER_KEYS,
  signInHostEmail,
  signOutHost,
  signUpHostEmail,
} from './hostAuthBridge';
import { isHostLibraryEnabled } from '../infrastructure/host/host-library-http';

/** Re-export host cookie bridge (MIG-014 / FE-HOST-07). */
export {
  isHostAuthBridgeEnabled,
  probeHostActor,
  scrubHostAuthJson,
  getHostAuthBaseUrl,
  HOST_AUTH_SESSION_BEARER_KEYS,
};

/** Minimal user shape for `useAuth()` (no `@supabase/supabase-js` after CUT-20). */
export type AuthUser = {
  readonly id: string;
  readonly email?: string;
  readonly app_metadata?: Readonly<Record<string, unknown>>;
  readonly user_metadata?: Readonly<Record<string, unknown>>;
};

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  /** True when a host Better Auth session is active. */
  hasJwtSession: boolean;
  ensureJwtSession: () => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

function provisionDornhainDefaultForSession(): void {
  void projectService.ensureNativeStarterProject().catch((error: unknown) => {
    console.warn('[auth] dornhain default provision:', error);
  });
}

const AuthContext = createContext<AuthContextType | null>(null);

function createHostSessionUser(actor: {
  readonly actorId: string;
  readonly email: string | null;
}): AuthUser {
  return {
    id: actor.actorId,
    email: actor.email ?? undefined,
    app_metadata: {
      provider: 'host-better-auth',
      providers: ['host-better-auth'],
    },
    user_metadata: {
      display_name: actor.email ?? 'Host',
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasJwtSession, setHasJwtSession] = useState(false);
  const authGenerationRef = useRef(0);
  const userRef = useRef<AuthUser | null>(null);

  const bumpAuthGeneration = (): number => {
    authGenerationRef.current += 1;
    return authGenerationRef.current;
  };

  const isLiveGeneration = (generation: number): boolean =>
    generation === authGenerationRef.current;

  const applyUser = (next: AuthUser | null, generation: number) => {
    if (!isLiveGeneration(generation)) return;
    userRef.current = next;
    setUser(next);
  };

  useEffect(() => {
    if (!isHostLibraryEnabled()) {
      setIsLoading(false);
      setHasJwtSession(false);
      setUser(null);
      userRef.current = null;
      return;
    }
    let cancelled = false;
    const generation = bumpAuthGeneration();

    void probeHostActor()
      .then((actor) => {
        if (cancelled || !isLiveGeneration(generation)) return;
        if (actor) {
          applyUser(createHostSessionUser(actor), generation);
          setHasJwtSession(true);
        } else {
          applyUser(null, generation);
          setHasJwtSession(false);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled && isLiveGeneration(generation)) {
          applyUser(null, generation);
          setHasJwtSession(false);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      bumpAuthGeneration();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isHostLibraryEnabled()) {
      throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
    }
    const generation = bumpAuthGeneration();
    setLocalAdminSession(false);
    let hostEmail = email.trim();
    let hostPassword = password;
    if (isLocalAdminEnabled() && isLocalAdminShortcut(email, password)) {
      hostEmail = LOCAL_ADMIN_EMAIL;
      hostPassword = LOCAL_ADMIN_PASSWORD;
    } else if (isLocalPlayerShortcut(email, password)) {
      hostEmail = LOCAL_PLAYER_EMAIL;
      hostPassword = LOCAL_PLAYER_PASSWORD;
    } else if (!hostEmail.includes('@')) {
      throw new Error(
        'Bitte eine E-Mail eingeben (z. B. name@example.com). DEV: admin oder player1 / 1234.',
      );
    }
    try {
      const actor = await signInHostEmail(hostEmail, hostPassword);
      if (!isLiveGeneration(generation)) return;
      applyUser(createHostSessionUser(actor), generation);
      setHasJwtSession(true);
      provisionDornhainDefaultForSession();
    } catch (err) {
      const isDemo =
        isLocalAdminShortcut(email, password) || isLocalPlayerShortcut(email, password);
      if (!isDemo || !import.meta.env.DEV) throw err;
      try {
        await signUpHostEmail(hostEmail, hostPassword);
      } catch {
        /* already exists */
      }
      const actor = await signInHostEmail(hostEmail, hostPassword);
      if (!isLiveGeneration(generation)) return;
      applyUser(createHostSessionUser(actor), generation);
      setHasJwtSession(true);
      provisionDornhainDefaultForSession();
    }
  };

  const ensureJwtSession = useCallback(async (): Promise<boolean> => {
    if (!isHostLibraryEnabled()) {
      setHasJwtSession(false);
      return false;
    }
    const actor = await probeHostActor();
    if (!actor) {
      setHasJwtSession(false);
      return false;
    }
    const generation = authGenerationRef.current;
    if (isLiveGeneration(generation)) {
      applyUser(createHostSessionUser(actor), generation);
      setHasJwtSession(true);
    }
    return true;
  }, []);

  const signUp = async (email: string, password: string) => {
    if (!isHostLibraryEnabled()) {
      throw new Error('Host-Registrierung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
    }
    const signedUp = await signUpHostEmail(email.trim(), password);
    const actor = signedUp ?? (await probeHostActor());
    if (actor) {
      const generation = bumpAuthGeneration();
      applyUser(createHostSessionUser(actor), generation);
      setHasJwtSession(true);
      provisionDornhainDefaultForSession();
    }
  };

  const signOut = async () => {
    await signOutHost();
    bumpAuthGeneration();
    setLocalAdminSession(false);
    userRef.current = null;
    setUser(null);
    setHasJwtSession(false);
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
