# Composition Gate — aiberto-aib-04-ask-host

- HEAD_SHA: 71d2eb058c0e8837049c4b8869d0b2a649cf19b1
- BASE_SHA: 4d19ef7c8fcc5b0e16d1c51628fc82cb49e01174
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: host-use-case

## Event

AIB-04 Host `aiberto-ask` + text inference port + evidence/citation validation (#1127).

## Hop chain

1. **Producer:** `src/domains/rulebook` (search + citations) via `generated/host-runtime.mjs`
2. **Gate:** `application/aiberto-ask` — flag → auth → policy `aiberto.ask` → quota → evidence → text inference → citation validate
3. **Consumer:** HTTP `POST /api/v1/ai/aiberto-ask` (+ `/stream` SSE) for AIB-05 UI later

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| Text port | media modalities unchanged | `AiModality` still image\|3d\|video\|audio; `inferText` separate | pass |
| No evidence | unanswered, no LLM | empty/unknown query → unanswered | pass |
| Fake citation | drop / unanswered | validateCitations drops stc-fake | pass |
| Flag off | disabled | `AIBERTO_CHAT_ENABLED` default off | pass |
| Auth deny | 401/403 | missing actor / policy deny | pass |
| Quota | 429 + secret scrub | rate-limit + stripTextInferenceSecrets | pass |
| No UI | host-only | no Layout/App/ai-assistant chat | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
