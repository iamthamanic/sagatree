# Composition Gate — aiberto-aib-06-tools-read

Issue: #1129 (AIB-06)
Slug: `aiberto-aib-06-tools-read`
Date: 2026-11-14

## HEAD

- Branch: `issue-1129-aib-06-tools-read`
- Implementation SHA: `7d74b1c8f43069f9db5dfd8e796c7af41d154a0a`
- Base: `main` @ `71e9c2986d8926e4b959bc09bb188ff6ad5b8c01` (AIB-05)

## Producer → consumer

| Hop | Producer | Consumer | Contract |
| --- | --- | --- | --- |
| 1 | Static `AIBERTO_TOOL_REGISTRY` | `createAibertoToolsUseCases.invoke` | `TOOL_UNKNOWN` / `INVALID_ARGS` before ports |
| 2 | Host ports (character owned + linked solo, inventory, world.read, session snapshot, rulebook host-runtime) | Tool handlers | DTO filter; no invented `character.read` |
| 3 | `aiberto.tools` + `world.read` PolicyService | HTTP `/api/v1/ai/aiberto-tools/*` | Auth session actor; flag fail-closed; body size bound |
| 4 | Invoke result (+ optional ClientAction) | FE `aiberto-tools-service` + Tool-Activity cards | capabilities ≠ rights; navigate allowlist only; `import.meta.env` default |

## N-actors / invalid-fallback / concurrent

- Cross-owner character.get → FORBIDDEN (Owned miss) — SCN-012
- Linked solo owner IDs included via `actorIdsForGovernance` (Library parity)
- Flag off → disabled (Rulebook still available via AIB-02)
- Budget exceed → 429 without further port side effects
- Forged `role` / `ownerUserId` stripped from args
- Oversized invoke body → 413 at HTTP boundary

## Verdict

**CLEAR** for AIB-06 Read/Nav registry scope.

## Notes

- No Atlas workbench edits; test-gate append only after AIB-05 cluster
- Sibling open PRs: Atlas #1283, AIB-03 #1287 — fingerprint overlap on mig-002/inventory unavoidable for infra-ai regen
