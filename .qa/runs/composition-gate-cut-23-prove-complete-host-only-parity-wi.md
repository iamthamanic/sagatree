# Composition Gate — cut-23-prove-complete-host-only-parity-wi (#1158)

- HEAD_SHA: d244cc3a992200adf43b08dc2863a675958215c4
- BASE_SHA: 8f48a1532371374a237c31f600a7768123eeed77
- Date: 2026-11-08
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: packaged desktop store binaries / NOT-RUN OS platforms remain
  DESKTOP-PRODUCT-STORE ops (GATE-05 APPROVED unlocks MIG-703 PoC only)

## Event

Final cutover closer: every CUT-01 matrix row is HOST_VERIFIED or LEGACY_UNUSED,
inventory check passes, Soft-DENY product fingerprints are gone, and operators run the
Node host via the CUT-22 Compose default without Supabase product services.

## Hop chain

1. **Producer (matrix):** `.qa/evidence/cutover-parity/feature-matrix.json`
2. **Gate:** `cutover-parity-inventory-check` + `cut-23-final-parity.self-test`
3. **Transport:** host HTTP membership leave + existing HOST_VERIFIED successors
4. **Authorize:** Better Auth actor + policy ports (unchanged)
5. **Persist:** SQLite project_members leave (DELETE active row)
6. **Consumer:** FE `projectMemberService.leave` → host `/leave`

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Player leave own membership | DELETE active row; GM ownership intact | pass |
| Invalid/missing | Stranger / no membership | P0002 / 403 path | pass |
| Two consumers / crash | Matrix + Soft-DENY scan + Compose | cut-23 self-test | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
