# Composition Gate — aiberto-aib-05-chat-ui

- HEAD_SHA: cda583cc2eb5b4e391653f3bc463c42d2396aab3
- BASE_SHA: 5f8f9de01593d99e3280e171cf7ccb804b4c620e
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: companion FE consumer
- Deferred integration: AIB-03 Phase-A Playwright e2e (owned by #1126 / PR #1287); persistent chat history; tool cards

## Event

AIB-05 Chat UI on Aiberto Companion (#1128): capability-gated Chat tab, SSE stream client for host `aiberto-ask`, safe markdown, citation → Regelmodus, RAM-only messages.

## Hop chain

1. **Producer:** Host AIB-04 `POST /api/v1/ai/aiberto-ask/stream` (SSE tokens + final citations)
2. **Gate:** FE `isAibertoChatEnabled` (default off) + cookie `credentials: 'include'` + AbortController stop
3. **Consumer:** `AibertoChatPanel` inside `AibertoCompanion` tabs; citations call `onOpenSection` → controlled `RulebookBrowser` selection

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| Flag off | Phase-A surface only (Rulebook) | No Chat tab; companion forces `rules` | pass |
| Flag on | Chat tab + composer | Tabs + `AibertoChatPanel` | pass |
| Stream / Stop | Tokens append; abort mid-flight | `streamAibertoAsk` + AbortController | pass |
| Citation nav | Chip → Regelmodus section | `onOpenSection` sets section + tab `rules` | pass |
| XSS | No HTML injection from model text | React-only `renderSafeChatMarkdown` | pass |
| AI down | Rulebook still usable | Banner/status in chat; rules tab independent | pass |
| Reload | Chat cleared; dock prefs kept | Messages in React state only; prefs localStorage | pass |
| AIB-03 collision | Do not own Phase-A e2e / Playwright | No edits to `e2e/aiberto-phase-a.spec.ts` or `playwright.config.ts` | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
