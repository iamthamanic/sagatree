# Acceptance — MIG-413 lorekeeper quarantine (#829)

## Intent
Capture legacy-unmounted `lorekeeper` Map-graph worker; keep external 404 until separate activation.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
authorized host routes + MIG-600; `LOREKEEPER_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Required Tests
- [x] Graph, context, NPC and consistency routes remain dispatcher/host 404.
- [x] Isolated graph traversal and missing-root results match source; createRelationship enforces both endpoints.
- [x] Session-context all-node scan and ignored NPC session filter recorded; no public role-safe projection yet.
- [x] Legacy regression: getSessionContext returns every NPC/location/event; only memories filter sessionId; getNPCContext ignores sessionId; no auth/GM filter.
- [x] Touched files: zero type escape hatches.

## Evidence
`scripts/mig-413-lorekeeper-quarantine.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-413.md`.
