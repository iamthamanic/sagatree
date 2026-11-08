/**
 * supabase client factory — inert stub after CUT-20 (#1155).
 * Location: src/lib/supabase.ts
 *
 * Product facades must not call this client. Host HTTP + Better Auth are the
 * only product runtime. Keep a placeholder createClient so legacy tooling that
 * still imports the module can load without Vite `VITE_SUPABASE_*`.
 */
import { createClient } from '@supabase/supabase-js';

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> })
  .env;
const configuredSupabaseUrl = String(viteEnv?.VITE_SUPABASE_URL ?? '').trim();
const configuredSupabaseAnonKey = String(viteEnv?.VITE_SUPABASE_ANON_KEY ?? '').trim();

/** Inert placeholders — never used for product auth/data after CUT-20. */
const supabaseUrl = configuredSupabaseUrl || 'http://127.0.0.1:9';
const supabaseAnonKey = configuredSupabaseAnonKey || 'missing-vite-supabase-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

/** No-op for callers that previously rewrote Storage URLs under Edge. */
export function rewriteBrowserStorageUrl(url: string): string {
  return url;
}

/** Legacy helper — unused by product after CUT-20; retained for import graph stability. */
export const createServerClient = () => createClient(supabaseUrl, supabaseAnonKey);
