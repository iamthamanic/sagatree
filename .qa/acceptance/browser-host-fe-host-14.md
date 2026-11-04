# Acceptance — browser-host-FE-HOST-14 (#1119)

## Intent

Clear host-first Medium residual AI/Meshy/media DENYs: wire host successors
where product-required (recap save, peer profiles, AI credentials/Ollama) and
document remaining optional Edge AI as Info soft-degraded UX without Supabase.

## Happy Path

1. Authenticated GM `PUT /api/v1/sessions/:id/recap` with `{ summaryText, status }` → 200.
2. Authenticated user `POST /api/v1/user-profile/batch` with `{ userIds }` → 200 `{ profiles }`.
3. FE under host-first: `sessionRecapAiService.saveSummary` + `userProfileService.getProfilesByUserIds` use host HTTP.
4. `host-ai-invoke` uses `/api/v1/ai/*` when host library is enabled (no Edge required).

## Edge Cases

- Unauth → 401/403.
- Optional Meshy/lore/thumbnail/look-analysis → soft unavailable (no PostgREST hang).
- Legacy opt-out keeps Edge/RPC paths.

## Required Tests

- `scripts/fe-host-14-ai-residuals.self-test.mjs`
- Wired into `npm run test-gate`
- Residual allowlist Medium AI rows closed / Info only

## Security

- Cookie actor only; no client-claimed owners.
- Credential isolation via existing AI routes.
- All severities listed (Critical→Info).
