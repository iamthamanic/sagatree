# Acceptance — RPC-SAGA-PROVISION (#873)

## Intent
Port create_project_from_saga_version, duplicate_saga_playthrough, ensure_native_starter_project with secure semantics.

## Acceptance tier
`isolated-contract` — SLICE DONE. FEATURE VERIFIED → MIG-311/#810 + MIG-602/#847. RELEASE APPROVED → human only.

## Product decision (RPC-POLICY-USER-PUBLISHED)
**KEEP legacy open instantiate:** published `origin=user` sagas remain creatable as GM groups by any authenticated actor. `private_backfill` stays owner-only. Version-read ACL remains separate.

## Required Tests
- [x] New play group binds published saga version + GM membership in one transaction
- [x] fresh / with_progress duplicate; no session identity reuse
- [x] ensure_native_starter_project idempotent per actor+slug (Dornhain character/atlas seed repair deferred MIG-600/#845)
- [x] Denies: mismatch, private_backfill stranger, bad mode; user-published keep-open proven
- [x] Touched files: zero type escape hatches

## Deferred
Full Dornhain character/atlas seed repair → MIG-600/#845. HTTP adapter → MIG-311.
