# Composition Gate — aiberto-aib-04-ask-host

- HEAD_SHA: a2204d61ee0f80114be32dacf6624638745caf10
- BASE_SHA: 4d19ef7c8fcc5b0e16d1c51628fc82cb49e01174
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: host-use-case

## Event

AIB-04 Host `aiberto-ask` + text inference + evidence/citations (#1127).
Codex P1/P2 addressed in `a2204d61e` (packaged host-runtime, Compose AIBERTO_*, provider precedence, TIMEOUT).

## Hop chain

1. **Producer:** `domains/rulebook` + packaged `server/src/modules/ai/internal/generated/host-runtime.mjs`
2. **Gate:** `application/aiberto-ask` (flag → auth/policy → quota → evidence → text-inference → citations)
3. **Consumer:** HTTP `POST /api/v1/ai/aiberto-ask` (+ `/stream`). No FE chat (AIB-05).

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| Docker image | runtime in server/src | packaged host-runtime.mjs | pass |
| Flag off | disabled | AIBERTO_CHAT_ENABLED default empty | pass |
| No evidence | unanswered | empty search | pass |
| Fake citation | drop | validateCitations | pass |
| AIBERTO_AI_* | wins over CHARACTER_* | resolve order | pass |
| Timeout | TIMEOUT | mapFetchError | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
