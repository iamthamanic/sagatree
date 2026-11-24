# Owner RELEASE — Supabase Dornhain live shutdown execute (2026-11-01)

> **Historisch — abgeschlossene Entscheidung, nicht Produkt-Stack.** Datiertes Owner-Entscheidungsprotokoll; Erwähnungen des früheren Backend-Stacks beschreiben den damaligen Stand. Aktueller Stack: [`AGENTS.md`](../../AGENTS.md) · [`host-modular-monolith.md`](host-modular-monolith.md) (#1328).

> **Dateiname:** bis #1328 hieß diese Datei `migration-owner-release-2026-11-01-supabase-live-shutdown.md` (der frühere Backend-Anbieter war Supabase). Umbenannt, damit Pfad-Scans den alten Stack nicht als aktuell melden. Das dort genannte Execute-Skript wurde nach dem Shutdown mit #1328 entfernt (Git-Historie).

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

Executed and closed. The one-off execute script and its ops checklist were removed with #1328
(they targeted the retired provider's Management API). To review them, see the Git history
before #1328 (`git log --diff-filter=D --name-only -- scripts docs/ops/cutover/shutdown`).
There is nothing left to run.

## Explicitly not approved by silence

- Abandoning Dornhain host content
- Wiping an undeclared / unlisted project ref
- Claiming “already abgeschaltet” without an execute receipt in the ops archive
