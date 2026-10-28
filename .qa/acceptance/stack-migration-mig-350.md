# Acceptance — MIG-350 world/atlas RPC cluster (#813)

## Intent
Coordinate the 6 world/atlas RPC child tickets; no additional host implementation in this issue.

## Acceptance tier
`isolated-contract` — SLICE DONE when all children have hashed completionEvidence.

## Required Tests
- [x] Child RPC-WORLD-MAP has PASS completionEvidence.
- [x] Child RPC-ATLAS-MAPS has PASS completionEvidence.
- [x] Child RPC-WORLD-PLACES has PASS completionEvidence.
- [x] Child RPC-WORLD-CREATE has PASS completionEvidence.
- [x] Child RPC-WORLD-RESTRUCTURE has PASS completionEvidence.
- [x] Child RPC-WORLD-DESTRUCTIVE has PASS completionEvidence.
- [x] All 17 RPCs are exclusively assigned via `.qa/intake/rpc-contracts/split-groups.json` (no duplicate / omission).
- [x] Coordinator does not invent a second source of truth for those RPCs.
- [x] Cutover / Supabase shutdown remain blocked (RELEASE APPROVED not claimed).

## Evidence
Child completion JSON under `.qa/evidence/stack-migration-prep/completion/rpc-world-*.json` and `rpc-atlas-maps.json`.
Coordinator completion: `.qa/evidence/stack-migration-prep/completion/mig-350.json`.

## Composition Gate
CLEAR (metadata/queue hops only) — see `.qa/runs/composition-gate-stack-migration-mig-350-done.md`.
