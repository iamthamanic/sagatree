# Acceptance — CUT-17 Activate existing item model3D generation (#1152)

## Intent
GLB upload/generation and job polling function via existing provider-neutral Host/item-model3d ports. Soft-DENY removed when host library is on. Without Meshy: typed `not-configured` for generate; config/upload/resolve/remove still work. Generate requires thumbnail assetKey.

## Preconditions
- Better Auth session (or solo loopback).
- Inventory item definition owned by actor (personal) or world-editable.
- Optional: Meshy credentials / `MESHY_*` / `ITEM_THUMBNAIL_MESHY_MOCK` for generate.

## Happy Path
1. `config` → meshyConfigured + limits.
2. `upload` with base64 GLB → model3d + signedUrl (`/api/v1/assets/...`).
3. `generate` (Meshy on + thumbnail assetKey) → jobId; `status` poll → succeeded + asset; `resolve` / `latest-job` / `remove`.

## Edge Cases
- No Meshy → generate `not-configured`
- Missing thumbnail assetKey → 400 THUMBNAIL_REQUIRED
- Foreign definition/job → 403/404
- Oversize / invalid GLB → 400/413
- Rate limit → 429
- Archived item → 403

## Security Coverage
- Actor from Better Auth; definition authz via store/inventory (+ world edit / linked solo).
- Secrets server-only; durable AssetPorts URLs.
- SC-01/02/03/06 inline; not a launch ticket.

## UI/UX
Existing item 3D preview + generation controls unchanged.

## Evidence
- `scripts/cut-17-item-model3d.self-test.mjs`
- `scripts/mig-409-item-model3d.self-test.mjs` — activation true
- Matrix item-model3d.* → HOST_VERIFIED

## Composition Gate
CLEAR — see `.qa/runs/composition-gate-cut-17-activate-existing-item-model3d.md`.

## Implementation Notes
- Action POST `/api/v1/items/model3d` + REST family under `/api/v1/items/:id/model3d/*`.
- Soft-DENY removed; Edge retained until CUT-20.
- Upload/status materialize publish durable bytes via AssetPorts.
- World hydrate requires `canEditWorld`; linked solo ids authorized.
