# Composition Gate — aiberto-aib-06-tools-read

- HEAD_SHA: eb9adcf8df03d74f43bf879ebbd55f01295b15e5
- BASE_SHA: b541aae7256c468331a7bcc1fb220b450337ce88
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: host tools dispatcher + companion Tool-Activity consumer
- Deferred integration: model-native tool calling in aiberto-ask stream (Q-005); write tools (AIB-07); MCP (AIB-08)

## Event

AIB-06 Read/Nav tool registry (#1129): static registry, Host dispatcher over Owned-Ports / world.read / session projection, navigate ClientAction allowlist, Tool-Activity UI, flag-closed HTTP.

## Hop chain

1. **Producer:** Static `AIBERTO_TOOL_REGISTRY` + Host ports (character owned + linked solo, inventory, world, session, rulebook host-runtime)
2. **Gate:** `aiberto.tools` Policy + `AIBERTO_TOOLS_READ_ENABLED` + body-size bound + budget; FE `VITE_AIBERTO_TOOLS_READ_ENABLED`
3. **Consumer:** `aiberto-tools-service` → `AibertoToolActivityCard` / Chat tools surface; `app.navigate` ClientAction via `useAppLocation` (shell public barrel)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| TOOL_UNKNOWN | Reject before ports | Dispatcher returns TOOL_UNKNOWN | pass |
| INVALID_ARGS | Reject before ports | Schema/arg checks | pass |
| Cross-owner character | DENY (SCN-012) | Owned miss → FORBIDDEN | pass |
| Linked solo owners | Library parity | `actorIdsForGovernance` | pass |
| Navigate allowlist | Only safe routes | ClientAction or INVALID_ARGS | pass |
| Flag off | Fail-closed | disabled; Rulebook still usable | pass |
| Oversized body | 413 at HTTP | Streamed size bound | pass |
| Atlas / AIB-03 overlap | Avoid workbench / phase-a e2e | No Atlas workbench; no phase-a e2e edits | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
