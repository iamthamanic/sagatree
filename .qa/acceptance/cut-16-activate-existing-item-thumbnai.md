# Acceptance — CUT-16 Activate existing item thumbnail generation (#1151)

## Intent
Image thumbnail upload/generation and job polling function via existing provider-neutral Host/item-thumbnail ports. Soft-DENY removed when host library is on. Without Meshy: typed `not-configured` for generate; config/upload/resolve/remove still work.

## Preconditions
- Better Auth session (or solo loopback).
- Inventory item definition owned by actor (personal) or world-editable.
- Optional: Meshy credentials / `MESHY_*` for generate.

## Happy Path
1. `config` → meshyConfigured + limits.
2. `upload` with base64 image → assetKey + signedUrl.
3. `generate` (Meshy on) → jobId; `status` poll → succeeded + asset; `resolve` / `latest-job` / `remove`.

## Edge Cases
- No Meshy → generate `not-configured`
- Foreign definition/job → 403/404
- Oversize / invalid MIME → 400/413
- Rate limit → 429
- Archived item → 403

## Security Coverage
- Actor from Better Auth; definition authz via store/inventory.
- Secrets server-only; signed URLs TTL-bound.
- SC-01/02/03/06 inline; not a launch ticket.

## UI/UX
Existing item thumbnail UI and polling unchanged.

## Implementation Notes
_(after coding)_

## Evidence
- `scripts/cut-16-item-thumbnail.self-test.mjs` — config/upload/generate/status/latest/remove; not-configured without Meshy; foreign deny; REST upload alias.
- `scripts/mig-410-item-thumbnail.self-test.mjs` — activation true + mount assertions.
- Matrix item-thumbnail.* → HOST_VERIFIED.

## Composition Gate
CLEAR — see `.qa/runs/composition-gate-cut-16-activate-existing-item-thumbnai.md`.

## Implementation Notes
- Action POST `/api/v1/items/thumbnail` + REST family under `/api/v1/items/:id/thumbnail/*`.
- Soft-DENY removed; Edge retained until CUT-20.
- Definitions hydrated from inventory ports into in-memory thumbnail store.
