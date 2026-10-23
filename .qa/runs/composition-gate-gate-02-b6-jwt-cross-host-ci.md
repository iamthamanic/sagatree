# Composition Gate — gate-02-b6-jwt-cross-host-ci (#785 / PR #905 P1 remediaiton)

- HEAD_SHA: d39121b74185a74ca8985da5d91175b482029ff3
- BASE_SHA: b1374d3b89ae316772a213e3fd15bb5f0cf7d1d8
- Date: 2026-10-23
- Verdict: CLEAR

## Event

GATE-02 B-6 remediaiton: Variant B cross-host isolation uses a second independently initialized `authProfile: 'jwt'` host (`jwt2`) plus foreign JWKS negative control so rejection proves JWT/JWKS/issuer/session isolation — not cookie-profile Bearer denial. CI pins GATE-02/03 job to `ubuntu-24.04` for Playwright 1.55.1 Chromium. Architecture freigabe remains NOT APPROVED.

## Hop chain

1. Producer: JWT host (`jwt`) mints EdDSA JWT for player1; second jwt host (`jwt2`) has own secret/JWKS/session store
2. `check.mjs` B-6 → foreign JWKS `jwtVerify` rejects local JWT; peer jwt2 whoami accepts own JWT; foreign credential HTTP/WS → UNAUTHENTICATED; wrong Origin → ORIGIN_DENIED
3. Evidence → `isolationMode: "jwt-to-jwt"`, `foreignJwksRejectsLocalJwt`, `rejectionNotFromCookieProfileBearerDeny`
4. Consumer: decision package / ADR-ST-06 / CI workflow still NOT APPROVED; no architecture-approvals.json APPROVED

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Two jwt hosts isolate credentials; cookie A-6 stays cookie↔cookie | jwt + jwt2 boot; A-6 vs hono; B-6 jwt-to-jwt | pass |
| Invalid/missing | Shared JWKS/trust would fail negative control | foreignJwksRejectsLocalJwt assert.rejects | pass |
| Two consumers / crash | CI Chromium install must run on ubuntu-24.04 | workflow `runs-on: ubuntu-24.04`; no skip fallback | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

Does not set GATE-02 APPROVED. Does not edit architecture-approvals.json to APPROVED. Does not close human freigabe / Variant A decision on #785. Does not known-green freigabe ambient reds (GATE-01 audit, PG baseline, Atlas).
