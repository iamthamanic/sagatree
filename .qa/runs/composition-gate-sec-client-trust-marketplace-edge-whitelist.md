# Composition Gate — sec-client-trust-marketplace-edge-whitelist (#675)

- HEAD_SHA: 7b9095e32abbac4df702d569c99cd1c8919ef88d
- BASE_SHA: 383f355620053904379d8a666ff527c79b06b862
- Date: 2026-10-29
- Verdict: CLEAR
- Scope: committed HEAD (marketplace client-trust + Edge body whitelist + DB guard)

## Event

Authenticated marketplace author creates/updates/deletes own listings via infrastructure adapter; privileged counters/ownership never accepted from client bodies. Allowlisted Edge POSTs reject privileged keys. schema.sql and deploy_marketplace.sql install DB guard + column grants. Featured listings rank by downloads because rating is server-owned.

## Hop chain

1. Producer: Marketplace UI / adapter caller supplies create/update DTO
2. Authorize: getAuthenticatedUserId + author_id scope on update/delete; domain whitelist rejects privileged keys
3. Persist: Supabase marketplace_items (RLS + privileged-column trigger/grants)
4. Project: MarketplaceItem row without client-set counters
5. Consumer: browse/list UI; Edge allowlisted workers reject privileged POST keys independently

## Simulations

### N-actors
Owner update/delete succeeds under author_id=JWT. Foreign author → empty maybeSingle / delete false. Edge privileged keys → 400 for any actor.

### Invalid/missing
Missing auth → adapter throws. Privileged DTO keys / unknown fields → throw. Edge body with author_id/rating/downloads/roles → 400. DB insert without JWT → 42501 from guard.

### Two consumers / crash
Download RPC (DEFINER, authenticated-only, search_path pinned) increments downloads despite column grants. Client counter fallback removed. Adapter and Edge parsers are single-hop; no invalid multi-consumer fallback path.

## Flags

- Acceptance tier: product-security
- Deferred integration: marketplace_items optional outside full migration chain; host cutover unchanged
- Browser E2E: SKIPPED (adapter/Edge/SQL security; no UI surface change)
- Skip MIG-305/#804 waiting-dependency; Dependabot #982–#984 deferred
