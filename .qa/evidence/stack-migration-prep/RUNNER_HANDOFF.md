# Stack migration runner handoff (Epic #773)

`paused: false`  
Updated: 2026-10-21 (MERGE-860 ALLOW-KNOWN-RED + GATE-01 APPROVED)

## Freigaben (human)

| Decision | Status |
| --- | --- |
| MERGE-860 | **ALLOW-KNOWN-RED** for head `651f0e1eb1bd484d2ba356f3666be860454c08b8` → merged as `78c5a58e88770bfbe490dfaf98daf249a65ce5a2` |
| GATE-01 / #784 | **APPROVED — Drizzle + SagaTree Policy Service** ([comment](https://github.com/iamthamanic/sagatree/issues/784#issuecomment-6317688552), [ADR-ST-05](../../docs/architecture/ADR-ST-05-gate-01-drizzle-policy.md)) |
| GATE-02..05 | **NOT APPROVED** |
| Production cutover | **NOT APPROVED** |

## Closed after merge

| Issue | Status |
| --- | --- |
| #782 MIG-001 | **CLOSED** (evidence lock; known-red failures preserved) |
| #783 MIG-002 | **CLOSED** (inventory complete; not implementation acceptance) |

## Continuation

1. ~~Freigaben~~ done  
2. ~~Merge #860~~ done (`78c5a58e…`)  
3. ~~Close #782 / #783~~ done  
4. ~~Record GATE-01~~ done (this package)  
5. **Start #789 MIG-010** under `@ecc-runner-loop` (next)

## Safety

Host modular monolith remains binding. No GATE-02..05 freigabe. No prod cutover.
