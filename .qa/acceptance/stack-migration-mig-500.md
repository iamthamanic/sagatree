# Feature: MIG-500 Local protected asset service

<!-- seeded for #841 -->

## Intent

Geschützte lokale Assets mit atomarem Publish und metadata-basierter Autorisierung bereitstellen (`server/src/assets`).

## Preconditions

- MIG-011 schema + MIG-013 Policy Service on main
- Host dataDir + SQLite bootstrap available

## Happy Path

- [x] Owner publish → metadata + bytes under dataDir/assets; checksum matches
- [x] Owner read returns same bytes/checksum after host reopen
- [x] Authorization via `permissions.authorize` (`asset.publish` / `asset.read`)

## Edge Cases

- [x] Stranger with foreign asset id → not-authorized (no payload leak)
- [x] Path traversal / symlink escape → path-traversal-denied before IO outside root
- [x] Unpublished / incomplete rows are not readable

## Regression

- [x] MIG-012 / MIG-013 self-tests remain in test-gate
- [x] `architecture-boundary-check` / host package rules green

## Assumptions

- MVP: owner-scoped publish/get only (no world-member share matrix yet)
- Storage keys are server-assigned opaque tokens — never caller paths
- Full media Edge cutover / signed URLs are follow-ups

## Security Coverage

| ID | How |
| --- | --- |
| B-01 | Owner vs stranger on asset.read |
| B-04 | authorize before publish/get |
| B-07 | Deny codes only; no bytes on deny |
| Path | resolveUnderRoot rejects `..`, absolutes, symlink escape |

### Launch Checklist (SC)

N/A — not a launch ticket.

## Implementation Notes

- `server/src/assets/` public API + `internal/local-asset-store.ts`
- Migration `0002_local_assets.sql`; table ownership `assets → media`
- Policy ops `asset.publish` / `asset.read` in permissions PolicyService
- Wired in `create-host.ts`; self-test `scripts/mig-500-local-assets.self-test.mjs`

## Composition Gate

Proof: `.qa/runs/composition-gate-stack-migration-mig-500.md`
