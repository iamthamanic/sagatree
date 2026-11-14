# Composition Gate — aiberto-aib-01-rulebook-index

- HEAD_SHA: 46aa061454b010af12ea06cf954d63a8f5e893f8
- Date: 2026-11-14
- Verdict: SKIPPED
- Acceptance tier: domain-index
- Reason: single-hop application diff without downstream side-effect path (indexer + pure search only; no UI/host consumer yet)

## Event

AIB-01 Core rulebook indexer + pure shared search (#1124). No UI hop.

## Hop chain

1. **Producer:** `docs/sagatree core rules.md` → `scripts/build-rulebook-index.mjs` → `src/domains/rulebook/generated/sagatree-core.json`
2. **Gate:** `scripts/aiberto-aib-01-rulebook-index.self-test.mjs` (T-001/T-002/T-010) via `npm run test-gate`
3. **Consumer:** later AIB-02 (FE) / AIB-04 (host) via `src/domains/rulebook` public barrel only

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| Deterministic rebuild | same source → same revisionHash | two builds identical | pass |
| Normativity | §§1–18 binding; 19 validation; 20 release | indexed tags | pass |
| EB pilot | Doc §5.3 ↔ `getSagaTreeAppliedExperienceBonus` | no second engine | pass |
| No UI | domain-only | no `app/ai-assistant` | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
