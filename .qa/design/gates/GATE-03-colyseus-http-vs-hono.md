# GATE-03 — Colyseus HTTP routes vs Hono API layer

> **Status:** OWNER APPROVED Variant B for implementation (2026-10-23); production qualification NOT RUN  
> **GitHub:** #786 · Prep criteria: #776  
> **Blocks:** MIG-020, MIG-021

## Variants

| ID | Approach |
| --- | --- |
| A | **Single process:** Colyseus + minimal HTTP (health, auth callbacks, asset GET) in same Node process |
| B | **Hono HTTP API** for commands/queries + Colyseus **only** for realtime rooms |

## Reproducible setup

1. `server/poc/gate-03/` implements one command `pingSession` and one query `getSnapshot` plus WS event `session.delta`.  
2. Same Policy Service stub from GATE-01 recommendation (or mock deny/allow).  
3. Load: 1 GM + 2 players concurrent command storm (N=200).

## Metrics / PASS criteria

| # | Test | PASS |
| --- | --- | --- |
| 1 | Authz applied identically on HTTP and WS paths | Same deny reasons |
| 2 | OpenAPI/typed client feasible | Document surface area |
| 3 | p95 command latency under storm | Recorded; no lost ACKs |
| 4 | Failure isolation: HTTP 500 does not drop WS room | Observed |
| 5 | Code size / boundary clarity | Notes for AGENTS.md `server/` layout |

## Negative tests

- WS-only privilege bypass attempting HTTP-forbidden command  
- Unauthenticated health vs authenticated command confusion  

## Decision criteria

1. Single authz middleware story.  
2. Operability (logging, metrics) acceptable.  
3. No dual business-logic implementations.

## On APPROVED

ADR-ST-07; unblock MIG-020/021.

## Decision source

[Owner approval on #786](https://github.com/iamthamanic/sagatree/issues/786#issuecomment-6364773133), delegated transcription. [ADR-ST-07](../../../docs/architecture/ADR-ST-07-gate-03-hono-colyseus.md) is binding for implementation; live HTTPS, product integration and cutover still need evidence. LiveKit remains separate.
