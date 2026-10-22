# Stack migration runner handoff (Epic #773)

`paused: false`  
Updated: 2026-10-22 (post MERGE-889 ALLOW-KNOWN-RED → `5104e262`; next **#791 MIG-012**)

## Freigaben (human)

| Decision | Status |
| --- | --- |
| MERGE-860 | **ALLOW-KNOWN-RED** for head `651f0e1e…` only → `78c5a58e` |
| MERGE-884 | **ALLOW-KNOWN-RED** for head `6fc31eb8…` only → `cf4e90ea` (does not transfer) |
| MERGE-889 | **ALLOW-KNOWN-RED** for head `8f0c77e8…` only → `5104e262` (does not transfer) — [MERGE-889-ALLOW-KNOWN-RED.md](MERGE-889-ALLOW-KNOWN-RED.md) |
| GATE-01 / #784 | **APPROVED — Drizzle + SagaTree Policy Service** |
| GATE-04 / #787 | **APPROVED — SQLite Single Writer (implementation freigabe only)** |
| GATE-02, GATE-03, GATE-05 | **NOT APPROVED** |
| Production cutover / capacity SLOs | **NOT APPROVED** / capacity **NOT RUN** → [MIG-700/#849](https://github.com/iamthamanic/sagatree/issues/849) |

## Closed after merge

| Issue | Status |
| --- | --- |
| #782 MIG-001 | **CLOSED** |
| #783 MIG-002 | **CLOSED** |
| #784 GATE-01 | **CLOSED** |
| #787 GATE-04 | **CLOSED** |
| #789 MIG-010 | **CLOSED** |
| #790 MIG-011 | **CLOSED** (PR #887 + follow-up #889 → `5104e262`) |
| #792 MIG-013 | **CLOSED** (PR #888 → `19c33a75`) |

## Next

| Item | Status |
| --- | --- |
| #791 MIG-012 | **NEXT** — Repository port pattern + first world read adapter (after MIG-013 on main) |
| #849 MIG-700 | OPEN — capacity proof remains NOT RUN |

## Continuation

1. `@ecc-runner-loop`: implement **#791 MIG-012** from current `main` (`5104e262`).
2. Then remaining wave-1 / Epic #773 issues in topo order.
3. Never reuse MERGE-889 known-red freigabe on later PRs.

## Safety

Host modular monolith remains binding. No GATE-02/03/05 freigabe. No prod cutover.
