# Composition Gate — aiberto-aib-02-companion-ui

- HEAD_SHA: 0000000000000000000000000000000000000000
- BASE_SHA: 4d19ef7c8fcc5b0e16d1c51628fc82cb49e01174
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: shell-ui
- Deferred integration: AIB-04 host ask / chat (sibling); AIB-03 if any

## Event

AIB-02 shell companion panel + offline Rulebook browser (#1125). Desktop dock + phone sheet; no chat/LLM/host; Layout mount only (Atlas #1283 does not touch Layout).

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

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
