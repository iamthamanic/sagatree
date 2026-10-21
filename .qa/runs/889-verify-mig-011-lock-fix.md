# Verify Ticket — PR #889 / MIG-011 follow-up (MERGE-889 WAIT)

- HEAD: (see tip after push)
- Date: 2026-10-21
- Verdict: **PASS** (local)

## Acceptance retained (MIG-011)

| Criterion | Evidence |
| --- | --- |
| Idempotent second migrate; foreign_keys ON | self-test AC1 |
| Broken SQL step rolls back; same failed step on restart | self-test AC2 (`0002_broken.sql`) |
| Integrity rejects orphan memberships / FK | self-test AC3 |
| Module ownership / no private cross-imports | self-test AC4 + architecture-boundary-check |
| BEGIN IMMEDIATE concurrency; journal never >1 | concurrent child-process cases |

## MERGE-889 WAIT additions

| Criterion | Evidence |
| --- | --- |
| Legacy lock present → fail-closed; no auto-delete | self-test legacy section |
| Old host holds lock + TX; new host refuses | old+new concurrency section |
| Clear only after `oldHostVerifiedStopped: true` | `clearLegacySchemaUpgradeLockAfterVerifiedStandstill` |
| Real SIGKILL mid-TX; uncommitted rolled back; v1 intact | SIGKILL crash-recovery section (POSIX) |

## Commands

```bash
node --experimental-strip-types scripts/mig-011-sqlite-schema.self-test.mjs  # PASS
node --experimental-strip-types scripts/mig-010-host-skeleton.self-test.mjs  # PASS
node scripts/architecture-boundary-check.mjs  # PASS
COMPOSITION_GATE_PR_BASE_SHA=<main> npm run composition-gate  # CLEAR
```
