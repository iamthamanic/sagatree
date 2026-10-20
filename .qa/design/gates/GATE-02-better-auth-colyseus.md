# GATE-02 — Better Auth + Colyseus authentication

> **Status:** SPEC only — not APPROVED  
> **GitHub:** #785 · Prep criteria: #776  
> **Blocks:** MIG-014, MIG-015, MIG-021, MIG-023

## Variants

| ID | Approach |
| --- | --- |
| A | Better Auth **session cookies** (httpOnly) + Colyseus `onAuth` validates session via shared secret/store |
| B | Better Auth issues **bearer access token**; Colyseus `onAuth` validates JWT/signature |

## Reproducible setup

1. `server/poc/gate-02/` with Better Auth email/password (test only).  
2. Colyseus room `SessionRoom` stub.  
3. Identities: Host admin, Player, revoked session user.  
4. Flows: login → HTTP whoami → WS join → revoke → reconnect attempt → role-specific join (GM vs player seat).

## Metrics / PASS criteria

| # | Test | PASS |
| --- | --- | --- |
| 1 | Login sets credentials not readable by JS (A) or stores token securely (B) | Documented threat model |
| 2 | WS join without auth | Rejected |
| 3 | WS join after **revoke/logout** | Rejected within ≤2s |
| 4 | Reconnect with valid session | Restores room seat; no privilege escalation |
| 5 | Player token cannot join as GM seat | Deny |
| 6 | Cross-host session cookie/token on wrong origin | Deny |
| 7 | Solo local identity path cannot bind to `0.0.0.0` public without auth | Fail closed |

## Negative tests

- Expired session  
- Tampered token/cookie  
- Seat claim for another `characterId`  

## Decision criteria

1. Revoke/reconnect (#3–4) pass.  
2. Role-specific join (#5) pass.  
3. Browser + future Tauri feasibility notes.  
4. CSRF story for cookie variant documented if A chosen.

## On APPROVED

ADR-ST-06; unblock MIG-014/015/021/023.

## Explicit non-decision

No agent APPROVED stamp.
