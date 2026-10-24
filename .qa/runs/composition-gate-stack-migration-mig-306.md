# Composition Gate — stack-migration-mig-306 (#805)

- HEAD_SHA: 744c3418ba7a8440a541a3ca21fe70ceefeeaf53
- BASE_SHA: f17e8b0e1131d9df890a17b115f746534132207b
- HOP_DIGEST: 9cfb7bd6d91f71b5bb05f9b9cfdb36fe71b9ac1bd7a585ea2b56cac446ce1505
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Host `createHost` exposes `media` ports. Upload/optimize metadata is evaluated via domain policies before asset storage (MIG-500). Browser engines remain the only codec path.

## Hop chain

1. Producer: Client media optimizer / upload intake
2. Authorize: Host `media.validateUpload` (profile MIME/budget) + existing asset policy on publish
3. Project: N/A (no realtime fan-out in this slice)
4. Consumer: `createHost` wiring; asset store remains MIG-500

## Simulations

### N-actors
Multiple profiles (portrait/map/avatar) share the same policy ports without cross-profile MIME elevation.

### Invalid/missing
Oversized bytes, unsupported MIME/GIF, and audio/video/model3d kinds DENY with explicit codes.

### Two consumers / crash
Host restart reconstructs media ports as pure factories; no durable media optimizer state.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: Full browser+host media E2E and adapter callers → MIG-602/#847; FEATURE VERIFIED via MIG-311/#810 wave + MIG-602
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
- No remote codec service invented (infra-media inventory unchanged)
