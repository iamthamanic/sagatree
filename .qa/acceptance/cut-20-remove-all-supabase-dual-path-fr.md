# Acceptance — CUT-20 Remove all Supabase dual-path frontend branches (#1155)

## Intent
Product FE uses only Host adapters, Better Auth, and HostRealtime. No
`VITE_SAGATREE_HOST_LIBRARY=0` opt-out, no dual `isHostLibraryEnabled` Supabase
branches, no productive `supabase.from` / `rpc` / `functions.invoke` / `storage`
or GoTrue product auth in `src/**`.

## Preconditions
- Host auth URL configured (`VITE_SAGATREE_HOST_AUTH_URL`).
- Prior CUT-02..19 host ports remain green.

## Happy Path
1. Vite boots without `VITE_SUPABASE_*`.
2. Login / Library / Atlas / Session use Host HTTP + Better Auth cookies.
3. CUT-02..19 self-tests still pass.
4. `scripts/cut-20-legacy-client-ban.self-test.mjs` bans legacy client patterns in product src.

## Edge Cases
- Missing host auth URL → fail closed (no silent GoTrue)
- PARITY_MISSING follow-ups (#1159–#1162) stay host Soft-DENY / unavailable — never Edge
- Legacy tests that imported deleted clients updated or removed

## Security Coverage
- Actor authority stays server-side; no Admin JWT / secret-in-frontend.
- SC-01/02/03/06 inline; not a launch ticket.

## UI/UX
AuthGate / LoginScreen / Library unchanged; only dead auth recovery/fallback states removed.

## Evidence
- `scripts/cut-20-legacy-client-ban.self-test.mjs`
- Prior cut self-tests + fe-host-09 host-first
- Matrix auth.* dual-path rows → HOST_VERIFIED notes updated

## Composition Gate
CLEAR — see `.qa/runs/composition-gate-cut-20-remove-all-supabase-dual-path-fr.md` (WORKTREE; stamp HEAD after commit).

## Implementation Notes
- Single host facade per owning module; remove `@supabase/supabase-js` product imports.
- Optional provider flags only for provider capability, not routing toggles.
