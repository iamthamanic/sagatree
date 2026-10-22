# Stack migration runner handoff (Epic #773)

`paused: false`  
Updated: 2026-10-23 (post MIG-503/#844 → `ba8ac523`; GATE-02 still NOT APPROVED)

## PR backlog

**Cleared.** No open PRs on `main`.

| Closed / superseded | Notes |
| --- | --- |
| #881 Phosphor | Merged or closed per queue |
| Dependabot | Closed / superseded |
| #896 | Closed (three-item batch) |

## Freigaben (human)

| Decision | Status |
| --- | --- |
| MERGE-860 | **ALLOW-KNOWN-RED** for head `651f0e1e…` only → `78c5a58e` |
| MERGE-884 | **ALLOW-KNOWN-RED** for head `6fc31eb8…` only → `cf4e90ea` (does not transfer) |
| MERGE-889 | **ALLOW-KNOWN-RED** for head `8f0c77e8…` only → `5104e262` (does not transfer) — [MERGE-889-ALLOW-KNOWN-RED.md](MERGE-889-ALLOW-KNOWN-RED.md) |
| GATE-01 / #784 | **APPROVED — Drizzle + SagaTree Policy Service** |
| GATE-04 / #787 | **APPROVED — SQLite Single Writer (implementation freigabe only)** |
| GATE-02 / #785 | **NOT APPROVED** — decision package **published** → [GATE-02-decision-package.md](GATE-02-decision-package.md) (PR #897); human freigabe still required |
| GATE-03, GATE-05 | **NOT APPROVED** |
| Production cutover / capacity SLOs | **NOT APPROVED** / capacity **NOT RUN** → #849 |

## Closed after merge

| Issue | Merge |
| --- | --- |
| #789 MIG-010 | `cf4e90ea` |
| #790 MIG-011 (+ #889 follow-up) | `5104e262` |
| #792 MIG-013 | `19c33a75` |
| #791 MIG-012 | `10516eee` (PR #893 tip `ad1922b7`) |
| #841 MIG-500 | `4eb2ec00` (PR #898) |
| #844 MIG-503 | `ba8ac523` (PR #901) |

## Next (options — pick one)

| Option | Item | Status |
| --- | --- | --- |
| **A — gate** | GATE-02 / #785 human freigabe | Package ready; PoC FAIL on credential isolation until human comment + `architecture-approvals.json` + ADR-ST-06 |
| **B — deps** | #844 MIG-503 | **CLOSED** → `ba8ac523` (PR #901) |
| **C — blocked auth** | #793 MIG-014, #794 MIG-015 | **agent-blocked** until GATE-02 APPROVED |
| **D — capacity** | #849 MIG-700 | OPEN — capacity NOT RUN |

**Recommendation:** `paused: false`. GATE-02 remains human freigabe only — do **not** approve. Pick next dependency-clear non-auth work (e.g. other wave-2 items not blocked on GATE-02) or wait on **A**.

## Safety

No GATE-02/03/05 freigabe. No prod cutover. MERGE-* known-red freigaben do not transfer. Publishing the GATE-02 decision package does not approve the gate.
