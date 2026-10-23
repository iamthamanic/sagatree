# Composition Gate — gate-02-cookie-jwt-escape (#785 / PR #900 P1 remediaiton)

- HEAD_SHA: 76a9921ced9344fd55298ba891bec0ecaaa08943
- BASE_SHA: efa183af7b4cfd52b4dfc5c4248332f16e5ca3a5
- Date: 2026-10-23
- Verdict: CLEAR

## Event

GATE-02 PoC cookie authProfile hard-denies `/api/auth/token` and unloads the JWT plugin; JWT issuance moves to a separate jwt-profile host. Chromium A-1-browser asserts token endpoint 404 and no JS-readable JWT. Architecture freigabe remains NOT APPROVED.

## Hop chain

1. Producer: Chromium page JS / Node harness → `fetch('/api/auth/token')` or Better Auth handler
2. `server.mjs` `wrapAuthHandler` cookie profile → 404 `JWT_ISSUANCE_DISABLED` (no JWT plugin)
3. Separate jwt-profile host → token mint for Variant B only
4. Consumer: `browser.mjs` / `check.mjs` A-1-browser + criteria matrix → PASS; decision package still NOT APPROVED

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Cookie host and jwt host are separate fixtures; cookie clients cannot mint JWT | Cookie login jwt=null; jwt host issues token; A-1-browser 404 | pass |
| Invalid/missing | Unknown authProfile / token path on cookie host fails closed | Hard 404 JWT_ISSUANCE_DISABLED; no bearer session restore | pass |
| Two consumers / crash | Browser probe and Node Variant B share evidence without cross-profile leak | A rows PASS; B row 1 NOT RUN; report approval NOT APPROVED | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

Does not set GATE-02 APPROVED. Does not edit architecture-approvals.json to APPROVED. Does not close human freigabe on #785.
