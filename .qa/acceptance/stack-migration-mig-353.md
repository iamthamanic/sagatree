# Acceptance — MIG-353 remaining RPC cluster (#816)

## Intent
Coordinate the 6 NPC-instance + marketplace-count RPC child tickets; no additional host implementation in this issue.

## Acceptance tier
`isolated-contract` — SLICE DONE when all children have hashed completionEvidence.

## Required Tests
- [x] Child RPC-NPC-INSTANCES has PASS completionEvidence.
- [x] Child RPC-MARKETPLACE-COUNT has PASS completionEvidence.
- [x] All 6 RPCs are assigned exactly once to RPC-NPC-INSTANCES or RPC-MARKETPLACE-COUNT (split-groups inventory).
- [x] Coordinator does not invent a second source of truth for those RPCs.
- [x] Coordinator stays open until children PASS; file existence alone is not acceptance.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Evidence
Child completion JSON under `.qa/evidence/stack-migration-prep/completion/rpc-npc-instances.json` and `rpc-marketplace-count.json`.

## Composition Gate
SKIPPED — coordinator evidence only; hops landed in child tickets.
