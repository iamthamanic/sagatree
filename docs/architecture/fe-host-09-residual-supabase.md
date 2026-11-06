# FE-HOST-09 — Residual Supabase product surfaces

Owner note (cutover milestone): with `VITE_SAGATREE_HOST_AUTH_URL` set and
`VITE_SAGATREE_HOST_LIBRARY` not explicitly off, the browser product runtime is
**host-first**. Covered journeys use host HTTP + Better Auth cookies. The
Supabase JS client stays inert (no GoTrue session) unless the operator opts out.

## Residual allowlist (DENY / degraded under host-first)

These FE facades still contain `supabase.from` / `rpc` / `storage` /
`functions.invoke` for the **legacy** dual-path (`VITE_SAGATREE_HOST_LIBRARY=0`
or missing auth URL). Under host-first they use host HTTP, soft-degraded
German UX, or throw unavailable — never hang on PostgREST/Edge.

| Surface | Module | Severity | Notes |
| --- | --- | --- | --- |
| Saga definition RPC editor | `saga-definition-service.ts` | Medium | DONE (FE-HOST-13) — host HTTP + FE dual-path |
| Project create/update/delete | `project-service.ts` | Medium | DONE (FE-HOST-12) — host HTTP + FE dual-path |
| Peer profile batch | `user-profile-service.ts` `getProfilesByUserIds` | Low | DONE (FE-HOST-14) — `POST /api/v1/user-profile/batch` |
| Session recap save | `session-recap-ai-service.ts` `saveSummary` | Medium | DONE (FE-HOST-14) — `PUT /api/v1/sessions/:id/recap` manual path |
| AI provider / Ollama settings | `host-ai-invoke.ts` | Low | DONE (FE-HOST-14) — host `/api/v1/ai/*` under host-first |
| Session outcome promote | `session-outcome-promotion-service.ts` | Info | Soft `{ ok: false, messageDe }`; no Edge required |
| Look reference Edge analysis | `look-reference-analysis-service.ts` | Info | DONE (CUT-15) — host `/api/v1/looks/reference-analysis`; Look CRUD is host |
| Item thumbnail Edge | `item-thumbnail-service.ts` | Info | DONE (CUT-16) — host `/api/v1/items/thumbnail` + AssetPorts; dual-path Edge until CUT-20 |
| Item model3d Edge | `item-model3d-service.ts` | Info | Soft German unavailable; inventory CRUD is host |
| Session media token Edge | `media-token-client.ts` | Info | Soft `degraded: true`; live media optional |
| Character lore AI Edge | `character-lore-service.ts` | Info | Soft German unavailable; optional AI |
| Session recap AI generate | `session-recap-ai-service.ts` `generateDraft` | Info | Soft German unavailable; manual save is host |
| Avatar Meshy Edge | `character-avatar-meshy-service.ts` | Info | Soft error / `meshyConfigured:false`; portrait publish is host |
| Avatar import/export/artifacts storage | `character-avatar-*-service.ts` | Info | Optional artifacts; portrait publish host (FE-HOST-06) |
| Historical `supabase/migrations` SQL | `supabase/migrations/**` | Info | Archive; not product runtime |
| Edge Functions tree | `supabase/functions/**` | Info | Archive / optional stack; dispatcher allowlists unchanged |

## Opt-out

`VITE_SAGATREE_HOST_LIBRARY=0` (or `false`/`off`/`no`) restores legacy Supabase
product paths when `VITE_SUPABASE_*` are configured.

## Security

- No silent anon Supabase fallback under host-first.
- Residual optional AI/Meshy surfaces fail closed with German UX copy (product remains usable).
- All severities listed above (including Low/Info).
