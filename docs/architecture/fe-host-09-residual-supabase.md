# FE-HOST-09 — Residual Supabase product surfaces

Owner note (cutover milestone): with `VITE_SAGATREE_HOST_AUTH_URL` set and
`VITE_SAGATREE_HOST_LIBRARY` not explicitly off, the browser product runtime is
**host-first**. Covered journeys use host HTTP + Better Auth cookies. The
Supabase JS client stays inert (no GoTrue session) unless the operator opts out.

## Residual allowlist (DENY under host-first)

These FE facades still contain `supabase.from` / `rpc` / `storage` /
`functions.invoke` for the **legacy** dual-path (`VITE_SAGATREE_HOST_LIBRARY=0`
or missing auth URL). Under host-first they throw or return German unavailable
via `assertHostProductSurfaceAvailable` / local stubs — never hang on PostgREST.

| Surface | Module | Severity | Notes |
| --- | --- | --- | --- |
| Saga definition RPC editor | `saga-definition-service.ts` | Medium | Host ports exist for tests; product HTTP not mounted |
| Session outcome promote | `session-outcome-promotion-service.ts` | Low | Returns `{ ok: false, messageDe }` |
| Look reference Edge analysis | `look-reference-analysis-service.ts` | Medium | Look CRUD already host; analysis Edge only |
| Item thumbnail / model3d Edge | `item-thumbnail-service.ts`, `item-model3d-service.ts` | Medium | Inventory CRUD host; Meshy Edge residual |
| Session media token Edge | `media-token-client.ts` | Low | Degraded media UX |
| Character lore AI Edge | `character-lore-service.ts` | Medium | Stubbed FE-HOST-08 |
| Session recap AI Edge | `session-recap-ai-service.ts` | Medium | Stubbed FE-HOST-08; get-recap host |
| Avatar Meshy Edge | `character-avatar-meshy-service.ts` | Medium | Needs host AI successor |
| Avatar import/export/artifacts storage | `character-avatar-*-service.ts` | Medium | Portrait publish is host (FE-HOST-06) |
| Character presets / adventure arcs | `character-preset-service.ts`, `character-adventure-arc-service.ts` | Low | PostgREST tables |
| AI provider Edge fallback | `host-ai-invoke.ts` | Low | Host path when `VITE_SAGATREE_HOST_AI=1`; else DENY under host-first |
| Peer profile batch | `user-profile-service.ts` `getProfilesByUserIds` | Low | Own profile host; batch DENY |
| Historical `supabase/migrations` SQL | `supabase/migrations/**` | Info | Archive; not product runtime |
| Edge Functions tree | `supabase/functions/**` | Info | Archive / optional stack; dispatcher allowlists unchanged |

## Opt-out

`VITE_SAGATREE_HOST_LIBRARY=0` (or `false`/`off`/`no`) restores legacy Supabase
product paths when `VITE_SUPABASE_*` are configured.

## Security

- No silent anon Supabase fallback under host-first.
- Residual surfaces fail closed with German UX copy.
- All severities listed above (including Low/Info).
