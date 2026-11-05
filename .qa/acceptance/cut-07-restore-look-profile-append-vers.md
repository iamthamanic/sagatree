# Acceptance — CUT-07 (#1142)

- HEAD_SHA: 5d2b483c979b2e2a257f07e70a5f17aeb27da13c
- Issue: #1142
- Slug: cut-07-restore-look-profile-append-vers

## Summary
Mount POST/GET `/api/v1/library/looks/:id/versions` on existing LookProfilePorts.
FE dual-path via host-library-http; Soft-DENY removed; full immutable history returned.

## Composition Gate

- HEAD_SHA: 5d2b483c979b2e2a257f07e70a5f17aeb27da13c
- Verdict: CLEAR

## Required Tests

- [x] scripts/cut-07-look-versions.self-test.mjs
- [x] scripts/cutover-parity-inventory-check.mjs
