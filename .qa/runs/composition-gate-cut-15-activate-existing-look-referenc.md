# Composition Gate — cut-15-activate-existing-look-referenc (#1150)

- HEAD_SHA: e3d3b3641fb496d3078489c4e4036cf798ba0854
- BASE_SHA: 2ebbf51640f83ecc98e7de271e7ef60600e61817
- Date: 2026-11-06
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none (CUT-15 activates existing look-reference-analysis host use-case)

## Event

Under host-first, Look Adaption calls `analyzeLookReferences` which POSTs to
`/api/v1/ai/look-reference-analysis`. Actor is resolved from Better Auth; use-case
enforces rate/size/MIME/owner-scoped storagePath, strips top-level secrets, invokes
vision provider (`LOOK_AI_*` → `CHARACTER_AI_*`). Soft-DENY removed. Owner-scoped `dataDir/media` loader for storagePath. Without provider:
`not-configured`. No LookProfile persist (draft normalize client-side only).

## Hop chain

1. **Producer (UI):** LookReferenceAdaptionFlow / analyzeLookReferencesForDraft
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed POST `/api/v1/ai/look-reference-analysis`
4. **Authorize:** Better Auth actor (+ solo loopback)
5. **Validate:** 1–10 images, MIME sniff, 12MiB envelope, owner storagePath
6. **Infer:** `analyzeLookReferencesWithVision`
7. **Consumer:** same UI — normalizeLookReferenceAnalysisPayload → draft (manual save)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Unauthenticated denied | 401/403 before provider | pass |
| Invalid/missing | No model configured | `not-configured` 200 | pass |
| Foreign path | Other-user storagePath | 400 before provider | pass |
| Dual-path | Flag off → Edge look-reference-analysis | Exclusive | pass |
| Quota | LOOK_AI / CHARACTER rate | process-memory 429 | pass |
| Two consumers / crash | Concurrent analyze shares in-memory rate Map | Same rate-limit store | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Service + HTTP + provider hops changed; covered by cut-15-look-reference.self-test with
injected deterministic vision adapter. Tip docs/qa pins are proofOnly after feature HEAD.

## Tip
Subsequent tip commits after feature HEAD are proofOnly (docs/qa pin + MIG retarget).
