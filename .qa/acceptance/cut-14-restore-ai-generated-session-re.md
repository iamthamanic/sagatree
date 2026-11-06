# Acceptance — CUT-14 Restore AI-generated session recaps (#1149)

## Intent
Host-first AI session recap draft generation via activated `createSessionRecapGenerateUseCases` and `POST /api/v1/sessions/:sessionId/recap/generate`. Soft-DENY removed. Without provider: typed `not-configured` degraded result; no Supabase fallback when host library is on. Manual PUT save/approve remains unchanged.

## Evidence
- `scripts/cut-14-recap-generate.self-test.mjs` — mock OpenAI-compatible provider: OK draft/provider/model; not-configured without model; 401 unauth; non-GM deny; approved-lock 409; rate-limit 429; SQLite draft persist.
- `scripts/mig-421-session-recap.self-test.mjs` — isolated contract remains green with `SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED === true` and mount assertions.
- Matrix row `session-recap-ai.generate-draft` → `HOST_VERIFIED` (counts 90 / 32).
- FE: `src/infrastructure/session/session-recap-ai-service.ts` dual-path host HTTP.

## UI/UX
Unchanged Session Recap `generateDraft` affordance and manual save/approval. No Aiberto UI.

## Non-goals respected
No new providers, no AI-GM, no UI redesign, no Edge removal (CUT-20).

## Composition Gate
CLEAR — see `.qa/runs/composition-gate-cut-14-restore-ai-generated-session-re.md` (HEAD `067e781878677efef21f9ac460125f08d666c0bb`).
