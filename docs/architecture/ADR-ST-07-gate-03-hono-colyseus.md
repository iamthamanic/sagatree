# ADR-ST-07 — GATE-03: Hono HTTP + Colyseus Realtime

- **Status:** APPROVED for implementation, not production release
- **Decision date:** 2026-10-23
- **Human source:** [#786 owner decision (delegated transcription)](https://github.com/iamthamanic/sagatree/issues/786#issuecomment-6364773133)
- **Related:** [Owner decision register](migration-owner-decisions-2026-10-23.md), GATE-03 PoC report, GATE-02 / ADR-ST-06, GATE-01 / ADR-ST-05, GATE-04 / ADR-ST-08

## Decision
Use **one Node host process** that mounts **Hono** for typed HTTP commands/queries and **Colyseus** for realtime rooms and WebSocket transport. Both share the same authenticated actor, current Better Auth cookie session, Policy Service and application/use-case operations. Never implement a command twice for HTTP and WS.

## Evidence / qualification
The isolated GATE-03 PoC executed and passed 10/10 local routing, auth parity and overlapping reconnection/HTTP cases; the candidate Hono and minimal Colyseus approaches were measured. This approval is a **product design choice**. It does not assert public TLS, deployed proxies, capacity, distributed rooms, or integrated release readiness. MIG-020 and MIG-021 must provide genuine integrated HTTP/WS/browser tests.

## Binding acceptance
1. Auth and policy parity across transport adapters, including deny by default, current session, actor, host, project membership and GM/Owner separation.
2. Hono has typed command/query DTOs, validated inputs and structured 401/403/409/422 errors; no client-controlled elevated identity.
3. A recoverable HTTP request error does not terminate existing Colyseus rooms; no state mutation occurs for invalid auth, origin or revision.
4. Revision, idempotency and transaction semantics are the same application-use-case contract for both protocols (GATE-04).
5. One Node bootstrap/composition root; common logging/health/metrics and no duplicated business logic.
6. Real browser/Node integration and negative regression canaries required before shipping.

## Non-decisions
No cutover, production deployment, TLS/proxy sign-off, platform performance SLO, or GATE-05 approval.
