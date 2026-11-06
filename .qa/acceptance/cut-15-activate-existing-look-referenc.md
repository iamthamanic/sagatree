# Acceptance — CUT-15 Activate existing look reference image analysis (#1150)

## Intent
Existing Look reference-image analysis produces the prior bounded LookDraft results via authorized Host and configured vision provider. Soft-DENY (`Look-Referenzanalyse ist im Host-Modus noch nicht verfügbar`) is removed when host library is on. Without provider: typed `not-configured` degraded result; no Supabase fallback.

## Preconditions
- Host Better Auth session (or solo loopback actor).
- Optional: `LOOK_AI_*` / `CHARACTER_AI_*` OpenAI-compatible vision provider configured.
- FE calls `analyzeLookReferences` from Look Adaption UX unchanged.

## Happy Path
1. Authenticated user submits 1–10 reference images (png/jpeg/webp, ≤12 MiB aggregate).
2. Host `POST /api/v1/ai/look-reference-analysis` resolves actor, rate-limits, validates images, calls vision provider.
3. Response `{ status: 'ok', payload, analyzedAtIso }` normalizes client-side to LookDraft (no auto-persist).

## Edge Cases
- 0 / >10 images, oversize Content-Length, invalid MIME → 400/413
- Provider absent → `not-configured` (200)
- Provider failure → bounded `error` 500
- Foreign `storagePath` → 400 (owner-scoped assert)
- Unauthenticated → 401/403
- Rate limit → 429
- Top-level secrets stripped from provider payload

## Security Coverage
- **B-auth:** Actor from Better Auth cookies; never trust client owner.
- **B-input:** MIME sniff, size caps, Content-Length envelope, rate limit.
- **B-secrets:** API keys server-only; `stripTopLevelSecrets` on payload.
- **SC-01/02/03/06:** N/A launch; inline auth + size + rate on new route.
- Out of scope: Aiberto, new providers, LookProfile HTTP mount (MIG-600), dual-path removal (CUT-20).

## UI/UX
Existing Look Adaption and image reference selection unchanged.

## Evidence
- `scripts/cut-15-look-reference.self-test.mjs` — mock vision: OK payload + secret strip; not-configured without model; 401; invalid MIME/zero refs/foreign path; per-actor rate 429.
- `scripts/mig-412-look-reference-analysis.self-test.mjs` — activation true + mount assertions.
- Matrix `look-reference.analyze` / `analyze-for-draft` → HOST_VERIFIED (counts 92 / 30).
- FE dual-path: `src/infrastructure/look/look-reference-analysis-service.ts`.

## Implementation Notes
- Mounted `createLookReferenceAnalysisHttpUseCases` at `POST /api/v1/ai/look-reference-analysis`.
- Vision provider: `LOOK_AI_*` with `CHARACTER_AI_*` fallback (Edge parity).
- Soft-DENY removed when `isHostLibraryEnabled()`; Edge retained until CUT-20.
- LookProfile HTTP mount remains deferred (MIG-600); no auto-persist of LookDraft.

## Composition Gate
CLEAR — see `.qa/runs/composition-gate-cut-15-activate-existing-look-referenc.md`.
