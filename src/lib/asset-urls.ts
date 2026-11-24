/**
 * Browser asset URL helpers.
 * Location: src/lib/asset-urls.ts
 *
 * Host assets are served from the credentialed host asset store; URLs from host HTTP are
 * already browser-reachable, so no rewrite is required today. Kept as a single seam so
 * item model/thumbnail services stay stable if a proxy/CDN rewrite is ever introduced.
 */

/** Returns a browser-loadable URL for a stored asset (currently identity). */
export function rewriteBrowserStorageUrl(url: string): string {
  return url;
}
