# Executed isolated baseline — 2026-10-21

This is a snapshot of actual execution against checkout
`839a8c256f53fc7f3be3375efd127ae07524458f` with the preparation harness hashes
recorded in each report. Repository product SQL and UI were unchanged.

| Execution | Result | Meaning |
| --- | --- | --- |
| PostgreSQL full source baseline | 25 tests: 16 passed, 9 failed | Seven security assertions and two functional assertions remain red |
| Actual RLS canary | Passed | Clean deny passed; intentionally opened real policy failed exactly PAR-10 |
| Atlas actual product | 3 tests: 1 passed, 2 failed; 0 skipped/flaky | Foreign owner deny passes; Tools hit target and player rendering block the product journey |
| Catalog export | 177 functions, 144 policies, 59 relations, 541 columns, 287 constraints | Actual pg_proc/pg_policies/pg_attribute/pg_constraint state after all 106 migration files |

`postgres-report.json`, `product-report.json`, and the canary child reports retain
source hashes, runtime versions, migration hashes and outcomes. `pg-catalog.json`
contains the actual schema/ACL export. `transport-observations.json` records real
GoTrue identity and PostgREST request/status/body without credentials.
`browser-observations.json` contains sanitized RPC captures, test errors and hashes
of the raw traces. The screenshots show the product failure states.

Raw Playwright traces are retained at
`scripts/stack-migration-db/artifacts/review-2026-10-21/browser/` in ignored local
artifacts. They are deliberately absent from committed evidence because trace
archives may contain generated local fixture credentials. The underlying local
database and services were stopped and removed after the runs. The workflow
uploads raw traces as execution artifacts, while committed evidence stays
sanitized. `artifact-manifest.json` checksums every committed artifact here.

No architecture, cutover, baseline security, or SQLite parity approval is granted.
The failures must be repaired through explicit product follow-ups; this preparation
never silently changes or whitelists them. See the harness README and
`.qa/design/parity-harness/README.md` for commands, defects and scope limits.
