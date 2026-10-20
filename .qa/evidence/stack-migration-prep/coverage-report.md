# Phase 9 — Coverage & Quality of Issue Drafts

## Counts

| Metric | Value |
| --- | --- |
| Inventoried SQL migrations | 106 |
| Inventoried Edge function dirs | 24 (+ `_shared`) |
| Inventoried frontend `.rpc` names | 55 |
| Inventoried infra areas | 13 |
| SQL CREATE TABLE (approx) | 56 |
| RLS/POLICY markers (approx) | 227 |
| SECURITY DEFINER markers (approx) | 181 |
| CREATE FUNCTION markers (approx) | 246 |
| Matrix mapped rows | 109+ (categories + per-RPC + per-edge + per-infra) |
| Draft issues total | 72 |
| READY (agent-executable without arch choice) | 2 (`MIG-001`, `MIG-002`) |
| BLOCKED / needs-design | 70 |
| Gate / open architecture decisions | 5 (`GATE-01`…`GATE-05`) |
| GitHub migration issues published | **0** (hard stop) |

## Automated draft checks (prep)

- [x] No cycle in `dependsOn` (topoOrder length == issues)  
- [x] Every issue has before/after/behavior/scope/acceptance  
- [x] Acceptance arrays ≤ 5  
- [x] GATE issues not labeled `agent-ready`  
- [x] Supabase shutdown only in late cutover issues with freigabe language  
- [x] Domains forbidden from ORM imports stated in design lock  
- [x] Environments covered: browser dev, native local host, Docker VPS, later Tauri  

## Remaining human decisions (required before runner)

1. GATE-01 ORM/policy stack  
2. GATE-02 Auth/session + Colyseus handshake  
3. GATE-03 HTTP boundary  
4. GATE-04 SQLite concurrency/revision proof  
5. GATE-05 Desktop packaging (later)  
6. #770 isolated CI DB design for Atlas live E2E  
7. Freigabe to publish draft issues to GitHub  
8. Freigabe to start migration runner  

## Next concrete action (no uncontrolled migration)

1. Review/approve this prep PR.  
2. Decide #770 CI isolated-DB approach.  
3. Run GATE PoCs (or explicitly schedule them).  
4. Only then: publish GitHub issues + start runner.  
