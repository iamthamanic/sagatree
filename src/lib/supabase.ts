/**
 * Legacy supabase module — SDK-free after CUT-21 (#1156).
 * Location: src/lib/supabase.ts
 *
 * Product runtime is host HTTP + Better Auth only. Kept as a tiny helper
 * surface so existing `rewriteBrowserStorageUrl` call sites stay stable
 * without `@supabase/supabase-js`.
 */

/** No-op for callers that previously rewrote Storage URLs under Edge. */
export function rewriteBrowserStorageUrl(url: string): string {
  return url;
}
