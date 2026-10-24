# Composition Gate — stack-migration-mig-501 (#842)

- HEAD_SHA: ef7ee1fec3210a9eb8e9217aabaea2b00017cb80
- BASE_SHA: 6967c8437a17a0c34c5742963376789c491bcee4
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Optional resumable (tus-style) uploads accumulate owner-bound chunks under `dataDir/assets/.uploads`, then finalize through the same MIG-500 `assets.publish` path. Capability flag `SAGATREE_LARGE_UPLOADS=1` gates create/patch; small direct publish remains available when disabled.

## Hop chain

1. Producer: host composition / future HTTP adapter → `uploads.create|head|patch(actor, …)`
2. Authorize: `permissions.authorize('asset.publish', actor)` on create and every chunk
3. Stage: `UploadSessionStore` enforces offset, length, owner; bytes only under `.uploads/<id>`
4. Finalize: `assets.publish` (LocalAssetStore) → published `assets` row + durable bytes; staging deleted
5. Consumer: `assets.get` for owner; strangers denied by existing MIG-500 policy

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner resume + publish; stranger patch denied | self-test Fall 1–2 | pass |
| Invalid/missing | Wrong offset / oversize / capability off | deny codes only | pass |
| Two consumers / crash | HEAD after interrupt resumes at confirmed offset | mid-offset durable in SQLite | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP tus routes + feature E2E → MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED

## Non-claims

No production Storage cutover. No public HTTP tus endpoints in this ticket. No Supabase shutdown.
