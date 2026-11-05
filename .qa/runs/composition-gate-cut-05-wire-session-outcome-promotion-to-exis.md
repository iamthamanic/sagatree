# Composition Gate — cut-05-wire-session-outcome-promotion-to-exis (#1140)

- HEAD_SHA: 8f9376cf3cb2f68c36c178fbafb5d353c16d5537
- BASE_SHA: d922aba4df5cdb1b67538a3c004160272e742aa9
- Date: 2026-11-05
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: CUT-06 item-catalog mutations (#1141)

## Event

Under host-first, session outcome promotion uses Host HTTP
`POST /api/v1/sessions/:sessionId/outcomes/:consequenceId/promote/{saga|world}`
backed by `SagaInfraPorts.promoteSessionOutcomeToSaga|World`.
Idempotent ledger rows prevent double lore facts. Legacy Supabase RPC remains
only when host library is off.

## Hop chain

1. **Producer (UI):** SessionRecapPromoteActions → `sessionOutcomePromotionService`
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed POST via host-session-http promote helpers
4. **Authorize:** Session actor; GM + saga-author / world-edit checks inside saga module
5. **Persist:** SQLite saga draft / world promoted lore + `session_outcome_promotions`
6. **Consumer:** Same UI reads promote result; overview/lore reflect facts after reload

Cardinality: one ledger row per (project, consequence, targetKind). No cross-owner fan-out.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Player/stranger cannot promote | Port GM/author checks | pass |
| Invalid/missing | Missing consequence → 404; bad input → 422 | Fail-closed statuses | pass |
| Two consumers / crash | Dual-path exclusive | Flag off → Supabase; on → host | pass |
| Idempotent | Second promote returns idempotent; no double fact | Ledger + draft revision | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

SagaPorts already owned promote writes; CUT-05 mounts product HTTP + FE dual-path so host-first UI no longer soft-DENYs outcome promotion.
