# Source baseline and observed behavior (MIG-001 / #782)

| Item | Evidence |
| --- | --- |
| Historical source freeze | `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248` |
| Verified worktree HEAD (this acceptance) | `c1e6dd0843898d9e2d8251815a0fa19cc12e8d12` |
| Original PR #860 prep head (historical) | `839a8c256f53fc7f3be3375efd127ae07524458f` |
| Effective SQL source chain | 106 migrations, applied unchanged in isolation |
| PostgreSQL | 15.18; official pinned Supabase/GoTrue/Storage bootstrap |
| Catalog | 177 functions, 144 policies, 59 relations, 541 columns, 287 constraints |
| RPC source parity | 177/177 observed function definitions match source extraction |
| Product backend | Actual GoTrue password grants and PostgREST v12.0.1 |
| SQL secure behavior suite | 25 tests: 16 passed, 9 failed (documented findings — **not** security acceptance) |
| Atlas product browser | 3 tests: 1 passed, 2 failed; no skipped or flaky tests |
| Actual RLS canary | Clean policy passes; deliberately widened policy fails the expected case |
| Dual fixture rebuild | **PASS** — identical semantic checksum (see below) |
| Product deployment state | Not inspected or certified by the isolated source baseline |

## MIG-001 acceptance mapping

### AC1 — Commit, SQL SHA-256, order, pg_proc, apply-script drift

- Per-file SHA-256 and apply status: `parity-fixtures/execution-2026-10-21/postgres-report.json` → `migrations[]`
- Lexicographic apply order note + filenames missing from `scripts/apply-migrations.sh`:
  - `080_item_thumbnail_webp.sql`
  - `082_dornhain_pregen_full_sheets.sql`
  - `108_atlas_worldbuilder_migration_apply.sql`
- `pg_proc` signatures / ACL / security-definer: `parity-fixtures/execution-2026-10-21/pg-catalog.json` (`functions[]` with `identity_arguments`, `arguments`, `result`, `definition`, `anon_execute`, `authenticated_execute`)
- Dual-rebuild reconfirm: `parity-fixtures/execution-2026-10-21-rebuild/rebuild-verify.json`

### AC2 — Synthetic fixtures + two independent rebuilds

Roles/memberships/open+secret Atlas/runtime/inventory/fixed IDs: `fixtures.mjs` + committed `fixture.json`.

Two independent fresh clusters seeded twice:

| Field | Value |
| --- | --- |
| Mode | `dual-fixture-rebuild` |
| Identical | `true` |
| Semantic SHA-256 | `0a4295dbd16f61977ddb0eb282c5630d36df99de9371bfdc28fd3c2b5b99141d` |
| Evidence | `parity-fixtures/execution-2026-10-21-rebuild/rebuild-verify.json` |
| Command | `npm run rebuild-verify --prefix scripts/stack-migration-db` |

### AC3 — PASS names actual commit / worktree hash

- Dual-rebuild PASS records `repositoryHead` + per-harness-file SHA-256 under `rebuilds[].source`.
- Historical SQL suite PASS/FAIL rows record checkout `839a8c25…` in `execution-2026-10-21/postgres-report.json`.
- Regular CI `Test Gate` PASS is **not** claimed as execution of the isolated DB/browser suite.

### AC4 — typed-strict

Harness and evidence edits introduce no TypeScript type escape hatches.

## Evidence location

- Primary SQL/browser snapshot: `parity-fixtures/execution-2026-10-21/`
- Dual rebuild (MIG-001 Fall 2): `parity-fixtures/execution-2026-10-21-rebuild/`
- Harness: `scripts/stack-migration-db/`

The initial historical baseline `4bc40a31` and its old test result do not prove execution of these new tests. Repository HEAD identifies the checkout; per-file hashes identify the actually executed working-tree harness. No new PASS is attributed to an unexecuted immutable commit.

## Reproduced blockers (findings — not greenwashed)

| Severity | Finding |
| --- | --- |
| Critical | `append_session_event` / `sagatree_resolve_adventure_command` callable as anon in isolated default-ACL fixture |
| High | Same helpers reachable by foreign authenticated callers; foreign leave mutates session; cross-saga Atlas reveal; legacy pin redaction via `p_player_view=false` |
| Medium | Dice resolver still reads `v_character.user_id`; `save_session_recap_summary(uuid,text)` overload ambiguity |
| High (product) | Atlas browser: missing saga context in player workbench; overlay intercepts tools click |
| Info | Dual-rebuild / canary PASS ≠ security parity approval (`securityParityApproved: false`) |

All failures require explicit correction and regression evidence before safe parity or cutover can be claimed. No test is weakened to accept insecure legacy behavior. MIG-001 acceptance is **evidence lock**, not security clearance.
