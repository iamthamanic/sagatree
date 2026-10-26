# Acceptance — MIG-351 session/runtime RPC cluster (#814)

## Intent
Coordinate the 4 session RPC child tickets; no additional host implementation in this issue.

## Acceptance tier
`isolated-contract` — SLICE DONE when all children have hashed completionEvidence.

## Required Tests
- [x] Child RPC-SESSION-RUNTIME has PASS completionEvidence.
- [x] Child RPC-SESSION-LIFECYCLE has PASS completionEvidence.
- [x] Child RPC-SESSION-ACCESS has PASS completionEvidence.
- [x] Child RPC-SESSION-RECAP has PASS completionEvidence.
- [x] Coordinator does not invent a second source of truth for those RPCs.

## Evidence
Child completion JSON under `.qa/evidence/stack-migration-prep/completion/rpc-session-*.json`.

## Composition Gate
SKIPPED — coordinator evidence only; hops landed in child tickets.
