# Composition Gate — mig-501-maxbytes-bypass (#939)

- HEAD_SHA: cb509dd2f08a24798848cbd354040ac610ef2648
- BASE_SHA: a6f6b148ccf3eecbbeea038a26c4e7230e948d0e
- Date: 2026-10-25
- Verdict: CLEAR

## Event

MIG-501 maxBytes bypass hardening: public `assets.publish` always DEFAULT 16 MiB; elevated LARGE only via `publishResumableFinalize` when `allowElevatedPublish` (host `SAGATREE_LARGE_UPLOADS=1`). No UI composition changes.

## Hop chain

1. Producer: direct `assets.publish` or resumable `uploads.patch` finalize
2. Authorize: `permissions.authorize('asset.publish', actor)` / upload owner
3. Ceiling: public → DEFAULT; strip caller maxBytes
4. Elevated: `publishResumableFinalize` only if `allowElevatedPublish` else `capability-disabled` → LARGE
5. Consumer: `assets.get` / head.assetId for owner; strangers denied

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner resume/finalize; stranger denied | self-test Fall 2 | pass |
| Invalid/missing | sneaky maxBytes → bytes-too-large; elevated off → capability-disabled | #939 | pass |
| Two consumers / crash | ≤16 MiB direct OK; resumable 17 MiB OK when capability on | #939 probes | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP tus routes + feature E2E → MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED

## Non-claims

No production Storage cutover. No public HTTP tus endpoints. No Supabase shutdown. No desktop release.
