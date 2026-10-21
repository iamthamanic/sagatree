# Stack migration runner handoff (Epic #773)

`paused: false`  
Updated: 2026-10-21 (post MERGE-884 confirm + GATE-04 published + MIG-011/#887 merged; follow-up #889 open)

## Freigaben (human)

| Decision | Status |
| --- | --- |
| MERGE-860 | **ALLOW-KNOWN-RED** for head `651f0e1e…` only → `78c5a58e` |
| MERGE-884 | **ALLOW-KNOWN-RED** for head `6fc31eb8…` only → `cf4e90ea` (does not transfer) |
| GATE-01 / #784 | **APPROVED — Drizzle + SagaTree Policy Service** ([comment](https://github.com/iamthamanic/sagatree/issues/784#issuecomment-6317688552), [ADR-ST-05](../../docs/architecture/ADR-ST-05-gate-01-drizzle-policy.md)) |
| GATE-04 / #787 | **APPROVED — SQLite Single Writer (implementation freigabe only)** ([comment](https://github.com/iamthamanic/sagatree/issues/787#issuecomment-6321569847), [ADR-ST-08](../../docs/architecture/ADR-ST-08-gate-04-sqlite-single-writer.md), registry + capacity NOT RUN) |
| GATE-02, GATE-03, GATE-05 | **NOT APPROVED** |
| Production cutover / capacity SLOs | **NOT APPROVED** / capacity **NOT RUN** → [MIG-700/#849](https://github.com/iamthamanic/sagatree/issues/849), [GATE-04-CAPACITY-NOT-RUN.md](GATE-04-CAPACITY-NOT-RUN.md) |

## Closed after merge

| Issue | Status |
| --- | --- |
| #782 MIG-001 | **CLOSED** |
| #783 MIG-002 | **CLOSED** |
| #784 GATE-01 | **CLOSED** |
| #787 GATE-04 | **CLOSED** (implementation freigabe published via #886) |
| #789 MIG-010 | **CLOSED** (`cf4e90ea` / approved head `6fc31eb8`) |
| #790 MIG-011 | **CLOSED** (PR #887 → `87bafeac`) |

## Open / in flight

| Item | Status |
| --- | --- |
| PR [#889](https://github.com/iamthamanic/sagatree/pull/889) | Follow-up for #887 Codex P1 (stale lock + duplicate versions + Node `>=22.13`). Head `ba175e28`. **Needs human ALLOW-KNOWN-RED or green Quality Gates before merge** (MERGE-884 freigabe does not transfer). |
| #792 MIG-013 | `agent-in-progress` — next executable wave-1 issue |
| #791 MIG-012 | blocked on #792 |
| #849 MIG-700 | OPEN — capacity proof remains NOT RUN |

## Continuation

1. Human: merge policy for **PR #889** (ALLOW-KNOWN-RED for `ba175e28` only, or wait for green).
2. Continue **#792 MIG-013** under `@ecc-runner-loop`.
3. Then #791 / #793 / #794 in topo order as blockers clear.

## Safety

Host modular monolith remains binding. No GATE-02/03/05 freigabe. No prod cutover. GATE-04 does not invent capacity SLOs.
