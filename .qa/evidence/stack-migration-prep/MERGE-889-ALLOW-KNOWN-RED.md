# MERGE-889: ALLOW-KNOWN-RED

**Status:** MERGED  
**PR:** [#889](https://github.com/iamthamanic/sagatree/pull/889)  
**Approved head (human):** `8f0c77e84b0c47db2fc58aec077564543bc938bf`  
**Merge commit on `main`:** `5104e262a969a4f7ac8b0e865824249a96379e65`  
**Tree equivalence:** `HEAD^{tree}` == approved tip `^{tree}` (`384222ce…`)  
**Freigabe date:** 2026-10-22  
**Scope:** This PR / this commit only — **does not transfer** to later PRs or production cutover.

## What was accepted

- SQLite `BEGIN IMMEDIATE` per migration step + in-TX version re-read (GATE-04 single-writer)
- Fail-closed legacy `schema-upgrade.lock` (no auto-delete; operator clear after verified standstill)
- Real SIGKILL crash harness asserting `signal === 'SIGKILL'` before SQLite recovery checks
- MIG-011 acceptance retained; no new migration regressions beyond documented known-red

## Green checks on approved head

- Test Gate
- Composition Gate
- Browser E2E
- RPC source regeneration and migration contracts
- Actual RLS regression canary

## Known-red exceptions (unchanged signatures; accepted for this head only)

| Check | Signature |
| --- | --- |
| PostgreSQL baseline security and persistence | PAR-08-DICE; BASELINE-SEC-CROSS-SAGA; LEGACY-MAP; RECAP-OVERLOAD; FOREIGN-LEAVE; EVENT/ADVENTURE-HELPER (anon+auth) |
| GATE-01 real SQLite policy candidates | `npm audit` high: `deepmerge-ts` / Prisma chain |
| GATE-02 and GATE-03 | GATE-02 `notRun:1` / Cookie-A (`secure:false`); GATE-03 executed PASS, approval NOT APPROVED |
| Atlas isolated real product journey | Timeout / nav-source / pointer intercept |

## Explicitly not approved

GATE-02, GATE-03, GATE-05, production cutover, capacity SLOs.
