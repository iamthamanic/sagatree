# Stack migration runner handoff (Epic #773)

`paused: false`  
Updated: 2026-10-21 (MERGE-884 ALLOW-KNOWN-RED + GATE-04 APPROVED implementation freigabe)

## Freigaben (human)

| Decision | Status |
| --- | --- |
| MERGE-860 | **ALLOW-KNOWN-RED** for head `651f0e1e…` only → `78c5a58e` |
| MERGE-884 | **ALLOW-KNOWN-RED** for head `6fc31eb8…` only → `cf4e90ea` (does not transfer) |
| GATE-01 / #784 | **APPROVED — Drizzle + SagaTree Policy Service** ([comment](https://github.com/iamthamanic/sagatree/issues/784#issuecomment-6317688552), [ADR-ST-05](../../docs/architecture/ADR-ST-05-gate-01-drizzle-policy.md)) |
| GATE-04 / #787 | **APPROVED — SQLite Single Writer (implementation freigabe only)** ([comment](https://github.com/iamthamanic/sagatree/issues/787#issuecomment-6321569847), [ADR-ST-08](../../docs/architecture/ADR-ST-08-gate-04-sqlite-single-writer.md)) |
| GATE-02, GATE-03, GATE-05 | **NOT APPROVED** |
| Production cutover / capacity SLOs | **NOT APPROVED** / capacity **NOT RUN** → [MIG-700/#849](https://github.com/iamthamanic/sagatree/issues/849), [GATE-04-CAPACITY-NOT-RUN.md](GATE-04-CAPACITY-NOT-RUN.md) |

## Closed after merge

| Issue | Status |
| --- | --- |
| #782 MIG-001 | **CLOSED** |
| #783 MIG-002 | **CLOSED** |
| #784 GATE-01 | **CLOSED** |
| #789 MIG-010 | **CLOSED** (`cf4e90ea` hardening) |

## Continuation

1. ~~#789 MIG-010~~ done  
2. ~~Record GATE-04~~ done (this package / PR #886 → `00b07b78`)  
3. **#790 MIG-011** in progress — SQLite schema bootstrap + migration runner

## Safety

Host modular monolith remains binding. No GATE-02/03/05 freigabe. No prod cutover. GATE-04 does not invent capacity SLOs.
