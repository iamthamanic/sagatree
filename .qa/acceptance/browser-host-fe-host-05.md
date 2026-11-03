# Acceptance — browser-host-FE-HOST-05 (#1097)

## SLICE DONE

Product inventory catalog create + NPC definition create/update/archive HTTP and FE dual-path under `VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL.

## Checks

- [x] Covered happy-path ops succeed against host SQLite without Supabase (`scripts/fe-host-05-inventory-npc-http.self-test.mjs`).
- [x] Unauthorized / forged identity is DENY.
- [x] Empty/missing resource produces stable empty/not-found UX.
- [x] Touched files: zero type escape hatches.
- [x] `npm run test-gate` includes FE-HOST-05 self-test.

## Deferred

- Full Supabase removal → FE-HOST-09
- Item definition update/archive/fork host HTTP (create + list only in this slice)
- NPC restore/duplicate host HTTP
- Character inventory_v2 column writes remain prior cutover surfaces

## Security Coverage

- Actor from cookie session / solo AUTH_NOT_CONFIGURED loopback only.
- inventory / npcCreature ports deny foreign owner mutations; no client-supplied owner elevation.

## Implementation Notes

- Host routes: `server/src/api/library-routes.ts` (`/api/v1/library/items`, `/api/v1/library/npc-creatures*`).
- FE client: `src/infrastructure/host/host-library-http.ts`.
- Dual-path: `item-catalog-service` create Personal/World; `npc-creature-service` create/update/archive.
