# Acceptance — RPC-WORLD-PLACES (#863)

## Intent
Port list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link to the modular host with successor security for cross-saga party projection.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
HTTP → MIG-311; FEATURE VERIFIED → MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] Editor- and Party-Projektionen getrennt; fehlender Saga-Kontext → leere Party-Listen.
- [x] Orte, Parent und Karte gehören derselben Welt; fremde IDs scheitern ohne verwaiste Verknüpfung.
- [x] UPSERT über place/map/usage aktualisiert genau eine Verknüpfung und liefert belegte JSON-Felder.
- [x] Same-world / cycle / primary-link uniqueness enforced in transaction (successor trigger parity).
- [x] RPC-SEC-CROSS-SAGA-REVEAL: saga B public id denied for saga A member (42501) on list places and list links.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `node --experimental-strip-types scripts/rpc-world-places.self-test.mjs` → PASS

## Evidence
`node --experimental-strip-types scripts/rpc-world-places.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-rpc-world-places.md`.
