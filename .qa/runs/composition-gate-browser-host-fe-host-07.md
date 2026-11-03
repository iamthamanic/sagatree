# Composition Gate — browser-host-fe-host-07 (#1099)

- HEAD_SHA: d88b37cdf3624e825624df605baae5e0fbc8cbc1
- BASE_SHA: adda6c230ac7c5a6c7796a6daf27973b6c198c0e
- Date: 2026-11-03
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: #1100–#1101; full GoTrue removal

## Event

With `VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL, LoginScreen sign-in/out
uses Better Auth cookie endpoints; AuthProvider treats host whoami as product
API auth (`hasJwtSession`); Atlas/World skip GoTrue reconnect. Without the
flag, GoTrue/Local Admin paths remain.

## Hop chain

1. **Producer (UI):** LoginScreen → `auth.signIn` / `signOut`
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed `POST /api/auth/sign-in/email` (+ sign-out)
4. **Authorize:** Cookie session → `/api/whoami` actor
5. **Persist:** Better Auth SQLite session (host)
6. **Consumer:** Library/Atlas host HTTP dual-path; no GoTrue JWT required

Cardinality: one session cookie per browser profile. No cross-owner fan-out.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Unauth whoami/library DENY. | 401 fail-closed. | pass |
| Invalid/missing | Bad credentials → error; sign-out clears whoami. | Cookie cleared. | pass |
| Two consumers / crash | Dual-path exclusive. | Flag off → GoTrue; flag on → host. | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Self-test covers host sign-up/whoami/library DENY/sign-out and FE wiring.
Composition hops exclusive under host library flag.
