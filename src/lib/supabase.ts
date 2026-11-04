/**
 * supabase client factory — inert under host-first (FE-HOST-09).
 * Location: src/lib/supabase.ts
 *
 * When `VITE_SAGATREE_HOST_AUTH_URL` is set and host library is not explicitly
 * disabled, missing `VITE_SUPABASE_*` is allowed (placeholders only) so Vite can
 * boot without GoTrue/PostgREST. Dual-path facades must not call this client
 * while `isHostLibraryEnabled()` is true.
 */
import { createClient } from '@supabase/supabase-js';
import { isHostLibraryExplicitlyDisabled } from '../infrastructure/host/host-library-http';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> })
  .env;
const configuredSupabaseUrl = String(viteEnv?.VITE_SUPABASE_URL ?? '').trim();
const configuredSupabaseAnonKey = String(viteEnv?.VITE_SUPABASE_ANON_KEY ?? '').trim();
const hostAuthUrl = String(viteEnv?.VITE_SAGATREE_HOST_AUTH_URL ?? '').trim();
const hostFirst =
  hostAuthUrl.length > 0 &&
  !isHostLibraryExplicitlyDisabled({
    VITE_SAGATREE_HOST_AUTH_URL: hostAuthUrl,
    VITE_SAGATREE_HOST_LIBRARY: String(viteEnv?.VITE_SAGATREE_HOST_LIBRARY ?? ''),
  });

const hasUrl = Boolean(configuredSupabaseUrl);
const hasAnon = Boolean(configuredSupabaseAnonKey);

if (hasUrl !== hasAnon) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be configured together.',
  );
}

/**
 * #672 — no committed hosted JWT fallback.
 * Browser/Vite and production builds fail closed when env is missing —
 * except FE-HOST-09 host-first (auth URL present, library not opted out).
 * Node tooling that bundles this module (no Vite env) gets inert placeholders
 * so offline checks can import the graph without real credentials.
 */
const isBrowser = typeof window !== 'undefined';
const mustHaveEnv = (Boolean(viteEnv?.PROD) || isBrowser) && !hostFirst;

if (mustHaveEnv && (!hasUrl || !hasAnon)) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required (see .env.example), or set VITE_SAGATREE_HOST_AUTH_URL for host-first.',
  );
}

if (
  viteEnv?.PROD &&
  hasAnon &&
  !/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(configuredSupabaseAnonKey)
) {
  throw new Error('VITE_SUPABASE_ANON_KEY must be a valid anon JWT from your Supabase project.');
}

const supabaseUrl = configuredSupabaseUrl || 'http://127.0.0.1:9';
const supabaseAnonKey = configuredSupabaseAnonKey || 'missing-vite-supabase-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: !hostFirst,
    autoRefreshToken: !hostFirst,
  },
});

/**
 * Edge Functions running in Docker often sign URLs with the internal Kong host
 * (`http://supabase-kong:8000/...`). Browsers cannot resolve that — rewrite to
 * the public VITE_SUPABASE_URL origin when needed.
 */
export function rewriteBrowserStorageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const publicOrigin = new URL(supabaseUrl).origin;
    if (parsed.origin === publicOrigin) return url;
    // Internal Docker / compose hostnames used by Edge when signing storage URLs.
    const host = parsed.hostname.toLowerCase();
    const isInternalStorageHost =
      host === 'supabase-kong' ||
      host === 'kong' ||
      host.endsWith('.supabase-kong') ||
      host === 'host.docker.internal';
    if (!isInternalStorageHost) return url;
    return `${publicOrigin}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/** Server client for authenticated requests (same public anon config). */
export const createServerClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey);
};
