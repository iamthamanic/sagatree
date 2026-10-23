# Composition Gate — mig-014-015-security-hardening

- HEAD_SHA: edff64976462dbb81811878ae9a879f4531c8693
- BASE_SHA: 721f53e3ba42b94e7292ce2f8bd24e5970828e24
- Date: 2026-10-23
- Verdict: CLEAR

## Event

Remote cookie sessions and solo-owned mutations stay correctly bounded across HTTP/WS hops; public binds require an explicit auth base URL; Origin allowlisting + credentialed CORS admit only configured frontends; remote solo-identity mutations (`/v1/ping`) never run without a cookie session; account-link durability survives crash via atomic rename. Merge policy is machine-enforced so unresolved P1/P2 review findings cannot be squash-merged unnoticed.

## Hop chain

1. Producer: `loadConfig` → auth baseURL + normalized `trustedOrigins`
2. HTTP entry (`route-registry`) → credentialed CORS → Better Auth / session resolve → policy → mutation
3. WS entry (`ws-session`) → same session resolve → identity frame → protocol close frame
4. Solo link store (`account-link`) → temp+fsync+rename → policy `linkedSoloActorIds`
5. Merge gate: `ecc-merge-gate-check` reads PR review threads + required checks before merge

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors / cross-origin FE | FE origin in allowlist → whoami + ACAO exact | mig-014 trusted-host block | pass |
| Invalid/missing | 0.0.0.0 without AUTH_BASE_URL; evil Origin; unauth remote ping | AUTH_MISCONFIG / 403 / 401; no mutation | pass |
| Two consumers / crash | Link write atomic; ping-log only after auth | mig-015 leftovers=0; ping-log gated | pass |
| Merge gate negative | Open P1 on #909 → gate FAIL; resolved #912 → PASS | ecc-merge-gate-check | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

Does not greenwash ambient CI (Atlas E2E, PG baseline). Does not approve GATE-05 / cutover. MIG-020/#912 remains a separate open PR.
