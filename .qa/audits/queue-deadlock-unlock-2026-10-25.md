# Queue deadlock unlock — 2026-10-25

Root cause: `scripts/stack-migration-issue-rendering.mjs` copied inventory `legacyDefects` into `verification.blockers`, forcing `blocked` even when predecessors were DONE.

Fix: legacy defects → `verification.requiredRegressions` (mandatory acceptance/negative regressions). True execution blockers remain: GATE-05, ATLAS CI not-passing, `source-blocked`, explicit `executionLock`.

- Generated: 2026-10-25T08:27:23.583195+00:00
- Counts: DONE=25 READY=21 WAITING=40 BLOCKED=4

## READY (proven executable — deps DONE + source-verified + no execution blockers)

- RPC-SAGA-PROVISION #873 — requiredRegressions=1; blockers=0; source=source-verified
- RPC-SESSION-RUNTIME #867 — requiredRegressions=3; blockers=0; source=source-verified
- RPC-WORLD-MAP #861 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-402 #818 — requiredRegressions=2; blockers=0; source=source-verified
- MIG-403 #819 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-406 #822 — requiredRegressions=2; blockers=0; source=source-verified
- MIG-407 #823 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-408 #824 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-411 #827 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-412 #828 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-413 #829 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-415 #831 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-416 #832 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-417 #833 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-418 #834 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-419 #835 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-420 #836 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-422 #838 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-423 #839 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-424 #840 — requiredRegressions=1; blockers=0; source=source-verified
- MIG-312 #811 — requiredRegressions=1; blockers=0; source=source-verified

## BLOCKED (remain — real locks)

- ATLAS-LIVE-E2E #770 — source=specified; blockers=['Atlas live product E2E CI remains not-passing on the isolated baseline workflow; known red must be fixed with real evidence before READY/DONE (do not skip or greenwash).']; requiredRegressions=0
- RPC-MARKETPLACE-COUNT #878 — source=source-blocked; blockers=[]; requiredRegressions=2
- MIG-353 #816 — source=source-blocked; blockers=[]; requiredRegressions=0
- GATE-05 #788 — source=specified; blockers=[]; requiredRegressions=0

## WAITING (deps incomplete — not artificially blocked)

