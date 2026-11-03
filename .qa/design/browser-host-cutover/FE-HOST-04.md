<!-- migration-contract:v2 localId=FE-HOST-04 -->
# FE-HOST-04: Saga / project membership / provision host HTTP + FE cutover

## Type

feature

## Intent

Saga-Overview, Membership, Join-by-code, ensure/provision über Host projectInfra; FE project/saga services umbiegen.

## Goal

Saga-Overview, Membership, Join-by-code, ensure/provision über Host projectInfra; FE project/saga services umbiegen.

## Non-Goals

- Desktop / Tauri packaging (GATE-05 / #788)
- Unapproved framework substitution
- Production wipe of unrelated tenant data without owner sign-off

## Context

- Epic: Browser Host Cutover (product FE→Host HTTP after MIG ports DONE).
- Architecture: `docs/architecture/host-modular-monolith.md`, `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Dual-path flag: `VITE_SAGATREE_HOST_LIBRARY=1` + `VITE_SAGATREE_HOST_AUTH_URL`.
- Host ports already exist; this slice mounts product HTTP and flips FE facades.

## Scope

In:
- HTTP for projectInfra ops (join, permissions, overview, ensure starter)
- FE: `project-service` mutations, `project-member-service`, `saga-overview-service`, `saga-permission-service`, `saga-definition-service` reads/writes needed for Library→play

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
- Wenn: Open Dornhain saga overview and join-by-code path on host
- Dann: Success against SQLite; no Supabase for covered ops.

### Fall 2

- Gegeben: Forged / unauthenticated caller
- Wenn: Membership mutation as non-member
- Dann: DENY; no leakage.

### Fall 3

- Gegeben: Missing resource
- Wenn: Unknown public id returns not-found
- Dann: Stable empty/not-found German UX.

## Required Tests

1. Covered happy-path ops succeed against host SQLite without Supabase.
2. Unauthorized / forged identity is DENY.
3. Empty/missing resource produces stable empty/not-found UX.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).
5. `npm run test-gate` green for touched architecture boundaries.

## Acceptance

- [ ] Covered happy-path ops succeed against host SQLite without Supabase.
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

- Depends on #1093 (FE-HOST-01)

Status: **open**

## Runner

- Feature slug: `browser-host-FE-HOST-04`
- Design: `.qa/design/browser-host-cutover/FE-HOST-04.md`
- Labels: `P1`, `agent-ready`, `feature`, `architecture migration`
- Milestone: Browser Host Cutover
- Checks: `npm run test-gate`
