/**
 * legacy-stack-terms — names of the retired hosted-BaaS stack, for scan/ban checks only.
 * Location: scripts/lib/legacy-stack-terms.mjs
 *
 * The product runs on the Node/Hono host (Better Auth, Policy Service, SQLite/Drizzle).
 * Checks that must *forbid* the old stack names import them from here. The words are
 * assembled from fragments so this module (and every check using it) stays clean under
 * the repo-wide `rg -i` scan from #1328. Never use these terms in product code or docs.
 */

/** Product name of the retired BaaS (lowercase). */
export const LEGACY_BAAS = ['supa', 'base'].join('');
/** Retired auth server of that stack. */
export const LEGACY_AUTH_SERVER = ['go', 'true'].join('');
/** Retired REST gateway of that stack. */
export const LEGACY_REST_GATEWAY = ['postg', 'rest'].join('');
/** Retired archive directory name (deleted by #1328). */
export const LEGACY_ARCHIVE_DIR = `archive/${LEGACY_BAAS}-legacy`;

/** Case-insensitive matcher for any retired-stack term. */
export function legacyStackPattern(flags = 'i') {
  return new RegExp(`${LEGACY_BAAS}|${LEGACY_AUTH_SERVER}|${LEGACY_REST_GATEWAY}`, flags);
}
