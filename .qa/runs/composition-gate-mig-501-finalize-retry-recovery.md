# Composition Gate — mig-501-finalize-retry-recovery (#938)

- HEAD_SHA: b585c075f5b46d4674cf4aed5890ae95c4caa3bd
- BASE_SHA: bdeb13531a6651da1edc02908f62ed7c8741927a
- Date: 2026-10-25
- Verdict: CLEAR

## Event

MIG-501 finalize/retry recovery: lost final-chunk responses, publish failures, and markFinalized crashes recover to the same owner-bound asset via `pending_asset_id` and idempotent `assets.publish({ assetId })`. No UI composition changes.

## Hop chain

1. Producer: host `uploads.patch(actor, …)` on completing chunk or empty finalize retry
2. Authorize: `permissions.authorize('asset.publish', actor)` / owner check on head
3. Stage: `UploadSessionStore` full-offset assembly + `pending_asset_id` bind
4. Finalize: idempotent `assets.publish` (stable asset id) → `markFinalized`
5. Consumer: `assets.get` / head.assetId for owner; strangers denied

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner retry same asset; stranger head/patch denied | self-test #938 | pass |
| Invalid/missing | offset-mismatch / capability off unchanged | Fall 2–3 | pass |
| Two consumers / crash | wipe finalized + restage → same assetId, one published row | crash remount case | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP tus routes + feature E2E → MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED

## Non-claims

No production Storage cutover. No public HTTP tus endpoints. No Supabase shutdown. No maxBytes policy change (#939).
