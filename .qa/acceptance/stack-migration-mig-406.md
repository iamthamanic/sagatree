# Acceptance — MIG-406 characters quarantine (#822)

## Intent
Capture the legacy-unmounted `characters` Edge worker; keep production host/dispatcher at 404 until a separate human activation. Isolated characterization fixtures only — no public host route.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
authorized host routes + MIG-600; public activation remains unauthorized (`CHARACTERS_PUBLIC_ACTIVATION_AUTHORIZED === false`). FEATURE VERIFIED → MIG-600/#845 + MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] All characters methods stay dispatcher404, including cross-owner body and import payload.
- [x] PUT can overwrite ownerId; level-up uses body.characterId in isolated fixture; neither becomes a successor authorization rule.
- [x] Source check identifies non-advancing addExperience loop; XP-at-threshold only with hard iteration guard.
- [x] Legacy regression: addExperience const nextLevel/nextThreshold never advance → indefinite loop at threshold (guarded fixture).
- [x] Legacy regression: no user authentication; client supplies ownerId; level-up body can target a different path ID.
- [x] Touched files: zero type escape hatches.
- [x] scripts/mig-406-characters-quarantine.self-test.mjs → PASS


## Evidence
`node --experimental-strip-types scripts/mig-406-characters-quarantine.self-test.mjs` → PASS (wired into `npm run test-gate`).

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-406.md`.
