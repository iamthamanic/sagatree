# Composition Gate — stack-migration-mig-014 (#793)

- HEAD_SHA: 849fdf409b08bb047c3bbc674d117de16a72ad83
- BASE_SHA: 63de26293337d418860ccf00b5a94a866f0ab32d
- Date: 2026-10-23
- Verdict: CLEAR

## Event

Remote-reachable host accounts authenticate via Better Auth cookie-only sessions (GATE-02 Variant A). HTTP `/api/whoami` and WebSocket `/v1/session-ws` resolve the same server-side Actor from the HttpOnly session cookie. Policy Service membership (not client role/owner claims) gates project mutation canaries. Revoked/cross-origin credentials deny both transports without mutating project data.

## Hop chain

1. Producer: Browser/Node client → Better Auth `/api/auth/*` (cookie Set-Cookie) or ambient cookie on whoami/WS
2. `wrapCookieAuthHandler` strips bearer fields; `/api/auth/token` hard-denies JWT mint
3. `identity.resolveRemoteSession` → `resolveCookieSession` (host/origin/bearer gates + Better Auth `getSession`)
4. Consumer A: HTTP whoami DTO (actorId/kind/email only) / project-touch → `permissions.authorize`
5. Consumer B: WS upgrade → same session resolve → identity frame or 401/403 deny

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Same actor on login, whoami reload, WS probe | mig-014 self-test | pass |
| Invalid/missing | Revoke, cross-origin, Bearer, JWT token path | HTTP+WS deny; no project-touch write | pass |
| Two consumers / crash | HTTP whoami + WS session-ws share authRuntime; host stop tears down authRuntime | both restore same actorId; post-stop whoami/WS deny | pass |
| Claimed elevation | Player forges role=gm / ownerUserId | session.gm deny; mutated=false | pass |
| Misconfig | Remote without secret; JWT allow flag | createHost fails closed | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

Production cutover / Supabase Auth shutdown NOT approved. Full Colyseus product rooms and HTTPS platform Secure-cookie proofs remain later tickets (MIG-015/021+). Ambient CI reds (Atlas E2E, PG baseline security) are out of scope for this freigabe.
