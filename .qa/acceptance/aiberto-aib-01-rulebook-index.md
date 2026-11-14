# Acceptance — aiberto-aib-01-rulebook-index

Issue: #1124 (AIB-01)

## Design

- `.qa/design/aiberto-companion.md`
- Epic acceptance: `.qa/acceptance/aiberto-companion.md`

## Scope proof

- [x] Deterministic Core index from `docs/sagatree core rules.md`
- [x] Manifest: `rulesetId`, `schemaVersion`, `revisionHash`, source refs
- [x] Normativity: §§1–18 `binding-playtest`; §19 `validation`; §20 `release-criteria`; front matter `informational`
- [x] Pure `searchRulebook` (no React/HTTP/LLM)
- [x] T-001 deterministic hash; T-002 search gold; T-010 EB Doc↔Domain pilot
- [x] Wired into `npm run test-gate` via `scripts/aib-01-rulebook-index.self-test.mjs`
- [x] No UI / chat / tool registry in this slice

## Composition Gate

Slug: `aiberto-aib-01-rulebook-index`
