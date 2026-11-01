# Owner RELEASE — Dornhain cutover scope (2026-11-01)

**Actor:** Repository owner (`iamthamanic`), explicit chat decision 2026-11-01.  
**Transcribed by:** agent under owner instruction (not agent-selected scope).  
**GitHub anchors:** [#849](https://github.com/iamthamanic/sagatree/issues/849#issuecomment-6554822337), [#788](https://github.com/iamthamanic/sagatree/issues/788).

## Approved to execute

1. **GATE-05** — run the Tauri+Node sidecar packaging PoC (platform qualification work). Desktop **ship** still needs PoC evidence; this unlocks execution, not a silent product release.
2. **MIG-700** — Freeze → Delta → authority switch → Rollback **drill** with a single writer.
3. **MIG-701** — reading parity window after the drill (fixture/staging).
4. **MIG-702** — Supabase shutdown **allowed after** Dornhain host proof + restore evidence (owner: no important non-Dornhain user data).

## Hard content requirement (non-negotiable)

After cutover drill / host import, the following **must** be present and intact on the host:

- Dornhain **world**
- Dornhain **adventure / saga**
- Dornhain **characters** (incl. pregens)
- Default **items**, **monsters**, **NPCs** bound to Dornhain

Anything else (other user accounts / disposable tenant data) may be omitted.

## Explicitly not approved by silence

- Wiping or abandoning Dornhain content
- Claiming RELEASE APPROVED without hashed completionEvidence
- Skipping Freeze/Delta/Rollback drills
- Shipping a desktop binary without GATE-05 PoC evidence

## Binding paths

- Cutover ops: `docs/ops/cutover/**`
- Host migration code: `server/src/migration/**`
- Approvals register: `.qa/evidence/stack-migration-prep/architecture-approvals.json`