- RPC-PROJECT-MEMBERSHIP #874 — missing ['RPC-SAGA-PROVISION']
- RPC-SAGA-GOVERNANCE #875 — missing ['RPC-PROJECT-MEMBERSHIP']
- RPC-SESSION-LIFECYCLE #868 — missing ['RPC-SESSION-RUNTIME']
- RPC-NPC-INSTANCES #877 — missing ['RPC-SESSION-LIFECYCLE']
- RPC-SESSION-ACCESS #869 — missing ['RPC-SESSION-LIFECYCLE']
- RPC-SESSION-RECAP #870 — missing ['RPC-SESSION-LIFECYCLE']
- MIG-351 #814 — missing ['RPC-SESSION-RUNTIME', 'RPC-SESSION-LIFECYCLE', 'RPC-SESSION-ACCESS', 'RPC-SESSION-RECAP']
- RPC-SAGA-PROJECTIONS #876 — missing ['RPC-SAGA-GOVERNANCE', 'RPC-SESSION-RECAP']
- MIG-352 #815 — missing ['RPC-SAGA-PROVISION', 'RPC-PROJECT-MEMBERSHIP', 'RPC-SAGA-GOVERNANCE', 'RPC-SAGA-PROJECTIONS']
- RPC-ATLAS-MAPS #862 — missing ['RPC-WORLD-MAP']
- RPC-WORLD-PLACES #863 — missing ['RPC-ATLAS-MAPS']
- RPC-WORLD-CREATE #864 — missing ['RPC-WORLD-PLACES']
- RPC-WORLD-RESTRUCTURE #865 — missing ['RPC-WORLD-CREATE']
- RPC-WORLD-DESTRUCTIVE #866 — missing ['RPC-WORLD-RESTRUCTURE']
- MIG-350 #813 — missing ['RPC-WORLD-MAP', 'RPC-ATLAS-MAPS', 'RPC-WORLD-PLACES', 'RPC-WORLD-CREATE', 'RPC-WORLD-RESTRUCTURE', 'RPC-WORLD-DESTRUCTIVE']
- MIG-401 #817 — missing ['MIG-402']
- MIG-404 #820 — missing ['MIG-402']
- MIG-405 #821 — missing ['MIG-402']
- MIG-409 #825 — missing ['MIG-402']
- MIG-410 #826 — missing ['MIG-402']
- MIG-421 #837 — missing ['MIG-402', 'RPC-SESSION-RECAP']
- MIG-414 #830 — missing ['MIG-402', 'MIG-404', 'MIG-405', 'MIG-409', 'MIG-410', 'MIG-412', 'MIG-420', 'MIG-421']
- MIG-301 #800 — missing ['MIG-402']
- MIG-302 #801 — missing ['MIG-404', 'MIG-405']
- MIG-303 #802 — missing ['MIG-409', 'MIG-410']
- MIG-304 #803 — missing ['MIG-412']
- MIG-305 #804 — missing ['RPC-MARKETPLACE-COUNT']
- MIG-307 #806 — missing ['RPC-NPC-INSTANCES']
- MIG-308 #807 — missing ['RPC-SESSION-LIFECYCLE', 'RPC-SAGA-PROVISION', 'RPC-SAGA-GOVERNANCE', 'RPC-SAGA-PROJECTIONS', 'RPC-PROJECT-MEMBERSHIP']
- MIG-310 #809 — missing ['RPC-SAGA-PROVISION', 'RPC-SAGA-PROJECTIONS']
- MIG-311 #810 — missing ['RPC-SESSION-RUNTIME', 'RPC-SESSION-LIFECYCLE', 'RPC-SESSION-ACCESS', 'RPC-SESSION-RECAP', 'MIG-420', 'MIG-421']
- MIG-313 #812 — missing ['RPC-WORLD-DESTRUCTIVE', 'RPC-WORLD-CREATE', 'RPC-WORLD-RESTRUCTURE', 'RPC-ATLAS-MAPS', 'RPC-WORLD-MAP', 'RPC-WORLD-PLACES']
- MIG-600 #845 — missing ['MIG-353', 'MIG-351', 'MIG-352', 'MIG-350', 'MIG-402', 'MIG-401', 'MIG-403', 'MIG-404']…
- MIG-601 #846 — missing ['MIG-414']
- MIG-602 #847 — missing ['MIG-600', 'MIG-601', 'ATLAS-LIVE-E2E', 'MIG-353', 'MIG-351', 'MIG-352', 'MIG-350', 'MIG-402']…
- MIG-603 #848 — missing ['MIG-601']
- MIG-700 #849 — missing ['ATLAS-LIVE-E2E', 'MIG-353', 'MIG-351', 'MIG-352', 'MIG-350', 'MIG-402', 'MIG-401', 'MIG-403']…
- MIG-701 #850 — missing ['MIG-700']
- MIG-702 #851 — missing ['MIG-700', 'MIG-701', 'ATLAS-LIVE-E2E', 'MIG-603']
- MIG-703 #852 — missing ['GATE-05', 'MIG-602', 'MIG-603']

## Human hard stops (not auto)

- GATE-05 / Desktop release (#788)
- Production cutover (MIG-700+)
- Supabase shutdown (MIG-702)
- ATLAS-LIVE-E2E until isolated CI green (#770)
- Source-blocked contracts (RPC-MARKETPLACE-COUNT #878, MIG-353 #816) until source verification evidence exists

## Quality-recovery queue (before normal migration)

- #938 MIG-501 upload finalize/resume idempotency
- #939 MIG-501 maxBytes bypass hardening
- #940 MIG-501 completion-evidence validation

No security bypass. No invented PASS evidence. Labels synced only for tickets whose intake status changed under the dependency + source rules above.
