# Composition Gate — aiberto-aib-02-companion-ui

- HEAD_SHA: 82f7885c2b00ad1646ac581bb981a746644e2999
- BASE_SHA: 0c263408d141bd9b0f955ee6ad1845ed0d80e6f0
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: shell-ui
- Deferred integration: AIB-05 chat UI streaming (consumes AIB-04 host); no chat in this PR

## Event

AIB-02 shell companion panel + offline Rulebook browser (#1125). Desktop dock + phone sheet; no chat/LLM client; Layout mount only. Merged main after sibling AIB-04 (#1286) for test-gate coexistence.

## Hop chain

1. **Producer:** `src/domains/rulebook` public barrel (AIB-01 index + `searchRulebook`)
2. **Gate:** `RulebookBrowser` → `AibertoCompanion` (`src/app/ai-assistant`) + prefs/flag; self-test `scripts/aiberto-aib-02-companion-ui.self-test.mjs`
3. **Consumer:** `src/app/shell/Layout.tsx` mounts companion once beside `@container/main` (sidebar + mobile-header toggles; not bottom-nav)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | one shell mount; main children unchanged | Layout main + companion | pass |
| Invalid/missing | flag off / empty search | no chrome; empty hits copy | pass |
| Two consumers / crash | dock + sheet never both product paths | band switches surface | pass |
| Offline search | no Host/LLM | domains/rulebook only | pass |
| ORC / version | notice + hash visible | data-aiberto-orc-notice / version | pass |
| Atlas isolation | no workbench/editor edits | Layout-only shell touch | pass |
| Coexist AIB-04 | host ask + FE companion | test-gate runs both self-tests | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
