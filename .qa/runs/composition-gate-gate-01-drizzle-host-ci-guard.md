# Composition Gate — gate-01-drizzle-host-ci-guard (#1044)

- HEAD_SHA: bf33963290012d229c241a0b9a55b361e7717922
- BASE_SHA: 881d61ca5d3ede00993aea8977883363a79f4728
- Date: 2026-10-30
- Verdict: CLEAR
- Scope: committed HEAD (host Drizzle/DB import CI guard)

## Event

CI architecture-boundary check loads the machine-readable exception policy, proves `drizzle-orm` + `HostDatabase` wiring, and rejects forbidden `node:sqlite` / `drizzle-orm` imports in application/api/http/bootstrap and frontend domains/app/infrastructure.

## Hop chain

1. Producer: PR changes server/src or src domain/app imports
2. Authorize: N/A (static import graph gate)
3. Persist: N/A
4. Project: `checkHostDrizzlePersistenceBoundaries` violations list
5. Consumer: `npm run test-gate` / required CI fails closed on violation

## Simulations

### N-actors
Any PR author inserting `drizzle-orm` into `server/src/application/**` or `src/domains/**` → boundary FAIL.

### Invalid/missing
Missing exceptions JSON, missing drizzle-orm dependency, or missing host-drizzle proof tokens → FAIL (not SKIP).

### Two consumers / crash
Guard is pure FS/AST; no DB mutation. Self-test fixtures isolate temp trees without touching product data.

## Flags

- Acceptance tier: host-architecture / CI-guard
- Deferred integration: fold guard requirement into MIG-602/#847 and MIG-700/#849 via Source-of-Truth generator when those tickets open; no hand-edit of generated migration contracts in this PR
- Browser E2E: SKIPPED (scripts/CI only; no UI)
