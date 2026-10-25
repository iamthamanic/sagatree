# Composition Gate — stack-migration-mig-413 (#829)

- HEAD_SHA: d5a3688efca9bd348cd9f0cdcf7e22eb1af1d76c
- BASE_SHA: 284bface
- Date: 2026-10-25
- Verdict: CLEAR

## Event

Legacy lorekeeper Map-graph characterized in world quarantine; host/dispatcher keep 404; no public mount; session-context all-node + ignored NPC sessionId preserved as required regressions.

## Hop chain

1. Producer: lorekeeper-quarantine fixtures (createLoreGraphStore / getWorldGraph / createRelationship / getSessionContext / getNPCContext)
2. Authorize: none (legacy unmounted; LOREKEEPER_PUBLIC_ACTIVATION_AUTHORIZED=false)
3. Persist: none (in-memory Maps only; no Neo4j/SQLite/Supabase)
4. Consumer: self-test / future MIG-600 HTTP after activation

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | No shared public route | allowlist deny + host 404 | pass |
| Invalid/missing | Missing root / missing edge endpoint | null graph / throw | pass |
| Two consumers / crash | No durable write; orphan excluded from BFS | Maps only | pass |
| Legacy defects | Session all-node scan; NPC ignores sessionId | fixtures | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host routes + MIG-600; LOREKEEPER_PUBLIC_ACTIVATION_AUTHORIZED=false

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
