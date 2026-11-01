# MIG-702 — Supabase shutdown readiness (Dornhain)

Supabase may exit **only after** predecessor proof + restore + call-path
clearance, and **productive** shutdown needs the linked Dornhain Freigabe.

## Rules

| Rule | Meaning |
| --- | --- |
| Evidence not labels | Relabeled `agent-done` without `completionEvidence` still blocks |
| Predecessors | MIG-700, MIG-701, ATLAS-LIVE-E2E, MIG-603 must PASS on disk |
| Call matrix | Every operation has a verified host successor **or** human-approved retirement |
| Supabase leftovers | Remaining network calls are explicit blockers until retired |
| Restore | MIG-700 rollback + MIG-701 parity archive; Dornhain catalog intact |
| Permission negative | Stranger must not authorize shutdown |
| Productive auth | Linked Freigabe (`APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF`) required |

## Hard content requirement

Dornhain world, saga, characters, default items, monsters, and NPCs must remain
intact. Other tenant/user data may be omitted (owner Freigabe A, 2026-11-01).

## Local proof

```bash
node --experimental-strip-types scripts/mig-702-shutdown-readiness.self-test.mjs
```

Code: `server/src/migration/cutover/shutdown-readiness.ts`

## Non-claims

- This slice does **not** wipe a live production Supabase project by itself.
- Desktop ship still needs GATE-05 PoC / MIG-703.
- RELEASE APPROVED for a named production deploy remains an explicit human act
  with the Freigabe link recorded in the shutdown decision archive.
