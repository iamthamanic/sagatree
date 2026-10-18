/**
 * CI / Browser E2E Supabase env helpers.
 * Location: e2e/helpers/supabase-env.ts
 *
 * After #672 the app fails closed without VITE_SUPABASE_*. CI prefers repo
 * secrets; otherwise verify.yml uses an inert URL so Local Admin can boot.
 * Tests that need a persisted GoTrue JWT (RLS mocks, scrub regression) must
 * fulfill `/auth/v1/token` themselves when the backend is inert.
 */

/** Syntactically valid placeholder JWT (public Supabase demo shape) — paired only with inert URL. */
export const E2E_INERT_ANON_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export function isInertSupabaseEnv(
  url = process.env.VITE_SUPABASE_URL ?? '',
  anon = process.env.VITE_SUPABASE_ANON_KEY ?? '',
): boolean {
  const u = url.trim().toLowerCase();
  const a = anon.trim();
  if (!u || u.includes('127.0.0.1:9') || u.includes('localhost:9')) return true;
  if (!a || a.startsWith('ci-e2e-missing') || a === 'missing-vite-supabase-anon-key') return true;
  return false;
}
