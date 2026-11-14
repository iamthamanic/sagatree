# Composition Gate — aiberto-aib-01-rulebook-index

- HEAD_SHA: 4392ce0a54ad70676ee6e8a0a1823423ea45a8b8
- BASE_SHA: bd8959322b310cd7e049eecf1e11cd0fed868dc9
- Date: 2026-11-14
- Verdict: SKIPPED
- Acceptance tier: domain-index

## Skip reason

Single-hop domain indexer + pure search with no downstream UI/host consumer in this PR; AIB-02/AIB-04 will compose against the public `src/domains/rulebook` barrel.

## Event

AIB-01 Core rulebook indexer + pure shared search (#1124). Codex P1/P2 search/self-test fixes. No UI hop.

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
| Unknown query | no false binding hits | zzzz/one-char → [] | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
