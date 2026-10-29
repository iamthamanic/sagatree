# Composition Gate — stack-migration-mig-301 (#800)

- HEAD_SHA: 5b31aa702b4164f59845ddad0706e35018519b5c
- BASE_SHA: b0afac23cd648cbcce8dd1c69fe8995edb050250
- HOP_DIGEST: infra-ai-host-http-v1
- Date: 2026-10-29
- Verdict: CLEAR

## Event

Infrastructure/ai callers gain dual-path host HTTP adapters for BYOK credentials and Ollama Organize prefs. Edge allowlist retained; no production cutover.

## Hop chain

1. Producer: Client Settings/Organize facades (`src/infrastructure/ai`)
2. Authorize: Host cookie/remote session (or solo actor in solo mode); missing session → 401
3. Persist: AI module credential store (SQLite) via MIG-402 ports
4. Consumer: Typed public credential/settings views; secrets never returned

## Simulations

### N-actors
Owner vs stranger credential/settings isolation via actor-scoped store.

### Invalid/missing
Unauthenticated remote requests fail closed before mutation/list.

### Two consumers / crash
Edge dispatcher allowlist unchanged; host routes optional via wired ports.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: MIG-600/#845 + MIG-602/#847
