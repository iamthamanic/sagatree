# Composition Gate — cut-18-activate-existing-meshy-avatar (#1153)

- HEAD_SHA: 1cf88c7a5991c584cd25012a58ed321fef46de6c
- BASE_SHA: b42f1de0a282bcdea8e39569e61a20e85f588141
- Date: 2026-11-06
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none (CUT-18 activates existing character-avatar-meshy host use-cases)

## Event

Under host-first, AvatarMeshyPanel calls invoke POST `/api/v1/ai/character-avatar-meshy`
(action body). Actor from Better Auth; jobs owner-scoped; mock Meshy advances
create→poll→AssetPorts durable GLB. Soft-DENY removed. Without Meshy: start `not-configured`.

## Hop chain

1. **Producer (UI):** AvatarMeshyPanel
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed POST `/api/v1/ai/character-avatar-meshy`
4. **Authorize:** Better Auth actor; job ownership; storage path owner prefix
5. **Store:** CharacterAvatarMeshyStore + AssetPorts durable GLB (+ Meshy mock/env/BYOK)
6. **Consumer:** same UI — job poll / `/api/v1/assets/...` modelUrl

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot poll/sign foreign job | 403/404 before read | pass |
| Invalid/missing | No Meshy / short prompt | `not-configured` / 400 | pass |
| Dual-path | Flag off → Edge character-avatar-meshy | Exclusive | pass |
| Quota | RATE_LIMIT 2/min | 429 | pass (isolated) |
| Two consumers / crash | Concurrent polls claim remesh once; durable bytes via AssetPorts | Same process Map + asset store | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Single-hop host HTTP over existing use-cases; Soft-DENY removed; mock-gated provider;
AssetPorts durable artifact; Edge retained until CUT-20. No new composition surface.
