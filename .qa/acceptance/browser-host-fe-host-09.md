# Acceptance — browser-host-FE-HOST-09 (#1101)

## SLICE DONE

Host-first product runtime: `VITE_SAGATREE_HOST_AUTH_URL` enables Library /
covered dual-path facades unless `VITE_SAGATREE_HOST_LIBRARY` is explicitly off.
Supabase client is inert under host-first (no GoTrue). Residual Edge/RPC
surfaces DENY with German UX. Residual allowlist documented.

## Checks

- [x] Host-only boot smoke for Library write + session + atlas (`scripts/fe-host-09-host-first.self-test.mjs`).
- [x] No required live Supabase for `npm run test-gate` product checks touched here.
- [x] Residual Supabase usage allowlisted (`docs/architecture/fe-host-09-residual-supabase.md`).
- [x] Touched files: zero type escape hatches.

## Deferred

- Saga-definition product HTTP mount
- Avatar Meshy / import-export / artifact host successors
- Item thumbnail / model3d host AI
- Look reference analysis host
- Session media token host
- Peer profile batch host route
- GATE-05 desktop packaging

## Security Coverage

- No silent anon Supabase fallback under host-first.
- Residual surfaces fail closed (German DENY / degraded).
- All severities listed in residual allowlist (Critical→Info).

## Implementation Notes

- Gate: `isHostLibraryEnabled` / `isHostLibraryExplicitlyDisabled` in `host-library-http.ts`.
- Boot: `src/lib/supabase.ts` placeholders + `persistSession: false` under host-first.
- Actor: `authenticatedUser` → `probeHostActor`.
- DENY helper: `host-product-deny.ts`.
