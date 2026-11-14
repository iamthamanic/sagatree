# Composition Gate — aiberto-aib-06-tools-read

Issue: #1129 (AIB-06)
Slug: `aiberto-aib-06-tools-read`
Date: 2026-11-14

## HEAD

- Branch: `issue-1129-aib-06-tools-read`
- Implementation SHA: `4d7ead9699159d5b422ee0333c76e1f59a844347`
- Base: `main` @ `71e9c2986d8926e4b959bc09bb188ff6ad5b8c01` (AIB-05)

## Producer → consumer

| Hop | Producer | Consumer | Contract |
| --- | --- | --- | --- |
| 1 | Static `AIBERTO_TOOL_REGISTRY` | `createAibertoToolsUseCases.invoke` | `TOOL_UNKNOWN` / `INVALID_ARGS` before ports |
| 2 | Host ports (character owned, inventory, world.read, session snapshot, rulebook host-runtime) | Tool handlers | DTO filter; no invented `character.read` |
| 3 | `aiberto.tools` + `world.read` PolicyService | HTTP `/api/v1/ai/aiberto-tools/*` | Auth session actor; flag fail-closed |
| 4 | Invoke result (+ optional ClientAction) | FE `aiberto-tools-service` + Tool-Activity cards | capabilities ≠ rights; navigate allowlist only |

## N-actors / invalid-fallback / concurrent

- Cross-owner character.get → FORBIDDEN (Owned miss) — SCN-012
- Flag off → disabled (Rulebook still available via AIB-02)
- Budget exceed → 429 without port side effects after first call
- Forged `role` / `ownerUserId` stripped from args

## Verdict

**CLEAR** for AIB-06 Read/Nav registry scope.

## Notes

- No Atlas workbench edits; test-gate append only after AIB-05 cluster
- Sibling open PRs: Atlas #1283, AIB-03 #1287 — file-overlap minimized
