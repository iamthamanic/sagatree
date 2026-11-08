/**
 * Supabase public config — env only (#672).
 * Location: src/utils/supabase/info.tsx
 *
 * Never commit hosted anon JWTs. Prefer `src/lib/supabase.ts` which validates
 * VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY together.
 */

function readEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return String(viteEnv?.[name] ?? '').trim();
}

/** Project ref derived from `VITE_SUPABASE_URL` host when present (self-host or *.supabase.co). */
export function resolveSupabaseProjectId(): string {
  const url = readEnv('VITE_SUPABASE_URL');
  if (!url) return '';
  try {
    const host = new URL(url).hostname;
    const match = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match?.[1] ?? '';
  } catch {
    return '';
  }
}

/** @deprecated Prefer env via src/lib/supabase.ts — empty when unset. */
export const projectId = resolveSupabaseProjectId();

/** @deprecated Prefer VITE_SUPABASE_ANON_KEY — empty when unset (no committed JWT). */
export const publicAnonKey = readEnv('VITE_SUPABASE_ANON_KEY');
