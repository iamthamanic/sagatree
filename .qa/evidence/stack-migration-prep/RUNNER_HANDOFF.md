# Stack migration runner handoff (Epic #773)

`paused: false`  
Updated: 2026-10-22 (post MERGE-889 → `5104e262`; MIG-012/#791 → `10516eee`)

## Freigaben (human)

| Decision | Status |
| --- | --- |
| MERGE-860 | **ALLOW-KNOWN-RED** for head `651f0e1e…` only → `78c5a58e` |
| MERGE-884 | **ALLOW-KNOWN-RED** for head `6fc31eb8…` only → `cf4e90ea` (does not transfer) |
| MERGE-889 | **ALLOW-KNOWN-RED** for head `8f0c77e8…` only → `5104e262` (does not transfer) — [MERGE-889-ALLOW-KNOWN-RED.md](MERGE-889-ALLOW-KNOWN-RED.md) |
| GATE-01 / #784 | **APPROVED — Drizzle + SagaTree Policy Service** |
| GATE-04 / #787 | **APPROVED — SQLite Single Writer (implementation freigabe only)** |
| GATE-02, GATE-03, GATE-05 | **NOT APPROVED** |
| Production cutover / capacity SLOs | **NOT APPROVED** / capacity **NOT RUN** → #849 |

## Closed after merge

| Issue | Merge |
| --- | --- |
| #789 MIG-010 | `cf4e90ea` |
| #790 MIG-011 (+ #889 follow-up) | `5104e262` |
| #792 MIG-013 | `19c33a75` |
| #791 MIG-012 | `10516eee` (PR #893 tip `ad1922b7`) |

## Next (queue)

| Item | Status |
| --- | --- |
| #793 MIG-014 | **agent-blocked** — Better Auth host accounts |
| #794 MIG-015 | **agent-blocked** — Solo local identity |
| #841 MIG-500 | **agent-blocked** — Local protected assets |
| #849 MIG-700 | OPEN — capacity NOT RUN |

## Safety

No GATE-02/03/05 freigabe. No prod cutover. MERGE-* known-red freigaben do not transfer.
