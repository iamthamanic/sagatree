# Acceptance — aiberto-aib-03-phase-a-qa

Issue: #1126 (AIB-03)

## Design

- `.qa/design/aiberto-companion.md`
- Epic acceptance: `.qa/acceptance/aiberto-companion.md`

## Scope proof

- [x] Playwright Phase-A journeys: open → search → section → close (`e2e/aiberto-phase-a.spec.ts`)
- [x] 320px narrow viewport: companion usable; no horizontal overflow
- [x] Shell chrome (Bibliothek/Home) remains reachable while companion open (CE non-interference)
- [x] ORC notice + version/hash visible in open companion
- [x] NFR-001 offline `searchRulebook` latency budget documented + gated in self-test (<25ms p95 Node)
- [x] Composition gate CLEAR/SKIPPED for slug; wired into `npm run test-gate`
- [x] Epic Release-A + AU/CE Phase-A checkboxes updated

## Adaptive UI / CE

- [x] AU device bands: e2e on chromium + mobile/tablet projects (testMatch)
- [x] AU-CONTENT-WIDTH / 320px journey
- [x] CE: companion does not block primary shell navigation controls

## Composition Gate

Slug: `aiberto-aib-03-phase-a-qa`
