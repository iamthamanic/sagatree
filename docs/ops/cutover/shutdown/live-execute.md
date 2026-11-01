# Productive Supabase shutdown — Dornhain live execute

MIG-702 proves **readiness**. This page is the **Freigabe-Handlung** for the
live act, gated by `releases.SUPABASE-DORHAIN-LIVE-SHUTDOWN`.

## Preconditions (all required)

1. `CUTOVER-DORHAIN` = `APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF`
2. `SUPABASE-DORHAIN-LIVE-SHUTDOWN` = `APPROVED`
3. MIG-700 / MIG-701 / MIG-702 completion evidence on disk
4. Dornhain catalog intact on the **host** (world / saga / characters / items /
   monsters / NPCs)
5. Operator holds a Supabase Management API token with rights over the listed
   hosted project refs

## Allowlisted hosted targets

From `docs/ops/rotate-hosted-anon-keys.md` (legacy committed-anon projects):

| Project ref | Intended act |
| --- | --- |
| `dnhotyjazjnhneqbqocq` | Pause (then delete only if owner confirms in dashboard) |
| `vjpfbedynctazvwywlqj` | Pause (DevTrack legacy) |

Self-host compose stacks are **not** in this allowlist — shut them down with
local compose ops, not this script.

## Commands

```bash
# Dry-run — Freigabe + allowlist check only
node --experimental-strip-types scripts/supabase-dornhain-live-shutdown.execute.mjs

# Execute — pauses each allowlisted project via Management API
CONFIRM_DORHAIN_LIVE_SHUTDOWN=I_UNDERSTAND_DORHAIN_HOST_SURVIVES \
SUPABASE_ACCESS_TOKEN="<management-api-token>" \
node --experimental-strip-types scripts/supabase-dornhain-live-shutdown.execute.mjs --execute
```

Receipts land under `.qa/evidence/stack-migration-prep/shutdown-live/` when
execute succeeds or fails closed.

## 2026-11-01 evening execute receipt

Under the owner Management API token:

- Allowlisted refs `dnhotyjazjnhneqbqocq` and `vjpfbedynctazvwywlqj` were
  **already absent** from `GET /projects` (ALREADY_ABSENT).
- No project name matching saga/dornhain/devtrack/figma was present.
- Remaining accessible projects were all `INACTIVE` (unrelated orgs/apps).

Receipts: `.qa/evidence/stack-migration-prep/shutdown-live/`

## Non-claims

- Dry-run success ≠ already abgeschaltet
- `ALREADY_ABSENT` means the allowlisted hosted ref is gone from this token’s org — not a silent claim about every possible foreign org
- Pause ≠ permanent delete (delete remains a dashboard owner step if a ref reappears)
- Script refusal without token is correct fail-closed behavior
