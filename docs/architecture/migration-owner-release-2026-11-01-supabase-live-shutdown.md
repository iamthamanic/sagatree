# Owner RELEASE — Supabase Dornhain live shutdown execute (2026-11-01)

**Actor:** Repository owner (`iamthamanic`), explicit chat decision 2026-11-01 evening.  
**Transcribed by:** agent under owner instruction.  
**GitHub anchor:** [#851](https://github.com/iamthamanic/sagatree/issues/851#issuecomment-6565086247).

## Decision

**`releases.SUPABASE-DORHAIN-LIVE-SHUTDOWN.status = APPROVED`**

Authorizes the **productive** Dornhain-scoped Supabase exit / hosted-project
retire act after MIG-700/701/702 proof.

## Relationship to CUTOVER-DORHAIN

| Record | Status | Meaning |
| --- | --- | --- |
| `CUTOVER-DORHAIN` | `APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF` | Freigabe binding for MIG-702 readiness (drill + shutdown-after-proof). **Not** “already wiped.” |
| `SUPABASE-DORHAIN-LIVE-SHUTDOWN` | `APPROVED` | Execute authorization for the live Freigabe-Handlung. |

Owner instruction: *CUTOVER-DORHAIN steht auf
APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF, nicht auf „schon abgeschaltet“*
and *Live-Supabase-Abschaltung — nur Drill/Readiness (MIG-702); produktiver
Wipe braucht die Freigabe-Handlung* — this RELEASE **is** that Handlung.

## Hard content requirement (unchanged)

Dornhain world, saga, characters, items, monsters, and NPCs must remain intact
on the host. Non-Dornhain disposable tenant data may exit with Supabase.

## Execution entry

```bash
# Dry-run (default): prove Freigabe + targets; no Management API mutation
node --experimental-strip-types scripts/supabase-dornhain-live-shutdown.execute.mjs

# Live act (requires token + typed confirmation env)
CONFIRM_DORHAIN_LIVE_SHUTDOWN=I_UNDERSTAND_DORHAIN_HOST_SURVIVES \
SUPABASE_ACCESS_TOKEN=… \
node --experimental-strip-types scripts/supabase-dornhain-live-shutdown.execute.mjs --execute
```

Ops checklist: `docs/ops/cutover/shutdown/live-execute.md`

## Explicitly not approved by silence

- Abandoning Dornhain host content
- Wiping an undeclared / unlisted project ref
- Claiming “already abgeschaltet” without an execute receipt in the ops archive
