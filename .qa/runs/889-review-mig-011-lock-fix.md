# Review Ticket — PR #889 (MERGE-889 WAIT head)

- Date: 2026-10-21
- Verdict: **ACCEPT** (with Info notes; no Critical/High open)

## Findings (all severities)

| Severity | ID | Finding | Status |
| --- | --- | --- | --- |
| Medium (resolved) | R-01 | Auto-`unlink` of `schema-upgrade.lock` could steal an old host's lock | **Fixed** — fail-closed; operator clear only after verified standstill |
| Medium (resolved) | R-02 | Constraint-fail test was not a process crash | **Fixed** — real SIGKILL mid-TX + reopen proof |
| Low | R-03 | `discardLegacySchemaUpgradeLockFile` now throws if called | Intentional hard break; no remaining callers |
| Info | R-04 | SIGKILL crash case skipped on Windows | Documented; CI runners are Linux |
| Info | R-05 | Operator must manually confirm old host stopped | By design — no PID/file-lock complexity |
| Info | R-06 | Known-red migration baseline / GATE-01 audit / GATE-02-03 / Atlas remain red | Unchanged signatures; **no ALLOW-KNOWN-RED** |

## Secure-by-Default

- B-01/B-04: N/A for lock recovery paths (no owner mutation surface change)
- B-07: migrate errors redacted; legacy error is a fixed code string
- No secrets / elevated origins introduced
