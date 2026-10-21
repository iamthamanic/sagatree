# Composition Gate — stack-migration-mig-010 (#789 hardening)

- HEAD_SHA: f473c8e6fe40c2e199a24817027cbf7cecb51219
- BASE_SHA: 741bfd8768062232c362926059bff3c22af3b1e7
- Date: 2026-10-21
- Verdict: CLEAR

## Event

Hardening of the solo Node host HTTP and bootstrap error boundaries: invalid request-targets and unexpected handler failures return controlled JSON statuses; corrupt host-identity fails start without readiness or secret leakage; data-dir deny uses a regular-file path (chmod-independent).

## Hop chain

1. Producer: raw HTTP client / bootstrap `main.ts`
2. `http/route-registry.ts` parses URL + catches handler errors → 400/500
3. `bootstrap/create-host.ts` identity load fail-closed → no ready
4. Consumer: `/health` remains available after controlled HTTP errors

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | One host process; malformed request does not fan out or crash listeners | Single connection 400; subsequent health 200 | pass |
| Invalid/missing | Corrupt identity / file-as-data-dir → exit 1, ready false, redacted | createHost/main never echo file body or secret markers | pass |
| Two consumers / crash | Handler throw during health → 500; host continues serving | Promise does not reject; next health succeeds | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

No GATE-02..05 / cutover. No ORM schema.
