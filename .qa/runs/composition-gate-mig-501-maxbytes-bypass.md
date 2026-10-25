# Composition Gate — mig-501-maxbytes-bypass (#939)

- HEAD_SHA: e20d665d9ccffd3c5f437122f590da655dca4525
- BASE_SHA: a6f6b148ccf3eecbbeea038a26c4e7230e948d0e
- Date: 2026-10-25
- Verdict: CLEAR

## Event

MIG-501 maxBytes bypass hardening: public `assets.publish` always uses DEFAULT 16 MiB; elevated LARGE ceiling only via `publishResumableFinalize` on the capability-gated resumable path. No UI composition changes.

## Hop chain

1. Producer: direct `assets.publish(actor, input)` or resumable `uploads.patch` finalize
2. Authorize: `permissions.authorize('asset.publish', actor)` (owner on upload session)
3. Ceiling: public publish → `LocalAssetStore.publish(..., DEFAULT)`; strip caller maxBytes
4. Elevated finalize: `assets.publishResumableFinalize` → `LocalAssetStore.publish(..., LARGE)`
5. Consumer: `assets.get` / head.assetId for owner; strangers denied

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner resume/finalize; stranger denied | self-test Fall 2 | pass |
| Invalid/missing | 17 MiB direct + sneaky maxBytes → bytes-too-large; capability off create denied | #939 + Fall 3 | pass |
| Two consumers / crash | ≤16 MiB direct OK; resumable 17 MiB OK; public path still capped | #939 probes | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP tus routes + feature E2E → MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED

## Non-claims

No production Storage cutover. No public HTTP tus endpoints. No Supabase shutdown. No desktop release.
