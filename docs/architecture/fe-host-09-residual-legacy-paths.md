# FE-HOST-09 — Residual legacy product surfaces (closed)

> **Historisch — abgeschlossene Bestandsaufnahme, nicht Produkt-Stack.** The browser product runs
> host-only (React/Vite → Node/Hono host, Better Auth cookies, Policy Service, SQLite). This file
> records how the former dual-path residuals were closed. Renamed from the FE-HOST-09 residual
> doc in #1328.

## Status (CUT-21 → CUT-23)

CUT-20 removed the dual-path auth/library opt-out; CUT-21 removed the former BaaS SDK and runtime
trees from the product (#1156); #1328 removed the remaining legacy references from product code, tests and entry docs.
CUT-22 made host Compose the product default; CUT-23 closed the parity matrix (`PARITY_MISSING=0`)
and cleared Soft-DENY product fingerprints (shared `host-product-deny` helper only).

## Residual allowlist (closed under host-only)

Every surface below uses host HTTP, soft-degraded German UX, or throws unavailable — never hangs
on a legacy REST/Edge path.

| Surface | Module | Severity | Notes |
| --- | --- | --- | --- |
| Saga definition RPC editor | `saga-definition-service.ts` | Medium | DONE (FE-HOST-13) — host HTTP |
| Project create/update/delete | `project-service.ts` | Medium | DONE (FE-HOST-12) — host HTTP |
| Peer profile batch | `user-profile-service.ts` `getProfilesByUserIds` | Low | DONE (FE-HOST-14) — `POST /api/v1/user-profile/batch` |
| Session recap save | `session-recap-ai-service.ts` `saveSummary` | Medium | DONE (FE-HOST-14) — `PUT /api/v1/sessions/:id/recap` manual path |
| AI provider / Ollama settings | `host-ai-invoke.ts` | Low | DONE (FE-HOST-14) — host `/api/v1/ai/*` |
| Session outcome promote | `session-outcome-promotion-service.ts` | Info | Soft `{ ok: false, messageDe }`; no Edge required |
| Look reference analysis | `look-reference-analysis-service.ts` | Info | DONE (CUT-15) — host `/api/v1/looks/reference-analysis`; Look CRUD is host |
| Item thumbnail | `item-thumbnail-service.ts` | Info | DONE (CUT-16) — host `/api/v1/items/thumbnail` + AssetPorts |
| Item model3d | `item-model3d-service.ts` | Info | DONE (CUT-17) — host `/api/v1/items/model3d` + AssetPorts |
| Session media token | `media-token-client.ts` | Info | DONE (CUT-19) — host `/api/v1/sessions/:id/media-token` + LiveKit |
| Character lore AI | `character-lore-service.ts` | Info | Soft German unavailable; optional AI |
| Session recap AI generate | `session-recap-ai-service.ts` `generateDraft` | Info | Soft German unavailable; manual save is host |
| Avatar Meshy | `character-avatar-meshy-service.ts` | Info | DONE (CUT-18) — host `/api/v1/ai/character-avatar-meshy` + AssetPorts |
| Avatar import/export/artifacts storage | `character-avatar-*-service.ts` | Info | Optional artifacts; portrait publish host (FE-HOST-06) |

## Opt-out

None. The former `VITE_SAGATREE_HOST_LIBRARY=0` opt-out was removed with CUT-20.

## Security

- No anonymous legacy fallback; host-only.
- Residual optional AI/Meshy surfaces fail closed with German UX copy (product remains usable).
- All severities listed above (including Low/Info).
