# Acceptance — CUT-10 (#1145)

- HEAD_SHA: pending
- Issue: #1145
- Slug: cut-10-restore-world-profile-lookup-by

## Summary
Authorized world profile lookup by `WO-` public id on host SQLite.
Hono `GET /api/v1/library/worlds/by-public-id/:publicId` via WorldPorts;
migration `0033_world_public_id.sql`; FE dual-path; Soft-DENY removed.
Public id is identity only — `world.read` policy still authorizes access.

## Composition Gate

- HEAD_SHA: pending
- Verdict: CLEAR

## Required Tests

- [x] scripts/cut-10-world-public-id.self-test.mjs
- [x] scripts/cutover-parity-inventory-check.mjs
