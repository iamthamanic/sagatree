/**
 * Browser E2E host environment helpers.
 * Location: e2e/helpers/host-env.ts
 *
 * CI runs specs against an ephemeral host (`scripts/browser-e2e-with-host.mjs`, Vite `/api`
 * proxy, Better Auth). Specs that need a long-lived host with a seeded Dornhain saga (fixed
 * public ids) opt in via `SAGATREE_E2E_LIVE_SEED=1`; otherwise they skip.
 */

/** True when a live host with the Dornhain seed was explicitly provided for this run. */
export function hasLiveHostSeed(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.SAGATREE_E2E_LIVE_SEED ?? '').trim() === '1';
}
