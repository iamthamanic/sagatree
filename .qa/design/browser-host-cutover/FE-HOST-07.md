<!-- migration-contract:v2 localId=FE-HOST-07 -->
# FE-HOST-07: Product auth path — Better Auth session replaces GoTrue/Local-Admin JWT dependency

## Type

feature

## Intent

Browser-Sign-in über Host Better Auth Cookies; Local-Admin/GoTrue JWT nicht mehr nötig für Library/Session/World.

## Goal

Browser-Sign-in über Host Better Auth Cookies; Local-Admin/GoTrue JWT nicht mehr nötig für Library/Session/World.

## Non-Goals

- Desktop / Tauri packaging (GATE-05 / #788)
- Unapproved framework substitution
- Production wipe of unrelated tenant data without owner sign-off

## Context

- Epic: Browser Host Cutover (product FE→Host HTTP after MIG ports DONE).
- Architecture: `docs/architecture/host-modular-monolith.md`, `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Dual-path flag: `VITE_SAGATREE_HOST_LIBRARY=1` + `VITE_SAGATREE_HOST_AUTH_URL`.

## Scope

In:
- Product sign-in/sign-out UX against host auth
- Remove API-Anmeldung-fehlt / GoTrue reconnect gates when host library enabled
- Keep solo loopback only for DEV without account; remote mode requires cookie session

Out:
- GATE-05 desktop packaging
- unrelated UX redesign

## User Journey

1. Solo/host browser uses host HTTP for this slice.
2. Covered UI journeys work without GoTrue/PostgREST.
3. DENY paths remain fail-closed.

## Runtime

| Axis | This slice |
| --- | --- |
| Local / Solo | Node host + SQLite; Vite on :3004 |
| VPS / Remote Browser | Same host; cookie sessions |
| Desktop (später) | Deferred to GATE-05 |

## Security & Data

- Actor from session / solo loopback only — never client-supplied owner ids.
- Owner-scoped data stays owner-scoped; list all severities including Low/Info.

## Edge Cases

### Fall 1

- Gegeben: Solo host + host library flag
- Wenn: Signed-in cookie session authorizes library + session ops
- Dann: Success against SQLite/host assets; no Supabase for covered ops.

### Fall 2

- Gegeben: Forged / unauthenticated caller
- Wenn: Expired/forged cookie is UNAUTHENTICATED
- Dann: DENY; no leakage.

### Fall 3

- Gegeben: Missing resource
- Wenn: Local Admin without host flag still documented; with host flag no GoTrue required
- Dann: Stable empty/not-found German UX.

## Required Tests

1. Covered happy-path ops succeed against host without Supabase.
2. Unauthorized / forged identity is DENY.
3. Empty/missing resource produces stable empty/not-found UX.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).
5. `npm run test-gate` green for touched architecture boundaries.

## Acceptance

- [ ] Covered happy-path ops succeed against host without Supabase.
- [ ] Unauthorized / forged identity is DENY.
- [ ] Empty/missing resource produces stable empty/not-found UX.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [ ] `npm run test-gate` green for touched architecture boundaries.

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Product HTTP + FE dual-path for this slice PASS under host flag. |
| **Acceptance tier** | `feature-integration` |
| **Deferred integration** | Full Supabase removal in FE-HOST-09 |
| **FEATURE VERIFIED** | Browser smoke without Supabase for this slice |
| **RELEASE APPROVED** | Explicit human approval only |

## Blockers

- Depends on #1094 (FE-HOST-02)
- Depends on #1095 (FE-HOST-03)
- Depends on #1096 (FE-HOST-04)

Status: **done**

## Runner

- Feature slug: `browser-host-FE-HOST-07`
- Design: `.qa/design/browser-host-cutover/FE-HOST-07.md`
- Labels: `P1`, `agent-ready`, `feature`, `architecture migration`
- Milestone: Browser Host Cutover
- Checks: `npm run test-gate`
