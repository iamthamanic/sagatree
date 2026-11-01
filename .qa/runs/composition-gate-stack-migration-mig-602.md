# Composition Gate — stack-migration-mig-602 (#847 / MIG-602)

- HEAD_SHA: PENDING
- BASE_SHA: ca059d1682266c91d16fa66beb08051a4c78d783
- Date: 2026-11-01
- Verdict: CLEAR
- Note: Elevates Atlas / Postgres baseline / GATE-01/02/03 into ECC
  `requiredChecks` (`.qa/merge-gate.yaml`); fail-closed wiring proven by
  `scripts/mig-602-ci-quality-gates.self-test.mjs`. No production cutover.

## Event

CI quality-gate composition: PR → GitHub Actions jobs (isolated harnesses) →
ECC Merge Gate requiredChecks → merge decision. Distinct artifacts per job
(browser / DB / canary / GATE / Test Gate).

## Hop chain

1. Producer: PR push triggers verify + stack-migration-baseline + stack-migration-pocs
2. Bootstrap: ephemeral PG/GoTrue/PostgREST or GATE-01 SQLite candidates (no hosted secrets)
3. Transport/Auth: GATE-02/03 + atlas outsider DENY / player reveal
4. Browser: Atlas isolated product + verify Browser E2E
5. Consumer: ECC Merge Gate classifies requiredChecks by name; missing/red blocks merge

## Simulations

### N-actors
Owner/GM/player/outsider remain separate fixture identities inside atlas + canary jobs.

### Invalid/missing
Missing Chromium/tools/DB → nonzero exit; artifact upload `if-no-files-found: error`;
no `continue-on-error` on migration workflows.

### Two consumers / crash
Browser E2E vs Atlas isolated product remain separate check names/artifacts; ECC
lists both; Test Gate still runs Drizzle host persistence proofs.

## Flags

- Acceptance tier: feature-e2e
- Deferred: production cutover / Supabase shutdown → MIG-700+ human RELEASE APPROVED
