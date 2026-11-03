<!-- migration-contract:v2 localId=FE-HOST-08 -->
# FE-HOST-08: Remaining facades — marketplace, rulesets, lore, recap, user-profile host cutover

## Type

feature

## Intent

Restliche Supabase-Facades (Marketplace, Rulesets, Lore, Recap, User-Profile) auf Host-HTTP dual-path umbiegen oder bewusst host-only stubs mit klarer DENY/empty Semantik.

## Goal

Restliche Supabase-Facades (Marketplace, Rulesets, Lore, Recap, User-Profile) auf Host-HTTP dual-path umbiegen oder bewusst host-only stubs mit klarer DENY/empty Semantik.

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
- FE services still on Supabase outside prior slices
- Prefer existing host ports; quarantine PUBLIC_ACTIVATION flips only with HTTP mount + FE wire
- Document any intentionally deferred surface as SKIPPED with owner note in acceptance run

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
- Wenn: Primary remaining facades used from Library/Dashboard/Session work without Supabase
- Dann: Success against SQLite/host assets; no Supabase for covered ops.

### Fall 2

- Gegeben: Forged / unauthenticated caller
- Wenn: Cross-owner marketplace/profile mutations DENY
- Dann: DENY; no leakage.

### Fall 3

- Gegeben: Missing resource
- Wenn: Unsupported op returns explicit German unavailable error (not hang)
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

- Depends on #1097 (FE-HOST-05)
- Depends on #1098 (FE-HOST-06)

Status: **open**

## Runner

- Feature slug: `browser-host-FE-HOST-08`
- Design: `.qa/design/browser-host-cutover/FE-HOST-08.md`
- Labels: `P1`, `agent-ready`, `feature`, `architecture migration`
- Milestone: Browser Host Cutover
- Checks: `npm run test-gate`

