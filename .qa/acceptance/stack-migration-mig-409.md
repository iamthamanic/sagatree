# Acceptance — MIG-409 Item-Model3d Host Port (#825)

## Intent
Port allowlisted Edge `item-model3d` contracts onto the host as an isolated use-case surface under `server/src/application/item-model3d/`. Edge remains the live mount; no public activation or production cutover.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
Authorized host HTTP adapters + MIG-600/#845 + MIG-602/#847. `ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Required Tests
- [x] Personal/world-profile owner upload GLB≤50MiB; GM/member/foreign → 403; archived → 403; no unauthorized provider/storage.
- [x] generate quota 2/60s; 3rd → 429; unavailable store → 500 before paid create; non-generate actions uncharged.
- [x] Action response unions (config/upload/generate/status/resolve/remove/latest); model3d: prefix; signed URL lifetime 604800s; latest null when absent.
- [x] Explicit successor decision: no status claim / paid-create-before-insert / ignored PATCH statuses characterized.
- [x] Foreign jobId → 404; foreign resolve → 403; remove clears pointer without deleting other-owner object; off-allowlist/oversize never materializes.
- [x] Provider/job failures distinguished; no API keys in error bodies.
- [x] Legacy defects characterized (header-only body limit; GLB magic/size/MIME only; provider error_message passthrough).
- [x] Touched files: zero type escape hatches.
- [x] `scripts/mig-409-item-model3d.self-test.mjs` → PASS

## Security Coverage
- SC-01: personal owner or world-profile owner only (GM/membership insufficient).
- SC-02: GLB magic + MIME + 50MiB; Meshy host allowlist.
- SC-03: generate quota 2/60s.
- SC-06: no provider secrets in public errors.
- Out of scope: production cutover / host HTTP mount.

## Launch Checklist (SC)
N/A — not a launch ticket.

## Evidence
`node --experimental-strip-types scripts/mig-409-item-model3d.self-test.mjs` → PASS.

## Implementation Notes
Isolated host ports under `server/src/modules/inventory/internal/item-model3d.ts` + application use-cases; Edge allowlist unchanged; no `create-app` mount.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-409.md` (CLEAR).
