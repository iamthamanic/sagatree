# Acceptance — MIG-404 Character-Avatar-Meshy Host Port (#820)

## Intent
Port allowlisted Edge `character-avatar-meshy` contracts onto the host as an isolated use-case surface. Edge remains the live mount; no public activation or production cutover.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
Authorized host HTTP adapters + MIG-600/#845 + MIG-602/#847. `CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Required Tests
- [x] Owner start/poll/retry; stranger jobId → 404; stranger cannot sign owner storage path.
- [x] Text 8..500, nonce 1..80, 4MiB image grammar, settings enums; unsupported provider → 400.
- [x] Identical start key replays own row; third start inside 60s → 429 even if replay; process-memory quota only.
- [x] Concurrent polls: only one remesh claim; retry with existing provider task resumes without paid create.
- [x] Provider create null → provider_unavailable pseudo-job; missing config → not-configured; GLB URL host/ext allowlist.
- [x] Legacy defects characterized (length-based idempotency collision; provider-before-insert; config/decryption + data-URI grammar).
- [x] Touched files: zero type escape hatches.
- [x] `scripts/mig-404-character-avatar-meshy.self-test.mjs` → PASS

## Evidence
`node --experimental-strip-types scripts/mig-404-character-avatar-meshy.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-404.md`.
