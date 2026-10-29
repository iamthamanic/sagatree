# Acceptance — MIG-410 Item-Thumbnail Host Port (#826)

## Intent
Port allowlisted Edge `item-thumbnail` contracts onto the host as an isolated use-case surface under `server/src/application/item-thumbnail/`. Edge remains the live mount; no public activation or production cutover.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
Authorized host HTTP adapters + MIG-600/#845 + MIG-602/#847. `ITEM_THUMBNAIL_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Required Tests
- [x] Personal/world-profile owner upload PNG/JPEG/WebP≤10MiB; GM/member/foreign → 403; archived → 403; no unauthorized provider/storage.
- [x] generate quota 4/60s; 5th → 429; unavailable store → 500 before paid create; non-generate actions uncharged.
- [x] Action response unions (config/upload/generate/status/resolve/remove/latest); thumbnail2d: prefix; signed URL lifetime 604800s; latest null when absent.
- [x] Explicit successor decision: status reauth + provider poll + allowlist before materialize; paid-create-before-insert characterized; concurrent claimer.
- [x] Foreign jobId → 404; foreign resolve → 403; remove clears pointer without deleting other-owner object; off-allowlist never materializes.
- [x] Provider/job failures distinguished; no API keys in error bodies.
- [x] Legacy defects characterized (header-only 14MiB body limit; image magic/size/MIME; provider error_message passthrough).
- [x] Touched files: zero type escape hatches.
- [x] `scripts/mig-410-item-thumbnail.self-test.mjs` → PASS

## Security Coverage
- SC-01: personal owner or world-profile owner only (GM/membership insufficient).
- SC-02: PNG/JPEG/WebP magic + MIME + 10MiB; Meshy host allowlist on materialize.
- SC-03: generate quota 4/60s.
- SC-06: no provider secrets in public errors.
- Out of scope: production cutover / host HTTP mount.

## Launch Checklist (SC)
N/A — not a launch ticket.

## Evidence
`node --experimental-strip-types scripts/mig-410-item-thumbnail.self-test.mjs` → PASS.

## Implementation Notes
Isolated host ports under `server/src/modules/inventory/internal/item-thumbnail.ts` + application use-cases; Edge allowlist unchanged; no `create-app` mount.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-410.md` (CLEAR).
