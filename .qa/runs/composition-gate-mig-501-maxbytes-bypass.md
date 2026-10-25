# Composition Gate — mig-501-maxbytes-bypass

## Status
CLEAR

## HEAD_SHA
PLACEHOLDER

## BASE_SHA
PLACEHOLDER

## Scope
MIG-501 maxBytes bypass hardening (#939): public `assets.publish` always DEFAULT 16 MiB; elevated LARGE only via `publishResumableFinalize` used by resumable uploads after capability/owner checks.

## Composition path
1. Caller → `assets.publish(actor, input)` → strip fields → `LocalAssetStore.publish(..., DEFAULT)`
2. Resumable finalize → `assets.publishResumableFinalize` → `LocalAssetStore.publish(..., LARGE)`
3. Capability off → uploads create `capability-disabled`; direct publish unchanged at 16 MiB

## Non-goals proved out of scope
No cutover, no Supabase shutdown, no desktop release, no UI.

## Evidence
`node --experimental-strip-types scripts/mig-501-resumable-uploads.self-test.mjs` → PASS
