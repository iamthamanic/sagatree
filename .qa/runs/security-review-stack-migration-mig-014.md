# Security review — MIG-014 / #793 Better Auth host accounts

Date: 2026-10-23  
Scope: `server/src/auth/**`, identity ports, host config fail-closed, HTTP/WS session resolve, `src/lib/hostAuthBridge.ts`  
Verdict: **ACCEPT** for implementation merge (not production cutover)

## Findings (all severities)

| Severity | Finding | State |
| --- | --- | --- |
| High | Cookie-A JWT escape via `/api/auth/token` or JS-readable bearers | **Mitigated** — no JWT plugin; hard 404 `JWT_ISSUANCE_DISABLED`; strip bearer fields + `set-auth-token`; Bearer rejected |
| High | Client-chosen GM/owner role elevation | **Mitigated** — Policy Service `session.gm` from SQLite membership; forged body fields ignored |
| Medium | Remote bind without session secret | **Mitigated** — `AUTH_MISCONFIG` fail-closed before ready |
| Medium | Cross-origin / wrong-host cookie use | **Mitigated** — Origin/Host gates on session resolve; WS + HTTP negatives in self-test |
| Medium | Session use after logout/revoke | **Mitigated** — `getSession` + disableCookieCache; HTTP/WS deny; no project-touch write |
| Low | Rate limiting disabled on Better Auth in host profile | Accepted for host migration slice; product abuse limits NOT RUN (document for launch) |
| Low | Minimal `/v1/session-ws` is not full Colyseus seat binding | By design for MIG-014; MIG-021 must bind seats to current session |
| Info | GoTrue remains default frontend auth | No cutover; host bridge opt-in only |
| Info | HTTPS Secure cookie platform proof | Auto-forced when `https://` baseURL; multi-engine/TLS terminate NOT RUN |
| Info | Auth DB separate file `auth.sqlite` | Isolates Better Auth tables from host catalog migrations |

## Secure-by-default checklist (inline)

- SC-01: Cookie-only; JWT mint disabled — PASS
- SC-02: Remote misconfig fail-closed — PASS
- SC-03: Origin/Host binding — PASS
- SC-06: Membership from durable SQLite — PASS
- SC-04/05/07: N/A — not a launch ticket

## Ambient known-red (do not transfer as freigabe)

- Atlas isolated real product journey
- PostgreSQL baseline security/persistence
- GATE-01 / GATE-02+03 isolated candidate workflow reds on some CI heads
