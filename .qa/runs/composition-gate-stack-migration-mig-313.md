# Composition Gate — stack-migration-mig-313 (#812)

- HEAD_SHA: ce8d93d362dbf8ac59172915fdf0d853877b11df
- BASE_SHA: e44a40ae499c48b710451e05ed2bb08948937b7e
- HOP_DIGEST: mig-313-host-world-adapter-v1
- Date: 2026-10-28
- Verdict: CLEAR
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

## Event

Infrastructure world adapters gain a host `HostWorldPorts` / `createHostWorldAdapter` seam bound to host `WorldPorts` + assets/media. All 17 world/atlas/place RPCs and profile CRUD are reachable on the host repository path. Supabase facades remain the live production path (no cutover).

## Hop chain

1. Producer: Infra world service successor / self-test adapter call with verified actor id
2. Authorize: host `permissions.authorize` / world access + media upload policy before projection or asset publish
3. Persist: SQLite world_* tables via `createWorldPorts`; map-pin bytes via `assets.publish` (not a world pin table)
4. Consumer: Host use-cases / future cutover transport; production UI still on Supabase until RELEASE APPROVED

## Simulations

### N-actors
Owner mutates tree and publishes map-pin; stranger get/update/delete/list DENY; player atlas list is not wider than owner and requires membership for party projection.

### Invalid/missing
Blank world ids, invalid map-pin MIME, unauthorized actor → explicit DENY codes; no private DTO leak.

### Two consumers / crash
World rows and assets reconstruct from SQLite after host reopen; deleted worlds stay absent; no client role elevation.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: Frontend facade cutover + ATLAS-LIVE-E2E/#770 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
