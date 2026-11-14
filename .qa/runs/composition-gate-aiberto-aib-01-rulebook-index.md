# Composition Gate — aiberto-aib-01-rulebook-index

- HEAD_SHA: 9bf5a62816fa024ed3c9f3292b18d5fa920ab95a
- BASE_SHA: bd8959322b310cd7e049eecf1e11cd0fed868dc9
- Date: 2026-11-14
- Verdict: SKIPPED
- Acceptance tier: domain-index

## Skip reason

Single-hop domain indexer + pure search with no downstream UI/host consumer in this PR; AIB-02/AIB-04 will compose against the public `src/domains/rulebook` barrel.

## Event

AIB-01 Core rulebook indexer + pure shared search (#1124). No UI hop. Codex P1/P2 fixes on HEAD.

## Hop chain

1. **Producer:** `docs/sagatree core rules.md` → `scripts/build-rulebook-index.mjs` → `src/domains/rulebook/generated/sagatree-core.json`
2. **Gate:** `scripts/aiberto-aib-01-rulebook-index.self-test.mjs` (T-001/T-002/T-010) via `npm run test-gate`
3. **Consumer:** later AIB-02 (FE) / AIB-04 (host) via `src/domains/rulebook` public barrel only

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| Deterministic rebuild | same source → same revisionHash | two builds identical + matches committed | pass |
| Normativity | §§1–18 binding; 19 validation; 20 release | indexed tags | pass |
| EB pilot | Doc §5.3 ↔ `getSagaTreeAppliedExperienceBonus` | no second engine | pass |
| No false hits | unknown/1-char query → [] | binding boost gated on match | pass |
| No UI | domain-only | no `app/ai-assistant` | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
