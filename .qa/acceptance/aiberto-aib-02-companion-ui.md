# Acceptance — aiberto-aib-02-companion-ui

Issue: #1125 (AIB-02)

## Design

- `.qa/design/aiberto-companion.md`
- Epic acceptance: `.qa/acceptance/aiberto-companion.md`

## Scope proof

- [x] Single shell mount via `Layout` → `AibertoCompanion` (public `app/ai-assistant` barrel)
- [x] Desktop/tablet right dock 320–520px with drag resize + localStorage prefs (no chat text)
- [x] Phone: `AdaptiveSheet` bottom sheet; toggle in mobile header (not 5th bottom-nav item)
- [x] Offline TOC / search / section reader via `domains/rulebook` only (no Host/LLM/chat)
- [x] Section shows stable id, ruleset/schema/revision hash, normativity; ORC notice visible
- [x] Feature flag `VITE_AIBERTO_COMPANION_ENABLED` (default ON)
- [x] SagaTree tokens + Phosphor; DE copy; no Lucide; no Atlas workbench/editor edits
- [x] Self-test wired into `npm run test-gate` (`scripts/aiberto-aib-02-companion-ui.self-test.mjs`)

## Adaptive UI (AU)

- [x] AU device bands: dock vs sheet by `useAdaptiveBand`
- [x] AU-CONTENT-WIDTH: main stays `@container/main min-w-0 flex-1`; dock `shrink-0`
- [x] Primary toggles ≥44px; visible Cyan focus; sheet/dock dismissible

## Composition Gate

Slug: `aiberto-aib-02-companion-ui`
