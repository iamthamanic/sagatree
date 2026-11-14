# Composition Gate — aiberto-aib-03-phase-a-qa

- HEAD_SHA: 99dd664f27ad7e266052f22543d0c0175b4c1142
- BASE_SHA: 71e9c2986d8926e4b959bc09bb188ff6ad5b8c01
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: qa-e2e
- Deferred integration: Release-A closed after AIB-03; AIB-05 chat already on main (sibling)

## Event

AIB-03 Phase-A quality gate (#1126): Playwright companion journeys, 320px, CE non-interference, NFR-001 search latency; no product chat/Atlas.

## Hop chain

1. **Producer:** AIB-01 `domains/rulebook` + AIB-02 `app/ai-assistant` companion mounted in Layout
2. **Gate:** `e2e/aiberto-phase-a.spec.ts` + `scripts/aiberto-aib-03-phase-a-qa.self-test.mjs` (NFR-001)
3. **Consumer:** QA evidence for Release-A exit; epic `.qa/acceptance/aiberto-companion.md` updated

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | open/search/close does not remount editor route | shell toggle + main chrome | pass |
| Invalid/missing | empty search / closed companion | empty hits; dock unmounted | pass |
| Two consumers / crash | dock vs sheet by band | AdaptiveSheet vs dock | pass |
| Live CE | Bibliothek/Home reachable while open | e2e asserts shell buttons | pass |
| NFR-001 | offline search budget | self-test p95 < 25ms | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
